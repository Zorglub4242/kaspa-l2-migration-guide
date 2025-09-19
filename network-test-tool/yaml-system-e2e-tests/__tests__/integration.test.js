const testHelpers = require('../utils/test-helpers');
const path = require('path');
const fs = require('fs-extra');

describe('Integration Tests', () => {
  const network = process.env.TEST_NETWORK || 'kasplex';

  describe('Complete E2E Workflow', () => {
    test('should execute a complete DeFi workflow', async () => {
      const yamlTest = {
        test: 'Complete DeFi Integration Test',
        network: network,
        report: 'detailed',

        // Define wallets
        wallets: {
          alice: 'generate',
          bob: 'generate',
          charlie: 'generate'
        },

        // Setup initial state
        setup: {
          funder: '100 ETH'
        },

        // Deploy contracts
        contracts: {
          tokenA: 'ERC20("Token A", "TKA", 1000000)',
          tokenB: 'ERC20("Token B", "TKB", 1000000)'
        },

        // Main scenario
        scenario: [
          // Fund wallets
          {
            parallel: [
              { transfer: 'funder -> {{wallets.alice.address}}, 10 ETH' },
              { transfer: 'funder -> {{wallets.bob.address}}, 10 ETH' },
              { transfer: 'funder -> {{wallets.charlie.address}}, 10 ETH' }
            ]
          },

          // Distribute tokens
          { 'tokenA.transfer': 'deployer -> {{wallets.alice.address}}, 10000' },
          { 'tokenA.transfer': 'deployer -> {{wallets.bob.address}}, 10000' },
          { 'tokenB.transfer': 'deployer -> {{wallets.charlie.address}}, 10000' },

          // Alice signs and sends transaction to Bob
          {
            wallet: {
              action: 'send',
              wallet: 'alice',
              to: 'bob',
              value: '1 ETH',
              wait: true
            },
            returns: 'txReceipt'
          },
          { assert: 'txReceipt.status == 1' },

          // Token transfers with approval
          { 'tokenA.approve': '{{wallets.alice.address}} -> {{wallets.bob.address}}, 5000',
            from: '{{wallets.alice.address}}' },
          { 'tokenA.transferFrom': '{{wallets.alice.address}} -> {{wallets.charlie.address}}, 3000',
            from: '{{wallets.bob.address}}' },

          // Check final balances
          {
            parallel: [
              { call: 'tokenA.balanceOf({{wallets.alice.address}})', returns: 'aliceTokenA' },
              { call: 'tokenA.balanceOf({{wallets.charlie.address}})', returns: 'charlieTokenA' },
              {
                wallet: {
                  action: 'balance',
                  wallet: 'bob'
                },
                returns: 'bobETH'
              }
            ]
          },

          { assert: 'aliceTokenA == 7000' },
          { assert: 'charlieTokenA == 3000' },
          { assert: 'bobETH > 10 ETH' },

          { log: 'DeFi workflow completed successfully' }
        ],

        cleanup: [
          { log: 'Test cleanup completed' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('DeFi workflow completed successfully');
    });

    test('should handle complex conditional workflows', async () => {
      // Create a keyword library for the test
      const keywordLibPath = path.join(__dirname, '../yaml-tests/integration-keywords.yaml');
      const keywordLib = `
keywords:
  check-and-fund:
    description: "Check balance and fund if needed"
    params: [account, threshold, amount]
    steps:
      - get: "balance = balance({{account}})"
      - if: "{{balance}} < {{threshold}}"
        then:
          - transfer: "funder -> {{account}}, {{amount}}"
          - log: "Funded {{account}} with {{amount}}"
          - return: true
        else:
          - log: "{{account}} has sufficient funds"
          - return: false

  batch-token-distribution:
    description: "Distribute tokens to multiple accounts"
    params: [token, accounts, amountEach]
    steps:
      - set:
          distributed: 0
      - parallel:
          forEach:
            item: account
            in: "{{accounts}}"
          do:
            - token.transfer: "deployer -> {{account}}, {{amountEach}}"
            - set:
                distributed: "{{distributed}} + {{amountEach}}"
      - return: "{{distributed}}"
`;
      await fs.ensureDir(path.dirname(keywordLibPath));
      await fs.writeFile(keywordLibPath, keywordLib);

      const yamlTest = {
        test: 'Complex Conditional Workflow Test',
        network: network,
        keywords: ['./yaml-tests/integration-keywords.yaml'],

        setup: {
          funder: '100 ETH',
          alice: '2 ETH',
          bob: '8 ETH',
          charlie: '4 ETH'
        },

        contracts: {
          token: 'ERC20("WorkflowToken", "WFT", 100000)'
        },

        scenario: [
          // Check and fund accounts conditionally
          {
            foreach: {
              item: 'account',
              in: ['alice', 'bob', 'charlie']
            },
            do: [
              {
                run: 'check-and-fund',
                params: ['{{account}}', '5 ETH', '3 ETH'],
                returns: 'wasFunded_{{account}}'
              }
            ]
          },

          // Verify funding results
          { assert: 'wasFunded_alice == true' },  // Was below 5 ETH
          { assert: 'wasFunded_bob == false' },   // Already above 5 ETH
          { assert: 'wasFunded_charlie == true' }, // Was below 5 ETH

          // Batch token distribution
          {
            run: 'batch-token-distribution',
            params: ['token', ['alice', 'bob', 'charlie'], 1000],
            returns: 'totalDistributed'
          },
          { assert: 'totalDistributed == 3000' },

          // Complex conditional logic
          { set: { successCount: 0 } },
          {
            try: [
              { 'token.transfer': 'alice -> bob, 500', from: 'alice' },
              { set: { successCount: '{{successCount}} + 1' } }
            ],
            catch: [
              { log: 'Transfer 1 failed' }
            ]
          },
          {
            try: [
              { 'token.transfer': 'bob -> charlie, 500', from: 'bob' },
              { set: { successCount: '{{successCount}} + 1' } }
            ],
            catch: [
              { log: 'Transfer 2 failed' }
            ]
          },
          {
            try: [
              { 'token.transfer': 'charlie -> alice, 500', from: 'charlie' },
              { set: { successCount: '{{successCount}} + 1' } }
            ],
            catch: [
              { log: 'Transfer 3 failed' }
            ]
          },

          { assert: 'successCount == 3' },
          { log: 'All {{successCount}} transfers succeeded' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('All 3 transfers succeeded');
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle batch operations efficiently', async () => {
      const yamlTest = {
        test: 'Batch Operations Performance Test',
        network: network,
        report: 'minimal',  // Reduce output for performance

        contracts: {
          token: 'ERC20("PerfToken", "PERF", 1000000)'
        },

        setup: {
          accounts: {}
        },

        scenario: [
          // Create multiple accounts
          {
            repeat: 5,
            do: [
              { set: { 'account_{{$$index}}': 'generate' } }
            ]
          },

          // Fund accounts in parallel
          {
            parallel: {
              maxConcurrency: 3,
              actions: []
            }
          },

          // Measure batch transfer performance
          {
            measure: {
              name: 'batchTransferTime',
              start: 'timestamp()'
            }
          },

          {
            repeat: 10,
            do: [
              { 'token.transfer': 'deployer -> account_0, 100' }
            ]
          },

          {
            measure: {
              name: 'batchTransferTime',
              end: 'timestamp()'
            }
          },

          { log: 'Batch transfer time: {{batchTransferTime}} ms' },
          { assert: 'batchTransferTime < 30000' }  // Should complete within 30 seconds
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile, { timeout: 60000 });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Batch transfer time');
    });

    test('should handle stress test scenarios', async () => {
      const yamlTest = {
        test: 'Stress Test Scenario',
        network: network,
        report: 'minimal',

        contracts: {
          token: 'ERC20("StressToken", "STR", 10000000)'
        },

        setup: {
          alice: '50 ETH',
          bob: '50 ETH',
          charlie: '50 ETH'
        },

        scenario: [
          // Rapid token transfers
          { set: { transferCount: 0 } },
          { set: { errorCount: 0 } },

          // Distribute initial tokens
          { 'token.transfer': 'deployer -> alice, 100000' },
          { 'token.transfer': 'deployer -> bob, 100000' },
          { 'token.transfer': 'deployer -> charlie, 100000' },

          // Stress test with rapid transfers
          {
            repeat: 5,
            do: [
              {
                parallel: [
                  {
                    try: [
                      { 'token.transfer': 'alice -> bob, 100', from: 'alice' },
                      { set: { transferCount: '{{transferCount}} + 1' } }
                    ],
                    catch: [
                      { set: { errorCount: '{{errorCount}} + 1' } }
                    ]
                  },
                  {
                    try: [
                      { 'token.transfer': 'bob -> charlie, 100', from: 'bob' },
                      { set: { transferCount: '{{transferCount}} + 1' } }
                    ],
                    catch: [
                      { set: { errorCount: '{{errorCount}} + 1' } }
                    ]
                  },
                  {
                    try: [
                      { 'token.transfer': 'charlie -> alice, 100', from: 'charlie' },
                      { set: { transferCount: '{{transferCount}} + 1' } }
                    ],
                    catch: [
                      { set: { errorCount: '{{errorCount}} + 1' } }
                    ]
                  }
                ]
              }
            ]
          },

          { log: 'Completed {{transferCount}} transfers with {{errorCount}} errors' },
          { assert: 'transferCount >= 10' },
          { assert: 'errorCount < 5' }  // Allow some errors under stress
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile, { timeout: 90000 });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Completed');
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from errors gracefully', async () => {
      const yamlTest = {
        test: 'Error Recovery Test',
        network: network,

        contracts: {
          token: 'ERC20("RecoveryToken", "REC", 1000)'
        },

        setup: {
          alice: '10 ETH',
          bob: '10 ETH'
        },

        scenario: [
          { set: { attempts: 0 } },
          { set: { success: false } },

          // Try operation with retry logic
          {
            while: '{{attempts}} < 3 && !{{success}}',
            do: [
              { set: { attempts: '{{attempts}} + 1' } },
              { log: 'Attempt {{attempts}}' },
              {
                try: [
                  // This will fail on first attempt (no tokens)
                  {
                    if: '{{attempts}} == 1',
                    then: [
                      { 'token.transfer': 'alice -> bob, 100', from: 'alice' }
                    ],
                    else: [
                      // Give alice tokens on second attempt
                      { 'token.transfer': 'deployer -> alice, 100' },
                      { 'token.transfer': 'alice -> bob, 100', from: 'alice' }
                    ]
                  },
                  { set: { success: true } },
                  { log: 'Operation succeeded on attempt {{attempts}}' }
                ],
                catch: [
                  { log: 'Attempt {{attempts}} failed: {{$$error.message}}' },
                  {
                    if: '{{attempts}} < 3',
                    then: [
                      { wait: 1000 },  // Wait before retry
                      { log: 'Retrying...' }
                    ]
                  }
                ]
              }
            ]
          },

          { assert: 'success == true' },
          { assert: 'attempts == 2' },  // Should succeed on second attempt

          // Verify final state
          { call: 'token.balanceOf(bob)', returns: 'bobBalance' },
          { assert: 'bobBalance == 100' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Operation succeeded on attempt 2');
    });
  });

  describe('Multi-Network Testing', () => {
    test('should validate network-specific behavior', async () => {
      const yamlTest = {
        test: 'Network-Specific Test',
        network: network,

        scenario: [
          // Get network info
          { get: 'chainId = network.chainId' },
          { get: 'networkName = network.name' },
          { log: 'Testing on {{networkName}} (Chain ID: {{chainId}})' },

          // Network-specific assertions
          {
            if: 'chainId == 167012',
            then: [
              { log: 'Running Kasplex-specific tests' },
              { assert: 'networkName == "kasplex"' }
            ]
          },
          {
            if: 'chainId == 19416',
            then: [
              { log: 'Running IGRA-specific tests' },
              { assert: 'networkName == "igra"' }
            ]
          },

          // Common tests
          { set: { testAccount: 'generate' } },
          { assert: 'exists(testAccount)' },
          { log: 'Network validation completed' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Network validation completed');
    });
  });

  describe('Test Result Validation', () => {
    test('should generate and validate test reports', async () => {
      const yamlTest = {
        test: 'Report Generation Test',
        network: network,
        report: 'detailed',

        metrics: {
          gasUsed: 0,
          transactionCount: 0,
          testStartTime: 'timestamp()'
        },

        contracts: {
          token: 'ERC20("ReportToken", "RPT", 1000)'
        },

        scenario: [
          // Track metrics
          { 'token.transfer': 'deployer -> alice, 100' },
          { set: { 'metrics.transactionCount': '{{metrics.transactionCount}} + 1' } },

          { 'token.transfer': 'deployer -> bob, 100' },
          { set: { 'metrics.transactionCount': '{{metrics.transactionCount}} + 1' } },

          // Calculate test duration
          { set: { 'metrics.testEndTime': 'timestamp()' } },
          { set: { 'metrics.duration': '{{metrics.testEndTime}} - {{metrics.testStartTime}}' } },

          // Generate summary
          { log: '=== Test Report ===' },
          { log: 'Network: {{network.name}}' },
          { log: 'Transactions: {{metrics.transactionCount}}' },
          { log: 'Duration: {{metrics.duration}} ms' },
          { log: '==================' }
        ],

        returns: {
          success: true,
          metrics: '{{metrics}}',
          network: '{{network.name}}',
          timestamp: 'timestamp()'
        }
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('=== Test Report ===');
      expect(result.stdout).toContain('Transactions: 2');

      // Verify returned data if available
      if (result.data) {
        expect(result.data.success).toBe(true);
        expect(result.data.metrics).toBeDefined();
      }
    });
  });
});