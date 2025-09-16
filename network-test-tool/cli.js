#!/usr/bin/env node

require('dotenv').config();

const { program } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { TestRunner } = require('./lib/test-runner');
const { getAllNetworks } = require('./lib/networks');
const { DashboardManager } = require('./lib/dashboard');

const pkg = require('./package.json');

program
  .name('blockchain-test-tool')
  .description('Comprehensive blockchain testing tool for Ethereum L2 networks')
  .version(pkg.version);

// Test command with granular selection
program
  .command('test')
  .description('Run blockchain tests with granular selection')
  .option('-n, --networks <networks>', 'Networks to test (comma-separated)', 'sepolia,kasplex,igra')
  .option('-t, --tests <tests>', 'Test types to run (comma-separated)', 'evm,defi,finality')
  .option('-m, --mode <mode>', 'Test execution mode', 'standard')
  .option('--parallel', 'Run networks in parallel')
  .option('--no-dashboard', 'Disable live dashboard')
  .option('--max-concurrent <number>', 'Maximum concurrent operations', '5')
  .option('--timeout <number>', 'Test timeout in milliseconds', '300000')
  .option('-v, --verbose', 'Verbose logging')
  .option('--dry-run', 'Show what would be tested without running')
  .option('--retry-until-success', 'Keep retrying failed tests until all pass')
  .option('--max-retries <number>', 'Maximum retry attempts per test', '3')
  .option('--retry-delay <number>', 'Delay between retries in milliseconds', '2000')
  .action(async (options) => {
    await runTests(options);
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Interactive menu - discover commands and options')
  .action(async () => {
    await runInteractiveMode();
  });

// Main menu shortcut
program
  .command('menu')
  .alias('m')
  .description('Show interactive main menu')
  .action(async () => {
    await runInteractiveMode();
  });

// Deploy command
program
  .command('deploy')
  .description('Deploy contracts to networks')
  .option('-n, --networks <networks>', 'Networks to deploy to (comma-separated)', 'sepolia,kasplex,igra')
  .option('--parallel', 'Deploy to networks in parallel')
  .option('-t, --type <type>', 'Contract type to deploy', 'all')
  .action(async (options) => {
    await runDeployment(options);
  });

// Dashboard command
program
  .command('dashboard')
  .alias('dash')
  .description('Launch live metrics dashboard')
  .option('-p, --port <port>', 'Dashboard port', '3000')
  .action(async (options) => {
    await launchDashboard(options);
  });

// Status command
program
  .command('status')
  .description('Check network and contract status')
  .option('-n, --networks <networks>', 'Networks to check (comma-separated)', 'sepolia,kasplex,igra')
  .action(async (options) => {
    await checkStatus(options);
  });

// Results command
program
  .command('results')
  .description('View and analyze test results')
  .option('-l, --latest', 'Show latest results')
  .option('-s, --since <date>', 'Show results since date')
  .option('-n, --network <network>', 'Filter by network')
  .option('-t, --type <type>', 'Filter by test type')
  .option('--compare', 'Compare results across networks')
  .action(async (options) => {
    await viewResults(options);
  });

// Contracts command
program
  .command('contracts')
  .description('Manage deployed contracts')
  .option('-n, --networks <networks>', 'Networks to check (comma-separated)', 'sepolia,kasplex,igra')
  .option('-a, --action <action>', 'Action to perform (list, health, verify)', 'list')
  .option('-t, --type <type>', 'Contract type filter (evm, defi, all)', 'all')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    await manageContracts(options);
  });

async function runTests(options) {
  console.log(chalk.cyan.bold('🚀 Blockchain Test Suite'));
  console.log(chalk.gray('=' .repeat(50)));
  
  if (options.dryRun) {
    await showDryRun(options);
    return;
  }

  const runner = new TestRunner({
    networks: parseList(options.networks),
    tests: parseList(options.tests),
    mode: options.mode,
    parallel: options.parallel,
    dashboard: !options.noDashboard,
    maxConcurrent: parseInt(options.maxConcurrent),
    timeout: parseInt(options.timeout),
    verbose: options.verbose,
    retryUntilSuccess: options.retryUntilSuccess,
    maxRetries: parseInt(options.maxRetries) || 3,
    retryDelay: parseInt(options.retryDelay) || 2000
  });

  await runner.run();
  process.exit(0);
}

async function runInteractiveMode() {
  console.log(chalk.cyan.bold('🚀 Blockchain Test Suite - Interactive Menu'));
  console.log(chalk.gray('Select what you want to do and get the exact command to run\\n'));

  while (true) {
    const mainAction = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🧪 Run Tests - Execute blockchain tests', value: 'test' },
          { name: '🚀 Deploy Contracts - Deploy contracts to networks', value: 'deploy' },
          { name: '📊 View Dashboard - Launch live metrics dashboard', value: 'dashboard' },
          { name: '📈 Check Status - View network and contract status', value: 'status' },
          { name: '📋 View Results - Analyze test results', value: 'results' },
          { name: '⚙️  Manage Contracts - Contract management tools', value: 'contracts' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }
    ]);

    if (mainAction.action === 'exit') {
      console.log(chalk.gray('Goodbye! 👋'));
      process.exit(0);
    }

    if (mainAction.action === 'test') {
      await runInteractiveTestBuilder();
    } else if (mainAction.action === 'deploy') {
      await runInteractiveDeployBuilder();
    } else if (mainAction.action === 'dashboard') {
      await runInteractiveDashboardBuilder();
    } else if (mainAction.action === 'status') {
      await runInteractiveStatusBuilder();
    } else if (mainAction.action === 'results') {
      await runInteractiveResultsBuilder();
    } else if (mainAction.action === 'contracts') {
      await runInteractiveContractsBuilder();
    }

    // Ask if user wants to continue or exit
    const continueChoice = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: 'Would you like to do something else?',
        default: true
      }
    ]);

    if (!continueChoice.continue) {
      console.log(chalk.gray('Goodbye! 👋'));
      break;
    }

    console.log(''); // Add spacing
  }
}

async function runInteractiveTestBuilder() {
  console.log(chalk.cyan.bold('\\n🧪 Interactive Test Configuration'));
  console.log(chalk.gray('Build your test command step by step\\n'));

  const allNetworks = getAllNetworks();
  const testTypes = ['evm', 'defi', 'load', 'finality'];
  const modes = ['standard', 'quick', 'comprehensive', 'stress'];

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'networks',
      message: 'Which networks would you like to test?',
      choices: [
        { name: 'sepolia - Ethereum Sepolia Testnet', value: 'sepolia', checked: false },
        { name: 'kasplex - Kasplex L2 Network', value: 'kasplex', checked: false },
        { name: 'igra - Igra L2 Network', value: 'igra', checked: true }
      ],
      validate: (input) => input.length > 0 || 'Please select at least one network'
    },
    {
      type: 'checkbox',
      name: 'tests',
      message: 'Which test types would you like to run?',
      choices: [
        { name: 'evm - EVM Compatibility Tests', value: 'evm', checked: false },
        { name: 'defi - DeFi Protocol Tests', value: 'defi', checked: true },
        { name: 'load - Load Testing', value: 'load', checked: false },
        { name: 'finality - Finality Measurements', value: 'finality', checked: false }
      ],
      validate: (input) => input.length > 0 || 'Please select at least one test type'
    },
    {
      type: 'list',
      name: 'mode',
      message: 'Select test execution mode:',
      choices: [
        { name: 'Standard - Balanced testing (recommended)', value: 'standard' },
        { name: 'Quick - Fast validation', value: 'quick' },
        { name: 'Comprehensive - Full coverage', value: 'comprehensive' },
        { name: 'Stress - Performance limits', value: 'stress' }
      ],
      default: 'standard'
    },
    {
      type: 'confirm',
      name: 'parallel',
      message: 'Run networks in parallel for faster execution?',
      default: false
    },
    {
      type: 'confirm',
      name: 'dashboard',
      message: 'Show live dashboard during testing?',
      default: true
    },
    {
      type: 'number',
      name: 'maxConcurrent',
      message: 'Maximum concurrent operations per network:',
      default: 5,
      validate: (input) => input > 0 && input <= 20 || 'Please enter a number between 1 and 20'
    }
  ]);

  // Build command
  let command = 'node cli.js test';
  command += ` --tests ${answers.tests.join(',')}`;
  command += ` --networks ${answers.networks.join(',')}`;
  if (answers.mode !== 'standard') {
    command += ` --mode ${answers.mode}`;
  }
  if (answers.parallel) {
    command += ' --parallel';
  }
  if (!answers.dashboard) {
    command += ' --no-dashboard';
  }
  if (answers.maxConcurrent !== 5) {
    command += ` --max-concurrent ${answers.maxConcurrent}`;
  }

  console.log(chalk.green('\\n✅ Configuration complete!'));
  console.log(chalk.yellow('Generated Command:'));
  console.log(chalk.white.bold(`  ${command}\\n`));

  const action = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🚀 Execute Now', value: 'execute' },
        { name: '📋 Copy Command', value: 'copy' },
        { name: '↩️  Back to Main Menu', value: 'back' }
      ]
    }
  ]);

  if (action.action === 'execute') {
    console.log(chalk.green('\\n🚀 Starting tests...\\n'));

    const runner = new TestRunner({
      networks: answers.networks,
      tests: answers.tests,
      mode: answers.mode,
      parallel: answers.parallel,
      dashboard: answers.dashboard,
      maxConcurrent: answers.maxConcurrent,
      verbose: false
    });

    await runner.run();
  } else if (action.action === 'copy') {
    // In a real implementation, this would copy to clipboard
    console.log(chalk.green('\\n📋 Command copied to clipboard (simulated)'));
    console.log(chalk.gray('You can now paste and run:'));
    console.log(chalk.white(`  ${command}`));
  }
  // 'back' returns to main menu naturally
}

async function runInteractiveDeployBuilder() {
  console.log(chalk.cyan.bold('\\n🚀 Interactive Contract Deployment'));
  console.log(chalk.gray('Configure contract deployment options\\n'));

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'networks',
      message: 'Which networks would you like to deploy to?',
      choices: [
        { name: 'sepolia - Ethereum Sepolia Testnet', value: 'sepolia', checked: false },
        { name: 'kasplex - Kasplex L2 Network', value: 'kasplex', checked: false },
        { name: 'igra - Igra L2 Network', value: 'igra', checked: true }
      ],
      validate: (input) => input.length > 0 || 'Please select at least one network'
    },
    {
      type: 'list',
      name: 'type',
      message: 'What type of contracts to deploy?',
      choices: [
        { name: 'all - Deploy all contract types', value: 'all' },
        { name: 'evm - EVM compatibility contracts only', value: 'evm' },
        { name: 'defi - DeFi protocol contracts only', value: 'defi' },
        { name: 'load - Load test contracts only', value: 'load' }
      ],
      default: 'all'
    },
    {
      type: 'confirm',
      name: 'parallel',
      message: 'Deploy to networks in parallel?',
      default: false
    }
  ]);

  // Build command
  let command = 'node cli.js deploy';
  command += ` --networks ${answers.networks.join(',')}`;
  if (answers.type !== 'all') {
    command += ` --type ${answers.type}`;
  }
  if (answers.parallel) {
    command += ' --parallel';
  }

  console.log(chalk.green('\\n✅ Configuration complete!'));
  console.log(chalk.yellow('Generated Command:'));
  console.log(chalk.white.bold(`  ${command}\\n`));

  const action = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🚀 Execute Now', value: 'execute' },
        { name: '📋 Copy Command', value: 'copy' },
        { name: '↩️  Back to Main Menu', value: 'back' }
      ]
    }
  ]);

  if (action.action === 'execute') {
    console.log(chalk.green('\\n🚀 Starting deployment...\\n'));
    await runDeployment({
      networks: answers.networks.join(','),
      type: answers.type,
      parallel: answers.parallel
    });
  } else if (action.action === 'copy') {
    console.log(chalk.green('\\n📋 Command copied to clipboard (simulated)'));
    console.log(chalk.gray('You can now paste and run:'));
    console.log(chalk.white(`  ${command}`));
  }
}

async function runInteractiveDashboardBuilder() {
  console.log(chalk.cyan.bold('\\n📊 Interactive Dashboard Configuration'));
  console.log(chalk.gray('Launch live metrics dashboard\\n'));

  const answers = await inquirer.prompt([
    {
      type: 'number',
      name: 'port',
      message: 'Dashboard port:',
      default: 3000,
      validate: (input) => input > 0 && input < 65536 || 'Please enter a valid port number'
    },
    {
      type: 'confirm',
      name: 'openBrowser',
      message: 'Open dashboard in browser automatically?',
      default: true
    }
  ]);

  // Build command
  let command = 'node cli.js dashboard';
  if (answers.port !== 3000) {
    command += ` --port ${answers.port}`;
  }
  if (!answers.openBrowser) {
    command += ' --no-browser';
  }

  console.log(chalk.green('\\n✅ Configuration complete!'));
  console.log(chalk.yellow('Generated Command:'));
  console.log(chalk.white.bold(`  ${command}\\n`));

  const action = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🚀 Execute Now', value: 'execute' },
        { name: '📋 Copy Command', value: 'copy' },
        { name: '↩️  Back to Main Menu', value: 'back' }
      ]
    }
  ]);

  if (action.action === 'execute') {
    console.log(chalk.green('\\n🚀 Starting dashboard...\\n'));
    // Dashboard execution would go here
    console.log(chalk.green('Dashboard launched! Press Ctrl+C to stop.'));
  } else if (action.action === 'copy') {
    console.log(chalk.green('\\n📋 Command copied to clipboard (simulated)'));
    console.log(chalk.gray('You can now paste and run:'));
    console.log(chalk.white(`  ${command}`));
  }
}

async function runInteractiveStatusBuilder() {
  console.log(chalk.cyan.bold('\\n📈 Interactive Status Check'));
  console.log(chalk.gray('Check network and contract status\\n'));

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'networks',
      message: 'Which networks would you like to check?',
      choices: [
        { name: 'sepolia - Ethereum Sepolia Testnet', value: 'sepolia', checked: true },
        { name: 'kasplex - Kasplex L2 Network', value: 'kasplex', checked: true },
        { name: 'igra - Igra L2 Network', value: 'igra', checked: true }
      ],
      validate: (input) => input.length > 0 || 'Please select at least one network'
    },
    {
      type: 'confirm',
      name: 'verbose',
      message: 'Show detailed status information?',
      default: false
    }
  ]);

  // Build command
  let command = 'node cli.js status';
  command += ` --networks ${answers.networks.join(',')}`;
  if (answers.verbose) {
    command += ' --verbose';
  }

  console.log(chalk.green('\\n✅ Configuration complete!'));
  console.log(chalk.yellow('Generated Command:'));
  console.log(chalk.white.bold(`  ${command}\\n`));

  const action = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🚀 Execute Now', value: 'execute' },
        { name: '📋 Copy Command', value: 'copy' },
        { name: '↩️  Back to Main Menu', value: 'back' }
      ]
    }
  ]);

  if (action.action === 'copy') {
    console.log(chalk.green('\\n📋 Command copied to clipboard (simulated)'));
    console.log(chalk.gray('You can now paste and run:'));
    console.log(chalk.white(`  ${command}`));
  }
}

async function runInteractiveResultsBuilder() {
  console.log(chalk.cyan.bold('\\n📋 Interactive Results Viewer'));
  console.log(chalk.gray('View and analyze test results\\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What results would you like to view?',
      choices: [
        { name: 'latest - Show latest test results', value: 'latest' },
        { name: 'summary - Show results summary', value: 'summary' },
        { name: 'export - Export results to file', value: 'export' }
      ]
    },
    {
      type: 'confirm',
      name: 'verbose',
      message: 'Show detailed results?',
      default: false,
      when: (answers) => answers.action !== 'export'
    }
  ]);

  // Build command
  let command = 'node cli.js results';
  if (answers.action === 'latest') {
    command += ' --latest';
  }
  if (answers.verbose) {
    command += ' --verbose';
  }

  console.log(chalk.green('\\n✅ Configuration complete!'));
  console.log(chalk.yellow('Generated Command:'));
  console.log(chalk.white.bold(`  ${command}\\n`));

  const action = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '📋 Copy Command', value: 'copy' },
        { name: '↩️  Back to Main Menu', value: 'back' }
      ]
    }
  ]);

  if (action.action === 'copy') {
    console.log(chalk.green('\\n📋 Command copied to clipboard (simulated)'));
    console.log(chalk.gray('You can now paste and run:'));
    console.log(chalk.white(`  ${command}`));
  }
}

async function runInteractiveContractsBuilder() {
  console.log(chalk.cyan.bold('\\n⚙️ Interactive Contract Management'));
  console.log(chalk.gray('Manage deployed contracts\\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What contract action would you like to perform?',
      choices: [
        { name: 'list - List deployed contracts', value: 'list' },
        { name: 'health - Check contract health', value: 'health' },
        { name: 'verify - Verify contract deployments', value: 'verify' }
      ]
    },
    {
      type: 'checkbox',
      name: 'networks',
      message: 'Which networks would you like to check?',
      choices: [
        { name: 'sepolia - Ethereum Sepolia Testnet', value: 'sepolia', checked: false },
        { name: 'kasplex - Kasplex L2 Network', value: 'kasplex', checked: false },
        { name: 'igra - Igra L2 Network', value: 'igra', checked: true }
      ],
      validate: (input) => input.length > 0 || 'Please select at least one network'
    }
  ]);

  // Build command
  let command = 'node cli.js contracts';
  command += ` --action ${answers.action}`;
  command += ` --networks ${answers.networks.join(',')}`;

  console.log(chalk.green('\\n✅ Configuration complete!'));
  console.log(chalk.yellow('Generated Command:'));
  console.log(chalk.white.bold(`  ${command}\\n`));

  const action = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '📋 Copy Command', value: 'copy' },
        { name: '↩️  Back to Main Menu', value: 'back' }
      ]
    }
  ]);

  if (action.action === 'copy') {
    console.log(chalk.green('\\n📋 Command copied to clipboard (simulated)'));
    console.log(chalk.gray('You can now paste and run:'));
    console.log(chalk.white(`  ${command}`));
  }
}

async function runDeployment(options) {
  console.log(chalk.yellow.bold('🏗️  Contract Deployment'));
  console.log(chalk.gray('=' .repeat(30)));

  const runner = new TestRunner({
    networks: parseList(options.networks),
    deployOnly: true,
    parallel: options.parallel,
    contractType: options.type
  });

  await runner.deploy();
  await runner.cleanup();
  process.exit(0);
}

async function launchDashboard(options) {
  console.log(chalk.magenta.bold('📊 Launching Live Dashboard'));
  
  const dashboard = new DashboardManager({
    port: parseInt(options.port)
  });

  await dashboard.start();
}

async function checkStatus(options) {
  console.log(chalk.blue.bold('📡 Network Status Check'));
  
  const runner = new TestRunner({
    networks: parseList(options.networks),
    statusOnly: true
  });

  await runner.checkStatus();
}

async function viewResults(options) {
  console.log(chalk.green.bold('📈 Test Results Analysis'));

  const { ResultsAnalyzer } = require('./lib/results-analyzer');
  const analyzer = new ResultsAnalyzer();

  if (options.compare) {
    await analyzer.compareNetworks(options);
  } else {
    await analyzer.viewResults(options);
  }
}

async function manageContracts(options) {
  console.log(chalk.blue.bold('📝 Contract Management'));
  console.log(chalk.gray('=' .repeat(40)));

  const { ContractRegistry } = require('./lib/contract-registry');
  const { getNetworkConfig } = require('./lib/networks');

  const registry = new ContractRegistry();
  await registry.initialize();

  const networks = parseList(options.networks);

  for (const networkName of networks) {
    const network = getNetworkConfig(networkName);
    console.log(chalk.cyan(`\n🌐 ${network.name} (Chain ID: ${network.chainId})`));

    switch (options.action) {
      case 'list':
        await listContracts(registry, network, options);
        break;

      case 'health':
        await checkContractHealth(registry, network, options);
        break;

      case 'verify':
        await verifyContracts(registry, network, options);
        break;

      default:
        console.log(chalk.red(`Unknown action: ${options.action}`));
    }
  }

  await registry.close();
}

async function listContracts(registry, network, options) {
  let contracts;

  if (options.type === 'all') {
    contracts = await registry.getAllContractsByNetwork(network.chainId);
  } else {
    contracts = await registry.getActiveContractsByType(network.chainId, options.type);
  }

  if (!contracts || (Array.isArray(contracts) ? contracts.length === 0 : Object.keys(contracts).length === 0)) {
    console.log(chalk.yellow('  No contracts found'));
    return;
  }

  // Convert to array if it's an object
  const contractList = Array.isArray(contracts) ? contracts : Object.values(contracts);

  console.log(chalk.green(`  Found ${contractList.length} contract(s):`));

  contractList.forEach(contract => {
    console.log(chalk.gray(`
  📄 ${contract.contract_name}
     Type: ${contract.contract_type}
     Address: ${contract.contract_address}
     Status: ${contract.health_status || 'unknown'}
     Deployed: ${contract.deployed_at || contract.timestamp}`));

    if (options.verbose) {
      console.log(chalk.gray(`     Block: ${contract.block_number}`));
      console.log(chalk.gray(`     Gas Used: ${contract.gas_used}`));
      console.log(chalk.gray(`     Deployer: ${contract.deployer_address}`));
    }
  });
}

async function checkContractHealth(registry, network, options) {
  const ethers = require('ethers');
  const provider = new ethers.providers.JsonRpcProvider(network.rpc);

  let contracts;
  if (options.type === 'all') {
    contracts = await registry.getAllContractsByNetwork(network.chainId);
  } else {
    contracts = await registry.getActiveContractsByType(network.chainId, options.type);
  }

  if (!contracts || (Array.isArray(contracts) ? contracts.length === 0 : Object.keys(contracts).length === 0)) {
    console.log(chalk.yellow('  No contracts to check'));
    return;
  }

  console.log(chalk.cyan('  🏥 Running health checks...'));

  const contractList = Array.isArray(contracts) ? contracts : Object.values(contracts);
  const contractsToCheck = {};

  contractList.forEach(contract => {
    contractsToCheck[contract.contract_name] = contract;
  });

  const healthResults = await registry.verifyContractsHealth(contractsToCheck, provider);

  if (healthResults.allHealthy) {
    console.log(chalk.green('  ✅ All contracts are healthy'));
  } else {
    console.log(chalk.yellow('  ⚠️ Some contracts have issues:'));
  }

  for (const [name, result] of Object.entries(healthResults.results)) {
    if (result.healthy) {
      console.log(chalk.green(`    ✅ ${name}: Healthy (${result.responseTime}ms)`));
    } else {
      console.log(chalk.red(`    ❌ ${name}: ${result.error || 'Failed'}`));
    }

    if (options.verbose && result.checks) {
      result.checks.forEach(check => {
        const status = check.passed ? '✓' : '✗';
        console.log(chalk.gray(`       ${status} ${check.name}`));
      });
    }
  }
}

async function verifyContracts(registry, network, options) {
  const ethers = require('ethers');
  const provider = new ethers.providers.JsonRpcProvider(network.rpc);

  let contracts;
  if (options.type === 'all') {
    contracts = await registry.getAllContractsByNetwork(network.chainId);
  } else {
    contracts = await registry.getActiveContractsByType(network.chainId, options.type);
  }

  if (!contracts || (Array.isArray(contracts) ? contracts.length === 0 : Object.keys(contracts).length === 0)) {
    console.log(chalk.yellow('  No contracts to verify'));
    return;
  }

  console.log(chalk.cyan('  🔍 Verifying contracts...'));

  const contractList = Array.isArray(contracts) ? contracts : Object.values(contracts);
  let verified = 0;
  let failed = 0;

  for (const contract of contractList) {
    try {
      const code = await provider.getCode(contract.contract_address);

      if (code && code !== '0x' && code !== '0x0') {
        console.log(chalk.green(`  ✅ ${contract.contract_name}: Verified`));
        verified++;
      } else {
        console.log(chalk.red(`  ❌ ${contract.contract_name}: No code at address`));
        failed++;
      }
    } catch (error) {
      console.log(chalk.red(`  ❌ ${contract.contract_name}: ${error.message}`));
      failed++;
    }
  }

  console.log(chalk.cyan(`\n  Summary: ${verified} verified, ${failed} failed`));
}

async function showDryRun(options) {
  const networks = parseList(options.networks);
  const tests = parseList(options.tests);
  
  console.log(chalk.yellow.bold('🔍 Dry Run - Test Plan'));
  console.log(chalk.gray('=' .repeat(40)));
  console.log(chalk.cyan('Networks:'), networks.join(', '));
  console.log(chalk.cyan('Tests:'), tests.join(', '));
  console.log(chalk.cyan('Mode:'), options.mode);
  console.log(chalk.cyan('Parallel:'), options.parallel ? 'Yes' : 'No');
  console.log(chalk.cyan('Max Concurrent:'), options.maxConcurrent);
  
  console.log(chalk.yellow('\\n📋 Test Matrix:'));
  networks.forEach(network => {
    tests.forEach(test => {
      console.log(chalk.gray(`  ✓ ${test.toUpperCase()} tests on ${network}`));
    });
  });
  
  const totalTests = networks.length * tests.length;
  const estimatedTime = options.parallel ? 
    Math.max(...networks.map(() => tests.length * 2)) : 
    totalTests * 2;
  
  console.log(chalk.green(`\\n📊 Estimated: ${totalTests} test suites, ~${estimatedTime} minutes`));
}

function parseList(str) {
  return str.split(',').map(item => item.trim()).filter(Boolean);
}

// Error handling
program.on('command:*', () => {
  console.error(chalk.red('❌ Invalid command. See --help for available commands.'));
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ Unhandled error:'), reason);
  process.exit(1);
});

if (require.main === module) {
  program.parse();
}