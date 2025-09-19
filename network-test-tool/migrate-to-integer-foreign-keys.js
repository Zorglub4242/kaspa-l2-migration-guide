const { TestDatabase } = require('./lib/database');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

async function migrateToIntegerForeignKeys() {
  console.log(chalk.blue('🔄 Starting migration to integer foreign keys...'));
  
  const db = new TestDatabase();
  await db.initialize();
  
  try {
    // Create backup first
    const backupPath = path.join(process.cwd(), `backup-before-migration-${Date.now()}.db`);
    console.log(chalk.yellow(`📂 Creating backup: ${backupPath}`));
    
    // Copy the database file manually since the backup method has issues
    const dbPath = db.dbPath;
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
      console.log(chalk.green(`✅ Backup created successfully`));
    }
    
    // Start transaction for safe migration
    const migration = db.db.transaction(() => {
      console.log(chalk.blue('🔄 Step 1: Creating new tables with integer foreign keys...'));
      
      // Create new tables with correct schema
      db.db.exec(`
        CREATE TABLE IF NOT EXISTS network_results_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          network_name TEXT NOT NULL,
          network_chain_id INTEGER NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          duration INTEGER,
          total_tests INTEGER DEFAULT 0,
          successful_tests INTEGER DEFAULT 0,
          failed_tests INTEGER DEFAULT 0,
          success_rate REAL DEFAULT 0.0,
          total_gas_used INTEGER DEFAULT 0,
          average_gas_price INTEGER DEFAULT 0,
          block_number_start INTEGER,
          block_number_end INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (run_id) REFERENCES test_runs (id)
        )
      `);
      
      db.db.exec(`
        CREATE TABLE IF NOT EXISTS test_results_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          network_name TEXT NOT NULL,
          test_type TEXT NOT NULL,
          test_name TEXT NOT NULL,
          success BOOLEAN NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          duration INTEGER,
          gas_used INTEGER DEFAULT 0,
          gas_price INTEGER DEFAULT 0,
          transaction_hash TEXT,
          block_number INTEGER,
          error_message TEXT,
          error_category TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (run_id) REFERENCES test_runs (id)
        )
      `);
      
      db.db.exec(`
        CREATE TABLE IF NOT EXISTS performance_metrics_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          network_name TEXT NOT NULL,
          metric_name TEXT NOT NULL,
          metric_value REAL NOT NULL,
          metric_unit TEXT,
          timestamp DATETIME NOT NULL,
          test_type TEXT,
          additional_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (run_id) REFERENCES test_runs (id)
        )
      `);
      
      console.log(chalk.blue('🔄 Step 2: Migrating data with proper foreign key mapping...'));
      
      // Migrate network_results
      const networkRows = db.db.prepare('SELECT COUNT(*) as count FROM network_results').get();
      if (networkRows.count > 0) {
        db.db.exec(`
          INSERT INTO network_results_new (
            run_id, network_name, network_chain_id, start_time, end_time,
            duration, total_tests, successful_tests, failed_tests, success_rate,
            total_gas_used, average_gas_price, block_number_start, block_number_end, created_at
          )
          SELECT 
            tr.id as run_id, nr.network_name, nr.network_chain_id, nr.start_time, nr.end_time,
            nr.duration, nr.total_tests, nr.successful_tests, nr.failed_tests, nr.success_rate,
            nr.total_gas_used, nr.average_gas_price, nr.block_number_start, nr.block_number_end, nr.created_at
          FROM network_results nr
          JOIN test_runs tr ON nr.run_id = tr.run_id
        `);
        console.log(chalk.green('✅ Migrated network_results'));
      }
      
      // Migrate test_results
      const testRows = db.db.prepare('SELECT COUNT(*) as count FROM test_results').get();
      if (testRows.count > 0) {
        db.db.exec(`
          INSERT INTO test_results_new (
            run_id, network_name, test_type, test_name, success,
            start_time, end_time, duration, gas_used, gas_price,
            transaction_hash, block_number, error_message, error_category, metadata, created_at
          )
          SELECT 
            tr.id as run_id, res.network_name, res.test_type, res.test_name, res.success,
            res.start_time, res.end_time, res.duration, res.gas_used, res.gas_price,
            res.transaction_hash, res.block_number, res.error_message, res.error_category, res.metadata, res.created_at
          FROM test_results res
          JOIN test_runs tr ON res.run_id = tr.run_id
        `);
        console.log(chalk.green('✅ Migrated test_results'));
      }
      
      // Migrate performance_metrics
      const perfRows = db.db.prepare('SELECT COUNT(*) as count FROM performance_metrics').get();
      if (perfRows.count > 0) {
        db.db.exec(`
          INSERT INTO performance_metrics_new (
            run_id, network_name, metric_name, metric_value, metric_unit,
            timestamp, test_type, additional_data, created_at
          )
          SELECT 
            tr.id as run_id, pm.network_name, pm.metric_name, pm.metric_value, pm.metric_unit,
            pm.timestamp, pm.test_type, pm.additional_data, pm.created_at
          FROM performance_metrics pm
          JOIN test_runs tr ON pm.run_id = tr.run_id
        `);
        console.log(chalk.green('✅ Migrated performance_metrics'));
      }
      
      console.log(chalk.blue('🔄 Step 3: Replacing old tables with new ones...'));
      
      // Drop old tables and rename new ones
      db.db.exec('DROP TABLE IF EXISTS network_results');
      db.db.exec('DROP TABLE IF EXISTS test_results');
      db.db.exec('DROP TABLE IF EXISTS performance_metrics');
      
      db.db.exec('ALTER TABLE network_results_new RENAME TO network_results');
      db.db.exec('ALTER TABLE test_results_new RENAME TO test_results');
      db.db.exec('ALTER TABLE performance_metrics_new RENAME TO performance_metrics');
      
      console.log(chalk.blue('🔄 Step 4: Recreating indexes...'));
      
      // Recreate indexes
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_network_results_run_id ON network_results(run_id)',
        'CREATE INDEX IF NOT EXISTS idx_network_results_network ON network_results(network_name)',
        'CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results(run_id)',
        'CREATE INDEX IF NOT EXISTS idx_test_results_network_test ON test_results(network_name, test_type)',
        'CREATE INDEX IF NOT EXISTS idx_test_results_success ON test_results(success)',
        'CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_performance_metrics_network_metric ON performance_metrics(network_name, metric_name)'
      ];
      
      indexes.forEach(indexSQL => {
        try {
          db.db.exec(indexSQL);
        } catch (error) {
          // Index might already exist, ignore
        }
      });
      
      return {
        networkResults: networkRows.count,
        testResults: testRows.count,
        performanceMetrics: perfRows.count
      };
    });
    
    const migrationResult = migration();
    
    console.log(chalk.green('✅ Migration completed successfully!'));
    console.log(chalk.gray('📊 Migration Summary:'));
    console.log(chalk.gray(`  - Network Results: ${migrationResult.networkResults} records migrated`));
    console.log(chalk.gray(`  - Test Results: ${migrationResult.testResults} records migrated`));
    console.log(chalk.gray(`  - Performance Metrics: ${migrationResult.performanceMetrics} records migrated`));
    
    // Verify the migration worked
    console.log(chalk.blue('🔍 Verifying migration...'));
    const verifyStmt = db.db.prepare(`
      SELECT tr.run_id as text_run_id, tr.id as test_run_id, res.run_id as foreign_key_id, res.test_name 
      FROM test_runs tr 
      JOIN test_results res ON tr.id = res.run_id 
      LIMIT 1
    `);
    
    const verifyResult = verifyStmt.get();
    if (verifyResult) {
      console.log(chalk.green('✅ Foreign key relationships verified:'));
      console.log(chalk.gray(`  - Test Run ID: ${verifyResult.test_run_id} (integer)`));
      console.log(chalk.gray(`  - Foreign Key ID: ${verifyResult.foreign_key_id} (integer)`));
      console.log(chalk.gray(`  - Text Run ID: ${verifyResult.text_run_id} (preserved)`));
    } else {
      console.log(chalk.yellow('⚠️  No data to verify, but schema migration completed'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Migration failed:'), error.message);
    throw error;
  } finally {
    db.close();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateToIntegerForeignKeys()
    .then(() => {
      console.log(chalk.green('🎉 Database migration completed successfully!'));
      process.exit(0);
    })
    .catch((error) => {
      console.error(chalk.red('💥 Migration failed:'), error);
      process.exit(1);
    });
}

module.exports = { migrateToIntegerForeignKeys };