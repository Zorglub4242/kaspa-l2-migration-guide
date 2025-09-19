#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const yaml = require('js-yaml');

/**
 * Migration script to convert JavaScript DeFi tests to YAML format
 */

class DeFiTestMigrator {
  constructor() {
    this.sourcePath = path.join(__dirname, '..', 'scripts');
    this.outputPath = path.join(__dirname, '..', 'migrations', 'defi');
    this.mappings = {
      'complete-defi-suite.js': 'defi-complete.yaml',
      'deploy-defi-suite.js': 'defi-deploy.yaml',
      'enhanced-defi-comprehensive.js': 'defi-enhanced.yaml',
      'test-nft-only.js': 'nft-test.yaml',
      'operations-only-test.js': 'operations-test.yaml'
    };
  }

  /**
   * Run the migration
   */
  async migrate() {
    console.log(chalk.blue.bold('\n═══ DeFi Test Migration Tool ═══\n'));

    // Ensure output directory exists
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }

    for (const [jsFile, yamlFile] of Object.entries(this.mappings)) {
      try {
        console.log(chalk.cyan(`\nMigrating ${jsFile}...`));
        await this.migrateFile(jsFile, yamlFile);
        console.log(chalk.green(`  ✓ Migrated to ${yamlFile}`));
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to migrate ${jsFile}: ${error.message}`));
      }
    }

    // Generate migration summary
    this.generateSummary();
  }

  /**
   * Migrate a single test file
   * @param {string} jsFile - JavaScript file name
   * @param {string} yamlFile - Output YAML file name
   */
  async migrateFile(jsFile, yamlFile) {
    const sourcePath = path.join(this.sourcePath, jsFile);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    // Parse JavaScript test structure
    const testStructure = this.parseJavaScriptTest(sourcePath);

    // Convert to YAML structure
    const yamlStructure = this.convertToYAML(testStructure, jsFile);

    // Write YAML file
    const outputFile = path.join(this.outputPath, yamlFile);
    const yamlContent = yaml.dump(yamlStructure, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });

    fs.writeFileSync(outputFile, yamlContent, 'utf8');
  }

  /**
   * Parse JavaScript test file
   * @param {string} filePath - Path to JS file
   * @returns {Object} Parsed test structure
   */
  parseJavaScriptTest(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract test patterns (simplified)
    const structure = {
      name: this.extractTestName(content),
      description: this.extractDescription(content),
      contracts: this.extractContracts(content),
      accounts: this.extractAccounts(content),
      scenarios: this.extractScenarios(content)
    };

    return structure;
  }

  /**
   * Convert JavaScript structure to YAML format
   * @param {Object} structure - Parsed JS structure
   * @param {string} fileName - Original file name
   * @returns {Object} YAML structure
   */
  convertToYAML(structure, fileName) {
    const yamlTest = {
      test: structure.name || `Migrated from ${fileName}`,
      description: structure.description || 'Automatically migrated DeFi test',
      network: ['kasplex', 'igra', 'sepolia'],

      variables: {
        initial_supply: 1000000,
        initial_liquidity: 100000,
        loan_amount: 1000,
        collateral_ratio: 1.5
      },

      setup: {
        accounts: this.convertAccounts(structure.accounts),
        contracts: this.convertContracts(structure.contracts)
      },

      scenario: this.convertScenarios(structure.scenarios),

      cleanup: [
        { log: 'Test cleanup' },
        { call: { contract: 'lending', method: 'pause', from: 'deployer' } }
      ]
    };

    // Add migration metadata
    yamlTest._migration = {
      source: fileName,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    return yamlTest;
  }

  /**
   * Extract test name from content
   */
  extractTestName(content) {
    const match = content.match(/describe\(['"](.+?)['"]/);
    return match ? match[1] : 'DeFi Test Suite';
  }

  /**
   * Extract description
   */
  extractDescription(content) {
    const match = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\n/);
    return match ? match[1].trim() : null;
  }

  /**
   * Extract contract deployments
   */
  extractContracts(content) {
    const contracts = [];

    // Match contract deployments
    const deployPattern = /await\s+ethers\.getContractFactory\(['"](.+?)['"]\)/g;
    let match;

    while ((match = deployPattern.exec(content)) !== null) {
      contracts.push({
        name: match[1],
        type: match[1]
      });
    }

    return contracts;
  }

  /**
   * Extract account patterns
   */
  extractAccounts(content) {
    const accounts = [];

    // Match signer patterns
    if (content.includes('getSigners()')) {
      accounts.push(
        { name: 'deployer', balance: '100 ETH' },
        { name: 'alice', balance: '10 ETH' },
        { name: 'bob', balance: '10 ETH' },
        { name: 'charlie', balance: '10 ETH' }
      );
    }

    return accounts;
  }

  /**
   * Extract test scenarios
   */
  extractScenarios(content) {
    const scenarios = [];

    // Match it() blocks
    const testPattern = /it\(['"](.+?)['"],[\s\S]*?{([\s\S]*?)}\);/g;
    let match;

    while ((match = testPattern.exec(content)) !== null) {
      const testName = match[1];
      const testContent = match[2];

      scenarios.push(this.convertTestBlock(testName, testContent));
    }

    return scenarios;
  }

  /**
   * Convert scenarios to YAML format
   */
  convertScenarios(scenarios) {
    if (!scenarios || scenarios.length === 0) {
      // Return default DeFi test scenario
      return this.getDefaultDeFiScenario();
    }

    const yamlScenario = [];

    for (const scenario of scenarios) {
      if (Array.isArray(scenario)) {
        yamlScenario.push(...scenario);
      } else {
        yamlScenario.push(scenario);
      }
    }

    return yamlScenario.length > 0 ? yamlScenario : this.getDefaultDeFiScenario();
  }

  /**
   * Get default DeFi scenario
   */
  getDefaultDeFiScenario() {
    return [
      { log: '=== DeFi Test Suite ===' },

      // Token setup
      { log: 'Setting up tokens' },
      { 'token.transfer': 'deployer -> alice, 10000' },
      { 'token.transfer': 'deployer -> bob, 10000' },

      // DEX operations
      { log: 'Testing DEX operations' },
      { 'token.approve': 'alice -> dex, 5000', from: 'alice' },
      { 'dex.addLiquidity': '[token, 1000, 1000]', from: 'alice' },
      { 'dex.swap': '[token, 100]', from: 'bob' },

      // Lending operations
      { log: 'Testing lending protocol' },
      { 'token.approve': 'bob -> lending, 2000', from: 'bob' },
      { 'lending.deposit': '[token, 2000]', from: 'bob' },
      { 'lending.borrow': '[token, 500]', from: 'bob' },
      { 'lending.repay': '[token, 500]', from: 'bob' },

      // Yield farming
      { log: 'Testing yield farming' },
      { 'lpToken.approve': 'alice -> farm, 100', from: 'alice' },
      { 'farm.stake': '[100]', from: 'alice' },
      { wait: '10s' },
      { 'farm.getReward': '[]', from: 'alice' },

      // NFT operations
      { log: 'Testing NFT operations' },
      { 'nft.mint': '[alice, 1]', from: 'deployer' },
      { 'nft.transferFrom': '[alice, bob, 1]', from: 'alice' },

      // Assertions
      { assert: 'token.balanceOf(alice) > 0' },
      { assert: 'token.balanceOf(bob) > 0' },
      { assert: 'nft.ownerOf(1) == bob' }
    ];
  }

  /**
   * Convert accounts to YAML format
   */
  convertAccounts(accounts) {
    const yamlAccounts = {};

    for (const account of accounts) {
      yamlAccounts[account.name] = account.balance;
    }

    return yamlAccounts;
  }

  /**
   * Convert contracts to YAML format
   */
  convertContracts(contracts) {
    const yamlContracts = {};

    // Common DeFi contracts
    const contractMappings = {
      'ERC20Token': {
        type: 'ERC20',
        args: ['["Test Token", "TST", 1000000]']
      },
      'SimpleDEX': {
        type: 'UniswapV2Pair',
        args: '[]'
      },
      'LendingProtocol': {
        type: './contracts/SimpleLending.json',
        args: '[]'
      },
      'YieldFarm': {
        type: './contracts/YieldFarm.json',
        args: '[dai.address, 100]'
      },
      'NFTCollection': {
        type: 'ERC721',
        args: '["NFT Collection", "NFT"]'
      },
      'MultiSigWallet': {
        type: './contracts/MultiSigWallet.json',
        args: '[[deployer, alice, bob], 2]'
      }
    };

    for (const contract of contracts) {
      const mapping = contractMappings[contract.type] || {
        type: contract.type,
        args: '[]'
      };

      yamlContracts[contract.name.toLowerCase()] = {
        type: mapping.type,
        args: eval(mapping.args), // Convert string to actual array
        from: 'deployer'
      };
    }

    return yamlContracts;
  }

  /**
   * Convert test block to scenario actions
   */
  convertTestBlock(name, content) {
    const actions = [{ log: `Test: ${name}` }];

    // Pattern mappings
    const patterns = [
      {
        pattern: /await\s+(\w+)\.transfer\((\w+)\.address,\s*(.+?)\)/g,
        convert: (match) => ({
          call: {
            contract: match[1],
            method: 'transfer',
            args: [match[2], match[3]],
            from: 'deployer'
          }
        })
      },
      {
        pattern: /await\s+(\w+)\.approve\((\w+)\.address,\s*(.+?)\)/g,
        convert: (match) => ({
          call: {
            contract: match[1],
            method: 'approve',
            args: [match[2], match[3]],
            from: 'alice'
          }
        })
      },
      {
        pattern: /expect\((.+?)\)\.to\.equal\((.+?)\)/g,
        convert: (match) => ({
          check: `${match[1]} == ${match[2]}`
        })
      },
      {
        pattern: /await\s+(\w+)\.(\w+)\((.*?)\)/g,
        convert: (match) => ({
          call: {
            contract: match[1],
            method: match[2],
            args: match[3] ? match[3].split(',').map(a => a.trim()) : []
          }
        })
      }
    ];

    // Apply patterns
    for (const { pattern, convert } of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        actions.push(convert(match));
      }
    }

    return actions;
  }

  /**
   * Generate migration summary
   */
  generateSummary() {
    const summaryPath = path.join(this.outputPath, 'MIGRATION_SUMMARY.md');

    const summary = `# DeFi Test Migration Summary

Generated: ${new Date().toISOString()}

## Migrated Tests

${Object.entries(this.mappings).map(([js, yaml]) =>
  `- **${js}** → ${yaml}`
).join('\n')}

## Next Steps

1. Review the generated YAML files in the \`migrations/defi\` directory
2. Run the migrated tests using: \`npm run yaml:test migrations/defi/<test>.yaml\`
3. Compare results with original JavaScript tests
4. Once validated, remove the original JavaScript test files

## Manual Review Required

Some patterns may require manual adjustment:
- Complex async/await patterns
- Custom helper functions
- Dynamic test generation
- Environment-specific configurations

## Running Migrated Tests

\`\`\`bash
# Run single migrated test
node cli.js yaml migrations/defi/defi-complete.yaml

# Run all migrated tests
node cli.js yaml-discover migrations/defi
\`\`\`
`;

    fs.writeFileSync(summaryPath, summary, 'utf8');
    console.log(chalk.green(`\n✅ Migration summary saved to: ${summaryPath}`));
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new DeFiTestMigrator();
  migrator.migrate().catch(error => {
    console.error(chalk.red(`Migration failed: ${error.message}`));
    process.exit(1);
  });
}

module.exports = { DeFiTestMigrator };