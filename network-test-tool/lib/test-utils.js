const fs = require('fs').promises;
const path = require('path');
const { getNetworkConfig } = require('./networks');
const { TestDatabase } = require('./database');
const { TimeSeriesTracker } = require('./time-series');

class TestResult {
  constructor(testName, network, runId = null) {
    this.testName = testName;
    this.network = network;
    this.runId = runId || this.generateRunId();
    this.startTime = Date.now();
    this.results = [];
    this.gasUsage = {
      total: 0,
      operations: {}
    };
    this.transactions = [];
    this.db = null;
    this.timeSeriesTracker = null;
    this.persistToDB = true; // Enable database persistence by default
  }

  async initializeDatabase() {
    if (!this.db && this.persistToDB) {
      this.db = new TestDatabase();
      await this.db.initialize();

      this.timeSeriesTracker = new TimeSeriesTracker(this.db);
      await this.timeSeriesTracker.initialize();

      // Create test run in database
      try {
        const runData = {
          runId: this.runId,
          startTime: new Date(this.startTime).toISOString(),
          mode: 'standard',
          parallel: false,
          networks: [this.network.name || 'unknown'],
          testTypes: [this.testName],
          configuration: {
            network: this.network,
            testName: this.testName
          }
        };

        this.db.insertTestRun(runData);
      } catch (error) {
        // If test run already exists, that's fine
        if (!error.message.includes('UNIQUE constraint failed')) {
          console.warn(`Failed to create test run in database: ${error.message}`);
        }
      }
    }
  }

  generateRunId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomId = Math.random().toString(36).substring(2, 8);
    return `${this.testName}-${timestamp}-${randomId}`;
  }

  async addResult(operation, success, details = {}) {
    const result = {
      operation,
      success,
      timestamp: Date.now(),
      duration: details.duration || 0,
      gasUsed: details.gasUsed || 0,
      transactionHash: details.transactionHash,
      error: details.error,
      ...details
    };

    this.results.push(result);

    if (details.gasUsed) {
      this.gasUsage.total += details.gasUsed;
      this.gasUsage.operations[operation] = (this.gasUsage.operations[operation] || 0) + details.gasUsed;
    }

    if (details.transactionHash) {
      this.transactions.push({
        hash: details.transactionHash,
        operation,
        gasUsed: details.gasUsed
      });
    }

    // Persist to database
    await this.persistResult(result);
    
    // Record performance metrics
    await this.recordPerformanceMetrics(result);

    return result;
  }

  async persistResult(result) {
    if (!this.persistToDB) return;
    
    try {
      await this.initializeDatabase();
      
      const testData = {
        runId: this.runId,
        networkName: this.network.name || 'unknown',
        testType: this.testName,
        testName: result.operation,
        success: result.success,
        startTime: new Date(result.timestamp).toISOString(),
        endTime: result.duration ? new Date(result.timestamp + result.duration).toISOString() : new Date(result.timestamp).toISOString(),
        duration: result.duration,
        gasUsed: result.gasUsed,
        gasPrice: result.gasPrice,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        errorMessage: result.error,
        errorCategory: this.categorizeError(result.error),
        metadata: result.metadata || {}
      };
      
      this.db.insertTestResult(testData);
      
    } catch (error) {
      console.warn(`Failed to persist result to database: ${error.message}`);
    }
  }

  async recordPerformanceMetrics(result) {
    if (!this.persistToDB || !this.timeSeriesTracker) return;
    
    try {
      const timestamp = new Date().toISOString();
      const networkName = this.network.name || 'unknown';
      
      // Record basic metrics
      const metrics = {
        success_rate: result.success ? 1 : 0,
        duration: result.duration || 0,
        gas_used: result.gasUsed || 0
      };
      
      // Add TPS if available
      if (result.transactions && result.duration) {
        metrics.tps = result.transactions / (result.duration / 1000);
      }
      
      // Add response time
      if (result.responseTime) {
        metrics.response_time = result.responseTime;
      }
      
      await this.timeSeriesTracker.recordMetrics(this.runId, networkName, metrics, {
        timestamp,
        testType: this.testName,
        additionalData: {
          operation: result.operation,
          transactionHash: result.transactionHash
        }
      });
      
    } catch (error) {
      console.warn(`Failed to record performance metrics: ${error.message}`);
    }
  }

  categorizeError(error) {
    if (!error) return null;
    
    const errorMessage = error.toLowerCase();
    
    if (errorMessage.includes('gas')) return 'gas_error';
    if (errorMessage.includes('timeout')) return 'timeout_error';
    if (errorMessage.includes('nonce')) return 'nonce_error';
    if (errorMessage.includes('revert')) return 'revert_error';
    if (errorMessage.includes('network') || errorMessage.includes('connection')) return 'network_error';
    
    return 'unknown_error';
  }

  getSuccessRate() {
    const successful = this.results.filter(r => r.success).length;
    return successful / this.results.length;
  }

  getDuration() {
    return Date.now() - this.startTime;
  }

  async save(customPath) {
    const config = getNetworkConfig(this.network.chainId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = customPath || `${this.testName}-${config.chainId}-${timestamp}.json`;
    const filePath = path.join('test-results', filename);

    const data = {
      runId: this.runId,
      testName: this.testName,
      network: {
        name: config.name,
        chainId: config.chainId,
        symbol: config.symbol
      },
      summary: {
        totalOperations: this.results.length,
        successful: this.results.filter(r => r.success).length,
        failed: this.results.filter(r => !r.success).length,
        successRate: this.getSuccessRate(),
        duration: this.getDuration(),
        totalGasUsed: this.gasUsage.total
      },
      gasUsage: this.gasUsage,
      transactions: this.transactions,
      results: this.results,
      timestamp: new Date().toISOString(),
      metadata: {
        explorer: config.explorer.base,
        faucet: config.faucet
      }
    };

    // Save to database if enabled
    await this.saveToDB();

    // Always save JSON file for backward compatibility
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    
    console.log(`📊 Test results saved to: ${filePath}`);
    return filePath;
  }

  async saveToDB() {
    if (!this.persistToDB) return;

    try {
      await this.initializeDatabase();

      const config = getNetworkConfig(this.network.chainId);
      
      // Save test run summary
      const testRunData = {
        runId: this.runId,
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        mode: 'standard', // Could be passed as parameter
        parallel: false, // Could be passed as parameter
        networks: [config.name],
        testTypes: [this.testName],
        totalTests: this.results.length,
        successfulTests: this.results.filter(r => r.success).length,
        failedTests: this.results.filter(r => !r.success).length,
        successRate: this.getSuccessRate(),
        totalGasUsed: this.gasUsage.total,
        configuration: {}
      };

      // Insert or update test run
      try {
        this.db.insertTestRun(testRunData);
      } catch (error) {
        // Might already exist, update instead
        this.db.updateTestRun(this.runId, {
          endTime: testRunData.endTime,
          duration: this.getDuration(),
          totalTests: testRunData.totalTests,
          successfulTests: testRunData.successfulTests,
          failedTests: testRunData.failedTests,
          successRate: testRunData.successRate,
          totalGasUsed: testRunData.totalGasUsed
        });
      }

      // Save network results
      const networkData = {
        runId: this.runId,
        networkName: config.name,
        networkChainId: config.chainId,
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: this.getDuration(),
        totalTests: this.results.length,
        successfulTests: this.results.filter(r => r.success).length,
        failedTests: this.results.filter(r => !r.success).length,
        successRate: this.getSuccessRate(),
        totalGasUsed: this.gasUsage.total,
        averageGasPrice: this.getAverageGasPrice()
      };

      this.db.insertNetworkResult(networkData);

    } catch (error) {
      console.warn(`Failed to save test run to database: ${error.message}`);
    }
  }

  getAverageGasPrice() {
    const gasResults = this.results.filter(r => r.gasPrice && r.gasPrice > 0);
    if (gasResults.length === 0) return 0;
    
    const totalGasPrice = gasResults.reduce((sum, r) => sum + r.gasPrice, 0);
    return Math.round(totalGasPrice / gasResults.length);
  }
}

class Logger {
  constructor(network, testName) {
    this.network = network;
    this.testName = testName;
    this.config = getNetworkConfig(network.chainId);
  }

  info(message) {
    console.log(`ℹ️ [${this.config.name}] ${message}`);
  }

  success(message) {
    console.log(`✅ [${this.config.name}] ${message}`);
  }

  warning(message) {
    console.log(`⚠️ [${this.config.name}] ${message}`);
  }

  error(message) {
    console.log(`❌ [${this.config.name}] ${message}`);
  }

  transaction(hash, operation) {
    const explorerUrl = this.config.explorer.tx(hash);
    console.log(`🔗 [${this.config.name}] ${operation}: ${explorerUrl}`);
  }

  gas(operation, gasUsed, gasPrice) {
    const gasCost = gasUsed * (gasPrice || 0);
    const gasCostEth = gasCost / 1e18;
    console.log(`⛽ [${this.config.name}] ${operation}: ${gasUsed.toLocaleString()} gas (${gasCostEth.toFixed(6)} ${this.config.symbol})`);
  }
}

async function measureTime(operation) {
  const start = Date.now();
  const result = await operation();
  const duration = Date.now() - start;
  return { result, duration };
}

async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function formatGas(gasAmount) {
  if (gasAmount > 1000000) {
    return `${(gasAmount / 1000000).toFixed(2)}M`;
  } else if (gasAmount > 1000) {
    return `${(gasAmount / 1000).toFixed(1)}K`;
  }
  return gasAmount.toString();
}

function formatDuration(ms) {
  if (ms > 60000) {
    return `${(ms / 60000).toFixed(1)}m`;
  } else if (ms > 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

module.exports = {
  TestResult,
  Logger,
  measureTime,
  retryWithBackoff,
  formatGas,
  formatDuration
};