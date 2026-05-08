/**
 * Roles + levels migration.
 *
 *   node src/scripts/migrate-roles-levels.js --dry-run
 *   node src/scripts/migrate-roles-levels.js
 *
 * For every User:
 *   1. Normalise `level` lowercase → UPPERCASE
 *      (region → REGIONAL, national → NATIONAL, global → SYSTEM,
 *       factory → FACTORY).
 *   2. Remap legacy `role` to the new role enum, using the (already-
 *      normalised) level when the legacy role is ambiguous (Manager,
 *      admin, ICT Manager, user).
 *
 * Persists with `validateBeforeSave: false` because the schema's old
 * validators reject the new uppercase values until we land the schema
 * patch in the same release.
 *
 * Idempotent: re-running mutates nothing once a user has a canonical
 * level + role.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const chalk = require('chalk');

const UserModel = require('../models/user');
const {
  LEVEL_LIST,
  ROLE_LIST,
  normaliseLevel,
  resolveLegacyRole,
  levelForRole,
} = require('../permissions');

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

function planForUser(u) {
  const oldLevel = u.level;
  const oldRole = u.role;

  let newLevel = LEVEL_LIST.includes(oldLevel) ? oldLevel : normaliseLevel(oldLevel);
  if (!newLevel) {
    return { error: `unknown level "${oldLevel}"` };
  }

  let newRole;
  let roleNote = null;
  if (ROLE_LIST.includes(oldRole)) {
    newRole = oldRole;
  } else {
    newRole = resolveLegacyRole(oldRole, newLevel);
  }
  if (!newRole) {
    return { error: `cannot remap role "${oldRole}" at level ${newLevel}` };
  }

  // Role declares the level. If a canonical role disagrees with the
  // (also-canonical) level, the role wins — promote the level to match.
  // The classic case is a sys-admin pinned to a factory in old data.
  const expected = levelForRole(newRole);
  if (expected !== newLevel) {
    roleNote = `level ${newLevel} → ${expected} (role ${newRole} requires it)`;
    newLevel = expected;
  }

  const change = {};
  if (oldLevel !== newLevel) change.level = newLevel;
  if (oldRole !== newRole) change.role = newRole;

  // SYSTEM users have no factory/region binding — clear any leftover refs.
  if (newLevel === 'SYSTEM') {
    if (u.factory) change.factory = null;
    if (u.region) change.region = null;
  }
  // NATIONAL users likewise have no region/factory binding.
  if (newLevel === 'NATIONAL') {
    if (u.factory) change.factory = null;
    if (u.region) change.region = null;
  }

  return { change, note: roleNote };
}

async function migrate() {
  const cursor = UserModel.find({}).cursor();
  const stats = { total: 0, touched: 0, unchanged: 0, errors: 0 };
  const errors = [];

  for await (const u of cursor) {
    stats.total += 1;
    const { change, error, note } = planForUser(u);

    if (error) {
      stats.errors += 1;
      errors.push({ id: u._id.toString(), email: u.email, level: u.level, role: u.role, error });
      log(chalk.red('error'), u.email || u._id, '—', error);
      continue;
    }

    if (Object.keys(change).length === 0) {
      stats.unchanged += 1;
      continue;
    }

    stats.touched += 1;
    log(
      chalk.green(u.email || u._id.toString()),
      Object.entries(change).map(([k, v]) => `${k}: ${u[k]} → ${v}`).join(', '),
      note ? chalk.gray(`(${note})`) : ''
    );

    if (!DRY) {
      Object.assign(u, change);
      await u.save({ validateBeforeSave: false });
    }
  }

  console.log();
  console.log(chalk.bold('Summary'));
  console.log('  total    :', stats.total);
  console.log('  touched  :', stats.touched);
  console.log('  unchanged:', stats.unchanged);
  console.log('  errors   :', stats.errors);
  if (errors.length) {
    console.log();
    console.log(chalk.red.bold('Errors (no writes attempted for these):'));
    for (const e of errors) console.log(' -', JSON.stringify(e));
  }
  if (DRY) console.log(chalk.yellow('\n(dry-run — nothing written)'));
}

(async () => {
  try {
    await connect();
    await migrate();
  } catch (err) {
    console.error(chalk.red('fatal'), err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
