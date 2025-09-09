const { logger } = require('../utils/logger');
const { PrecisionTimer } = require('../utils/PrecisionTimer');
const { FinalityDataStorage } = require('./FinalityDataStorage');

/**
 * Finality Controller - Main orchestrator for finality measurements
 * Coordinates testing across multiple networks with MEV awareness
 */
class FinalityController {
  constructor(options = {}) {
    this.options = {
      sessionName: options.sessionName || null,
      storageMode: options.storageMode || 'mixed',
      mevAware: options.mevAware !== false, // Default to MEV-aware
      ...options
    };
    
    this.adapters = new Map(); // networkName -> adapter
    this.dataStorage = null;
    this.sessionId = null;
    this.isRunning = false;
    
    // Test configuration
    this.testConfig = {
      networks: [],
      transactionCount: 10,
      finalityThreshold: 12,
      mevThreshold: 50,
      enableRetry: true,
      exportFormat: 'json'
    };
  }

  // Initialize the controller with data storage and network adapters
  async initialize() {
    try {
      // Initialize data storage
      this.dataStorage = new FinalityDataStorage({
        storageMode: this.options.storageMode,
        sessionName: this.options.sessionName
      });
      
      this.sessionId = await this.dataStorage.init();
      
      logger.success(`🎯 FinalityController initialized with session: ${this.sessionId}`);
      return this.sessionId;
      
    } catch (error) {
      logger.error(`❌ Failed to initialize FinalityController: ${error.message}`);
      throw error;
    }
  }

  // Register a network adapter
  registerAdapter(networkName, adapter) {
    this.adapters.set(networkName, adapter);
    
    // Add network to data storage
    this.dataStorage.addNetwork(networkName, {
      chainId: adapter.chainId,
      rpcUrl: adapter.rpcUrl,
      currency: adapter.currency || 'ETH'
    });
    
    logger.info(`📡 Registered network adapter: ${networkName}`);
  }

  // Initialize all registered adapters
  async initializeAdapters() {
    const initPromises = [];
    
    for (const [networkName, adapter] of this.adapters.entries()) {
      initPromises.push(
        adapter.initialize().then(() => {
          if (this.options.mevAware) {
            return adapter.initializeMevMonitoring();
          }
        }).then(() => {
          logger.success(`✅ Initialized adapter: ${networkName}`);
        }).catch(error => {
          logger.error(`❌ Failed to initialize adapter ${networkName}: ${error.message}`);
          throw error;
        })
      );
    }
    
    await Promise.all(initPromises);
    logger.success(`🌐 All network adapters initialized`);
  }

  // Run finality test across specified networks
  async runFinalityTest(config = {}) {
    this.testConfig = { ...this.testConfig, ...config };
    
    if (!this.sessionId) {
      await this.initialize();
    }

    if (this.adapters.size === 0) {
      throw new Error('No network adapters registered');
    }

    this.isRunning = true;
    
    try {
      logger.cyan(`\n🎯 STARTING FINALITY TEST`);
      logger.cyan(`=`.repeat(60));
      logger.info(`📊 Networks: ${Array.from(this.adapters.keys()).join(', ')}`);
      logger.info(`📈 Transactions per network: ${this.testConfig.transactionCount}`);
      logger.info(`🎯 Base finality threshold: ${this.testConfig.finalityThreshold} blocks`);
      logger.info(`🤖 MEV awareness: ${this.options.mevAware ? 'enabled' : 'disabled'}`);
      
      // Set test configuration in data storage
      this.dataStorage.setTestConfiguration('finality_measurement', this.testConfig);

      // Run pre-test health checks
      await this.runHealthChecks();

      // Get target networks
      const targetNetworks = this.testConfig.networks.length > 0 ? 
        this.testConfig.networks : 
        Array.from(this.adapters.keys());

      const results = {};

      // Run tests on each network
      for (const networkName of targetNetworks) {
        if (!this.adapters.has(networkName)) {
          logger.error(`❌ Network adapter not found: ${networkName}`);
          continue;
        }

        logger.cyan(`\n🚀 Testing ${networkName}...`);
        results[networkName] = await this.runNetworkTest(networkName);
      }

      // Generate comprehensive analysis
      const analysis = await this.generateAnalysis(results);

      // Finalize session
      await this.dataStorage.finalizeSession({
        testType: 'finality_measurement',
        networksCount: targetNetworks.length,
        totalMeasurements: Object.values(results).reduce((sum, r) => sum + r.measurements.length, 0),
        overallResults: analysis
      });

      this.isRunning = false;
      
      logger.success(`\n🎉 Finality test completed successfully!`);
      this.displayResults(analysis);
      
      return {
        sessionId: this.sessionId,
        results,
        analysis,
        exportPath: await this.exportResults(analysis)
      };

    } catch (error) {
      this.isRunning = false;
      logger.error(`❌ Finality test failed: ${error.message}`);
      throw error;
    }
  }

  // Run health checks on all adapters
  async runHealthChecks() {
    logger.warning(`\n🏥 Running network health checks...`);
    
    const healthChecks = [];
    
    for (const [networkName, adapter] of this.adapters.entries()) {
      healthChecks.push(
        adapter.healthCheck().then(health => ({ networkName, health }))
      );
    }
    
    const results = await Promise.all(healthChecks);
    
    for (const { networkName, health } of results) {
      if (health.rpcConnected) {
        logger.success(`✅ ${networkName}: Connected (Block ${health.blockNumber})`);
      } else {
        logger.error(`❌ ${networkName}: Connection failed - ${health.lastError}`);
      }
    }
  }

  // Run finality test on a specific network
  async runNetworkTest(networkName) {
    const adapter = this.adapters.get(networkName);
    const measurements = [];
    let successCount = 0;
    let failureCount = 0;
    
    logger.info(`📊 Starting ${this.testConfig.transactionCount} measurements on ${networkName}`);
    
    // Get network conditions
    const initialConditions = await adapter.getNetworkConditions();
    logger.info(`🌡️ Network conditions: ${JSON.stringify(initialConditions)}`);

    for (let i = 0; i < this.testConfig.transactionCount; i++) {
      try {
        logger.gray(`  📤 Measurement ${i + 1}/${this.testConfig.transactionCount}...`);
        
        const measurementStart = PrecisionTimer.now();
        
        // Submit test transaction (this would be a simple increment call)
        const txResult = await this.submitTestTransaction(adapter);
        
        // Measure finality
        const finalityMeasurement = await adapter.measureFinality(
          txResult.hash, 
          this.testConfig.finalityThreshold
        );
        
        // Calculate costs
        const costAnalysis = this.calculateCosts(txResult, finalityMeasurement);
        
        // Record measurement
        const measurementData = {
          ...finalityMeasurement,
          transactionCost: costAnalysis.totalCost,
          gasPremium: costAnalysis.gasPremium,
          mevPremium: costAnalysis.mevPremium,
          costPerSecond: costAnalysis.costPerSecond
        };
        
        const measurementId = await this.dataStorage.recordFinalityMeasurement(
          networkName, 
          measurementData
        );
        
        measurements.push({ id: measurementId, ...measurementData });
        successCount++;
        
        const totalTime = PrecisionTimer.elapsedMs(measurementStart);
        logger.success(`    ✅ ${finalityMeasurement.finalityTime.toFixed(2)}ms (${totalTime.toFixed(2)}ms total)`);
        
        // Small delay between measurements
        await PrecisionTimer.sleep(500);
        
      } catch (error) {
        failureCount++;
        logger.error(`    ❌ Measurement ${i + 1} failed: ${error.message}`);
        
        // Record failed measurement
        await this.dataStorage.recordError(networkName, 'finality_measurement', {
          message: error.message,
          stack: error.stack,
          measurementIndex: i + 1
        });
      }
    }
    
    logger.success(`📊 ${networkName} completed: ${successCount}/${this.testConfig.transactionCount} successful`);
    
    return {
      networkName,
      measurements,
      successCount,
      failureCount,
      successRate: (successCount / this.testConfig.transactionCount) * 100,
      networkStats: adapter.getStats(),
      mevConditions: await adapter.getCurrentMevConditions(),
      reorgStats: adapter.getReorganizationStats()
    };
  }

  // Submit a test transaction (placeholder - would use actual contract)
  async submitTestTransaction(adapter) {
    // This is a placeholder for actual transaction submission
    // In practice, this would call adapter.submitTransaction() with a contract
    
    return {
      hash: `0x${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`, // Proper 64-char hash
      blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
      gasUsed: 21000 + Math.floor(Math.random() * 50000),
      gasPrice: '50000000000', // 50 Gwei
      effectiveGasPrice: '52000000000' // 52 Gwei
    };
  }

  // Calculate transaction costs
  calculateCosts(txResult, finalityMeasurement) {
    const gasUsed = parseInt(txResult.gasUsed || '21000');
    const gasPrice = parseInt(txResult.gasPrice || '50000000000');
    const effectiveGasPrice = parseInt(txResult.effectiveGasPrice || gasPrice);
    
    const baseCost = (gasUsed * gasPrice) / 1e18; // ETH
    const actualCost = (gasUsed * effectiveGasPrice) / 1e18; // ETH
    const gasPremium = actualCost - baseCost;
    
    // Estimate MEV premium (simplified)
    const mevScore = finalityMeasurement.initialMevConditions?.currentScore || 0;
    const mevPremium = mevScore > 50 ? actualCost * 0.1 : 0;
    
    const finalityTimeSeconds = finalityMeasurement.finalityTime / 1000;
    const costPerSecond = finalityTimeSeconds > 0 ? actualCost / finalityTimeSeconds : 0;
    
    return {
      totalCost: actualCost,
      baseCost,
      gasPremium,
      mevPremium,
      costPerSecond
    };
  }

  // Generate comprehensive analysis
  async generateAnalysis(results) {
    logger.info(`📊 Generating comprehensive analysis...`);
    
    return this.dataStorage.buildFinalityAnalysis();
  }

  // Display results in console
  displayResults(analysis) {
    logger.cyan(`\n📊 FINALITY TEST RESULTS`);
    logger.cyan(`=`.repeat(60));
    
    // Overall metrics
    const overall = analysis.overallMetrics;
    logger.info(`📈 Total measurements: ${overall.count}`);
    logger.info(`⚡ Fastest finality: ${overall.fastest.toFixed(2)}ms`);
    logger.info(`🐌 Slowest finality: ${overall.slowest.toFixed(2)}ms`);
    logger.info(`📊 Median finality: ${overall.median.toFixed(2)}ms`);
    logger.info(`💰 Lowest cost: $${(overall.lowestCost * 3000).toFixed(4)}`); // Assume $3000 ETH
    
    // Network-specific results
    logger.cyan(`\n🌐 NETWORK COMPARISON:`);
    Object.entries(analysis.networkAnalysis).forEach(([network, data]) => {
      logger.info(`${network}:`);
      logger.info(`  ⚡ Avg finality: ${data.averageFinality.toFixed(2)}ms`);
      logger.info(`  💰 Avg cost: $${(data.averageCost * 3000).toFixed(4)}`);
      logger.info(`  🛡️ Reliability: ${data.reliability.toFixed(1)}%`);
      logger.info(`  🤖 MEV risk: ${data.mevRisk}`);
    });
    
    // Fastest and lowest recommendations
    logger.cyan(`\n🏆 RECOMMENDATIONS:`);
    logger.success(`🚀 Fastest finality: ${analysis.fastestFinality.network} (${analysis.fastestFinality.finalityTime.toFixed(2)}ms)`);
    logger.success(`💰 Lowest cost: ${analysis.lowestCostFinality.network} ($${(analysis.lowestCostFinality.cost * 3000).toFixed(4)})`);
    
    // MEV impact analysis
    if (analysis.mevImpactAnalysis.totalMevAffected > 0) {
      logger.warning(`\n🤖 MEV IMPACT:`);
      logger.warning(`📊 ${analysis.mevImpactAnalysis.mevAffectedPercentage.toFixed(1)}% of measurements affected by MEV`);
      logger.warning(`📈 Average MEV score: ${analysis.mevImpactAnalysis.averageMevScore.toFixed(1)}`);
      logger.warning(`🔄 MEV-related reorganizations: ${analysis.mevImpactAnalysis.mevReorganizations}`);
    }
  }

  // Export results
  async exportResults(analysis) {
    const exportData = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      testConfig: this.testConfig,
      analysis,
      metadata: {
        version: '1.0.0',
        mevAware: this.options.mevAware,
        totalNetworks: this.adapters.size
      }
    };

    // Save export file
    const fs = require('fs');
    const path = require('path');
    const exportPath = path.join(process.cwd(), `finality-results-${this.sessionId}.json`);
    
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    logger.success(`💾 Results exported to: ${exportPath}`);
    
    return exportPath;
  }

  // Cleanup resources
  async cleanup() {
    for (const [networkName, adapter] of this.adapters.entries()) {
      try {
        await adapter.cleanup();
      } catch (error) {
        logger.error(`Failed to cleanup adapter ${networkName}: ${error.message}`);
      }
    }
    
    this.adapters.clear();
    this.isRunning = false;
    
    logger.info(`🧹 FinalityController cleanup completed`);
  }

  // Get current status
  getStatus() {
    return {
      sessionId: this.sessionId,
      isRunning: this.isRunning,
      registeredNetworks: Array.from(this.adapters.keys()),
      testConfig: this.testConfig,
      mevAware: this.options.mevAware
    };
  }
}

module.exports = { FinalityController };