#!/usr/bin/env node

/**
 * Network Configuration Validation Script
 *
 * Validates all network configurations and tests RPC connectivity
 */

const chalk = require('chalk');
const ora = require('ora');
const { ethers } = require('ethers');
const { NetworkConfigLoader } = require('../lib/network-config-loader');
const { table } = require('table');
const axios = require('axios');

class NetworkValidator {
  constructor() {
    this.loader = new NetworkConfigLoader();
    this.results = [];
  }

  async validate() {
    console.log(chalk.cyan.bold('\n🔍 Network Configuration Validator\n'));

    // Load configurations
    const spinner = ora('Loading network configurations...').start();
    try {
      await this.loader.loadAll();
      spinner.succeed(`Loaded ${Object.keys(this.loader.networks).length} network configurations`);
    } catch (error) {
      spinner.fail(`Failed to load configurations: ${error.message}`);
      process.exit(1);
    }

    console.log(chalk.yellow('\n📋 Validating configurations...\n'));

    // Validate each network
    for (const [id, config] of Object.entries(this.loader.networks)) {
      await this.validateNetwork(id, config);
    }

    // Display results
    this.displayResults();

    // Generate summary
    this.generateSummary();

    // Return exit code based on validation results
    const hasErrors = this.results.some(r => r.status === 'FAILED');
    process.exit(hasErrors ? 1 : 0);
  }

  async validateNetwork(id, config) {
    const result = {
      network: config.name,
      chainId: config.chainId,
      status: 'PASSED',
      checks: {
        schema: '✅',
        rpc: '⏳',
        gasPrice: '⏳',
        blockNumber: '⏳',
        balance: '⏳'
      },
      errors: []
    };

    console.log(chalk.blue(`\nValidating ${config.name} (${id})...`));

    // Test RPC connectivity
    const rpcUrl = config.rpc.public[0];
    const rpcSpinner = ora(`Testing RPC: ${rpcUrl}`).start();

    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      provider.connection.timeout = 10000; // 10 second timeout

      // Test basic connectivity
      const network = await provider.getNetwork();
      if (network.chainId !== config.chainId) {
        result.errors.push(`Chain ID mismatch: expected ${config.chainId}, got ${network.chainId}`);
        result.checks.rpc = '❌';
        result.status = 'FAILED';
      } else {
        result.checks.rpc = '✅';
      }

      // Get latest block
      const blockNumber = await provider.getBlockNumber();
      result.blockNumber = blockNumber;
      result.checks.blockNumber = '✅';

      // Test gas price retrieval
      try {
        const gasPrice = await provider.getGasPrice();
        result.gasPrice = ethers.utils.formatUnits(gasPrice, 'gwei') + ' gwei';
        result.checks.gasPrice = '✅';
      } catch (error) {
        result.checks.gasPrice = '⚠️';
        result.errors.push(`Gas price retrieval failed: ${error.message}`);
      }

      // Check a test address balance (zero address)
      try {
        const balance = await provider.getBalance('0x0000000000000000000000000000000000000000');
        result.checks.balance = '✅';
      } catch (error) {
        result.checks.balance = '⚠️';
        result.errors.push(`Balance check failed: ${error.message}`);
      }

      rpcSpinner.succeed(`RPC connection successful`);
    } catch (error) {
      rpcSpinner.fail(`RPC connection failed: ${error.message}`);
      result.checks.rpc = '❌';
      result.status = 'FAILED';
      result.errors.push(`RPC connection error: ${error.message}`);
    }

    // Test WebSocket if available
    if (config.rpc.websocket && config.rpc.websocket.length > 0) {
      const wsSpinner = ora(`Testing WebSocket: ${config.rpc.websocket[0]}`).start();
      try {
        const wsProvider = new ethers.providers.WebSocketProvider(config.rpc.websocket[0]);
        await wsProvider.getNetwork();
        wsProvider.destroy();
        wsSpinner.succeed('WebSocket connection successful');
        result.checks.websocket = '✅';
      } catch (error) {
        wsSpinner.warn('WebSocket connection failed (optional)');
        result.checks.websocket = '⚠️';
      }
    }

    // Test explorer URL if available
    if (config.explorer && config.explorer.url) {
      const explorerSpinner = ora(`Testing explorer: ${config.explorer.url}`).start();
      try {
        await axios.head(config.explorer.url, { timeout: 5000 });
        explorerSpinner.succeed('Explorer accessible');
        result.checks.explorer = '✅';
      } catch (error) {
        explorerSpinner.warn('Explorer not accessible (optional)');
        result.checks.explorer = '⚠️';
      }
    }

    // Test faucet URL if available
    if (config.faucet && config.faucet.url) {
      const faucetSpinner = ora(`Testing faucet: ${config.faucet.url}`).start();
      try {
        await axios.head(config.faucet.url, { timeout: 5000 });
        faucetSpinner.succeed('Faucet accessible');
        result.checks.faucet = '✅';
      } catch (error) {
        faucetSpinner.warn('Faucet not accessible (optional)');
        result.checks.faucet = '⚠️';
      }
    }

    this.results.push(result);
  }

  displayResults() {
    console.log(chalk.cyan.bold('\n📊 Validation Results\n'));

    const tableData = [
      ['Network', 'Chain ID', 'Status', 'RPC', 'Gas', 'Block', 'Balance', 'Details']
    ];

    for (const result of this.results) {
      const row = [
        result.network,
        result.chainId,
        result.status === 'PASSED' ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED'),
        result.checks.rpc,
        result.checks.gasPrice,
        result.checks.blockNumber,
        result.checks.balance,
        result.blockNumber ? `Block: ${result.blockNumber}` : '-'
      ];

      if (result.gasPrice) {
        row[7] += `\nGas: ${result.gasPrice}`;
      }

      tableData.push(row);
    }

    console.log(table(tableData, {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼'
      }
    }));

    // Display errors if any
    const failedNetworks = this.results.filter(r => r.errors.length > 0);
    if (failedNetworks.length > 0) {
      console.log(chalk.red.bold('\n⚠️  Errors Found:\n'));
      for (const result of failedNetworks) {
        console.log(chalk.yellow(`${result.network}:`));
        for (const error of result.errors) {
          console.log(chalk.red(`  - ${error}`));
        }
      }
    }
  }

  generateSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASSED').length;
    const failed = this.results.filter(r => r.status === 'FAILED').length;

    console.log(chalk.cyan.bold('\n📈 Summary\n'));
    console.log(`Total Networks: ${total}`);
    console.log(`${chalk.green('✅ Passed:')} ${passed}`);
    console.log(`${chalk.red('❌ Failed:')} ${failed}`);

    if (passed === total) {
      console.log(chalk.green.bold('\n🎉 All network configurations are valid!'));
    } else {
      console.log(chalk.yellow.bold(`\n⚠️  ${failed} network(s) need attention.`));
    }

    // Performance stats
    const avgBlockNumbers = this.results
      .filter(r => r.blockNumber)
      .map(r => r.blockNumber);

    if (avgBlockNumbers.length > 0) {
      console.log(chalk.blue('\n📊 Network Statistics:'));
      console.log(`Networks with working RPC: ${avgBlockNumbers.length}`);

      const gasPrices = this.results
        .filter(r => r.gasPrice)
        .map(r => parseFloat(r.gasPrice));

      if (gasPrices.length > 0) {
        const avgGasPrice = gasPrices.reduce((a, b) => a + b, 0) / gasPrices.length;
        console.log(`Average gas price: ${avgGasPrice.toFixed(2)} gwei`);
      }
    }
  }
}

// Run validator if called directly
if (require.main === module) {
  const validator = new NetworkValidator();
  validator.validate().catch(error => {
    console.error(chalk.red('Validation failed:', error));
    process.exit(1);
  });
}

module.exports = { NetworkValidator };