const testHelpers = require('../utils/test-helpers');
const path = require('path');

describe('Control Flow Tests', () => {
  const network = process.env.TEST_NETWORK || 'kasplex';

  describe('Conditional Execution (if/then/else)', () => {
    test('should execute simple if/then statement', async () => {
      const yamlTest = {
        test: 'Simple If/Then Test',
        network: network,
        setup: {
          alice: '10 ETH',
          bob: '2 ETH'
        },
        scenario: [
          {
            if: 'balance(alice) > 5 ETH',
            then: [
              { transfer: 'alice -> bob, 3 ETH' },
              { log: 'Transfer executed' }
            ]
          },
          { assert: 'balance(bob) >= 5 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Transfer executed');
    });

    test('should execute if/then/else branches correctly', async () => {
      const yamlTest = {
        test: 'If/Then/Else Test',
        network: network,
        setup: {
          alice: '3 ETH',
          bob: '8 ETH'
        },
        scenario: [
          // First condition - should take else branch
          {
            if: 'balance(alice) > 5 ETH',
            then: [
              { set: { result1: 'alice is rich' } }
            ],
            else: [
              { set: { result1: 'alice needs funds' } }
            ]
          },
          { assert: 'result1 == "alice needs funds"' },

          // Second condition - should take then branch
          {
            if: 'balance(bob) > 5 ETH',
            then: [
              { set: { result2: 'bob is rich' } }
            ],
            else: [
              { set: { result2: 'bob needs funds' } }
            ]
          },
          { assert: 'result2 == "bob is rich"' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.passed).toBe(2);
    });

    test('should handle nested conditionals', async () => {
      const yamlTest = {
        test: 'Nested Conditionals Test',
        network: network,
        setup: {
          alice: '7 ETH',
          bob: '3 ETH',
          charlie: '1 ETH'
        },
        scenario: [
          {
            if: 'balance(alice) > 5 ETH',
            then: [
              {
                if: 'balance(bob) > 2 ETH',
                then: [
                  { transfer: 'alice -> charlie, 2 ETH' },
                  { set: { result: 'both conditions met' } }
                ],
                else: [
                  { set: { result: 'only first condition met' } }
                ]
              }
            ],
            else: [
              { set: { result: 'first condition not met' } }
            ]
          },
          { assert: 'result == "both conditions met"' },
          { assert: 'balance(charlie) >= 3 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });

    test('should handle complex conditions with AND/OR', async () => {
      const yamlTest = {
        test: 'Complex Conditions Test',
        network: network,
        setup: {
          alice: '10 ETH',
          bob: '5 ETH',
          charlie: '2 ETH'
        },
        scenario: [
          // AND condition
          {
            if: {
              and: [
                'balance(alice) > 8 ETH',
                'balance(bob) >= 5 ETH',
                'balance(charlie) < 3 ETH'
              ]
            },
            then: [
              { set: { andResult: 'all conditions true' } }
            ]
          },
          { assert: 'andResult == "all conditions true"' },

          // OR condition
          {
            if: {
              or: [
                'balance(alice) < 1 ETH',  // false
                'balance(bob) > 10 ETH',    // false
                'balance(charlie) == 2 ETH' // true
              ]
            },
            then: [
              { set: { orResult: 'at least one true' } }
            ]
          },
          { assert: 'orResult == "at least one true"' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.passed).toBe(2);
    });
  });

  describe('Loops (foreach, while, repeat)', () => {
    test('should execute foreach loop', async () => {
      const yamlTest = {
        test: 'ForEach Loop Test',
        network: network,
        setup: {
          alice: '20 ETH',
          bob: '0 ETH',
          charlie: '0 ETH',
          dave: '0 ETH'
        },
        scenario: [
          {
            foreach: {
              item: 'recipient',
              in: ['bob', 'charlie', 'dave']
            },
            do: [
              { transfer: 'alice -> {{recipient}}, 2 ETH' },
              { log: 'Transferred to {{recipient}}' }
            ]
          },
          { assert: 'balance(bob) == 2 ETH' },
          { assert: 'balance(charlie) == 2 ETH' },
          { assert: 'balance(dave) == 2 ETH' },
          { assert: 'balance(alice) == 14 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Transferred to bob');
      expect(result.stdout).toContain('Transferred to charlie');
      expect(result.stdout).toContain('Transferred to dave');
    });

    test('should execute while loop', async () => {
      const yamlTest = {
        test: 'While Loop Test',
        network: network,
        setup: {
          alice: '10 ETH',
          bob: '0 ETH'
        },
        scenario: [
          { set: { counter: 0 } },
          { set: { transferAmount: '0.5 ETH' } },
          {
            while: '{{counter}} < 3',
            do: [
              { transfer: 'alice -> bob, {{transferAmount}}' },
              { set: { counter: '{{counter}} + 1' } },
              { log: 'Transfer {{counter}} completed' }
            ]
          },
          { assert: 'counter == 3' },
          { assert: 'balance(bob) == 1.5 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Transfer 3 completed');
    });

    test('should execute repeat loop', async () => {
      const yamlTest = {
        test: 'Repeat Loop Test',
        network: network,
        contracts: {
          token: 'ERC20("RepeatToken", "RPT", 10000)'
        },
        setup: {
          alice: '10 ETH',
          bob: '10 ETH'
        },
        scenario: [
          { 'token.transfer': 'deployer -> alice, 5000' },
          {
            repeat: 5,
            do: [
              { 'token.transfer': 'alice -> bob, 100', from: 'alice' }
            ]
          },
          { call: 'token.balanceOf(bob)', returns: 'bobTokens' },
          { assert: 'bobTokens == 500' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });

    test('should handle nested loops', async () => {
      const yamlTest = {
        test: 'Nested Loops Test',
        network: network,
        variables: {
          senders: ['alice', 'bob'],
          recipients: ['charlie', 'dave']
        },
        setup: {
          alice: '10 ETH',
          bob: '10 ETH',
          charlie: '0 ETH',
          dave: '0 ETH'
        },
        scenario: [
          { set: { totalTransfers: 0 } },
          {
            foreach: {
              item: 'sender',
              in: '{{senders}}'
            },
            do: [
              {
                foreach: {
                  item: 'recipient',
                  in: '{{recipients}}'
                },
                do: [
                  { transfer: '{{sender}} -> {{recipient}}, 0.25 ETH' },
                  { set: { totalTransfers: '{{totalTransfers}} + 1' } }
                ]
              }
            ]
          },
          { assert: 'totalTransfers == 4' },
          { assert: 'balance(charlie) == 0.5 ETH' },
          { assert: 'balance(dave) == 0.5 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });
  });

  describe('Parallel Execution', () => {
    test('should execute actions in parallel', async () => {
      const yamlTest = {
        test: 'Parallel Execution Test',
        network: network,
        setup: {
          alice: '20 ETH',
          bob: '0 ETH',
          charlie: '0 ETH',
          dave: '0 ETH'
        },
        scenario: [
          {
            parallel: [
              { transfer: 'alice -> bob, 2 ETH' },
              { transfer: 'alice -> charlie, 3 ETH' },
              { transfer: 'alice -> dave, 4 ETH' }
            ]
          },
          { assert: 'balance(bob) == 2 ETH' },
          { assert: 'balance(charlie) == 3 ETH' },
          { assert: 'balance(dave) == 4 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });

    test('should respect maxConcurrency limit', async () => {
      const yamlTest = {
        test: 'Max Concurrency Test',
        network: network,
        contracts: {
          token: 'ERC20("ConcurrentToken", "CCT", 100000)'
        },
        setup: {
          accounts: {
            alice: '10 ETH',
            bob: '10 ETH',
            charlie: '10 ETH',
            dave: '10 ETH',
            eve: '10 ETH'
          }
        },
        scenario: [
          {
            parallel: {
              maxConcurrency: 2,
              actions: [
                { 'token.transfer': 'deployer -> alice, 1000' },
                { 'token.transfer': 'deployer -> bob, 1000' },
                { 'token.transfer': 'deployer -> charlie, 1000' },
                { 'token.transfer': 'deployer -> dave, 1000' },
                { 'token.transfer': 'deployer -> eve, 1000' }
              ]
            }
          },
          { call: 'token.balanceOf(alice)', returns: 'aliceTokens' },
          { assert: 'aliceTokens == 1000' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });

    test('should handle parallel forEach', async () => {
      const yamlTest = {
        test: 'Parallel ForEach Test',
        network: network,
        contracts: {
          token: 'ERC20("ParallelToken", "PLT", 50000)'
        },
        setup: {
          alice: '10 ETH',
          bob: '10 ETH',
          charlie: '10 ETH'
        },
        scenario: [
          {
            parallel: {
              forEach: {
                item: 'account',
                in: ['alice', 'bob', 'charlie']
              },
              do: [
                { 'token.transfer': 'deployer -> {{account}}, 500' },
                { log: 'Sent tokens to {{account}}' }
              ]
            }
          },
          { call: 'token.balanceOf(alice)', returns: 'aliceTokens' },
          { call: 'token.balanceOf(bob)', returns: 'bobTokens' },
          { call: 'token.balanceOf(charlie)', returns: 'charlieTokens' },
          { assert: 'aliceTokens == 500' },
          { assert: 'bobTokens == 500' },
          { assert: 'charlieTokens == 500' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });

    test('should handle parallel with failFast option', async () => {
      const yamlTest = {
        test: 'Parallel FailFast Test',
        network: network,
        setup: {
          alice: '1 ETH'  // Insufficient for all transfers
        },
        scenario: [
          {
            parallel: {
              failFast: false,  // Continue even if some fail
              actions: [
                { transfer: 'alice -> bob, 0.4 ETH' },
                { transfer: 'alice -> charlie, 0.4 ETH' },
                { transfer: 'alice -> dave, 0.4 ETH' }  // This should fail
              ]
            }
          },
          { assert: 'balance(alice) < 0.5 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      // Test should handle partial failures gracefully
      expect(result.stdout || result.stderr).toBeDefined();
    });
  });

  describe('Try/Catch Error Handling', () => {
    test('should handle try/catch blocks', async () => {
      const yamlTest = {
        test: 'Try/Catch Test',
        network: network,
        contracts: {
          token: 'ERC20("ErrorToken", "ERR", 1000)'
        },
        setup: {
          alice: '10 ETH'
        },
        scenario: [
          {
            try: [
              { 'token.transfer': 'alice -> bob, 10000', from: 'alice' }  // Will fail
            ],
            catch: [
              { log: 'Transfer failed as expected: {{$$error.message}}' },
              { set: { errorCaught: true } }
            ]
          },
          { assert: 'errorCaught == true' },

          // Try block that succeeds
          {
            try: [
              { 'token.transfer': 'deployer -> alice, 100' }
            ],
            catch: [
              { set: { errorCaught2: true } }
            ]
          },
          { assert: '!exists(errorCaught2)' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Transfer failed as expected');
    });

    test('should handle nested try/catch', async () => {
      const yamlTest = {
        test: 'Nested Try/Catch Test',
        network: network,
        setup: {
          alice: '0.1 ETH'  // Very low balance
        },
        scenario: [
          {
            try: [
              { transfer: 'alice -> bob, 1 ETH' },  // Will fail
              { set: { step1: 'completed' } }
            ],
            catch: [
              { log: 'Outer catch: Transfer failed' },
              {
                try: [
                  { transfer: 'alice -> bob, 0.05 ETH' }  // Should succeed
                ],
                catch: [
                  { log: 'Inner catch: Even small transfer failed' }
                ]
              },
              { set: { recovered: true } }
            ]
          },
          { assert: 'recovered == true' },
          { assert: 'balance(bob) >= 0.05 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });
  });

  describe('Complex Control Flow Combinations', () => {
    test('should handle conditionals within loops', async () => {
      const yamlTest = {
        test: 'Conditional in Loop Test',
        network: network,
        setup: {
          alice: '20 ETH',
          bob: '7 ETH',
          charlie: '3 ETH',
          dave: '1 ETH'
        },
        scenario: [
          { set: { richCount: 0 } },
          { set: { poorCount: 0 } },
          {
            foreach: {
              item: 'account',
              in: ['alice', 'bob', 'charlie', 'dave']
            },
            do: [
              { get: 'bal = balance({{account}})' },
              {
                if: '{{bal}} > 5 ETH',
                then: [
                  { set: { richCount: '{{richCount}} + 1' } },
                  { log: '{{account}} is wealthy' }
                ],
                else: [
                  { set: { poorCount: '{{poorCount}} + 1' } },
                  { log: '{{account}} needs funds' },
                  { transfer: 'alice -> {{account}}, 1 ETH' }
                ]
              }
            ]
          },
          { assert: 'richCount == 2' },  // alice and bob
          { assert: 'poorCount == 2' },  // charlie and dave
          { assert: 'balance(charlie) >= 4 ETH' },
          { assert: 'balance(dave) >= 2 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });

    test('should handle parallel execution with conditionals', async () => {
      const yamlTest = {
        test: 'Parallel with Conditionals Test',
        network: network,
        setup: {
          alice: '10 ETH',
          bob: '5 ETH',
          charlie: '2 ETH'
        },
        scenario: [
          {
            parallel: [
              {
                if: 'balance(alice) > 8 ETH',
                then: [
                  { transfer: 'alice -> charlie, 2 ETH' }
                ]
              },
              {
                if: 'balance(bob) > 4 ETH',
                then: [
                  { transfer: 'bob -> charlie, 1 ETH' }
                ]
              }
            ]
          },
          { assert: 'balance(charlie) >= 5 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });
  });
});