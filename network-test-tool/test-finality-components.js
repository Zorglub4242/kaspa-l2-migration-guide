#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Finality Measurement Components
 * Tests all Phase 1 components and identifies issues
 */

const fs = require('fs');
const path = require('path');

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  warnings: [],
  summary: {}
};

function logTest(testName, status, details = '') {
  const timestamp = new Date().toISOString().substring(11, 19);
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`[${timestamp}] ${icon} ${testName}${details ? ': ' + details : ''}`);
  
  if (status === 'PASS') {
    testResults.passed++;
  } else if (status === 'FAIL') {
    testResults.failed++;
    testResults.errors.push({ test: testName, details });
  } else {
    testResults.warnings.push({ test: testName, details });
  }
}

function testFileExists(filePath, description) {
  try {
    if (fs.existsSync(filePath)) {
      logTest(`File exists: ${description}`, 'PASS', filePath);
      return true;
    } else {
      logTest(`File missing: ${description}`, 'FAIL', filePath);
      return false;
    }
  } catch (error) {
    logTest(`File check error: ${description}`, 'FAIL', error.message);
    return false;
  }
}

function testRequire(modulePath, description) {
  try {
    const module = require(modulePath);
    logTest(`Module loads: ${description}`, 'PASS', modulePath);
    return module;
  } catch (error) {
    logTest(`Module load error: ${description}`, 'FAIL', error.message);
    return null;
  }
}

function testClassInstantiation(ClassConstructor, className, ...args) {
  try {
    const instance = new ClassConstructor(...args);
    logTest(`Class instantiation: ${className}`, 'PASS');
    return instance;
  } catch (error) {
    logTest(`Class instantiation: ${className}`, 'FAIL', error.message);
    return null;
  }
}

async function testAsyncMethod(instance, methodName, ...args) {
  try {
    const result = await instance[methodName](...args);
    logTest(`Async method: ${methodName}`, 'PASS');
    return result;
  } catch (error) {
    logTest(`Async method: ${methodName}`, 'FAIL', error.message);
    return null;
  }
}

function testSyncMethod(instance, methodName, ...args) {
  try {
    const result = instance[methodName](...args);
    logTest(`Sync method: ${methodName}`, 'PASS');
    return result;
  } catch (error) {
    logTest(`Sync method: ${methodName}`, 'FAIL', error.message);
    return null;
  }
}

async function runTests() {
  console.log('🧪 COMPREHENSIVE FINALITY COMPONENT TESTING');
  console.log('=' .repeat(60));
  
  // Change to the correct directory
  const testDir = path.join(__dirname);
  process.chdir(testDir);
  
  console.log(`📁 Testing from directory: ${testDir}`);
  console.log('');

  // Test 1: Directory Structure
  console.log('📂 TESTING DIRECTORY STRUCTURE');
  testFileExists('./lib', 'lib directory');
  testFileExists('./lib/finality', 'finality directory');
  testFileExists('./lib/mev', 'mev directory');
  testFileExists('./lib/utils', 'utils directory');
  console.log('');

  // Test 2: Core Files
  console.log('📄 TESTING CORE FILES');
  const loggerExists = testFileExists('./lib/utils/logger.js', 'Logger utility');
  const precisionTimerExists = testFileExists('./lib/utils/PrecisionTimer.js', 'PrecisionTimer utility');
  const finalityDataStorageExists = testFileExists('./lib/finality/FinalityDataStorage.js', 'FinalityDataStorage');
  const mevMonitorExists = testFileExists('./lib/mev/MevActivityMonitor.js', 'MevActivityMonitor');
  const reorgMonitorExists = testFileExists('./lib/mev/ReorganizationMonitor.js', 'ReorganizationMonitor');
  console.log('');

  // Test 3: Module Loading
  console.log('📦 TESTING MODULE LOADING');
  const logger = loggerExists ? testRequire('./lib/utils/logger.js', 'Logger module') : null;
  const PrecisionTimer = precisionTimerExists ? testRequire('./lib/utils/PrecisionTimer.js', 'PrecisionTimer module') : null;
  const FinalityDataStorage = finalityDataStorageExists ? testRequire('./lib/finality/FinalityDataStorage.js', 'FinalityDataStorage module') : null;
  const MevActivityMonitor = mevMonitorExists ? testRequire('./lib/mev/MevActivityMonitor.js', 'MevActivityMonitor module') : null;
  const ReorganizationMonitor = reorgMonitorExists ? testRequire('./lib/mev/ReorganizationMonitor.js', 'ReorganizationMonitor module') : null;
  console.log('');

  // Test 4: Class Extraction
  console.log('🏗️ TESTING CLASS EXTRACTION');
  let LoggerClass = null, PrecisionTimerClass = null, FinalityDataStorageClass = null;
  let MevActivityMonitorClass = null, ReorganizationMonitorClass = null;

  if (logger) {
    LoggerClass = logger.logger || logger.Logger || logger;
    if (LoggerClass) {
      logTest('Logger class extraction', 'PASS');
    } else {
      logTest('Logger class extraction', 'FAIL', 'Could not extract logger class');
    }
  }

  if (PrecisionTimer) {
    PrecisionTimerClass = PrecisionTimer.PrecisionTimer || PrecisionTimer;
    if (PrecisionTimerClass) {
      logTest('PrecisionTimer class extraction', 'PASS');
    } else {
      logTest('PrecisionTimer class extraction', 'FAIL', 'Could not extract PrecisionTimer class');
    }
  }

  if (FinalityDataStorage) {
    FinalityDataStorageClass = FinalityDataStorage.FinalityDataStorage || FinalityDataStorage;
    if (FinalityDataStorageClass) {
      logTest('FinalityDataStorage class extraction', 'PASS');
    } else {
      logTest('FinalityDataStorage class extraction', 'FAIL', 'Could not extract FinalityDataStorage class');
    }
  }

  if (MevActivityMonitor) {
    MevActivityMonitorClass = MevActivityMonitor.MevActivityMonitor || MevActivityMonitor;
    if (MevActivityMonitorClass) {
      logTest('MevActivityMonitor class extraction', 'PASS');
    } else {
      logTest('MevActivityMonitor class extraction', 'FAIL', 'Could not extract MevActivityMonitor class');
    }
  }

  if (ReorganizationMonitor) {
    ReorganizationMonitorClass = ReorganizationMonitor.ReorganizationMonitor || ReorganizationMonitor;
    if (ReorganizationMonitorClass) {
      logTest('ReorganizationMonitor class extraction', 'PASS');
    } else {
      logTest('ReorganizationMonitor class extraction', 'FAIL', 'Could not extract ReorganizationMonitor class');
    }
  }
  console.log('');

  // Test 5: PrecisionTimer Static Methods
  console.log('⏰ TESTING PRECISION TIMER');
  if (PrecisionTimerClass) {
    const startTime = testSyncMethod(PrecisionTimerClass, 'now');
    if (startTime) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
      const endTime = testSyncMethod(PrecisionTimerClass, 'now');
      const elapsed = testSyncMethod(PrecisionTimerClass, 'elapsedMs', startTime, endTime);
      
      if (elapsed && elapsed > 90 && elapsed < 150) {
        logTest('PrecisionTimer timing accuracy', 'PASS', `${elapsed.toFixed(2)}ms`);
      } else {
        logTest('PrecisionTimer timing accuracy', 'FAIL', `Expected ~100ms, got ${elapsed}ms`);
      }
    }

    // Test monotonic timing
    const monotonicResult = await testAsyncMethod(PrecisionTimerClass, 'monotonic', async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'test';
    });

    if (monotonicResult && monotonicResult.result === 'test' && monotonicResult.elapsed > 40) {
      logTest('PrecisionTimer monotonic timing', 'PASS', `${monotonicResult.elapsed.toFixed(2)}ms`);
    }
  }
  console.log('');

  // Test 6: FinalityDataStorage
  console.log('💾 TESTING FINALITY DATA STORAGE');
  if (FinalityDataStorageClass) {
    const dataStorage = testClassInstantiation(FinalityDataStorageClass, 'FinalityDataStorage', { 
      storageMode: 'isolated',
      sessionName: 'test-session' 
    });

    if (dataStorage) {
      const sessionId = await testAsyncMethod(dataStorage, 'init');
      if (sessionId) {
        logTest('FinalityDataStorage initialization', 'PASS', sessionId);

        // Test recording finality measurement
        const measurementData = {
          transactionHash: '0x123abc',
          finalityTime: 15000,
          finalityThreshold: 12,
          mevScoreDuringTx: 45,
          transactionCost: 0.001
        };

        const measurementId = await testAsyncMethod(dataStorage, 'recordFinalityMeasurement', 'ethereum', measurementData);
        if (measurementId) {
          logTest('FinalityDataStorage measurement recording', 'PASS', measurementId);
        }

        // Test MEV event recording
        const mevEventData = {
          eventType: 'high_activity',
          mevScore: 75,
          blockNumber: 18000000,
          impact: 'finality_delay'
        };

        const mevEventId = await testAsyncMethod(dataStorage, 'recordMevEvent', 'ethereum', mevEventData);
        if (mevEventId) {
          logTest('FinalityDataStorage MEV event recording', 'PASS', mevEventId);
        }
      }
    }
  }
  console.log('');

  // Test 7: MEV Activity Monitor  
  console.log('🤖 TESTING MEV ACTIVITY MONITOR');
  if (MevActivityMonitorClass) {
    // Create a mock provider for testing
    const mockProvider = {
      getBlockWithTransactions: async () => ({
        number: 18000000,
        timestamp: Math.floor(Date.now() / 1000),
        transactions: [
          {
            gasPrice: '50000000000', // 50 Gwei
            gasLimit: '100000',
            from: '0x123',
            to: '0x456',
            value: '1000000000000000000' // 1 ETH
          },
          {
            gasPrice: '100000000000', // 100 Gwei
            gasLimit: '200000',
            from: '0x789',
            to: '0xabc',
            value: '0'
          }
        ]
      })
    };

    const mevMonitor = testClassInstantiation(MevActivityMonitorClass, 'MevActivityMonitor', 'ethereum', mockProvider);

    if (mevMonitor) {
      const currentScore = testSyncMethod(mevMonitor, 'getCurrentScore');
      if (typeof currentScore === 'number') {
        logTest('MevActivityMonitor score retrieval', 'PASS', `Score: ${currentScore}`);
      }

      const mevConditions = await testAsyncMethod(mevMonitor, 'getCurrentMevConditions');
      if (mevConditions && typeof mevConditions.currentScore === 'number') {
        logTest('MevActivityMonitor conditions analysis', 'PASS', `Risk: ${mevConditions.riskLevel}`);
      }

      // Test block analysis
      await testAsyncMethod(mevMonitor, 'analyzeLatestBlock');
    }
  }
  console.log('');

  // Test 8: Reorganization Monitor
  console.log('🔄 TESTING REORGANIZATION MONITOR');
  if (ReorganizationMonitorClass) {
    const mockProvider = {
      getBlockNumber: async () => 18000000,
      getBlock: async (blockNumber) => ({
        number: blockNumber,
        hash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
        timestamp: Math.floor(Date.now() / 1000)
      }),
      getBlockWithTransactions: async (blockNumber) => ({
        number: blockNumber,
        hash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
        timestamp: Math.floor(Date.now() / 1000),
        transactions: []
      })
    };

    const reorgMonitor = testClassInstantiation(ReorganizationMonitorClass, 'ReorganizationMonitor', 'ethereum', mockProvider);

    if (reorgMonitor) {
      const stats = testSyncMethod(reorgMonitor, 'getReorganizationStats');
      if (stats && typeof stats.totalReorganizations === 'number') {
        logTest('ReorganizationMonitor stats retrieval', 'PASS', `Total reorgs: ${stats.totalReorganizations}`);
      }

      // Test reorganization detection
      const reorgResult = await testAsyncMethod(reorgMonitor, 'detectReorganization', '0x123', 18000000);
      if (reorgResult && typeof reorgResult.reorgDetected === 'boolean') {
        logTest('ReorganizationMonitor detection method', 'PASS', `Reorg detected: ${reorgResult.reorgDetected}`);
      }
    }
  }
  console.log('');

  // Test 9: Integration Testing
  console.log('🔗 TESTING COMPONENT INTEGRATION');
  
  // Test logger integration with other components
  if (LoggerClass && LoggerClass.info) {
    try {
      LoggerClass.info('Integration test message');
      logTest('Logger integration', 'PASS');
    } catch (error) {
      logTest('Logger integration', 'FAIL', error.message);
    }
  }

  // Test Timer + MEV Monitor integration
  if (PrecisionTimerClass && MevActivityMonitorClass) {
    const testMockProvider = {
      getBlockWithTransactions: async () => ({
        number: 18000000,
        timestamp: Math.floor(Date.now() / 1000),
        transactions: []
      })
    };
    try {
      const mevMonitor = new MevActivityMonitorClass('ethereum', testMockProvider);
      const timedResult = await PrecisionTimerClass.mevAwareMonotonic(
        async () => 'test',
        mevMonitor
      );
      
      if (timedResult && timedResult.result === 'test' && typeof timedResult.mevDelta === 'number') {
        logTest('Timer + MEV Monitor integration', 'PASS');
      } else {
        logTest('Timer + MEV Monitor integration', 'FAIL', 'Invalid result structure');
      }
    } catch (error) {
      logTest('Timer + MEV Monitor integration', 'FAIL', error.message);
    }
  }

  console.log('');

  // Test Results Summary
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('=' .repeat(60));
  console.log(`✅ Tests Passed: ${testResults.passed}`);
  console.log(`❌ Tests Failed: ${testResults.failed}`);
  console.log(`⚠️ Warnings: ${testResults.warnings.length}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.errors.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.test}: ${error.details}`);
    });
  }

  if (testResults.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    testResults.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning.test}: ${warning.details}`);
    });
  }

  // Save test results
  const testReport = {
    timestamp: new Date().toISOString(),
    results: testResults,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      cwd: process.cwd()
    }
  };

  fs.writeFileSync('./test-results.json', JSON.stringify(testReport, null, 2));
  console.log('\n💾 Test results saved to: test-results.json');

  // Return overall status
  return testResults.failed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().then(success => {
    if (success) {
      console.log('\n🎉 ALL TESTS PASSED! Ready for next phase.');
      process.exit(0);
    } else {
      console.log('\n🚨 SOME TESTS FAILED! Please fix issues before continuing.');
      process.exit(1);
    }
  }).catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };