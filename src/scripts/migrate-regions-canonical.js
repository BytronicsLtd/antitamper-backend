/**
 * Canonical-region migration.
 *
 *   node src/scripts/migrate-regions-canonical.js --dry-run
 *   node src/scripts/migrate-regions-canonical.js
 *
 * Reads regions-migration-config.json and:
 *   1. Upserts Region docs (one per `regions[]` entry).
 *   2. Walks `factory_actions[]` and rewrites each Factory.region from
 *      string label to the corresponding Region _id.
 *   3. Rewrites every User.region from string label to ObjectId, using the
 *      "current → target" mapping from the same config.
 *   4. Backfills missing factory_name / factory_location on devices, data
 *      and pdas (from their referenced factory). Does NOT denormalise
 *      region onto child docs — children resolve via factory.region.
 *   5. Renames user.settings.showTestRegions → showTestData (backward read).
 *
 * Idempotent: re-running mutates nothing once converged.
 */

require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const chalk = require('chalk');

const FactoryModel = require('../models/factory');
const RegionModel = require('../models/region.model');
const UserModel = require('../models/user');

const config = require('./regions-migration-config.json');

const DRY = process.argv.includes('--dry-run');
function tag() { return DRY ? chalk.yellow('[dry-run]') : chalk.cyan('[migrate]'); }
function log(...a) { console.log(tag(), ...a); }

async function connect() {
  const { DB_IP, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_RS_NAME } = process.env;
  const uri = `mongodb://${DB_USER}:${DB_PASSWORD}@${DB_IP}:${DB_PORT}/`;
  mongoose.set('strictQuery', false);
  await mongoose.connect(uri, {
    authSource: 'admin',
    replicaSet: DB_RS_NAME,
    dbName: DB_NAME,
    directConnection: true,
    serverSelectionTimeoutMS: 30000,
  });
  console.log(chalk.green('connected to'), `${DB_IP}:${DB_PORT}/${DB_NAME}`);
}

// 1) Upsert Region docs from config.regions[]. Returns Map<code, Region>.
async function upsertRegions() {
  const out = new Map();
  for (const r of config.regions) {
    const existing = await RegionModel.findOne({ name: r.name }).collation({ locale: 'en', strength: 2 });
    if (existing) {
      // Patch missing code/counties/isTest if config has new info
      const patch = {};
      if (existing.code !== r.code) patch.code = r.code;
      if (JSON.stringify(existing.counties || []) !== JSON.stringify(r.counties || [])) patch.counties = r.counties;
      if (existing.isTest !== r.isTest) patch.isTest = r.isTest;
      if (Object.keys(patch).length) {
        if (!DRY) await RegionModel.updateOne({ _id: existing._id }, { $set: patch });
        log('region', chalk.bold(r.name), 'patched', JSON.stringify(patch));
      } else {
        log('region', chalk.gray(r.name), 'unchanged');
      }
      out.set(r.code, await RegionModel.findById(existing._id));
    } else {
      const doc = { name: r.name, code: r.code, counties: r.counties, isTest: r.isTest };
      log('region', chalk.green(r.name), 'creating');
      const created = DRY
        ? { ...doc, _id: new mongoose.Types.ObjectId() }
        : await RegionModel.create(doc);
      out.set(r.code, created);
    }
  }
  return out;
}

// 2) Apply factory_actions[]: set Factory.region to Region._id of target_region_code.
async function migrateFactories(regionsByCode) {
  let touched = 0, unchanged = 0, missing = 0;
  for (const action of config.factory_actions) {
    const target = regionsByCode.get(action.target_region_code);
    if (!target) {
      console.error(chalk.red('  no region for code'), action.target_region_code, 'on factory', action.name);
      missing++;
      continue;
    }
    const factory = await FactoryModel.collection.findOne({ _id: new mongoose.Types.ObjectId(action._id) });
    if (!factory) {
      console.warn(chalk.yellow('  factory not found'), action._id, action.name);
      missing++;
      continue;
    }
    const currentRegion = factory.region;
    const targetId = target._id;
    const alreadyOk = currentRegion && currentRegion.toString && currentRegion.toString() === targetId.toString();
    if (alreadyOk) {
      unchanged++;
      continue;
    }
    if (!DRY) {
      // Bypass mongoose validation: existing docs may temporarily have invalid types.
      await FactoryModel.collection.updateOne(
        { _id: factory._id },
        { $set: { region: targetId } },
      );
    }
    touched++;
    log('factory', chalk.bold(action.name), '→', chalk.cyan(target.name));
  }
  log(chalk.bold('factories'), `touched=${touched} unchanged=${unchanged} missing=${missing}`);
}

// 3) User.region: was a string label, becomes ObjectId.
async function migrateUsers(regionsByCode) {
  // Map old string → Region by code (we created codes "1".."12") or by name.
  const stringToRegion = new Map();
  // Common case: legacy strings looked like "region 1" / "region 12" — pick code from the digit.
  for (const r of regionsByCode.values()) {
    stringToRegion.set(`region ${r.code}`, r);
    stringToRegion.set(`Region ${r.code}`, r);
    stringToRegion.set(r.name, r);
  }
  let touched = 0, unchanged = 0, cleared = 0;
  const users = await UserModel.collection.find({}).toArray();
  for (const u of users) {
    if (u.region == null || u.region === '') {
      // Already null/empty — coerce to null for cleanliness.
      if (u.region === '') {
        if (!DRY) await UserModel.collection.updateOne({ _id: u._id }, { $set: { region: null } });
        cleared++;
      }
      continue;
    }
    if (typeof u.region === 'object') {
      // Already an ObjectId — leave it.
      unchanged++;
      continue;
    }
    const r = stringToRegion.get(u.region);
    if (!r) {
      console.warn(chalk.yellow('  user'), u.email, 'has unknown region', JSON.stringify(u.region), '— clearing');
      if (!DRY) await UserModel.collection.updateOne({ _id: u._id }, { $set: { region: null } });
      cleared++;
      continue;
    }
    if (!DRY) await UserModel.collection.updateOne({ _id: u._id }, { $set: { region: r._id } });
    log('user', u.email, '→', chalk.cyan(r.name));
    touched++;
  }
  log(chalk.bold('users'), `touched=${touched} unchanged=${unchanged} cleared=${cleared}`);
}

// 4) Backfill device/data/pda factory_name + factory_location from their factory ref.
async function backfillFactoryDenormalisation() {
  const factories = await FactoryModel.collection.find({}).toArray();
  const byId = new Map(factories.map(f => [f._id.toString(), f]));

  const collections = ['devices', 'data', 'pdas'];
  for (const c of collections) {
    const coll = mongoose.connection.collection(c);
    let touched = 0, scanned = 0;
    const cursor = coll.find({});
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      scanned++;
      // factory id may be string or ObjectId across the codebase.
      const fid = doc.factory && (doc.factory._bsontype ? doc.factory.toString() : String(doc.factory));
      if (!fid) continue;
      const f = byId.get(fid);
      if (!f) continue;
      const patch = {};
      if (doc.factory_name !== f.name) patch.factory_name = f.name;
      if (doc.factory_location !== f.location) patch.factory_location = f.location;
      if (Object.keys(patch).length) {
        if (!DRY) await coll.updateOne({ _id: doc._id }, { $set: patch });
        touched++;
      }
    }
    log(chalk.bold(c), `scanned=${scanned} touched=${touched}`);
  }
}

// 5) Rename user.settings.showTestRegions → showTestData
async function renameShowTestSetting() {
  const filter = { 'settings.showTestRegions': { $exists: true } };
  const cursor = UserModel.collection.find(filter);
  let touched = 0;
  while (await cursor.hasNext()) {
    const u = await cursor.next();
    const oldVal = u.settings && u.settings.showTestRegions;
    const newVal = u.settings && (u.settings.showTestData ?? oldVal);
    if (!DRY) {
      await UserModel.collection.updateOne(
        { _id: u._id },
        {
          $set: { 'settings.showTestData': !!newVal },
          $unset: { 'settings.showTestRegions': '' },
        },
      );
    }
    touched++;
  }
  log(chalk.bold('settings rename'), `touched=${touched}`);
}

async function main() {
  await connect();
  console.log(chalk.bold(DRY ? '\n*** DRY RUN — no writes ***\n' : '\n*** LIVE RUN — writing ***\n'));

  const regionsByCode = await upsertRegions();
  await migrateFactories(regionsByCode);
  await migrateUsers(regionsByCode);
  await backfillFactoryDenormalisation();
  await renameShowTestSetting();

  console.log(chalk.green('\ndone.'));
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(chalk.red('migration failed:'), err);
  process.exit(1);
});
