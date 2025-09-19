#!/usr/bin/env node

const { ethers } = require('ethers');
const chalk = require('chalk');
const { DeFiTestRunner } = require('./lib/defi-test-runner');
const { networks } = require('./lib/networks');
const { ResourcePool } = require('./lib/resource-pool');
const { GasManager } = require('./lib/gas-manager');
require('dotenv').config();

/**
 * Test DeFi Suite with Aggressive Gas Mode
 * Runs complete DeFi protocol tests with 5x gas on Igra, 1.5x on Kasplex
 */
async function runAggressiveDeFiTests(networkName) {
  const network = networks[networkName.toLowerCase()];

  if (!network) {
    console.error(chalk.red(`Network "${networkName}" not found`));
    console.log('Available networks:', Object.keys(networks).join(', '));
    process.exit(1);
  }

  console.log(chalk.cyan(`\n🚀 DeFi Tests with AGGRESSIVE Gas Mode on ${network.name}`));
  console.log('='.repeat(60));

  // Show gas strategy
  if (network.chainId === 19416) { // Igra
    console.log(chalk.red('⚡ Using 5x gas (10,000 gwei) for ~30% faster confirmations'));
  } else if (network.chainId === 167012) { // Kasplex
    console.log(chalk.yellow('⚡ Using 1.5x gas for faster confirmations'));
  }
  console.log();

  // Create resource pool with optimizations
  const resourcePool = new ResourcePool({
    maxProviders: 1,
    preferWebSocket: false, // Stick with JsonRPC for now
    verbose: false
  });

  try {
    // Get provider from resource pool
    const provider = await resourcePool.getProvider(network);

    // Create signer
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('Please set PRIVATE_KEY in .env file');
    }
    const wallet = new ethers.Wallet(privateKey, provider);

    // Initialize runner with aggressive gas mode
    const runner = new DeFiTestRunner(network, {
      verbose: true,
      aggressiveGas: true, // ENABLE AGGRESSIVE GAS MODE
      skipRedundant: true  // Skip redundant operations
    });

    // Set provider and signer
    runner.provider = provider;
    runner.signer = wallet;
    runner.gasManager = new GasManager(network, wallet);

    console.log(chalk.blue('\n🔧 DeFi Test Runner initialized'));

    console.log(chalk.blue('\n📋 Loading deployed contracts from database...'));
    await runner.loadContracts();

    console.log(chalk.green('\n✅ Starting Aggressive Gas Mode Tests\n'));
    const startTime = Date.now();

    // Run the complete test suite
    const results = await runner.runAllTests();

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    // Print results
    console.log(chalk.cyan('\n📊 Test Results with Aggressive Gas:'));
    console.log('='.repeat(60));
    console.log(chalk.green(`✅ Passed: ${results.metrics.passed}`));
    console.log(chalk.red(`❌ Failed: ${results.metrics.failed}`));
    console.log(chalk.blue(`⛽ Total Gas Used: ${results.metrics.gasUsed.toLocaleString()}`));
    console.log(chalk.magenta(`⏱️ Total Time: ${totalTime}s`));

    // Calculate time per test
    const timePerTest = (parseFloat(totalTime) / results.metrics.totalTests).toFixed(1);
    console.log(chalk.yellow(`📈 Average time per test: ${timePerTest}s`));

    // Compare with baseline (15s per tx on Igra, 5s on Kasplex)
    const expectedBaseline = network.chainId === 19416 ? 15 : 5;
    const expectedTime = results.metrics.totalTests * expectedBaseline;
    const actualTime = parseFloat(totalTime);
    const timeSaved = expectedTime - actualTime;
    const percentSaved = ((timeSaved / expectedTime) * 100).toFixed(0);

    if (timeSaved > 0) {
      console.log(chalk.green(`\n💰 Time Savings with Aggressive Gas:`));
      console.log(`  Expected (baseline): ${expectedTime}s`);
      console.log(`  Actual (aggressive): ${actualTime}s`);
      console.log(`  Time saved: ${timeSaved.toFixed(0)}s (${percentSaved}% faster!)`);
    }

    // Save results
    await runner.saveResults();

  } catch (error) {
    console.error(chalk.red('\nTest failed:'), error.message);
    if (error.stack && process.env.DEBUG) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  } finally {
    await resourcePool.cleanup();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const networkName = args[0];

if (!networkName) {
  console.log(chalk.cyan('🚀 DeFi Aggressive Gas Mode Tester'));
  console.log(chalk.gray('\nUsage: node test-defi-aggressive.js <network>\n'));
  console.log('Available networks:');
  Object.keys(networks).forEach(name => {
    const net = networks[name];
    console.log(`  ${chalk.green(name.padEnd(10))} - ${net.name} (Chain ID: ${net.chainId})`);
  });
  console.log('\nExample: node test-defi-aggressive.js igra');
  console.log('\nThis will run DeFi tests with:');
  console.log('  - Igra: 5x gas (10,000 gwei) for ~30% faster');
  console.log('  - Kasplex: 1.5x gas for faster confirmations');
  process.exit(0);
}

// Run the tests
runAggressiveDeFiTests(networkName).catch(console.error);