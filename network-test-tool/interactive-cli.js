#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');

/**
 * Interactive CLI for running network-agnostic YAML tests
 */
class InteractiveTestRunner {
  constructor() {
    this.testScriptsDir = path.join(__dirname, 'test-scripts');
    this.networksDir = path.join(__dirname, 'config', 'networks');
    this.tests = [];
    this.networks = [];
  }

  /**
   * Load all available test scripts
   */
  loadTests() {
    const categories = fs.readdirSync(this.testScriptsDir);

    categories.forEach(category => {
      const categoryPath = path.join(this.testScriptsDir, category);
      const stats = fs.statSync(categoryPath);

      if (stats.isDirectory()) {
        const files = fs.readdirSync(categoryPath);
        files.forEach(file => {
          if (file.endsWith('.yaml')) {
            const testPath = path.join(categoryPath, file);
            try {
              const content = fs.readFileSync(testPath, 'utf8');
              const match = content.match(/^test:\s*(.+)$/m);
              const descMatch = content.match(/^description:\s*(.+)$/m);

              this.tests.push({
                name: match ? match[1] : file.replace('.yaml', ''),
                description: descMatch ? descMatch[1] : 'No description',
                category: category,
                file: file,
                path: path.relative(__dirname, testPath)
              });
            } catch (error) {
              console.warn(`Warning: Could not parse ${file}: ${error.message}`);
            }
          }
        });
      }
    });
  }

  /**
   * Load all available networks
   */
  loadNetworks() {
    const files = fs.readdirSync(this.networksDir);

    files.forEach(file => {
      if (file.endsWith('.json')) {
        try {
          const networkPath = path.join(this.networksDir, file);
          const network = JSON.parse(fs.readFileSync(networkPath, 'utf8'));

          this.networks.push({
            name: network.name,
            chainId: network.chainId,
            symbol: network.symbol || 'ETH',
            file: file.replace('.json', ''),
            isTestnet: network.isTestnet !== false
          });
        } catch (error) {
          console.warn(`Warning: Could not load network ${file}: ${error.message}`);
        }
      }
    });
  }

  /**
   * Get test choices grouped by category
   */
  getTestChoices() {
    const categories = {};

    this.tests.forEach(test => {
      if (!categories[test.category]) {
        categories[test.category] = [];
      }
      categories[test.category].push({
        name: `${test.name} - ${chalk.gray(test.description)}`,
        value: test,
        short: test.name
      });
    });

    // Build hierarchical choices
    const choices = [];
    Object.keys(categories).sort().forEach(category => {
      choices.push(new inquirer.Separator(chalk.bold.blue(`\n=== ${category.toUpperCase()} ===`)));
      choices.push(...categories[category]);
    });

    return choices;
  }

  /**
   * Get network choices
   */
  getNetworkChoices() {
    const testnets = [];
    const mainnets = [];

    this.networks.forEach(network => {
      const choice = {
        name: `${network.name} (${network.chainId}) - ${network.symbol}`,
        value: network,
        short: network.name
      };

      if (network.isTestnet) {
        testnets.push(choice);
      } else {
        mainnets.push(choice);
      }
    });

    const choices = [];

    if (testnets.length > 0) {
      choices.push(new inquirer.Separator(chalk.bold.green('\n=== TESTNETS ===')));
      choices.push(...testnets);
    }

    if (mainnets.length > 0) {
      choices.push(new inquirer.Separator(chalk.bold.yellow('\n=== MAINNETS ===')));
      choices.push(...mainnets);
    }

    return choices;
  }

  /**
   * Run a test on a network
   */
  async runTest(test, network, options = {}) {
    console.log(chalk.blue('\n' + '='.repeat(60)));
    console.log(chalk.blue.bold(`Running: ${test.name}`));
    console.log(chalk.gray(`Category: ${test.category}`));
    console.log(chalk.gray(`Network: ${network.name} (${network.chainId})`));
    console.log(chalk.gray(`File: ${test.path}`));
    console.log(chalk.blue('='.repeat(60) + '\n'));

    const spinner = ora('Executing test...').start();

    try {
      const cmd = `node cli.js yaml "${test.path}" -n ${network.file}`;

      if (options.verbose) {
        spinner.stop();
        console.log(chalk.gray(`Command: ${cmd}\n`));
        execSync(cmd, { stdio: 'inherit' });
      } else {
        const output = execSync(cmd, { encoding: 'utf8' });
        spinner.succeed('Test completed');

        // Show summary
        if (output.includes('Success Rate: 100')) {
          console.log(chalk.green('✅ Test PASSED'));
        } else if (output.includes('Success Rate:')) {
          const match = output.match(/Success Rate: ([\d.]+)%/);
          const rate = match ? match[1] : '?';
          console.log(chalk.yellow(`⚠️  Test partially passed: ${rate}% success rate`));
        } else {
          console.log(chalk.red('❌ Test FAILED'));
        }

        if (options.showOutput) {
          console.log('\n' + output);
        }
      }

      return true;
    } catch (error) {
      spinner.fail('Test failed');
      console.error(chalk.red(`Error: ${error.message}`));

      if (options.showErrors && error.stdout) {
        console.log('\n' + error.stdout);
      }

      return false;
    }
  }

  /**
   * Main interactive menu
   */
  async run() {
    console.log(chalk.bold.cyan('\n🧪 Network Test Runner - Interactive CLI\n'));

    // Load available tests and networks
    const loadingSpinner = ora('Loading tests and networks...').start();
    this.loadTests();
    this.loadNetworks();
    loadingSpinner.succeed(`Loaded ${this.tests.length} tests and ${this.networks.length} networks`);

    if (this.tests.length === 0) {
      console.error(chalk.red('No tests found in test-scripts directory!'));
      process.exit(1);
    }

    if (this.networks.length === 0) {
      console.error(chalk.red('No networks found in config/networks directory!'));
      process.exit(1);
    }

    let continueRunning = true;

    while (continueRunning) {
      console.log('\n' + chalk.gray('─'.repeat(60)));

      const { mode } = await inquirer.prompt([
        {
          type: 'list',
          name: 'mode',
          message: 'What would you like to do?',
          choices: [
            { name: '🚀 Run a single test', value: 'single' },
            { name: '📦 Run tests by category', value: 'category' },
            { name: '🌐 Run all tests on a network', value: 'network' },
            { name: '🔄 Run test on multiple networks', value: 'multi' },
            new inquirer.Separator(),
            { name: '📋 List all tests', value: 'list' },
            { name: '🌍 List all networks', value: 'networks' },
            new inquirer.Separator(),
            { name: '❌ Exit', value: 'exit' }
          ]
        }
      ]);

      switch (mode) {
        case 'single':
          await this.runSingleTest();
          break;

        case 'category':
          await this.runCategoryTests();
          break;

        case 'network':
          await this.runNetworkTests();
          break;

        case 'multi':
          await this.runMultiNetworkTest();
          break;

        case 'list':
          this.listTests();
          break;

        case 'networks':
          this.listNetworks();
          break;

        case 'exit':
          continueRunning = false;
          break;
      }
    }

    console.log(chalk.cyan('\n👋 Goodbye!\n'));
  }

  /**
   * Run a single test
   */
  async runSingleTest() {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'test',
        message: 'Select a test:',
        choices: this.getTestChoices(),
        pageSize: 20
      },
      {
        type: 'list',
        name: 'network',
        message: 'Select a network:',
        choices: this.getNetworkChoices()
      },
      {
        type: 'confirm',
        name: 'verbose',
        message: 'Show detailed output?',
        default: false
      }
    ]);

    await this.runTest(answers.test, answers.network, {
      verbose: answers.verbose,
      showOutput: !answers.verbose
    });

    await this.promptContinue();
  }

  /**
   * Run tests by category
   */
  async runCategoryTests() {
    const categories = [...new Set(this.tests.map(t => t.category))];

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'category',
        message: 'Select a category:',
        choices: categories.map(c => ({
          name: `${c} (${this.tests.filter(t => t.category === c).length} tests)`,
          value: c
        }))
      },
      {
        type: 'list',
        name: 'network',
        message: 'Select a network:',
        choices: this.getNetworkChoices()
      },
      {
        type: 'confirm',
        name: 'continueOnError',
        message: 'Continue if a test fails?',
        default: true
      }
    ]);

    const categoryTests = this.tests.filter(t => t.category === answers.category);
    const results = { passed: 0, failed: 0 };

    for (const test of categoryTests) {
      const success = await this.runTest(test, answers.network);

      if (success) {
        results.passed++;
      } else {
        results.failed++;
        if (!answers.continueOnError) break;
      }
    }

    console.log(chalk.bold('\n📊 Category Test Summary:'));
    console.log(chalk.green(`  ✅ Passed: ${results.passed}`));
    console.log(chalk.red(`  ❌ Failed: ${results.failed}`));

    await this.promptContinue();
  }

  /**
   * Run all tests on a network
   */
  async runNetworkTests() {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'network',
        message: 'Select a network:',
        choices: this.getNetworkChoices()
      },
      {
        type: 'checkbox',
        name: 'categories',
        message: 'Select categories to test:',
        choices: [...new Set(this.tests.map(t => t.category))],
        default: [...new Set(this.tests.map(t => t.category))]
      },
      {
        type: 'confirm',
        name: 'continueOnError',
        message: 'Continue if a test fails?',
        default: true
      }
    ]);

    const selectedTests = this.tests.filter(t => answers.categories.includes(t.category));
    const results = { passed: 0, failed: 0, skipped: 0 };

    console.log(chalk.bold(`\n🏃 Running ${selectedTests.length} tests on ${answers.network.name}...\n`));

    for (const test of selectedTests) {
      const success = await this.runTest(test, answers.network);

      if (success) {
        results.passed++;
      } else {
        results.failed++;
        if (!answers.continueOnError) {
          results.skipped = selectedTests.length - results.passed - results.failed;
          break;
        }
      }
    }

    console.log(chalk.bold('\n📊 Network Test Summary:'));
    console.log(chalk.green(`  ✅ Passed: ${results.passed}`));
    console.log(chalk.red(`  ❌ Failed: ${results.failed}`));
    if (results.skipped > 0) {
      console.log(chalk.yellow(`  ⏭️  Skipped: ${results.skipped}`));
    }

    await this.promptContinue();
  }

  /**
   * Run a test on multiple networks
   */
  async runMultiNetworkTest() {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'test',
        message: 'Select a test:',
        choices: this.getTestChoices(),
        pageSize: 20
      },
      {
        type: 'checkbox',
        name: 'networks',
        message: 'Select networks:',
        choices: this.getNetworkChoices().filter(c => c.value)
      }
    ]);

    const results = {};

    for (const network of answers.networks) {
      const success = await this.runTest(answers.test, network);
      results[network.name] = success;
    }

    console.log(chalk.bold('\n📊 Multi-Network Test Summary:'));
    Object.entries(results).forEach(([network, success]) => {
      const icon = success ? '✅' : '❌';
      const color = success ? chalk.green : chalk.red;
      console.log(color(`  ${icon} ${network}`));
    });

    await this.promptContinue();
  }

  /**
   * List all tests
   */
  listTests() {
    console.log(chalk.bold.cyan('\n📋 Available Tests:\n'));

    const categories = {};
    this.tests.forEach(test => {
      if (!categories[test.category]) {
        categories[test.category] = [];
      }
      categories[test.category].push(test);
    });

    Object.keys(categories).sort().forEach(category => {
      console.log(chalk.bold.blue(`\n${category.toUpperCase()} (${categories[category].length} tests)`));
      console.log(chalk.gray('─'.repeat(40)));

      categories[category].forEach(test => {
        console.log(`  • ${chalk.white(test.name)}`);
        console.log(`    ${chalk.gray(test.description)}`);
        console.log(`    ${chalk.dim(`File: ${test.file}`)}`);
      });
    });
  }

  /**
   * List all networks
   */
  listNetworks() {
    console.log(chalk.bold.cyan('\n🌍 Available Networks:\n'));

    const testnets = this.networks.filter(n => n.isTestnet);
    const mainnets = this.networks.filter(n => !n.isTestnet);

    if (testnets.length > 0) {
      console.log(chalk.bold.green('TESTNETS'));
      console.log(chalk.gray('─'.repeat(40)));
      testnets.forEach(network => {
        console.log(`  • ${chalk.white(network.name)}`);
        console.log(`    Chain ID: ${network.chainId}`);
        console.log(`    Symbol: ${network.symbol}`);
      });
    }

    if (mainnets.length > 0) {
      console.log(chalk.bold.yellow('\nMAINNETS'));
      console.log(chalk.gray('─'.repeat(40)));
      mainnets.forEach(network => {
        console.log(`  • ${chalk.white(network.name)}`);
        console.log(`    Chain ID: ${network.chainId}`);
        console.log(`    Symbol: ${network.symbol}`);
      });
    }
  }

  /**
   * Prompt to continue
   */
  async promptContinue() {
    const { cont } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'cont',
        message: 'Continue to main menu?',
        default: true
      }
    ]);

    if (!cont) {
      console.log(chalk.cyan('\n👋 Goodbye!\n'));
      process.exit(0);
    }
  }
}

// Run the CLI
if (require.main === module) {
  const runner = new InteractiveTestRunner();
  runner.run().catch(error => {
    console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
    process.exit(1);
  });
}

module.exports = InteractiveTestRunner;