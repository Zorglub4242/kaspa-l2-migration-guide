#!/usr/bin/env node

const Database = require('better-sqlite3');

try {
  const db = new Database('./data/test-results.db', { readonly: true });

  console.log('=== Database Tables ===');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  tables.forEach(table => console.log(table.name));

  console.log('\n=== contract_deployments columns ===');
  try {
    const deploymentColumns = db.prepare("PRAGMA table_info(contract_deployments)").all();
    deploymentColumns.forEach(col => console.log(`${col.name} (${col.type})`));
  } catch (e) {
    console.log('contract_deployments table not found');
  }

  console.log('\n=== contract_health_checks columns ===');
  try {
    const healthColumns = db.prepare("PRAGMA table_info(contract_health_checks)").all();
    healthColumns.forEach(col => console.log(`${col.name} (${col.type})`));
  } catch (e) {
    console.log('contract_health_checks table not found');
  }

  console.log('\n=== Sample contract_deployments data ===');
  try {
    const sample = db.prepare("SELECT * FROM contract_deployments LIMIT 2").all();
    console.log(JSON.stringify(sample, null, 2));
  } catch (e) {
    console.log('No data in contract_deployments');
  }

  db.close();
} catch (error) {
  console.error('Error:', error.message);
}