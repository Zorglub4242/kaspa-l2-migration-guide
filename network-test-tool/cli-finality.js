#!/usr/bin/env node

/**
 * CLI Interface for Finality Measurement Tool
 * Phase 4: Command-Line Interface
 * 
 * This provides a user-friendly CLI for measuring blockchain finality
 * across Ethereum, Kasplex, and Igra networks with MEV awareness
 */

// Load environment variables first
require('dotenv').config();

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');

const { FinalityTestIntegration } = require('./finality-test-integration');
const { logger } = require('./lib/utils/logger');

const program = new Command();

// ASCII Art Header
const HEADER = chalk.cyan(`
███████╗██╗███╗   ██╗ █████╗ ██╗     ██╗████████╗██╗   ██╗
██╔════╝██║████╗  ██║██╔══██╗██║     ██║╚══██╔══╝╚██╗ ██╔╝
█████╗  ██║██╔██╗ ██║███████║██║     ██║   ██║    ╚████╔╝ 
██╔══╝  ██║██║╚██╗██║██╔══██║██║     ██║   ██║     ╚██╔╝  
██║     ██║██║ ╚████║██║  ██║███████╗██║   ██║      ██║   
╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═╝   ╚═╝      ╚═╝   
                                                          
📊 BLOCKCHAIN FINALITY MEASUREMENT TOOL 📊
`);

class FinalitiyCLI {
  constructor() {
    this.integration = null;
    this.config = {
      networks: [],
      measurements: 5,
      timeout: 300000, // 5 minutes
      mevAware: true,
      exportFormat: 'json',
      sessionName: null
    };
  }

  showHeader() {
    console.clear();
    console.log(HEADER);
    console.log(chalk.gray('MEV-Aware Finality Analysis for Ethereum, Kasplex, and Igra\n'));
  }

  async runInteractiveMode() {
    this.showHeader();
    
    console.log(chalk.yellow('🚀 INTERACTIVE FINALITY MEASUREMENT\n'));
    
    const inquirer = require('inquirer');
    
    try {
      // Network selection
      const networkChoices = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'networks',
          message: 'Select networks to test:',
          choices: [
            { name: 'Ethereum Sepolia (Testnet)', value: 'sepolia', checked: true },
            { name: 'Kasplex L2 (Testnet)', value: 'kasplex', checked: true },
            { name: 'Igra L2 (Testnet)', value: 'igra', checked: true }
          ],
          validate: (answer) => {
            if (answer.length < 1) {
              return 'Please select at least one network.';
            }
            return true;
          }
        }
      ]);

      // Test configuration
      const testConfig = await inquirer.prompt([
        {
          type: 'number',
          name: 'measurements',
          message: 'Number of measurements per network:',
          default: 5,
          validate: (value) => {
            if (value < 1 || value > 20) {
              return 'Please enter a number between 1 and 20.';
            }
            return true;
          }
        },
        {
          type: 'confirm',
          name: 'mevAware',
          message: 'Enable MEV (Maximal Extractable Value) awareness?',
          default: true
        },
        {
          type: 'input',
          name: 'sessionName',
          message: 'Session name (optional):',
          default: ''
        }
      ]);

      // Update configuration
      this.config.networks = networkChoices.networks;
      this.config.measurements = testConfig.measurements;
      this.config.mevAware = testConfig.mevAware;
      this.config.sessionName = testConfig.sessionName || null;

      // Run test
      await this.runFinalityTest();

    } catch (error) {
      if (error.isTtyError) {
        console.log(chalk.red('❌ Interactive mode not supported in this environment'));
        console.log(chalk.yellow('💡 Try using command-line options instead:'));
        console.log('   cli-finality test --networks sepolia,kasplex --measurements 5');
      } else {
        console.log(chalk.red(`❌ Interactive mode error: ${error.message}`));
      }
    }
  }

  async runFinalityTest() {
    const spinner = ora('Initializing finality measurement system...').start();
    
    try {
      // Create integration instance
      this.integration = new FinalityTestIntegration();
      
      // Override configuration
      this.integration.testConfig = {
        ...this.integration.testConfig,
        transactionCount: this.config.measurements,
        mevAware: this.config.mevAware
      };
      
      if (this.config.sessionName) {
        this.integration.controller = null; // Reset to use new session name
      }

      spinner.text = 'Initializing finality controller...';
      await this.integration.initialize();

      spinner.text = 'Creating network adapters...';
      await this.integration.createNetworkAdapters();
      await this.integration.registerAdapters();

      spinner.succeed('System initialized successfully!');
      
      // Run measurements
      console.log(chalk.cyan('\n📊 Running finality measurements...\n'));
      
      // Check if we have real private keys or should run in mock mode
      const hasRealPrivateKey = process.env.PRIVATE_KEY && 
                               process.env.PRIVATE_KEY !== '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' &&
                               (process.env.PRIVATE_KEY.length === 64 || (process.env.PRIVATE_KEY.startsWith('0x') && process.env.PRIVATE_KEY.length === 66)) &&
                               process.env.PRIVATE_KEY !== '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      // Debug output
      console.log(chalk.gray('🔍 Private Key Detection:'));
      console.log(chalk.gray(`  - PRIVATE_KEY exists: ${!!process.env.PRIVATE_KEY}`));
      console.log(chalk.gray(`  - Length: ${process.env.PRIVATE_KEY?.length}`));
      console.log(chalk.gray(`  - Is real key: ${hasRealPrivateKey}`));
      
      let results;
      if (hasRealPrivateKey) {
        console.log(chalk.green('🔑 Real private key detected - running live finality tests'));
        results = await this.integration.runRealFinalityTests(this.config.networks, this.config.measurements);
      } else {
        console.log(chalk.yellow('🎭 Mock mode - using simulated finality measurements'));  
        results = await this.integration.runMockFinalityTests();
      }
      
      if (results.success) {
        this.displayResults(results);
        
        // Ask if user wants detailed export
        if (process.stdin.isTTY) {
          const inquirer = require('inquirer');
          const exportChoice = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'showDetails',
              message: 'Show detailed measurement data?',
              default: false
            }
          ]);
          
          if (exportChoice.showDetails) {
            this.showDetailedResults(results);
          }
        }
      } else {
        console.log(chalk.red('❌ Finality test failed'));
        process.exit(1);
      }

    } catch (error) {
      spinner.fail(`Finality test failed: ${error.message}`);
      process.exit(1);
    } finally {
      if (this.integration) {
        await this.integration.cleanup();
      }
    }
  }

  displayResults(results) {
    console.log(chalk.green('\n🎉 FINALITY MEASUREMENT COMPLETED!\n'));
    
    const analysis = results.analysis;
    
    // Summary table
    const summaryTable = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      colWidths: [25, 25]
    });
    
    summaryTable.push(
      ['Total Measurements', analysis.totalMeasurements],
      ['Networks Tested', analysis.networks.join(', ').toUpperCase()],
      ['Fastest Finality', `${(analysis.overallMetrics.fastest / 1000).toFixed(2)}s`],
      ['Median Finality', `${(analysis.overallMetrics.median / 1000).toFixed(2)}s`],
      ['Lowest Cost', `$${(analysis.overallMetrics.lowestCost * 3000).toFixed(4)}`]
    );
    
    console.log(summaryTable.toString());
    
    // Network comparison table
    console.log(chalk.cyan('\n📊 NETWORK PERFORMANCE COMPARISON\n'));
    
    const networkTable = new Table({
      head: [
        chalk.cyan('Network'),
        chalk.cyan('Avg Finality'),
        chalk.cyan('Avg Cost (USD)'),
        chalk.cyan('MEV Risk'),
        chalk.cyan('Score')
      ],
      colWidths: [12, 15, 15, 12, 10]
    });
    
    Object.entries(analysis.networkAnalysis).forEach(([network, data]) => {
      const coloredNetwork = network === 'kasplex' ? chalk.yellow(network.toUpperCase()) :
                             network === 'igra' ? chalk.blue(network.toUpperCase()) :
                             chalk.green(network.toUpperCase());
      
      const riskColor = data.mevRisk === 'high' ? chalk.red :
                        data.mevRisk === 'medium' ? chalk.yellow :
                        chalk.green;
      
      const scoreColor = data.overallScore >= 80 ? chalk.green :
                         data.overallScore >= 60 ? chalk.yellow :
                         chalk.red;
      
      networkTable.push([
        coloredNetwork,
        `${(data.averageFinality / 1000).toFixed(2)}s`,
        `$${(data.averageCost * 3000).toFixed(4)}`,
        riskColor(data.mevRisk.toUpperCase()),
        scoreColor(`${data.overallScore}/100`)
      ]);
    });
    
    console.log(networkTable.toString());
    
    // Recommendations
    console.log(chalk.cyan('\n🏆 RECOMMENDATIONS\n'));
    console.log(`🚀 ${chalk.bold('Fastest Finality:')} ${chalk.green(analysis.fastestFinality.network.toUpperCase())} - ${(analysis.fastestFinality.finalityTime / 1000).toFixed(2)}s`);
    console.log(`💰 ${chalk.bold('Lowest Cost:')} ${chalk.green(analysis.lowestCostFinality.network.toUpperCase())} - $${(analysis.lowestCostFinality.cost * 3000).toFixed(4)}`);
    
    // MEV Analysis
    if (analysis.mevImpactAnalysis.averageMevScore > 30) {
      console.log(chalk.cyan('\n🤖 MEV IMPACT ANALYSIS\n'));
      console.log(`📊 Average MEV Score: ${chalk.yellow(analysis.mevImpactAnalysis.averageMevScore.toFixed(1))}`);
      console.log(`📈 Measurements with High MEV: ${chalk.yellow(analysis.mevImpactAnalysis.mevAffectedPercentage.toFixed(1))}%`);
      
      if (analysis.mevImpactAnalysis.averageMevScore > 50) {
        console.log(chalk.red('\n⚠️  High MEV activity detected. Consider using MEV-protected transaction strategies.'));
      }
    }
    
    // Export information
    console.log(chalk.gray(`\n📁 Detailed results exported to: ${path.basename(results.exportPath)}`));
    console.log(chalk.gray(`📋 Session ID: ${results.sessionId}\n`));
  }

  showDetailedResults(results) {
    console.log(chalk.cyan('\n📈 DETAILED MEASUREMENT DATA\n'));
    
    Object.entries(results.results).forEach(([networkName, networkData]) => {
      console.log(chalk.bold(`\n${networkName.toUpperCase()} MEASUREMENTS:`));
      
      const detailTable = new Table({
        head: [
          chalk.cyan('#'),
          chalk.cyan('Finality (s)'),
          chalk.cyan('Cost (USD)'),
          chalk.cyan('MEV Score'),
          chalk.cyan('Status')
        ],
        colWidths: [5, 15, 15, 12, 12]
      });
      
      networkData.measurements.forEach((measurement, index) => {
        const mevColor = measurement.mevScoreDuringTx > 50 ? chalk.red :
                         measurement.mevScoreDuringTx > 30 ? chalk.yellow :
                         chalk.green;
        
        detailTable.push([
          index + 1,
          (measurement.finalityTime / 1000).toFixed(2),
          `$${(measurement.transactionCost * 3000).toFixed(4)}`,
          mevColor(measurement.mevScoreDuringTx.toFixed(1)),
          chalk.green('✓')
        ]);
      });
      
      console.log(detailTable.toString());
    });
  }

  async benchmarkCommand(options) {
    this.showHeader();
    console.log(chalk.yellow('🏁 BENCHMARK MODE\n'));
    
    if (options.networks) {
      this.config.networks = options.networks.split(',').map(n => n.trim());
    } else {
      this.config.networks = ['sepolia', 'kasplex', 'igra'];
    }
    
    this.config.measurements = options.measurements || 10;
    this.config.mevAware = options.mev !== false;
    
    console.log(chalk.blue(`🌐 Networks: ${this.config.networks.join(', ').toUpperCase()}`));
    console.log(chalk.blue(`📊 Measurements: ${this.config.measurements} per network`));
    console.log(chalk.blue(`🤖 MEV Aware: ${this.config.mevAware ? 'Yes' : 'No'}\n`));
    
    await this.runFinalityTest();
  }

  async compareCommand(options) {
    this.showHeader();
    console.log(chalk.yellow('⚖️  NETWORK COMPARISON MODE\n'));
    
    // Force all networks for comparison
    this.config.networks = ['sepolia', 'kasplex', 'igra'];
    this.config.measurements = options.measurements || 5;
    this.config.mevAware = true; // Always enable MEV for comparison
    
    console.log(chalk.blue('🔍 Running comprehensive comparison across all networks...\n'));
    
    await this.runFinalityTest();
  }

  showQuickStart() {
    this.showHeader();
    
    console.log(chalk.yellow('🚀 QUICK START GUIDE\n'));
    
    console.log(chalk.bold('Basic Usage:'));
    console.log('  cli-finality interactive          # Interactive mode (recommended)');
    console.log('  cli-finality test                 # Quick test with default settings');
    console.log('  cli-finality benchmark            # Extended benchmark test');
    console.log('  cli-finality compare              # Compare all networks\n');
    
    console.log(chalk.bold('Advanced Options:'));
    console.log('  --networks sepolia,kasplex        # Select specific networks');
    console.log('  --measurements 10                 # Number of measurements per network');
    console.log('  --no-mev                          # Disable MEV awareness');
    console.log('  --session-name "My Test"          # Custom session name\n');
    
    console.log(chalk.bold('Examples:'));
    console.log('  cli-finality test --networks kasplex --measurements 3');
    console.log('  cli-finality benchmark --measurements 20');
    console.log('  cli-finality compare --no-mev\n');
    
    console.log(chalk.bold('Networks:'));
    console.log('  sepolia    - Ethereum Sepolia Testnet');
    console.log('  kasplex    - Kasplex L2 Testnet');
    console.log('  igra       - Igra L2 Testnet\n');
    
    console.log(chalk.gray('Note: This tool uses mock data for demonstration purposes.'));
    console.log(chalk.gray('No actual blockchain transactions are performed.\n'));
  }
}

// Configure CLI commands
program
  .name('cli-finality')
  .description('MEV-Aware Blockchain Finality Measurement Tool')
  .version('1.0.0');

program
  .command('interactive')
  .alias('i')
  .description('Run interactive finality measurement')
  .action(async () => {
    const cli = new FinalitiyCLI();
    await cli.runInteractiveMode();
  });

program
  .command('test')
  .alias('t')
  .description('Run finality test with options')
  .option('-n, --networks <networks>', 'Comma-separated list of networks (sepolia,kasplex,igra)')
  .option('-m, --measurements <number>', 'Number of measurements per network', '5')
  .option('--no-mev', 'Disable MEV awareness')
  .option('-s, --session-name <name>', 'Custom session name')
  .action(async (options) => {
    const cli = new FinalitiyCLI();
    cli.config.networks = options.networks ? options.networks.split(',').map(n => n.trim()) : ['sepolia', 'kasplex', 'igra'];
    cli.config.measurements = parseInt(options.measurements) || 5;
    cli.config.mevAware = options.mev !== false;
    cli.config.sessionName = options.sessionName || null;
    
    await cli.runFinalityTest();
  });

program
  .command('benchmark')
  .alias('b')
  .description('Run extended benchmark test')
  .option('-n, --networks <networks>', 'Comma-separated list of networks')
  .option('-m, --measurements <number>', 'Number of measurements per network', '10')
  .option('--no-mev', 'Disable MEV awareness')
  .action(async (options) => {
    const cli = new FinalitiyCLI();
    await cli.benchmarkCommand(options);
  });

program
  .command('compare')
  .alias('c')
  .description('Compare all networks')
  .option('-m, --measurements <number>', 'Number of measurements per network', '5')
  .action(async (options) => {
    const cli = new FinalitiyCLI();
    await cli.compareCommand(options);
  });

program
  .command('quickstart')
  .alias('help')
  .description('Show quick start guide')
  .action(() => {
    const cli = new FinalitiyCLI();
    cli.showQuickStart();
  });

// Default action
program.action(() => {
  const cli = new FinalitiyCLI();
  cli.showQuickStart();
});

// Handle unknown commands
program.on('command:*', () => {
  console.log(chalk.red(`❌ Unknown command: ${program.args.join(' ')}`));
  console.log(chalk.yellow('💡 Run "cli-finality help" for available commands'));
  process.exit(1);
});

// Parse command line arguments
if (require.main === module) {
  program.parse();
}

module.exports = { FinalitiyCLI };