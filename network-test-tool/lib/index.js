// Main library exports
const { NETWORKS, getNetworkByChainId, getNetworkByName, getAllNetworks, getNetworkConfig } = require('./networks');
const { GasManager } = require('./gas-manager');
const { DeploymentUtils } = require('./deployment-utils');
const { TestResult, Logger, measureTime, retryWithBackoff, formatGas, formatDuration } = require('./test-utils');
const { LoadTestRunner } = require('./load-test-runner');
const { EVMCompatibilityTester } = require('./evm-test-runner');

module.exports = {
  // Network configuration
  NETWORKS,
  getNetworkByChainId,
  getNetworkByName,
  getAllNetworks,
  getNetworkConfig,
  
  // Core utilities
  GasManager,
  DeploymentUtils,
  TestResult,
  Logger,
  
  // Test runners
  LoadTestRunner,
  EVMCompatibilityTester,
  
  // Helper functions
  measureTime,
  retryWithBackoff,
  formatGas,
  formatDuration
};