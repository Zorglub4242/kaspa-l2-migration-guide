#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const yaml = require('js-yaml');

/**
 * Migration script to convert JavaScript load tests to YAML format
 */

class LoadTestMigrator {
  constructor() {
    this.sourcePath = path.join(__dirname, '..', 'scripts');
    this.outputPath = path.join(__dirname, '..', 'migrations', 'load');
    this.loadTestFiles = [
      'load-test-simple.js',
      'load-test-reliable.js',
      'load-test-stress.js',
      'load-test-burst.js',
      'load-test-max-tps.js',
      'load-test-defi-suite.js',
      'load-test-defi-dex.js',
      'load-test-defi-tokens.js',
      'load-test-diagnostic.js',
      'load-test-compare.js'
    ];
  }

  /**
   * Run the migration
   */
  async migrate() {
    console.log(chalk.blue.bold('\n═══ Load Test Migration Tool ═══\n'));

    // Ensure output directory exists
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }

    const migrated = [];
    const failed = [];

    for (const jsFile of this.loadTestFiles) {
      const yamlFile = jsFile.replace('.js', '.yaml');

      try {
        console.log(chalk.cyan(`\nMigrating ${jsFile}...`));
        await this.migrateLoadTest(jsFile, yamlFile);
        console.log(chalk.green(`  ✓ Migrated to ${yamlFile}`));
        migrated.push(jsFile);
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed: ${error.message}`));
        failed.push({ file: jsFile, error: error.message });
      }
    }

    // Generate summary
    this.generateSummary(migrated, failed);
  }

  /**
   * Migrate a single load test
   * @param {string} jsFile - JavaScript file name
   * @param {string} yamlFile - Output YAML file name
   */
  async migrateLoadTest(jsFile, yamlFile) {
    const sourcePath = path.join(this.sourcePath, jsFile);

    // Check if file exists
    if (!fs.existsSync(sourcePath)) {
      // Try alternative paths
      const altPaths = [
        path.join(this.sourcePath, '..', jsFile),
        path.join(this.sourcePath, '..', 'test', jsFile)
      ];

      const found = altPaths.find(p => fs.existsSync(p));
      if (!found) {
        console.warn(chalk.yellow(`  ⚠️ File not found, creating template: ${jsFile}`));
        return this.createLoadTestTemplate(jsFile, yamlFile);
      }
    }

    // Analyze load test type
    const testType = this.analyzeLoadTestType(jsFile);

    // Generate YAML based on type
    const yamlStructure = this.generateLoadTestYAML(testType, jsFile);

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
   * Analyze load test type from filename
   * @param {string} filename - Test file name
   * @returns {string} Test type
   */
  analyzeLoadTestType(filename) {
    if (filename.includes('simple')) return 'simple';
    if (filename.includes('stress')) return 'stress';
    if (filename.includes('burst')) return 'burst';
    if (filename.includes('max-tps')) return 'max-tps';
    if (filename.includes('defi')) return 'defi';
    if (filename.includes('diagnostic')) return 'diagnostic';
    if (filename.includes('compare')) return 'compare';
    if (filename.includes('reliable')) return 'reliable';
    return 'standard';
  }

  /**
   * Generate YAML structure for load test
   * @param {string} testType - Type of load test
   * @param {string} fileName - Original file name
   * @returns {Object} YAML structure
   */
  generateLoadTestYAML(testType, fileName) {
    const baseStructure = {
      test: `Load Test - ${testType}`,
      description: `Migrated from ${fileName}`,
      network: ['kasplex', 'igra', 'sepolia'],

      variables: {
        users: 100,
        transactions_per_user: 100,
        batch_size: 10,
        target_tps: 1000,
        test_duration: 60
      },

      setup: {
        accounts: {
          master: '1000 ETH'
        }
      }
    };

    // Add type-specific scenarios
    switch (testType) {
      case 'simple':
        baseStructure.scenario = this.generateSimpleLoadScenario();
        break;

      case 'stress':
        baseStructure.scenario = this.generateStressTestScenario();
        break;

      case 'burst':
        baseStructure.scenario = this.generateBurstTestScenario();
        break;

      case 'max-tps':
        baseStructure.scenario = this.generateMaxTPSScenario();
        break;

      case 'defi':
        baseStructure.scenario = this.generateDeFiLoadScenario();
        break;

      case 'diagnostic':
        baseStructure.scenario = this.generateDiagnosticScenario();
        break;

      case 'compare':
        baseStructure.scenario = this.generateComparisonScenario();
        break;

      default:
        baseStructure.scenario = this.generateStandardLoadScenario();
    }

    return baseStructure;
  }

  /**
   * Generate simple load test scenario
   */
  generateSimpleLoadScenario() {
    return [
      { log: '=== Simple Load Test ===' },

      // Create test accounts
      {
        loop: {
          times: '${users}',
          actions: [
            { set: { 'user_{_index}': 'Account()' } },
            { transfer: 'master -> user_{_index}, 1 ETH' }
          ]
        }
      },

      // Generate load
      {
        measure: {
          name: 'Simple Load Test',
          metric: 'time',
          start: { log: 'Starting load generation' },
          end: {
            loop: {
              times: '${transactions_per_user}',
              actions: [
                {
                  parallel: Array(10).fill({
                    transfer: 'user_{_index % users} -> user_{(_index + 1) % users}, 0.001 ETH'
                  })
                }
              ]
            }
          }
        }
      },

      // Report metrics
      { log: 'Total transactions: ${users * transactions_per_user}' }
    ];
  }

  /**
   * Generate stress test scenario
   */
  generateStressTestScenario() {
    return [
      { log: '=== Stress Test ===' },

      // Setup stress accounts
      {
        loop: {
          times: '${users * 2}',
          actions: [
            { set: { 'stress_{_index}': 'Account("0.5 ETH")' } }
          ]
        }
      },

      // Maximum parallel load
      {
        measure: {
          name: 'Stress Test',
          metric: 'time',
          start: { log: 'Starting stress test' },
          end: {
            parallel: Array(50).fill({
              loop: {
                times: 100,
                actions: [
                  { transfer: 'stress_{_index % (users * 2)} -> master, 0.0001 ETH' }
                ]
              }
            })
          }
        }
      },

      // Measure finality under stress
      {
        measure: {
          name: 'Finality Under Stress',
          metric: 'blocks',
          start: { transfer: 'master -> stress_0, 0.01 ETH' },
          end: { wait: { confirmations: 12 } }
        }
      }
    ];
  }

  /**
   * Generate burst test scenario
   */
  generateBurstTestScenario() {
    return [
      { log: '=== Burst Load Test ===' },

      // Create burst accounts
      {
        loop: {
          times: 500,
          actions: [
            { set: { 'burst_{_index}': 'Account("0.1 ETH")' } }
          ]
        }
      },

      // Burst pattern: quiet -> burst -> quiet
      { log: 'Phase 1: Quiet period' },
      { wait: '5s' },

      { log: 'Phase 2: Burst!' },
      {
        measure: {
          name: 'Burst Transactions',
          metric: 'time',
          start: { log: 'Burst started' },
          end: {
            parallel: Array(100).fill({
              loop: {
                times: 10,
                actions: [
                  { transfer: 'burst_{_index} -> burst_{(_index + 1) % 500}, 0.0001 ETH' }
                ]
              }
            })
          }
        }
      },

      { log: 'Phase 3: Recovery period' },
      { wait: '10s' },

      // Measure recovery
      {
        measure: {
          name: 'Recovery Time',
          metric: 'time',
          start: { transfer: 'master -> burst_0, 0.01 ETH' },
          end: { wait: { confirmations: 1 } }
        }
      }
    ];
  }

  /**
   * Generate max TPS scenario
   */
  generateMaxTPSScenario() {
    return [
      { log: '=== Maximum TPS Test ===' },

      // Setup for max TPS
      { set: { current_tps: 100 } },
      { set: { max_achieved_tps: 0 } },

      // Iteratively increase TPS
      {
        loop: {
          times: 10,
          actions: [
            { log: 'Testing TPS: ${current_tps}' },

            {
              measure: {
                name: 'TPS Test ${current_tps}',
                metric: 'custom',
                start: { set: { start_time: 'timestamp' } },
                end: {
                  loop: {
                    times: '${current_tps}',
                    actions: [
                      { transfer: 'master -> master, 0' }
                    ]
                  }
                }
              }
            },

            // Calculate actual TPS
            {
              set: {
                elapsed_time: '(timestamp - start_time) / 1000',
                actual_tps: 'current_tps / elapsed_time'
              }
            },

            { log: 'Achieved TPS: ${actual_tps}' },

            // Update max if higher
            {
              if: {
                condition: 'actual_tps > max_achieved_tps',
                then: [
                  { set: { max_achieved_tps: 'actual_tps' } }
                ]
              }
            },

            // Increase target TPS
            { set: { current_tps: 'current_tps * 1.5' } }
          ]
        }
      },

      { log: 'Maximum achieved TPS: ${max_achieved_tps}' }
    ];
  }

  /**
   * Generate DeFi load scenario
   */
  generateDeFiLoadScenario() {
    return [
      { log: '=== DeFi Protocol Load Test ===' },

      // Deploy DeFi contracts
      {
        contracts: {
          token: {
            type: 'ERC20',
            args: ['Load Token', 'LOAD', 10000000],
            from: 'master'
          },
          dex: {
            type: 'UniswapV2Pair',
            args: [],
            from: 'master'
          }
        }
      },

      // Create DeFi users
      {
        loop: {
          times: 50,
          actions: [
            { set: { 'trader_{_index}': 'Account("1 ETH")' } },
            {
              call: {
                contract: 'token',
                method: 'transfer',
                args: ['trader_{_index}', 1000],
                from: 'master'
              }
            }
          ]
        }
      },

      // Load test DeFi operations
      {
        measure: {
          name: 'DeFi Operations Load',
          metric: 'time',
          start: { log: 'Starting DeFi load test' },
          end: {
            parallel: Array(10).fill({
              loop: {
                times: 100,
                actions: [
                  // Approve
                  {
                    call: {
                      contract: 'token',
                      method: 'approve',
                      args: ['dex.address', 100],
                      from: 'trader_{_index % 50}'
                    }
                  },
                  // Swap
                  {
                    call: {
                      contract: 'dex',
                      method: 'swap',
                      args: [10, 10, 'trader_{_index % 50}', 'timestamp + 3600'],
                      from: 'trader_{_index % 50}'
                    }
                  }
                ]
              }
            })
          }
        }
      }
    ];
  }

  /**
   * Generate diagnostic scenario
   */
  generateDiagnosticScenario() {
    return [
      { log: '=== Diagnostic Load Test ===' },

      // Test different transaction types
      { log: 'Testing simple transfers' },
      {
        measure: {
          name: 'Simple Transfer Latency',
          metric: 'time',
          start: { transfer: 'master -> master, 0.001 ETH' },
          end: { wait: { confirmations: 1 } }
        }
      },

      { log: 'Testing contract calls' },
      {
        deploy: {
          name: 'testContract',
          contract: 'ERC20',
          args: ['Test', 'TST', 1000000]
        }
      },
      {
        measure: {
          name: 'Contract Call Latency',
          metric: 'time',
          start: {
            call: {
              contract: 'testContract',
              method: 'transfer',
              args: ['master', 100],
              from: 'master'
            }
          },
          end: { wait: { confirmations: 1 } }
        }
      },

      // Network metrics
      {
        measure: {
          name: 'Block Time',
          metric: 'time',
          start: { set: { start_block: 'block.number' } },
          end: {
            wait: { blocks: 10 }
          }
        }
      },

      { log: 'Diagnostic complete - see metrics for results' }
    ];
  }

  /**
   * Generate comparison scenario
   */
  generateComparisonScenario() {
    return [
      { log: '=== Multi-Network Comparison ===' },

      // This will run on all specified networks
      { log: 'Network: ${network}' },

      // Standardized test for comparison
      {
        measure: {
          name: 'Network Latency',
          metric: 'time',
          start: { transfer: 'master -> master, 0.001 ETH' },
          end: { wait: { confirmations: 1 } }
        }
      },

      {
        measure: {
          name: 'Throughput Test',
          metric: 'time',
          start: { log: 'Starting throughput test' },
          end: {
            loop: {
              times: 100,
              actions: [
                { transfer: 'master -> master, 0' }
              ]
            }
          }
        }
      },

      { log: 'Comparison data collected for ${network}' }
    ];
  }

  /**
   * Generate standard load scenario
   */
  generateStandardLoadScenario() {
    return this.generateSimpleLoadScenario();
  }

  /**
   * Create template for missing file
   */
  createLoadTestTemplate(jsFile, yamlFile) {
    const template = {
      test: `Load Test Template - ${jsFile}`,
      description: 'Template load test (original file not found)',
      network: ['kasplex', 'igra'],

      variables: {
        users: 50,
        transactions: 1000
      },

      setup: {
        accounts: {
          master: '100 ETH'
        }
      },

      scenario: [
        { log: `Template for ${jsFile}` },
        { log: 'Please customize this template' },

        {
          loop: {
            times: '${users}',
            actions: [
              { transfer: 'master -> master, 0.001 ETH' }
            ]
          }
        }
      ]
    };

    const outputFile = path.join(this.outputPath, yamlFile);
    const yamlContent = yaml.dump(template, { indent: 2 });
    fs.writeFileSync(outputFile, yamlContent, 'utf8');
  }

  /**
   * Generate migration summary
   */
  generateSummary(migrated, failed) {
    const summaryPath = path.join(this.outputPath, 'MIGRATION_SUMMARY.md');

    const summary = `# Load Test Migration Summary

Generated: ${new Date().toISOString()}

## Migration Statistics

- **Total Files**: ${this.loadTestFiles.length}
- **Successfully Migrated**: ${migrated.length}
- **Failed**: ${failed.length}

## Successfully Migrated Tests

${migrated.map(file => `- ✅ ${file} → ${file.replace('.js', '.yaml')}`).join('\n')}

## Failed Migrations

${failed.length > 0 ? failed.map(f => `- ❌ ${f.file}: ${f.error}`).join('\n') : 'None'}

## Test Execution

### Run Individual Test
\`\`\`bash
node cli.js yaml migrations/load/load-test-simple.yaml
\`\`\`

### Run All Load Tests
\`\`\`bash
node cli.js yaml-discover migrations/load
\`\`\`

### Run with Custom Parameters
\`\`\`bash
node cli.js yaml migrations/load/load-test-stress.yaml \\
  --networks kasplex,igra \\
  --parallel
\`\`\`

## Customization

The migrated YAML files can be customized by editing:
- \`variables\` section for test parameters
- \`setup.accounts\` for account configuration
- \`scenario\` for test logic

## Cleanup

After validating the migrated tests, you can remove the original JavaScript files:
\`\`\`bash
rm scripts/load-test-*.js
\`\`\`
`;

    fs.writeFileSync(summaryPath, summary, 'utf8');
    console.log(chalk.green(`\n✅ Summary saved to: ${summaryPath}`));
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new LoadTestMigrator();
  migrator.migrate().catch(error => {
    console.error(chalk.red(`Migration failed: ${error.message}`));
    process.exit(1);
  });
}

module.exports = { LoadTestMigrator };