let Database;
try {
  Database = require('better-sqlite3');
} catch (error) {
  // Fallback when better-sqlite3 is not available
  Database = class {
    constructor() { 
      console.warn('⚠️  SQLite database not available, using fallback mode');
      return { 
        prepare: () => ({ run: () => {}, get: () => null, all: () => [] }),
        exec: () => {},
        close: () => {}
      };
    }
  };
}
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

class TestDatabase {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'test-results.db');
    this.db = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      
      this.createTables();
      this.isInitialized = true;
      
      console.log(chalk.green(`✅ Database initialized: ${this.dbPath}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize database:'), error.message);
      throw error;
    }
  }

  createTables() {
    // Test runs table - main test suite executions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT UNIQUE NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration INTEGER,
        mode TEXT NOT NULL,
        parallel BOOLEAN NOT NULL,
        networks TEXT NOT NULL,
        test_types TEXT NOT NULL,
        total_tests INTEGER DEFAULT 0,
        successful_tests INTEGER DEFAULT 0,
        failed_tests INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0.0,
        total_gas_used INTEGER DEFAULT 0,
        total_cost_tokens REAL DEFAULT 0.0,
        total_cost_usd REAL DEFAULT 0.0,
        configuration TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Network results table - results per network per test run
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS network_results (
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

    // Test results table - individual test results
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_results (
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
        cost_tokens REAL DEFAULT 0.0,
        cost_usd REAL DEFAULT 0.0,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES test_runs (id)
      )
    `);

    // Performance metrics table - time series data
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
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

    // Network status table - network health over time
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS network_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        network_name TEXT NOT NULL,
        network_chain_id INTEGER NOT NULL,
        block_number INTEGER NOT NULL,
        gas_price INTEGER NOT NULL,
        response_time INTEGER NOT NULL,
        online BOOLEAN NOT NULL,
        timestamp DATETIME NOT NULL,
        rpc_url TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Alerts table - performance alerts and notifications
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        network_name TEXT,
        test_type TEXT,
        message TEXT NOT NULL,
        details TEXT,
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at DATETIME,
        triggered_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Contract deployments table - track all deployed contracts
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contract_deployments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id TEXT UNIQUE NOT NULL,
        network_name TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        contract_name TEXT NOT NULL,
        contract_type TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        transaction_hash TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        gas_used INTEGER,
        gas_price TEXT,
        deployed_at DATETIME NOT NULL,
        deployer_address TEXT NOT NULL,
        constructor_args TEXT,
        abi TEXT,
        bytecode_hash TEXT,
        version TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        verified BOOLEAN DEFAULT FALSE,
        health_status TEXT DEFAULT 'healthy',
        last_health_check DATETIME,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chain_id, contract_type, contract_name, is_active)
      )
    `);

    // Contract health checks table - track health status over time
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contract_health_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id TEXT NOT NULL,
        check_time DATETIME NOT NULL,
        status TEXT NOT NULL,
        response_time_ms INTEGER,
        gas_price_at_check TEXT,
        error_message TEXT,
        checks_performed TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (deployment_id) REFERENCES contract_deployments (deployment_id)
      )
    `);

    // Test performance table - track test execution metrics
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_performance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id TEXT NOT NULL,
        test_name TEXT NOT NULL,
        execution_time_ms INTEGER,
        gas_used INTEGER,
        success BOOLEAN,
        run_timestamp DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (deployment_id) REFERENCES contract_deployments (deployment_id)
      )
    `);

    // Create indexes for better query performance
    this.createIndexes();
  }

  createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_test_runs_start_time ON test_runs(start_time)',
      'CREATE INDEX IF NOT EXISTS idx_test_runs_mode ON test_runs(mode)',
      'CREATE INDEX IF NOT EXISTS idx_network_results_run_id ON network_results(run_id)',
      'CREATE INDEX IF NOT EXISTS idx_network_results_network ON network_results(network_name)',
      'CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results(run_id)',
      'CREATE INDEX IF NOT EXISTS idx_test_results_network_test ON test_results(network_name, test_type)',
      'CREATE INDEX IF NOT EXISTS idx_test_results_success ON test_results(success)',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_network_metric ON performance_metrics(network_name, metric_name)',
      'CREATE INDEX IF NOT EXISTS idx_network_status_timestamp ON network_status(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_network_status_network ON network_status(network_name)',
      'CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at)',
      'CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity)',
      // Contract deployment indexes
      'CREATE INDEX IF NOT EXISTS idx_contract_deployments_network ON contract_deployments(chain_id, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_contract_deployments_type ON contract_deployments(contract_type, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_contract_deployments_lookup ON contract_deployments(chain_id, contract_type, contract_name, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_contract_health_deployment ON contract_health_checks(deployment_id, check_time)',
      'CREATE INDEX IF NOT EXISTS idx_test_performance_deployment ON test_performance(deployment_id, run_timestamp)'
    ];

    indexes.forEach(indexSQL => {
      try {
        this.db.exec(indexSQL);
      } catch (error) {
        // Index might already exist, ignore
      }
    });
  }

  // Test run operations
  insertTestRun(runData) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT INTO test_runs (
        run_id, start_time, mode, parallel, networks, test_types, configuration
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      runData.runId,
      runData.startTime,
      runData.mode,
      runData.parallel ? 1 : 0,
      JSON.stringify(runData.networks),
      JSON.stringify(runData.testTypes),
      JSON.stringify(runData.configuration || {})
    );
    
    // Return the inserted row ID for use as foreign key
    return { ...result, insertedId: result.lastInsertRowid };
  }

  // Helper method to get test run ID by run_id string
  getTestRunId(runId) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT id FROM test_runs WHERE run_id = ?');
    const result = stmt.get(runId);
    return result ? result.id : null;
  }

  updateTestRun(runId, updates) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const fields = [];
    const values = [];
    
    if (updates.endTime) {
      fields.push('end_time = ?');
      values.push(updates.endTime);
    }
    
    if (updates.duration !== undefined) {
      fields.push('duration = ?');
      values.push(updates.duration);
    }
    
    if (updates.totalTests !== undefined) {
      fields.push('total_tests = ?');
      values.push(updates.totalTests);
    }
    
    if (updates.successfulTests !== undefined) {
      fields.push('successful_tests = ?');
      values.push(updates.successfulTests);
    }
    
    if (updates.failedTests !== undefined) {
      fields.push('failed_tests = ?');
      values.push(updates.failedTests);
    }
    
    if (updates.successRate !== undefined) {
      fields.push('success_rate = ?');
      values.push(updates.successRate);
    }
    
    if (updates.totalGasUsed !== undefined) {
      fields.push('total_gas_used = ?');
      values.push(updates.totalGasUsed);
    }

    if (updates.totalCostTokens !== undefined) {
      fields.push('total_cost_tokens = ?');
      values.push(updates.totalCostTokens);
    }

    if (updates.totalCostUSD !== undefined) {
      fields.push('total_cost_usd = ?');
      values.push(updates.totalCostUSD);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(runId);
    
    const stmt = this.db.prepare(`
      UPDATE test_runs 
      SET ${fields.join(', ')} 
      WHERE run_id = ?
    `);
    
    return stmt.run(...values);
  }

  // Network result operations
  insertNetworkResult(networkData) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    // Get the integer ID for the run_id
    const testRunId = typeof networkData.runId === 'string' ? this.getTestRunId(networkData.runId) : networkData.runId;
    if (!testRunId) {
      throw new Error(`Test run not found for runId: ${networkData.runId}`);
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO network_results (
        run_id, network_name, network_chain_id, start_time, end_time,
        duration, total_tests, successful_tests, failed_tests, success_rate,
        total_gas_used, average_gas_price, block_number_start, block_number_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      testRunId,
      networkData.networkName,
      networkData.networkChainId,
      networkData.startTime,
      networkData.endTime,
      networkData.duration,
      networkData.totalTests || 0,
      networkData.successfulTests || 0,
      networkData.failedTests || 0,
      networkData.successRate || 0.0,
      networkData.totalGasUsed || 0,
      networkData.averageGasPrice || 0,
      networkData.blockNumberStart,
      networkData.blockNumberEnd
    );
  }

  // Test result operations
  insertTestResult(testData) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    // Get the integer ID for the run_id
    const testRunId = typeof testData.runId === 'string' ? this.getTestRunId(testData.runId) : testData.runId;
    if (!testRunId) {
      throw new Error(`Test run not found for runId: ${testData.runId}`);
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO test_results (
        run_id, network_name, test_type, test_name, success,
        start_time, end_time, duration, gas_used, gas_price,
        transaction_hash, block_number, error_message, error_category,
        cost_tokens, cost_usd, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      testRunId,
      testData.networkName,
      testData.testType,
      testData.testName,
      testData.success ? 1 : 0,
      testData.startTime,
      testData.endTime,
      testData.duration,
      testData.gasUsed || 0,
      testData.gasPrice || 0,
      testData.transactionHash,
      testData.blockNumber,
      testData.errorMessage,
      testData.errorCategory,
      testData.costTokens || 0,
      testData.costUSD || 0,
      JSON.stringify(testData.metadata || {})
    );
  }

  // Performance metrics operations
  insertPerformanceMetric(metricData) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    // Get the integer ID for the run_id
    const testRunId = typeof metricData.runId === 'string' ? this.getTestRunId(metricData.runId) : metricData.runId;
    if (!testRunId) {
      throw new Error(`Test run not found for runId: ${metricData.runId}`);
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO performance_metrics (
        run_id, network_name, metric_name, metric_value, metric_unit,
        timestamp, test_type, additional_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      testRunId,
      metricData.networkName,
      metricData.metricName,
      metricData.metricValue,
      metricData.metricUnit,
      metricData.timestamp,
      metricData.testType,
      JSON.stringify(metricData.additionalData || {})
    );
  }

  // Network status operations
  insertNetworkStatus(statusData) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT INTO network_status (
        network_name, network_chain_id, block_number, gas_price,
        response_time, online, timestamp, rpc_url, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      statusData.networkName,
      statusData.networkChainId,
      statusData.blockNumber,
      statusData.gasPrice,
      statusData.responseTime,
      statusData.online ? 1 : 0,
      statusData.timestamp,
      statusData.rpcUrl,
      statusData.errorMessage
    );
  }

  // Alert operations
  insertAlert(alertData) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT INTO alerts (
        alert_type, severity, network_name, test_type, message,
        details, triggered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      alertData.alertType,
      alertData.severity,
      alertData.networkName,
      alertData.testType,
      alertData.message,
      JSON.stringify(alertData.details || {}),
      alertData.triggeredAt
    );
  }

  resolveAlert(alertId) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      UPDATE alerts 
      SET resolved = 1, resolved_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    return stmt.run(alertId);
  }

  // Query operations
  getTestRuns(options = {}) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    let query = 'SELECT * FROM test_runs';
    const conditions = [];
    const params = [];
    
    if (options.since) {
      conditions.push('start_time >= ?');
      params.push(options.since);
    }
    
    if (options.mode) {
      conditions.push('mode = ?');
      params.push(options.mode);
    }
    
    if (options.network) {
      conditions.push('networks LIKE ?');
      params.push(`%${options.network}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY start_time DESC';
    
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  getNetworkResults(runId) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    // Convert string run_id to integer ID if needed
    const testRunId = typeof runId === 'string' ? this.getTestRunId(runId) : runId;
    if (!testRunId) {
      return [];
    }
    
    const stmt = this.db.prepare(`
      SELECT * FROM network_results 
      WHERE run_id = ? 
      ORDER BY network_name
    `);
    
    return stmt.all(testRunId);
  }

  getTestResults(runId, networkName = null) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    // Convert string run_id to integer ID if needed
    const testRunId = typeof runId === 'string' ? this.getTestRunId(runId) : runId;
    if (!testRunId) {
      return [];
    }
    
    let query = 'SELECT * FROM test_results WHERE run_id = ?';
    const params = [testRunId];
    
    if (networkName) {
      query += ' AND network_name = ?';
      params.push(networkName);
    }
    
    query += ' ORDER BY start_time';
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  getPerformanceMetrics(options = {}) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    let query = 'SELECT * FROM performance_metrics';
    const conditions = [];
    const params = [];
    
    if (options.networkName) {
      conditions.push('network_name = ?');
      params.push(options.networkName);
    }
    
    if (options.metricName) {
      conditions.push('metric_name = ?');
      params.push(options.metricName);
    }
    
    if (options.since) {
      conditions.push('timestamp >= ?');
      params.push(options.since);
    }
    
    if (options.testType) {
      conditions.push('test_type = ?');
      params.push(options.testType);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY timestamp DESC';
    
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  getNetworkStatus(options = {}) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    let query = 'SELECT * FROM network_status';
    const conditions = [];
    const params = [];
    
    if (options.networkName) {
      conditions.push('network_name = ?');
      params.push(options.networkName);
    }
    
    if (options.since) {
      conditions.push('timestamp >= ?');
      params.push(options.since);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY timestamp DESC';
    
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  getAlerts(options = {}) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    let query = 'SELECT * FROM alerts';
    const conditions = [];
    const params = [];
    
    if (options.resolved !== undefined) {
      conditions.push('resolved = ?');
      params.push(options.resolved ? 1 : 0);
    }
    
    if (options.severity) {
      conditions.push('severity = ?');
      params.push(options.severity);
    }
    
    if (options.networkName) {
      conditions.push('network_name = ?');
      params.push(options.networkName);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY triggered_at DESC';
    
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  // Utility methods
  vacuum() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    this.db.exec('VACUUM');
  }

  getStats() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stats = {};
    
    const tables = [
      'test_runs', 'network_results', 'test_results', 
      'performance_metrics', 'network_status', 'alerts'
    ];
    
    tables.forEach(table => {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
      const result = stmt.get();
      stats[table] = result.count;
    });
    
    return stats;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log(chalk.gray('🗃️ Database connection closed'));
    }
  }

  // Transaction support
  transaction(callback) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(callback);
    return transaction;
  }

  // Backup and maintenance
  backup(backupPath) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      this.db.backup(backupPath)
        .then(() => {
          console.log(chalk.green(`✅ Database backed up to: ${backupPath}`));
          resolve();
        })
        .catch(reject);
    });
  }

  // Purge operations
  purgeAllTestResults(confirm = false) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    if (!confirm) {
      throw new Error('Purge operation requires explicit confirmation. Set confirm=true');
    }
    
    const transaction = this.db.transaction(() => {
      // Get counts before deletion
      const stats = this.getStats();
      
      // Delete in correct order to maintain foreign key constraints
      this.db.exec('DELETE FROM performance_metrics');
      this.db.exec('DELETE FROM test_results');
      this.db.exec('DELETE FROM network_results');
      this.db.exec('DELETE FROM test_runs');
      this.db.exec('DELETE FROM network_status');
      this.db.exec('DELETE FROM alerts');
      
      // Reset auto-increment counters
      try {
        this.db.exec('DELETE FROM sqlite_sequence WHERE name IN ("test_runs", "network_results", "test_results", "performance_metrics", "network_status", "alerts")');
      } catch (error) {
        // sqlite_sequence might not exist or have different structure, ignore
      }
      
      return stats;
    });
    
    const deletedStats = transaction();
    
    console.log(chalk.yellow('🗑️ Purged all test results from database:'));
    Object.entries(deletedStats).forEach(([table, count]) => {
      if (count > 0) {
        console.log(chalk.gray(`  - ${table}: ${count} records deleted`));
      }
    });
    
    // Vacuum to reclaim space
    this.vacuum();
    
    return deletedStats;
  }

  purgeOldTestResults(olderThanDays, confirm = false) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    if (!confirm) {
      throw new Error('Purge operation requires explicit confirmation. Set confirm=true');
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffTimestamp = cutoffDate.toISOString();
    
    const transaction = this.db.transaction(() => {
      // Count records to be deleted
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM test_runs WHERE start_time < ?');
      const { count: testRunsToDelete } = countStmt.get(cutoffTimestamp);
      
      if (testRunsToDelete === 0) {
        return { deleted: 0, message: `No test runs older than ${olderThanDays} days found` };
      }
      
      // Get IDs to be deleted (both string run_id and integer id)
      const runDataStmt = this.db.prepare('SELECT id, run_id FROM test_runs WHERE start_time < ?');
      const runData = runDataStmt.all(cutoffTimestamp);
      const runIds = runData.map(row => row.run_id);
      const runIntIds = runData.map(row => row.id);
      
      // Delete related records using integer IDs
      const deletePerformanceMetrics = this.db.prepare('DELETE FROM performance_metrics WHERE run_id = ?');
      const deleteTestResults = this.db.prepare('DELETE FROM test_results WHERE run_id = ?');
      const deleteNetworkResults = this.db.prepare('DELETE FROM network_results WHERE run_id = ?');
      const deleteTestRuns = this.db.prepare('DELETE FROM test_runs WHERE id = ?');
      
      let deletedCounts = {
        performance_metrics: 0,
        test_results: 0,
        network_results: 0,
        test_runs: 0
      };
      
      // Delete using appropriate IDs
      for (let i = 0; i < runData.length; i++) {
        const intId = runIntIds[i];
        deletedCounts.performance_metrics += deletePerformanceMetrics.run(intId).changes;
        deletedCounts.test_results += deleteTestResults.run(intId).changes;
        deletedCounts.network_results += deleteNetworkResults.run(intId).changes;
        deletedCounts.test_runs += deleteTestRuns.run(intId).changes;
      }
      
      // Also delete old network status and alerts
      const deleteOldNetworkStatus = this.db.prepare('DELETE FROM network_status WHERE timestamp < ?');
      const deleteOldAlerts = this.db.prepare('DELETE FROM alerts WHERE triggered_at < ?');
      
      deletedCounts.network_status = deleteOldNetworkStatus.run(cutoffTimestamp).changes;
      deletedCounts.alerts = deleteOldAlerts.run(cutoffTimestamp).changes;
      
      return { deleted: testRunsToDelete, counts: deletedCounts, cutoffDate };
    });
    
    const result = transaction();
    
    if (result.deleted === 0) {
      console.log(chalk.yellow(result.message));
      return result;
    }
    
    console.log(chalk.yellow(`🗑️ Purged test results older than ${olderThanDays} days (before ${result.cutoffDate.toLocaleDateString()}):`));
    Object.entries(result.counts).forEach(([table, count]) => {
      if (count > 0) {
        console.log(chalk.gray(`  - ${table}: ${count} records deleted`));
      }
    });
    
    // Vacuum to reclaim space
    this.vacuum();
    
    return result;
  }

  purgeByNetwork(networkName, confirm = false) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    if (!confirm) {
      throw new Error('Purge operation requires explicit confirmation. Set confirm=true');
    }
    
    const transaction = this.db.transaction(() => {
      // Delete performance metrics for the network
      const deletePerformanceMetrics = this.db.prepare('DELETE FROM performance_metrics WHERE network_name = ?');
      const performanceMetricsDeleted = deletePerformanceMetrics.run(networkName).changes;
      
      // Delete test results for the network
      const deleteTestResults = this.db.prepare('DELETE FROM test_results WHERE network_name = ?');
      const testResultsDeleted = deleteTestResults.run(networkName).changes;
      
      // Delete network results
      const deleteNetworkResults = this.db.prepare('DELETE FROM network_results WHERE network_name = ?');
      const networkResultsDeleted = deleteNetworkResults.run(networkName).changes;
      
      // Delete network status
      const deleteNetworkStatus = this.db.prepare('DELETE FROM network_status WHERE network_name = ?');
      const networkStatusDeleted = deleteNetworkStatus.run(networkName).changes;
      
      // Delete alerts for the network
      const deleteAlerts = this.db.prepare('DELETE FROM alerts WHERE network_name = ?');
      const alertsDeleted = deleteAlerts.run(networkName).changes;
      
      // Clean up test runs that no longer have any network results
      const cleanupTestRuns = this.db.prepare(`
        DELETE FROM test_runs 
        WHERE id NOT IN (SELECT DISTINCT run_id FROM network_results)
      `);
      const testRunsDeleted = cleanupTestRuns.run().changes;
      
      return {
        performance_metrics: performanceMetricsDeleted,
        test_results: testResultsDeleted,
        network_results: networkResultsDeleted,
        network_status: networkStatusDeleted,
        alerts: alertsDeleted,
        test_runs: testRunsDeleted
      };
    });
    
    const deletedCounts = transaction();
    
    const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);
    
    if (totalDeleted === 0) {
      console.log(chalk.yellow(`🗑️ No records found for network: ${networkName}`));
      return deletedCounts;
    }
    
    console.log(chalk.yellow(`🗑️ Purged all records for network: ${networkName}`));
    Object.entries(deletedCounts).forEach(([table, count]) => {
      if (count > 0) {
        console.log(chalk.gray(`  - ${table}: ${count} records deleted`));
      }
    });
    
    // Vacuum to reclaim space
    this.vacuum();
    
    return deletedCounts;
  }

  // Database maintenance
  optimize() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    console.log(chalk.blue('🔧 Optimizing database...'));
    
    // Analyze tables for better query optimization
    this.db.exec('ANALYZE');
    
    // Update statistics
    this.db.pragma('optimize');
    
    // Vacuum to reclaim space and defragment
    this.vacuum();
    
    console.log(chalk.green('✅ Database optimization completed'));
  }

  getDatabaseSize() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const fs = require('fs');
    const stats = fs.statSync(this.dbPath);
    const sizeBytes = stats.size;
    
    return {
      bytes: sizeBytes,
      kb: Math.round(sizeBytes / 1024),
      mb: Math.round(sizeBytes / (1024 * 1024) * 100) / 100,
      human: this.formatBytes(sizeBytes)
    };
  }

  formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = { TestDatabase };