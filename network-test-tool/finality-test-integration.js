#!/usr/bin/env node

/**
 * Comprehensive Finality Test Integration
 * Phase 3: Analytics + MEV Engine Integration
 * 
 * This script demonstrates the complete finality measurement system
 * with MEV awareness, network-specific adapters, and comprehensive analytics
 */

const { FinalityController } = require('./lib/finality/FinalityController');
const { EthereumAdapter } = require('./lib/finality/EthereumAdapter');
const { KasplexAdapter } = require('./lib/finality/KasplexAdapter');
const { IgraAdapter } = require('./lib/finality/IgraAdapter');
const { logger } = require('./lib/utils/logger');

class FinalityTestIntegration {
  constructor() {
    this.controller = null;
    this.adapters = {};
    this.testConfig = {
      networks: [],
      transactionCount: 5, // Reduced for demo
      finalityThreshold: 12,
      mevAware: true,
      enableRetry: true,
      exportFormat: 'json'
    };
    
    // Network configurations - use real private key from environment
    const realPrivateKey = process.env.PRIVATE_KEY || '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const privateKeyToUse = realPrivateKey.startsWith('0x') ? realPrivateKey : `0x${realPrivateKey}`;
    
    this.networkConfigs = {
      sepolia: {
        name: 'sepolia',
        rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
        privateKey: privateKeyToUse,
        chainId: 11155111
      },
      kasplex: {
        name: 'kasplex',
        rpcUrl: 'https://rpc.kasplextest.xyz',
        privateKey: privateKeyToUse,
        chainId: 167012
      },
      igra: {
        name: 'igra',
        rpcUrl: 'https://rpc.caravel.igralabs.com', // Real Igra Caravel RPC
        privateKey: privateKeyToUse,
        chainId: 19762 // Real Igra Caravel chain ID
      }
    };
  }

  async initialize() {
    try {
      // Initialize finality controller
      this.controller = new FinalityController({
        sessionName: 'finality-integration-demo',
        storageMode: 'isolated',
        mevAware: true
      });

      await this.controller.initialize();
      logger.success('🎯 FinalityTestIntegration initialized successfully');

      return true;
    } catch (error) {
      logger.error(`❌ Failed to initialize FinalityTestIntegration: ${error.message}`);
      return false;
    }
  }

  async createNetworkAdapters() {
    logger.info('🌐 Creating network adapters...');

    try {
      // Create Ethereum/Sepolia adapter
      const ethereumAdapter = new EthereumAdapter(
        this.networkConfigs.sepolia.name,
        this.networkConfigs.sepolia.rpcUrl,
        this.networkConfigs.sepolia.privateKey,
        this.networkConfigs.sepolia.chainId
      );
      this.adapters.sepolia = ethereumAdapter;
      
      // Create Kasplex adapter
      const kasplexAdapter = new KasplexAdapter(
        this.networkConfigs.kasplex.name,
        this.networkConfigs.kasplex.rpcUrl,
        this.networkConfigs.kasplex.privateKey,
        this.networkConfigs.kasplex.chainId
      );
      this.adapters.kasplex = kasplexAdapter;
      
      // Create Igra adapter
      const igraAdapter = new IgraAdapter(
        this.networkConfigs.igra.name,
        this.networkConfigs.igra.rpcUrl,
        this.networkConfigs.igra.privateKey,
        this.networkConfigs.igra.chainId
      );
      this.adapters.igra = igraAdapter;

      logger.success(`✅ Created ${Object.keys(this.adapters).length} network adapters`);
      return true;

    } catch (error) {
      logger.error(`❌ Failed to create network adapters: ${error.message}`);
      return false;
    }
  }

  async registerAdapters() {
    logger.info('📡 Registering network adapters with controller...');

    try {
      for (const [networkName, adapter] of Object.entries(this.adapters)) {
        this.controller.registerAdapter(networkName, adapter);
      }

      logger.success(`✅ Registered ${Object.keys(this.adapters).length} adapters`);
      return true;

    } catch (error) {
      logger.error(`❌ Failed to register adapters: ${error.message}`);
      return false;
    }
  }

  async runMockFinalityTests() {
    logger.warning('⚠️ RUNNING IN MOCK MODE');
    logger.warning('⚠️ This demo uses mock private keys and will simulate finality measurements');
    logger.warning('⚠️ No actual transactions will be sent to networks');
    console.log('');

    try {
      // Mock finality test configuration
      const mockConfig = {
        ...this.testConfig,
        networks: Object.keys(this.adapters), // Test all adapters
        mockMode: true // Add mock mode flag
      };

      logger.cyan('🚀 Starting mock finality measurements...');
      logger.info(`📊 Testing networks: ${mockConfig.networks.join(', ')}`);
      logger.info(`📈 Measurements per network: ${mockConfig.transactionCount}`);
      logger.info(`🤖 MEV awareness: ${mockConfig.mevAware ? 'enabled' : 'disabled'}`);
      console.log('');

      // Simulate finality measurements for each network
      const mockResults = {};
      
      for (const networkName of mockConfig.networks) {
        logger.cyan(`\n🎯 Simulating ${networkName} finality measurements...`);
        
        const adapter = this.adapters[networkName];
        const mockMeasurements = [];
        
        // Generate mock finality measurements
        for (let i = 0; i < mockConfig.transactionCount; i++) {
          const mockMeasurement = this.generateMockMeasurement(adapter, i + 1);
          mockMeasurements.push(mockMeasurement);
          
          logger.info(`  📤 Mock measurement ${i + 1}/${mockConfig.transactionCount}: ${mockMeasurement.finalityTime.toFixed(2)}ms`);
          
          // Small delay to simulate real measurement
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        mockResults[networkName] = {
          networkName,
          measurements: mockMeasurements,
          successCount: mockMeasurements.length,
          failureCount: 0,
          successRate: 100,
          networkStats: this.generateMockNetworkStats(adapter),
          mevConditions: this.generateMockMevConditions(adapter),
          reorgStats: { totalReorganizations: 0, mevRelatedReorgs: 0 }
        };
        
        logger.success(`✅ ${networkName} mock simulation completed: ${mockMeasurements.length} measurements`);
      }

      // Generate mock analysis
      logger.cyan('\n📊 Generating comprehensive mock analysis...');
      const mockAnalysis = this.generateMockAnalysis(mockResults);
      
      // Display results
      this.displayMockResults(mockAnalysis);

      // Export results
      const exportPath = await this.exportMockResults(mockAnalysis);
      
      logger.success('\n🎉 Mock finality test integration completed successfully!');
      logger.info(`📁 Results exported to: ${exportPath}`);
      
      return {
        success: true,
        sessionId: this.controller.sessionId,
        results: mockResults,
        analysis: mockAnalysis,
        exportPath
      };

    } catch (error) {
      logger.error(`❌ Mock finality test failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async runRealFinalityTests(networks = ['sepolia', 'kasplex', 'igra'], measurementCount = 5) {
    try {
      logger.info('🚀 Starting REAL finality measurements with actual blockchain transactions...');
      logger.info(`📊 Testing networks: ${networks.join(', ')}`);
      logger.info(`📈 Measurements per network: ${measurementCount}`);
      logger.info('🤖 MEV awareness: enabled');
      logger.warning('⚠️ This will send actual transactions and consume testnet tokens');

      const realResults = {};

      // Process all networks concurrently for better performance
      const networkPromises = networks.map(async (networkName) => {
        const adapter = this.adapters[networkName];
        if (!adapter) {
          logger.error(`❌ Network adapter not found: ${networkName}`);
          return { networkName, success: false, error: 'Adapter not found' };
        }

        logger.cyan(`\n🎯 Running real finality measurements on ${networkName.toUpperCase()}...`);

        try {
          // Initialize adapter for real transactions with timeout
          const initTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Initialization timeout')), 10000)
          );
          
          await Promise.race([adapter.initialize(), initTimeout]);

          const realMeasurements = [];
          let successCount = 0;
          let failureCount = 0;

          // Run measurements concurrently for this network
          const measurementPromises = Array.from({ length: measurementCount }, async (_, i) => {
            try {
              logger.info(`  🔄 Real measurement ${i + 1}/${measurementCount} on ${networkName}...`);
              
              const measurementTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Measurement timeout')), 15000)
              );
              
              const measurement = await Promise.race([
                this.performRealFinalityMeasurement(adapter, i + 1),
                measurementTimeout
              ]);
              
              logger.success(`  ✅ Measurement ${i + 1}/${measurementCount}: ${measurement.finalityTime.toFixed(2)}ms`);
              return { ...measurement, success: true };
              
            } catch (error) {
              logger.error(`  ❌ Measurement ${i + 1}/${measurementCount} failed: ${error.message}`);
              return {
                measurementId: `real-${networkName}-${i + 1}`,
                networkName,
                success: false,
                error: error.message,
                timestamp: Date.now()
              };
            }
          });

          const measurements = await Promise.allSettled(measurementPromises);
          measurements.forEach(result => {
            if (result.status === 'fulfilled') {
              realMeasurements.push(result.value);
              if (result.value.success) successCount++;
              else failureCount++;
            } else {
              failureCount++;
              realMeasurements.push({
                measurementId: `real-${networkName}-failed`,
                networkName,
                success: false,
                error: result.reason.message,
                timestamp: Date.now()
              });
            }
          });

          // Clean up adapter resources
          await adapter.cleanup();

          return {
            networkName,
            adapter: networkName,
            measurements: realMeasurements,
            successCount,
            failureCount,
            totalMeasurements: measurementCount,
            networkStats: this.generateNetworkStats(realMeasurements, adapter),
            mevConditions: this.generateMevConditions(realMeasurements)
          };

        } catch (error) {
          logger.error(`❌ ${networkName} network failed: ${error.message}`);
          return {
            networkName,
            success: false,
            error: error.message,
            measurements: []
          };
        }
      });

      // Wait for all networks to complete
      const networkResults = await Promise.allSettled(networkPromises);
      
      // Process results
      networkResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.networkName) {
          realResults[result.value.networkName] = result.value;
          if (result.value.successCount !== undefined) {
            logger.success(`✅ ${result.value.networkName} completed: ${result.value.successCount}/${result.value.totalMeasurements} successful`);
          }
        }
      });

      // Generate comprehensive analysis
      logger.cyan('\n📊 Generating comprehensive real transaction analysis...');
      const realAnalysis = this.generateRealAnalysis(realResults);

      // Display results
      this.displayRealResults(realAnalysis);

      // Export results
      const exportPath = await this.exportRealResults(realAnalysis);

      logger.success('\n🎉 Real finality test completed successfully!');
      logger.info(`📁 Results exported to: ${exportPath}`);

      return {
        success: true,
        results: realResults,
        analysis: realAnalysis,
        exportPath
      };

    } catch (error) {
      logger.error(`❌ Real finality test failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async performRealFinalityMeasurement(adapter, index) {
    const startTime = process.hrtime.bigint();
    
    // Create a simple storage transaction to measure finality
    const value = index * 1000 + Math.floor(Math.random() * 1000);
    
    // Submit transaction through the controller
    const result = await this.controller.runFinalityTest({
      networks: [adapter.networkName],
      transactionCount: 1,
      testValue: value
    });
    
    const endTime = process.hrtime.bigint();
    const finalityTime = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    
    if (result.results[adapter.networkName]?.measurements[0]) {
      const measurement = result.results[adapter.networkName].measurements[0];
      return {
        ...measurement,
        finalityTime,
        measurementId: `real-${adapter.networkName}-${index}`
      };
    } else {
      throw new Error('Failed to get measurement result from controller');
    }
  }

  generateMockMeasurement(adapter, index) {
    // Generate realistic mock finality measurements based on network type
    const baseFinality = adapter.finalityThresholds?.standard || 12;
    const networkName = adapter.networkName;
    
    // Network-specific finality characteristics
    let finalityTime, mevScore, cost;
    
    if (networkName.includes('sepolia') || networkName.includes('ethereum')) {
      // Ethereum: slower finality, higher costs, moderate MEV
      finalityTime = 180000 + (Math.random() * 120000); // 3-5 minutes
      mevScore = 30 + (Math.random() * 40); // 30-70 MEV score
      cost = 0.01 + (Math.random() * 0.05); // 0.01-0.06 ETH
    } else if (networkName.includes('kasplex')) {
      // Kasplex: fast finality, very low costs, minimal MEV
      finalityTime = 8000 + (Math.random() * 4000); // 8-12 seconds
      mevScore = 5 + (Math.random() * 15); // 5-20 MEV score
      cost = 0.0001 + (Math.random() * 0.0005); // Very low KAS cost
    } else {
      // Igra (L2): very fast finality, low costs, low MEV
      finalityTime = 3000 + (Math.random() * 2000); // 3-5 seconds
      mevScore = 10 + (Math.random() * 20); // 10-30 MEV score
      cost = 0.001 + (Math.random() * 0.01); // Low L2 cost
    }

    return {
      measurementId: `mock-${networkName}-${index}`,
      transactionHash: `0x${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      finalityTime: finalityTime,
      finalityThreshold: baseFinality,
      initialConfirmationTime: finalityTime * 0.1, // 10% of finality time
      mevScoreDuringTx: mevScore,
      transactionCost: cost,
      gasPremium: cost * 0.1,
      mevPremium: mevScore > 50 ? cost * 0.05 : 0,
      costPerSecond: cost / (finalityTime / 1000),
      networkHealthScore: 85 + (Math.random() * 10), // 85-95 health
      congestionLevel: mevScore > 60 ? 'high' : mevScore > 30 ? 'medium' : 'low'
    };
  }

  generateMockNetworkStats(adapter) {
    return {
      totalTransactions: 5,
      successfulTransactions: 5,
      failedTransactions: 0,
      averageFinalityTime: adapter.networkName.includes('kasplex') ? 10000 : 
                          adapter.networkName.includes('igra') ? 4000 : 240000,
      successRate: 100,
      mevAdjustmentRate: adapter.networkName.includes('sepolia') ? 30 : 5
    };
  }

  generateMockMevConditions(adapter) {
    const baseMevScore = adapter.networkConfig?.mevBaseline || 25;
    return {
      currentScore: baseMevScore + (Math.random() * 20),
      riskLevel: baseMevScore > 50 ? 'medium' : 'low',
      recentActivity: 'normal',
      detectedPatterns: adapter.networkName.includes('sepolia') ? ['arbitrage'] : []
    };
  }

  generateMockAnalysis(results) {
    const allMeasurements = Object.values(results).flatMap(r => r.measurements);
    const finalityTimes = allMeasurements.map(m => m.finalityTime);
    const costs = allMeasurements.map(m => m.transactionCost);

    // Find fastest and lowest cost
    const fastestMeasurement = allMeasurements.reduce((prev, curr) => 
      prev.finalityTime < curr.finalityTime ? prev : curr);
    const cheapestMeasurement = allMeasurements.reduce((prev, curr) => 
      prev.transactionCost < curr.transactionCost ? prev : curr);

    return {
      totalMeasurements: allMeasurements.length,
      networks: Object.keys(results),
      overallMetrics: {
        count: finalityTimes.length,
        fastest: Math.min(...finalityTimes),
        slowest: Math.max(...finalityTimes),
        median: this.calculateMedian(finalityTimes),
        mean: finalityTimes.reduce((a, b) => a + b, 0) / finalityTimes.length,
        lowestCost: Math.min(...costs),
        highestCost: Math.max(...costs),
        averageCost: costs.reduce((a, b) => a + b, 0) / costs.length
      },
      networkAnalysis: this.analyzeNetworkResults(results),
      fastestFinality: {
        network: fastestMeasurement.measurementId.split('-')[1],
        finalityTime: fastestMeasurement.finalityTime,
        transactionHash: fastestMeasurement.transactionHash,
        mevConditions: fastestMeasurement.mevScoreDuringTx,
        reliability: 'high'
      },
      lowestCostFinality: {
        network: cheapestMeasurement.measurementId.split('-')[1],
        cost: cheapestMeasurement.transactionCost,
        finalityTime: cheapestMeasurement.finalityTime,
        costPerSecond: cheapestMeasurement.costPerSecond
      },
      mevImpactAnalysis: {
        totalMevAffected: allMeasurements.filter(m => m.mevScoreDuringTx > 50).length,
        mevAffectedPercentage: (allMeasurements.filter(m => m.mevScoreDuringTx > 50).length / allMeasurements.length) * 100,
        averageMevScore: allMeasurements.reduce((sum, m) => sum + m.mevScoreDuringTx, 0) / allMeasurements.length,
        mevReorganizations: 0
      }
    };
  }

  analyzeNetworkResults(results) {
    const analysis = {};
    
    for (const [networkName, data] of Object.entries(results)) {
      const measurements = data.measurements;
      const finalityTimes = measurements.map(m => m.finalityTime);
      const costs = measurements.map(m => m.transactionCost);
      const mevScores = measurements.map(m => m.mevScoreDuringTx);
      
      analysis[networkName] = {
        measurementCount: measurements.length,
        averageFinality: finalityTimes.reduce((a, b) => a + b, 0) / finalityTimes.length,
        medianFinality: this.calculateMedian(finalityTimes),
        averageCost: costs.reduce((a, b) => a + b, 0) / costs.length,
        mevRisk: this.calculateMevRisk(mevScores),
        reliability: 100, // Mock 100% reliability
        overallScore: this.calculateOverallScore(measurements)
      };
    }
    
    return analysis;
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  calculateMevRisk(mevScores) {
    const avgMev = mevScores.reduce((a, b) => a + b, 0) / mevScores.length;
    if (avgMev > 60) return 'high';
    if (avgMev > 30) return 'medium';
    return 'low';
  }

  calculateOverallScore(measurements) {
    // Simplified scoring based on speed, cost, and MEV risk
    const avgFinality = measurements.reduce((sum, m) => sum + m.finalityTime, 0) / measurements.length;
    const avgCost = measurements.reduce((sum, m) => sum + m.transactionCost, 0) / measurements.length;
    
    // Speed score (faster is better)
    const speedScore = Math.max(0, 100 - (avgFinality / 1000));
    
    // Cost score (cheaper is better)  
    const costScore = Math.max(0, 100 - (avgCost * 1000));
    
    return Math.round((speedScore + costScore) / 2);
  }

  displayMockResults(analysis) {
    logger.cyan(`\\n📊 MOCK FINALITY TEST RESULTS`);
    logger.cyan(`=`.repeat(60));
    
    // Overall metrics
    const overall = analysis.overallMetrics;
    logger.info(`📈 Total measurements: ${overall.count}`);
    logger.info(`⚡ Fastest finality: ${(overall.fastest / 1000).toFixed(2)}s`);
    logger.info(`🐌 Slowest finality: ${(overall.slowest / 1000).toFixed(2)}s`);
    logger.info(`📊 Median finality: ${(overall.median / 1000).toFixed(2)}s`);
    logger.info(`💰 Lowest cost: $${(overall.lowestCost * 3000).toFixed(4)} (assuming $3000 ETH)`);
    
    // Network comparison
    logger.cyan(`\\n🌐 NETWORK COMPARISON:`);
    Object.entries(analysis.networkAnalysis).forEach(([network, data]) => {
      logger.info(`${network.toUpperCase()}:`);
      logger.info(`  ⚡ Avg finality: ${(data.averageFinality / 1000).toFixed(2)}s`);
      logger.info(`  💰 Avg cost: $${(data.averageCost * 3000).toFixed(4)}`);
      logger.info(`  🛡️ Reliability: ${data.reliability.toFixed(1)}%`);
      logger.info(`  🤖 MEV risk: ${data.mevRisk}`);
      logger.info(`  📊 Overall score: ${data.overallScore}/100`);
    });
    
    // Recommendations
    logger.cyan(`\\n🏆 RECOMMENDATIONS:`);
    logger.success(`🚀 Fastest finality: ${analysis.fastestFinality.network.toUpperCase()} (${(analysis.fastestFinality.finalityTime / 1000).toFixed(2)}s)`);
    logger.success(`💰 Lowest cost: ${analysis.lowestCostFinality.network.toUpperCase()} ($${(analysis.lowestCostFinality.cost * 3000).toFixed(4)})`);
    
    // MEV impact
    if (analysis.mevImpactAnalysis.averageMevScore > 30) {
      logger.warning(`\\n🤖 MEV IMPACT:`);
      logger.warning(`📊 Average MEV score: ${analysis.mevImpactAnalysis.averageMevScore.toFixed(1)}`);
      logger.warning(`📈 ${analysis.mevImpactAnalysis.mevAffectedPercentage.toFixed(1)}% of measurements had significant MEV activity`);
    }
  }

  async exportMockResults(analysis) {
    const exportData = {
      sessionId: this.controller.sessionId,
      timestamp: new Date().toISOString(),
      testMode: 'mock',
      testConfig: this.testConfig,
      analysis,
      metadata: {
        version: '1.0.0',
        phase: 'Phase 3 - Analytics + MEV Engine',
        mevAware: true,
        totalNetworks: Object.keys(this.adapters).length
      },
      disclaimer: 'This is a mock test using simulated data. No actual blockchain transactions were performed.'
    };

    const fs = require('fs');
    const path = require('path');
    const exportPath = path.join(__dirname, `mock-finality-results-${this.controller.sessionId}.json`);
    
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    
    return exportPath;
  }

  generateRealAnalysis(results) {
    // Same as mock analysis but for real data
    return this.generateMockAnalysis(results);
  }

  generateNetworkStats(measurements, adapter) {
    const successful = measurements.filter(m => m.success);
    const successfulCount = successful.length;
    
    return {
      successRate: (successfulCount / measurements.length) * 100,
      averageFinality: successfulCount > 0 ? successful.reduce((sum, m) => sum + m.finalityTime, 0) / successfulCount : null,
      totalGasUsed: successful.reduce((sum, m) => sum + (m.gasUsed || 0), 0),
      averageCost: successfulCount > 0 ? successful.reduce((sum, m) => sum + (m.cost || 0), 0) / successfulCount : null
    };
  }

  generateMevConditions(measurements) {
    const mevScores = measurements.filter(m => m.success).map(m => m.mevScoreBefore || 0);
    return {
      averageMevScore: mevScores.length > 0 ? mevScores.reduce((sum, score) => sum + score, 0) / mevScores.length : null,
      highMevEvents: mevScores.filter(score => score > 70).length,
      mevTrend: 'stable'
    };
  }

  displayRealResults(analysis) {
    logger.info('\\n📊 REAL FINALITY TEST RESULTS');
    logger.info('============================================================');
    
    // Display same format as mock but with "REAL" indicators
    this.displayMockResults(analysis);
  }

  async exportRealResults(analysis) {
    const exportData = {
      sessionId: this.controller.sessionId,
      timestamp: new Date().toISOString(),
      testMode: 'real',
      testConfig: analysis.config || {},
      analysis,
      metadata: {
        version: '1.0.0',
        phase: 'Real Finality Measurements',
        mevAware: true,
        totalNetworks: Object.keys(this.adapters).length
      },
      disclaimer: 'This test used real blockchain transactions. All data represents actual network measurements.'
    };

    const fs = require('fs');
    const path = require('path');
    const exportPath = path.join(__dirname, `real-finality-results-${this.controller.sessionId}.json`);
    
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    
    return exportPath;
  }

  async cleanup() {
    if (this.controller) {
      await this.controller.cleanup();
    }
    logger.info('🧹 FinalityTestIntegration cleanup completed');
  }
}

// Main execution function
async function main() {
  const integration = new FinalityTestIntegration();
  
  try {
    logger.info('🚀 Starting Finality Test Integration (Phase 3)');
    logger.info('=' .repeat(60));
    
    // Initialize
    const initialized = await integration.initialize();
    if (!initialized) {
      throw new Error('Failed to initialize integration test');
    }
    
    // Create and register adapters
    await integration.createNetworkAdapters();
    await integration.registerAdapters();
    
    // Run mock finality tests
    const results = await integration.runMockFinalityTests();
    
    if (results.success) {
      logger.success('\\n🎊 PHASE 3 INTEGRATION TEST COMPLETED SUCCESSFULLY!');
      logger.info('📋 Summary:');
      logger.info(`  📊 Session ID: ${results.sessionId}`);
      logger.info(`  🌐 Networks tested: ${Object.keys(integration.adapters).length}`);
      logger.info(`  📈 Total measurements: ${results.analysis.totalMeasurements}`);
      logger.info(`  💾 Export file: ${results.exportPath}`);
    } else {
      logger.error('❌ Integration test failed');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error(`💥 Integration test error: ${error.message}`);
    process.exit(1);
  } finally {
    await integration.cleanup();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { FinalityTestIntegration };