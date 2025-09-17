#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');
const { networkConfigLoader } = require('../lib/network-config-loader');
const { gasPriceService } = require('../lib/gas-price-service');
const { costCalculator } = require('../lib/cost-calculator');

const program = new Command();

program
  .name('network-cli')
  .description('CLI tool for managing blockchain network configurations')
  .version('1.0.0');

// List all networks
program
  .command('list')
  .description('List all configured networks')
  .option('-t, --type <type>', 'Filter by type (mainnet/testnet)', '')
  .option('-f, --format <format>', 'Output format (table/json/markdown)', 'table')
  .action(async (options) => {
    try {
      await networkConfigLoader.loadAll();
      let networks = networkConfigLoader.getAllNetworks();

      if (options.type) {
        networks = networks.filter(n => n.type === options.type);
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(networks, null, 2));
      } else if (options.format === 'markdown') {
        const markdown = networkConfigLoader.exportNetworks('markdown');
        console.log(markdown);
      } else {
        const table = new Table({
          head: ['ID', 'Name', 'Chain ID', 'Type', 'Symbol', 'RPC'],
          colWidths: [20, 25, 12, 10, 8, 40]
        });

        networks.forEach(network => {
          table.push([
            network.id,
            network.name,
            network.chainId,
            network.type,
            network.symbol,
            network.rpc.public[0] || 'N/A'
          ]);
        });

        console.log(chalk.cyan.bold('\n📊 Configured Networks\n'));
        console.log(table.toString());
        console.log(chalk.gray(`\nTotal: ${networks.length} networks`));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Show network details
program
  .command('show <networkId>')
  .description('Show detailed information about a network')
  .action(async (networkId) => {
    try {
      await networkConfigLoader.loadAll();
      const network = networkConfigLoader.getNetwork(networkId);

      if (!network) {
        console.error(chalk.red(`Network '${networkId}' not found`));
        process.exit(1);
      }

      console.log(chalk.cyan.bold(`\n📡 Network Details: ${network.name}\n`));

      // Basic Info
      console.log(chalk.yellow('Basic Information:'));
      console.log(`  ID: ${network.id}`);
      console.log(`  Chain ID: ${network.chainId}`);
      console.log(`  Type: ${network.type}`);
      console.log(`  Symbol: ${network.symbol}`);

      // RPC Endpoints
      console.log(chalk.yellow('\nRPC Endpoints:'));
      network.rpc.public.forEach(rpc => {
        console.log(`  - ${rpc}`);
      });

      // Gas Configuration
      console.log(chalk.yellow('\nGas Configuration:'));
      console.log(`  Strategy: ${network.gasConfig.strategy}`);
      if (network.gasConfig.fixed) {
        console.log(`  Fixed Price: ${network.gasConfig.fixed} gwei`);
      }

      // Explorer
      if (network.explorer?.url) {
        console.log(chalk.yellow('\nExplorer:'));
        console.log(`  ${network.explorer.url}`);
      }

      // Faucet
      if (network.faucet?.url) {
        console.log(chalk.yellow('\nFaucet:'));
        console.log(`  URL: ${network.faucet.url}`);
        console.log(`  Amount: ${network.faucet.amount}`);
        console.log(`  Cooldown: ${network.faucet.cooldown}`);
      }

      // Features
      if (network.features) {
        console.log(chalk.yellow('\nFeatures:'));
        console.log(`  EIP-1559: ${network.features.eip1559 ? '✅' : '❌'}`);
        console.log(`  CREATE2: ${network.features.create2 ? '✅' : '❌'}`);
      }

      // MetaMask Configuration
      if (network.wallet?.metamask) {
        console.log(chalk.yellow('\nMetaMask Configuration:'));
        console.log(`  Network Name: ${network.wallet.metamask.networkName}`);
        console.log(`  Chain ID (hex): ${network.wallet.metamask.chainId}`);
        console.log(`  RPC URL: ${network.wallet.metamask.rpcUrl}`);
      }

      console.log();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Add a new network
program
  .command('add <configFile>')
  .description('Add a new network from configuration file')
  .action(async (configFile) => {
    try {
      await networkConfigLoader.loadAll();

      const configPath = path.resolve(configFile);
      if (!fs.existsSync(configPath)) {
        console.error(chalk.red(`Configuration file not found: ${configFile}`));
        process.exit(1);
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      // Validate configuration
      if (!networkConfigLoader.validateConfig(config)) {
        console.error(chalk.red('Invalid network configuration'));
        console.error(networkConfigLoader.ajv.errorsText());
        process.exit(1);
      }

      // Add network
      await networkConfigLoader.addNetwork(config);

      console.log(chalk.green(`✅ Network '${config.name}' added successfully`));
      console.log(chalk.gray(`  Chain ID: ${config.chainId}`));
      console.log(chalk.gray(`  Symbol: ${config.symbol}`));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Validate network configuration
program
  .command('validate <configFile>')
  .description('Validate a network configuration file')
  .action(async (configFile) => {
    try {
      await networkConfigLoader.loadSchema();

      const configPath = path.resolve(configFile);
      if (!fs.existsSync(configPath)) {
        console.error(chalk.red(`Configuration file not found: ${configFile}`));
        process.exit(1);
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      if (networkConfigLoader.validateConfig(config)) {
        console.log(chalk.green('✅ Configuration is valid'));
        console.log(chalk.gray(`  Network: ${config.name}`));
        console.log(chalk.gray(`  Chain ID: ${config.chainId}`));
      } else {
        console.error(chalk.red('❌ Configuration is invalid'));
        console.error(networkConfigLoader.ajv.errorsText());
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Get gas prices
program
  .command('gas [network]')
  .description('Get current gas prices for a network')
  .option('--historical', 'Include 7-day historical data')
  .action(async (network = 'ethereum', options) => {
    try {
      console.log(chalk.cyan.bold(`\n⛽ Gas Prices: ${network}\n`));

      const report = await gasPriceService.getGasPriceReport(network);

      // Current prices
      console.log(chalk.yellow('Current Prices:'));
      console.log(`  Low:    ${report.current.low}`);
      console.log(`  Medium: ${report.current.medium}`);
      console.log(`  High:   ${report.current.high}`);
      console.log(chalk.gray(`  Sources: ${report.current.sources.join(', ')}`));

      // Recommendations
      console.log(chalk.yellow('\nRecommendation:'));
      console.log(`  ${report.recommendations}`);

      // Historical data
      if (options.historical) {
        console.log(chalk.yellow('\nHistorical (7 days):'));

        const table = new Table({
          head: ['Date', 'Low', 'Average', 'High'],
          colWidths: [15, 12, 12, 12]
        });

        report.historical.last7Days.forEach(day => {
          table.push([
            day.date,
            `${day.low} gwei`,
            `${day.avg} gwei`,
            `${day.high} gwei`
          ]);
        });

        console.log(table.toString());
      }

      console.log(chalk.gray(`\nLast updated: ${report.lastUpdated}`));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Calculate costs
program
  .command('cost <networkId> <gasUsed>')
  .description('Calculate transaction cost for a network')
  .option('-c, --compare', 'Compare with other networks')
  .action(async (networkId, gasUsed, options) => {
    try {
      await costCalculator.initialize();

      if (options.compare) {
        console.log(chalk.cyan.bold(`\n💰 Cost Comparison (${gasUsed} gas)\n`));

        const comparison = await costCalculator.compareNetworkCosts(parseInt(gasUsed));

        const table = new Table({
          head: ['Network', 'Type', 'Gas Price', 'Cost (Native)', 'Cost (USD)'],
          colWidths: [25, 10, 15, 20, 12]
        });

        comparison.networks.forEach(network => {
          table.push([
            network.network,
            network.type,
            network.gasPrice,
            network.costInNative,
            `$${network.costInUSD}`
          ]);
        });

        console.log(table.toString());

        console.log(chalk.yellow('\nSummary:'));
        console.log(`  Cheapest: ${comparison.cheapest.network} ($${comparison.cheapest.costInUSD})`);
        console.log(`  Most Expensive: ${comparison.mostExpensive.network} ($${comparison.mostExpensive.costInUSD})`);
        console.log(`  Average: $${comparison.averageCostUSD}`);
      } else {
        const cost = await costCalculator.calculateTransactionCost(networkId, parseInt(gasUsed));

        console.log(chalk.cyan.bold(`\n💰 Transaction Cost: ${cost.network}\n`));
        console.log(`  Gas Used: ${cost.gasUsed}`);
        console.log(`  Gas Price: ${cost.gasPrice}`);
        console.log(`  Cost: ${cost.costInNative}`);
        console.log(`  Cost (USD): $${cost.costInUSD}`);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Export configurations
program
  .command('export')
  .description('Export network configurations')
  .option('-f, --format <format>', 'Export format (json/markdown/hardhat)', 'json')
  .option('-o, --output <file>', 'Output file')
  .action(async (options) => {
    try {
      await networkConfigLoader.loadAll();

      let output;
      if (options.format === 'markdown') {
        output = networkConfigLoader.exportNetworks('markdown');
      } else if (options.format === 'hardhat') {
        output = JSON.stringify(networkConfigLoader.exportNetworks('hardhat'), null, 2);
      } else {
        output = JSON.stringify(networkConfigLoader.exportNetworks('json'), null, 2);
      }

      if (options.output) {
        fs.writeFileSync(options.output, output);
        console.log(chalk.green(`✅ Exported to ${options.output}`));
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Get statistics
program
  .command('stats')
  .description('Show network configuration statistics')
  .action(async () => {
    try {
      await networkConfigLoader.loadAll();
      const stats = networkConfigLoader.getStatistics();

      console.log(chalk.cyan.bold('\n📈 Network Statistics\n'));
      console.log(chalk.yellow('Total Networks:'), stats.total);
      console.log();
      console.log(chalk.yellow('By Type:'));
      console.log(`  Mainnet:  ${stats.byType.mainnet}`);
      console.log(`  Testnet:  ${stats.byType.testnet}`);
      console.log(`  Local:    ${stats.byType.local}`);
      console.log();
      console.log(chalk.yellow('Feature Support:'));
      console.log(`  EIP-1559: ${stats.features.eip1559} networks`);
      console.log(`  CREATE2:  ${stats.features.create2} networks`);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);