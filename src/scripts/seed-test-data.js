/**
 * Seed live data into test regions (9 and 12) so showTestData=on
 * actually exercises a non-empty filter.
 *
 * Idempotent — safe to re-run; updates in place by lookup keys (region
 * code, factory name, device serial).
 *
 *   node src/scripts/seed-test-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const chalk = require('chalk');

const RegionModel = require('../models/region.model');
const FactoryModel = require('../models/factory');
const DeviceModel = require('../models/device.model');

const TEST_REGIONS = [
  { code: '9', name: 'Region 9 — Test', isTest: true },
  { code: '12', name: 'Region 12 — Test', isTest: true },
];

const TEST_FACTORIES_BY_REGION = {
  '9': [{ name: 'TEST FACTORY ALPHA', location: 'Test Lab — Region 9' }],
  '12': [{ name: 'TEST FACTORY BRAVO', location: 'Test Lab — Region 12' }],
};

const DEVICES_PER_FACTORY = 3;

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
  console.log(chalk.green('connected'), `${DB_IP}:${DB_PORT}/${DB_NAME}`);
}

async function ensureRegions() {
  const out = new Map();
  for (const r of TEST_REGIONS) {
    const existing = await RegionModel.findOne({ code: r.code });
    if (existing) {
      const patch = {};
      if (existing.name !== r.name) patch.name = r.name;
      if (existing.isTest !== r.isTest) patch.isTest = r.isTest;
      if (Object.keys(patch).length) {
        await RegionModel.updateOne({ _id: existing._id }, { $set: patch });
        console.log(chalk.cyan('region'), r.code, 'patched', JSON.stringify(patch));
      } else {
        console.log(chalk.gray('region'), r.code, 'unchanged');
      }
      out.set(r.code, await RegionModel.findById(existing._id));
    } else {
      const created = await RegionModel.create(r);
      console.log(chalk.green('region'), r.code, 'created');
      out.set(r.code, created);
    }
  }
  return out;
}

async function ensureFactories(regionMap) {
  const factories = [];
  for (const [code, factoryDefs] of Object.entries(TEST_FACTORIES_BY_REGION)) {
    const region = regionMap.get(code);
    for (const def of factoryDefs) {
      const existing = await FactoryModel.findOne({ name: def.name });
      if (existing) {
        const patch = {};
        if (String(existing.region) !== String(region._id)) patch.region = region._id;
        if (existing.location !== def.location) patch.location = def.location;
        if (existing.soft_deleted) patch.soft_deleted = false;
        if (existing.status !== 'active') patch.status = 'active';
        if (Object.keys(patch).length) {
          await FactoryModel.updateOne({ _id: existing._id }, { $set: patch });
          console.log(chalk.cyan('factory'), def.name, 'patched', JSON.stringify(patch));
        } else {
          console.log(chalk.gray('factory'), def.name, 'unchanged');
        }
        factories.push(await FactoryModel.findById(existing._id));
      } else {
        const created = await FactoryModel.create({
          name: def.name,
          location: def.location,
          region: region._id,
          status: 'active',
          soft_deleted: false,
        });
        console.log(chalk.green('factory'), def.name, 'created in region', code);
        factories.push(created);
      }
    }
  }
  return factories;
}

async function ensureDevices(factories) {
  for (const factory of factories) {
    for (let i = 1; i <= DEVICES_PER_FACTORY; i++) {
      const serial = `${factory.name.replace(/\s+/g, '')}-DEV-${i}`;
      const existing = await DeviceModel.findOne({ serial_number: serial });
      if (existing) {
        const patch = {};
        if (String(existing.factory) !== String(factory._id)) patch.factory = factory._id;
        if (existing.factory_name !== factory.name) patch.factory_name = factory.name;
        if (existing.factory_location !== factory.location) patch.factory_location = factory.location;
        if (existing.status !== 'active') patch.status = 'active';
        if (existing.soft_deleted) patch.soft_deleted = false;
        if (Object.keys(patch).length) {
          await DeviceModel.updateOne({ _id: existing._id }, { $set: patch });
          console.log(chalk.cyan('device'), serial, 'patched');
        } else {
          console.log(chalk.gray('device'), serial, 'unchanged');
        }
      } else {
        await DeviceModel.create({
          device_id: serial,
          serial_number: serial,
          company_id: `TEST-${factory.name.split(' ')[2] || 'X'}-${i}`,
          factory: factory._id,
          factory_name: factory.name,
          factory_location: factory.location,
          status: 'active',
          soft_deleted: false,
        });
        console.log(chalk.green('device'), serial, 'created');
      }
    }
  }
}

(async () => {
  try {
    await connect();
    const regions = await ensureRegions();
    const factories = await ensureFactories(regions);
    await ensureDevices(factories);
    console.log(chalk.bold.green('\ndone.'));
  } catch (err) {
    console.error(chalk.red('fatal'), err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
