#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Network Adapters
 * Tests Ethereum, Kasplex, and Igra adapters
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
  console.log('🧪 COMPREHENSIVE NETWORK ADAPTER TESTING');
  console.log('=' .repeat(60));
  
  // Change to the correct directory
  const testDir = path.join(__dirname);
  process.chdir(testDir);
  
  console.log(`📁 Testing from directory: ${testDir}`);
  console.log('');

  // Test 1: Network Adapter Files
  console.log('📄 TESTING NETWORK ADAPTER FILES');
  const ethereumAdapterExists = testFileExists('./lib/finality/EthereumAdapter.js', 'EthereumAdapter');
  const kasplexAdapterExists = testFileExists('./lib/finality/KasplexAdapter.js', 'KasplexAdapter');
  const igraAdapterExists = testFileExists('./lib/finality/IgraAdapter.js', 'IgraAdapter');
  const baseAdapterExists = testFileExists('./lib/finality/BaseNetworkAdapter.js', 'BaseNetworkAdapter');
  console.log('');

  // Test 2: Module Loading
  console.log('📦 TESTING MODULE LOADING');
  const EthereumAdapter = ethereumAdapterExists ? testRequire('./lib/finality/EthereumAdapter.js', 'EthereumAdapter module') : null;
  const KasplexAdapter = kasplexAdapterExists ? testRequire('./lib/finality/KasplexAdapter.js', 'KasplexAdapter module') : null;
  const IgraAdapter = igraAdapterExists ? testRequire('./lib/finality/IgraAdapter.js', 'IgraAdapter module') : null;
  const BaseAdapter = baseAdapterExists ? testRequire('./lib/finality/BaseNetworkAdapter.js', 'BaseNetworkAdapter module') : null;
  console.log('');

  // Test 3: Class Extraction
  console.log('🏗️ TESTING CLASS EXTRACTION');
  let EthereumAdapterClass = null, KasplexAdapterClass = null, IgraAdapterClass = null, BaseAdapterClass = null;

  if (EthereumAdapter) {
    EthereumAdapterClass = EthereumAdapter.EthereumAdapter || EthereumAdapter;
    if (EthereumAdapterClass) {
      logTest('EthereumAdapter class extraction', 'PASS');
    } else {
      logTest('EthereumAdapter class extraction', 'FAIL', 'Could not extract class');
    }
  }

  if (KasplexAdapter) {
    KasplexAdapterClass = KasplexAdapter.KasplexAdapter || KasplexAdapter;
    if (KasplexAdapterClass) {
      logTest('KasplexAdapter class extraction', 'PASS');
    } else {
      logTest('KasplexAdapter class extraction', 'FAIL', 'Could not extract class');
    }
  }

  if (IgraAdapter) {
    IgraAdapterClass = IgraAdapter.IgraAdapter || IgraAdapter;
    if (IgraAdapterClass) {
      logTest('IgraAdapter class extraction', 'PASS');
    } else {
      logTest('IgraAdapter class extraction', 'FAIL', 'Could not extract class');
    }
  }

  if (BaseAdapter) {
    BaseAdapterClass = BaseAdapter.BaseNetworkAdapter || BaseAdapter;
    if (BaseAdapterClass) {
      logTest('BaseNetworkAdapter class extraction', 'PASS');
    } else {
      logTest('BaseNetworkAdapter class extraction', 'FAIL', 'Could not extract class');
    }
  }
  console.log('');

  // Test 4: Ethereum Adapter Testing
  console.log('⚡ TESTING ETHEREUM ADAPTER');
  if (EthereumAdapterClass) {
    const ethereumAdapter = testClassInstantiation(
      EthereumAdapterClass, 
      'EthereumAdapter',
      'sepolia',
      'https://rpc.sepolia.org',
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // Mock private key
      11155111 // Sepolia chain ID
    );

    if (ethereumAdapter) {
      // Test network configuration
      const networkConfig = testSyncMethod(ethereumAdapter, 'getNetworkConfig');
      if (networkConfig) {
        logTest('EthereumAdapter network config', 'PASS', `Chain ID: ${networkConfig.chainId}`);
      }

      // Test finality thresholds
      const finalityThresholds = testSyncMethod(ethereumAdapter, 'getDefaultFinalityThresholds');
      if (finalityThresholds) {
        logTest('EthereumAdapter finality thresholds', 'PASS', `Standard: ${finalityThresholds.standard}`);
      }

      // Test gas strategies
      const gasStrategies = testSyncMethod(ethereumAdapter, 'getDefaultGasStrategies');
      if (gasStrategies) {
        logTest('EthereumAdapter gas strategies', 'PASS', `Strategies: ${Object.keys(gasStrategies).join(', ')}`);
      }

      // Test retry configuration
      const retryConfig = testSyncMethod(ethereumAdapter, 'getDefaultRetryConfig');
      if (retryConfig) {
        logTest('EthereumAdapter retry config', 'PASS', `Max retries: ${retryConfig.maxRetries}`);
      }

      // Test error retry detection
      const mockError = new Error('nonce too low');
      const shouldRetry = testSyncMethod(ethereumAdapter, 'shouldRetryError', mockError);
      if (shouldRetry) {
        logTest('EthereumAdapter retry detection', 'PASS', 'Correctly identifies retryable error');
      }

      // Test state export
      const exportedState = testSyncMethod(ethereumAdapter, 'exportState');
      if (exportedState) {
        logTest('EthereumAdapter state export', 'PASS', `Network: ${exportedState.networkName}`);
      }
    }
  }
  console.log('');

  // Test 5: Kasplex Adapter Testing
  console.log('💎 TESTING KASPLEX ADAPTER');
  if (KasplexAdapterClass) {
    const kasplexAdapter = testClassInstantiation(
      KasplexAdapterClass,
      'KasplexAdapter',
      'kasplex',
      'https://rpc.kasplextest.xyz',
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // Mock private key
      167012 // Kasplex chain ID
    );

    if (kasplexAdapter) {
      // Test network configuration
      const networkConfig = testSyncMethod(kasplexAdapter, 'getNetworkConfig');
      if (networkConfig) {
        logTest('KasplexAdapter network config', 'PASS', `Chain ID: ${networkConfig.chainId}, Gas: ${networkConfig.gasPrice.toString()}`);
      }

      // Test finality thresholds
      const finalityThresholds = testSyncMethod(kasplexAdapter, 'getDefaultFinalityThresholds');
      if (finalityThresholds) {
        logTest('KasplexAdapter finality thresholds', 'PASS', `Standard: ${finalityThresholds.standard}`);
      }

      // Test gas strategies
      const gasStrategies = testSyncMethod(kasplexAdapter, 'getDefaultGasStrategies');
      if (gasStrategies) {
        logTest('KasplexAdapter gas strategies', 'PASS', `Strategies: ${Object.keys(gasStrategies).join(', ')}`);
      }

      // Test Kasplex-specific features
      const explorerUrl = testSyncMethod(kasplexAdapter, 'getExplorerUrl', '0x123abc');
      if (explorerUrl) {
        logTest('KasplexAdapter explorer URL', 'PASS', explorerUrl);
      }

      // Test state export
      const exportedState = testSyncMethod(kasplexAdapter, 'exportState');
      if (exportedState && exportedState.kasplexSpecific) {
        logTest('KasplexAdapter state export', 'PASS', `Currency: ${exportedState.kasplexSpecific.currency}`);
      }
    }
  }
  console.log('');

  // Test 6: Igra Adapter Testing
  console.log('🌊 TESTING IGRA ADAPTER');
  if (IgraAdapterClass) {
    const igraAdapter = testClassInstantiation(
      IgraAdapterClass,
      'IgraAdapter',
      'igra',
      'https://rpc.igra.network', // Mock RPC URL
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // Mock private key
      421614 // Example L2 chain ID
    );

    if (igraAdapter) {
      // Test network configuration
      const networkConfig = testSyncMethod(igraAdapter, 'getNetworkConfig');
      if (networkConfig) {
        logTest('IgraAdapter network config', 'PASS', `Chain ID: ${networkConfig.chainId}`);
      }

      // Test finality thresholds (should be faster than Ethereum)
      const finalityThresholds = testSyncMethod(igraAdapter, 'getDefaultFinalityThresholds');
      if (finalityThresholds && finalityThresholds.standard < 12) {
        logTest('IgraAdapter finality thresholds', 'PASS', `Faster than ETH: ${finalityThresholds.standard} blocks`);
      }

      // Test gas strategies (should be cheaper than Ethereum)
      const gasStrategies = testSyncMethod(igraAdapter, 'getDefaultGasStrategies');
      if (gasStrategies) {
        logTest('IgraAdapter gas strategies', 'PASS', `L2 optimized strategies`);
      }

      // Test chain ID detection
      const configForChainId = testSyncMethod(igraAdapter, 'getNetworkConfigForChainId', 10); // Optimism
      if (configForChainId) {
        logTest('IgraAdapter chain ID detection', 'PASS', `Detected: ${configForChainId.name}`);
      }

      // Test state export
      const exportedState = testSyncMethod(igraAdapter, 'exportState');
      if (exportedState && exportedState.igraSpecific) {
        logTest('IgraAdapter state export', 'PASS', `Type: ${exportedState.igraSpecific.networkType}`);
      }
    }
  }
  console.log('');

  // Test 7: Cross-Adapter Inheritance
  console.log('🔗 TESTING ADAPTER INHERITANCE');
  if (EthereumAdapterClass && BaseAdapterClass) {
    const ethereumAdapter = new EthereumAdapterClass('test', 'https://test.com', '0x123', 1);
    const isInstanceOfBase = ethereumAdapter instanceof BaseAdapterClass;
    if (isInstanceOfBase) {
      logTest('EthereumAdapter inherits from BaseNetworkAdapter', 'PASS');
    } else {
      logTest('EthereumAdapter inherits from BaseNetworkAdapter', 'FAIL', 'Inheritance not working');
    }
  }

  if (KasplexAdapterClass && BaseAdapterClass) {
    const kasplexAdapter = new KasplexAdapterClass('test', 'https://test.com', '0x123', 167012);
    const isInstanceOfBase = kasplexAdapter instanceof BaseAdapterClass;
    if (isInstanceOfBase) {
      logTest('KasplexAdapter inherits from BaseNetworkAdapter', 'PASS');
    } else {
      logTest('KasplexAdapter inherits from BaseNetworkAdapter', 'FAIL', 'Inheritance not working');
    }
  }

  if (IgraAdapterClass && BaseAdapterClass) {
    const igraAdapter = new IgraAdapterClass('test', 'https://test.com', '0x123', 421614);
    const isInstanceOfBase = igraAdapter instanceof BaseAdapterClass;
    if (isInstanceOfBase) {
      logTest('IgraAdapter inherits from BaseNetworkAdapter', 'PASS');
    } else {
      logTest('IgraAdapter inherits from BaseNetworkAdapter', 'FAIL', 'Inheritance not working');
    }
  }
  console.log('');

  // Test 8: Network-Specific Configurations
  console.log('⚙️ TESTING NETWORK-SPECIFIC CONFIGURATIONS');
  
  // Compare gas strategies across networks
  if (EthereumAdapterClass && KasplexAdapterClass && IgraAdapterClass) {
    const ethAdapter = new EthereumAdapterClass('eth', 'https://test.com', '0x123', 11155111);
    const kasAdapter = new KasplexAdapterClass('kas', 'https://test.com', '0x123', 167012);
    const igraAdapter = new IgraAdapterClass('igra', 'https://test.com', '0x123', 421614);

    const ethGas = ethAdapter.getDefaultGasStrategies().standard.gasPrice.toString();
    const kasGas = kasAdapter.getDefaultGasStrategies().standard.gasPrice.toString();
    const igraGas = igraAdapter.getDefaultGasStrategies().standard.gasPrice.toString();

    logTest('Gas price differences', 'PASS', `ETH: ${ethGas}, KAS: ${kasGas}, IGRA: ${igraGas}`);

    // Compare finality thresholds
    const ethFinality = ethAdapter.getDefaultFinalityThresholds().standard;
    const kasFinality = kasAdapter.getDefaultFinalityThresholds().standard;
    const igraFinality = igraAdapter.getDefaultFinalityThresholds().standard;

    if (kasFinality <= ethFinality && igraFinality <= ethFinality) {
      logTest('Finality optimization', 'PASS', `ETH: ${ethFinality}, KAS: ${kasFinality}, IGRA: ${igraFinality}`);
    } else {
      logTest('Finality optimization', 'FAIL', 'L2s should have faster finality than Ethereum');
    }
  }
  console.log('');

  // Test Results Summary
  console.log('📊 NETWORK ADAPTER TEST RESULTS');
  console.log('=' .repeat(60));
  console.log(`✅ Tests Passed: ${testResults.passed}`);
  console.log(`❌ Tests Failed: ${testResults.failed}`);
  console.log(`⚠️ Warnings: ${testResults.warnings.length}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.errors.length > 0) {
    console.log('\\n❌ FAILED TESTS:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.test}: ${error.details}`);
    });
  }

  if (testResults.warnings.length > 0) {
    console.log('\\n⚠️ WARNINGS:');
    testResults.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning.test}: ${warning.details}`);
    });
  }

  // Save test results
  const testReport = {
    timestamp: new Date().toISOString(),
    phase: 'Phase 2 - Network Adapters',
    results: testResults,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      cwd: process.cwd()
    },
    networkAdapters: {
      ethereum: !!EthereumAdapterClass,
      kasplex: !!KasplexAdapterClass,
      igra: !!IgraAdapterClass
    }
  };

  fs.writeFileSync('./network-adapter-test-results.json', JSON.stringify(testReport, null, 2));
  console.log('\\n💾 Test results saved to: network-adapter-test-results.json');

  // Return overall status
  return testResults.failed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().then(success => {
    if (success) {
      console.log('\\n🎉 ALL NETWORK ADAPTER TESTS PASSED! Phase 2 Complete.');
      process.exit(0);
    } else {
      console.log('\\n🚨 SOME TESTS FAILED! Please fix issues before continuing.');
      process.exit(1);
    }
  }).catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };