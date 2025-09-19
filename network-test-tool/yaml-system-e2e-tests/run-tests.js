#!/usr/bin/env node

/**
 * Main test runner for YAML system E2E tests
 * Provides a simple interface to run all tests or specific test categories
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

// Test categories
const TEST_CATEGORIES = {
  core: 'Core YAML functionality',
  contracts: 'Bring your own contract',
  keywords: 'Keyword system',
  control: 'Control flow',
  wallets: 'Wallet operations',
  data: 'Data-driven testing',
  integration: 'Integration tests',
  all: 'All tests'
};

// Parse command line arguments
const args = process.argv.slice(2);
const category = args[0] || 'all';
const network = args[1] || 'kasplex';

// Validate arguments
if (!TEST_CATEGORIES[category]) {
  console.error(`Invalid test category: ${category}`);
  console.log('\nAvailable categories:');
  Object.entries(TEST_CATEGORIES).forEach(([key, desc]) => {
    console.log(`  ${key.padEnd(12)} - ${desc}`);
  });
  console.log('\nUsage: node run-tests.js [category] [network]');
  console.log('Example: node run-tests.js core kasplex');
  process.exit(1);
}

// Validate network
const validNetworks = ['kasplex', 'igra', 'sepolia'];
if (!validNetworks.includes(network)) {
  console.error(`Invalid network: ${network}`);
  console.log(`Valid networks: ${validNetworks.join(', ')}`);
  process.exit(1);
}

console.log('=============================================');
console.log('YAML System E2E Test Runner');
console.log('=============================================');
console.log(`Category: ${category} (${TEST_CATEGORIES[category]})`);
console.log(`Network: ${network}`);
console.log('=============================================\n');

// Ensure test results directory exists
const resultsDir = path.join(__dirname, 'test-results');
fs.ensureDirSync(resultsDir);

// Build Jest command
let jestCommand = 'npm';
let jestArgs = ['test'];

// Add specific test file pattern if not running all tests
if (category !== 'all') {
  const testFileMap = {
    core: 'core-functionality',
    contracts: 'bring-your-own-contract',
    keywords: 'keyword-system',
    control: 'control-flow',
    wallets: 'wallet-operations',
    data: 'data-driven',
    integration: 'integration'
  };

  jestArgs.push(testFileMap[category]);
}

// Set environment variables
const env = {
  ...process.env,
  NETWORK: network,
  NODE_ENV: 'test',
  FORCE_COLOR: '1'
};

// Run tests
console.log(`Running: ${jestCommand} ${jestArgs.join(' ')}\n`);

const testProcess = spawn(jestCommand, jestArgs, {
  env,
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

testProcess.on('error', (error) => {
  console.error('Failed to start test process:', error);
  process.exit(1);
});

testProcess.on('close', (code) => {
  console.log('\n=============================================');

  if (code === 0) {
    console.log('✅ Tests completed successfully');

    // Check for test report
    const reportPath = path.join(resultsDir, 'test-report.html');
    if (fs.existsSync(reportPath)) {
      console.log(`📊 Test report available at: ${reportPath}`);
    }
  } else {
    console.log(`❌ Tests failed with exit code: ${code}`);
  }

  console.log('=============================================');
  process.exit(code);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\nTest run interrupted by user');
  testProcess.kill('SIGTERM');
  process.exit(130);
});