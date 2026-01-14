/**
 * Migration script to convert static regions.json to MongoDB collection
 *
 * Usage: node src/scripts/migrate-regions.js
 *
 * This script will:
 * 1. Read the existing regions.json file
 * 2. Insert each region as a MongoDB document
 * 3. Mark regions containing "test" in their name as isTest: true
 */

require('dotenv').config();
const mongoose = require('mongoose');
const chalk = require('chalk');
const RegionModel = require('../models/region.model');
const regions = require('../routes/regions/regions.json');

async function connect() {
  const db_ip = process.env.DB_IP;
  const db_port = process.env.DB_PORT;
  const db_user = process.env.DB_USER;
  const db_password = process.env.DB_PASSWORD;
  const db_name = process.env.DB_NAME;
  const rs_name = process.env.DB_RS_NAME;
  const host_0 = `${db_ip}:${db_port}`;

  const connection_string = `mongodb://${db_user}:${db_password}@${host_0}/`;

  mongoose.set('strictQuery', false);
  await mongoose.connect(connection_string, {
    authSource: "admin",
    replicaSet: rs_name,
    dbName: db_name,
    directConnection: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 30000,
  });

  console.log(chalk.green("Database connection successful"));
}

async function migrate() {
  console.log(chalk.blue('Starting region migration...'));
  console.log(chalk.blue(`Found ${regions.length} regions to migrate`));

  let migrated = 0;
  let skipped = 0;

  for (const name of regions) {
    const isTest = name.toLowerCase().includes('test');

    try {
      const result = await RegionModel.findOneAndUpdate(
        { name },
        { name, isTest },
        { upsert: true, new: true }
      );

      console.log(chalk.green(`✓ Migrated: ${name}${isTest ? ' (test region)' : ''}`));
      migrated++;
    } catch (error) {
      console.log(chalk.yellow(`⚠ Skipped ${name}: ${error.message}`));
      skipped++;
    }
  }

  console.log(chalk.blue('\n=== Migration Summary ==='));
  console.log(chalk.green(`Migrated: ${migrated}`));
  console.log(chalk.yellow(`Skipped: ${skipped}`));
  console.log(chalk.blue('========================\n'));
}

async function main() {
  try {
    await connect();
    await migrate();
    console.log(chalk.green('Migration completed successfully!'));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Migration failed:'), error);
    process.exit(1);
  }
}

main();
