const testHelpers = require('../utils/test-helpers');
const path = require('path');
const fs = require('fs-extra');

describe('Keyword System Tests', () => {
  const network = process.env.TEST_NETWORK || 'kasplex';

  beforeAll(async () => {
    // Create test keyword library
    const keywordLibPath = path.join(__dirname, '../yaml-tests/test-keywords.yaml');
    const keywordLib = `
# Test keyword library
keywords:
  setup-test-tokens:
    description: "Setup test tokens with initial distribution"
    params: [tokenSupply, recipients]
    steps:
      - deploy: token = ERC20("TestToken", "TEST", {{tokenSupply}})
      - foreach:
          item: recipient
          in: "{{recipients}}"
        do:
          - token.transfer: "deployer -> {{recipient}}, 1000"
      - return: "{{token}}"

  check-balance-range:
    description: "Check if balance is within range"
    params: [account, min, max]
    steps:
      - get: "balance = balance({{account}})"
      - assert: "{{balance}} >= {{min}}"
      - assert: "{{balance}} <= {{max}}"
      - return: "{{balance}}"

  multi-transfer:
    description: "Transfer to multiple recipients"
    params: [from, recipients, amount]
    steps:
      - foreach:
          item: recipient
          in: "{{recipients}}"
        do:
          - transfer: "{{from}} -> {{recipient}}, {{amount}}"
      - log: "Transferred {{amount}} to {{recipients.length}} recipients"

  swap-tokens:
    description: "Simulate a token swap"
    params: [tokenA, tokenB, amountA, user]
    steps:
      - call: "{{tokenA}}.balanceOf({{user}})"
        returns: initialA
      - call: "{{tokenB}}.balanceOf({{user}})"
        returns: initialB
      - token.transfer: "{{user}} -> deployer, {{amountA}}"
        from: "{{user}}"
      - set:
          amountB: "{{amountA}} * 2"  # 1:2 exchange rate
      - token.transfer: "deployer -> {{user}}, {{amountB}}"
      - return:
          sent: "{{amountA}}"
          received: "{{amountB}}"
          rate: 2
`;
    await fs.ensureDir(path.dirname(keywordLibPath));
    await fs.writeFile(keywordLibPath, keywordLib);
  });

  describe('Basic Keyword Usage', () => {
    test('should execute a simple keyword', async () => {
      const yamlTest = {
        test: 'Simple Keyword Test',
        network: network,
        keywords: ['./yaml-tests/test-keywords.yaml'],
        setup: {
          alice: '10 ETH',
          bob: '10 ETH'
        },
        scenario: [
          {
            run: 'setup-test-tokens',
            params: [10000, ['alice', 'bob']],
            returns: 'token'
          },
          { call: 'token.balanceOf(alice)', returns: 'aliceBalance' },
          { assert: 'aliceBalance == 1000' },
          { call: 'token.balanceOf(bob)', returns: 'bobBalance' },
          { assert: 'bobBalance == 1000' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.passed).toBeGreaterThan(0);
    });

    test('should handle keyword with return values', async () => {
      const yamlTest = {
        test: 'Keyword Return Value Test',
        network: network,
        keywords: ['./yaml-tests/test-keywords.yaml'],
        setup: {
          alice: '5 ETH'
        },
        scenario: [
          {
            run: 'check-balance-range',
            params: ['alice', '4 ETH', '6 ETH'],
            returns: 'actualBalance'
          },
          { assert: 'exists(actualBalance)' },
          { log: 'Alice balance: {{actualBalance}}' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Alice balance');
    });
  });

  describe('Nested Keywords', () => {
    test('should execute keywords that call other keywords', async () => {
      // Create nested keyword library
      const nestedKeywordPath = path.join(__dirname, '../yaml-tests/nested-keywords.yaml');
      const nestedLib = `
keywords:
  outer-keyword:
    description: "Outer keyword that calls inner"
    params: [value]
    steps:
      - run: inner-keyword
        params: ["{{value}} * 2"]
        returns: doubled
      - return: "{{doubled}}"

  inner-keyword:
    description: "Inner keyword"
    params: [value]
    steps:
      - set:
          result: "{{value}} + 10"
      - return: "{{result}}"

  complex-nested:
    description: "Complex nested operations"
    params: [accounts, amount]
    steps:
      - foreach:
          item: account
          in: "{{accounts}}"
        do:
          - run: process-account
            params: ["{{account}}", "{{amount}}"]
      - return: "processed"

  process-account:
    description: "Process single account"
    params: [account, amount]
    steps:
      - log: "Processing {{account}} with {{amount}}"
      - if: "balance({{account}}) > 5 ETH"
        then:
          - log: "{{account}} is wealthy"
        else:
          - log: "{{account}} needs funds"
`;
      await fs.writeFile(nestedKeywordPath, nestedLib);

      const yamlTest = {
        test: 'Nested Keyword Test',
        network: network,
        keywords: ['./yaml-tests/nested-keywords.yaml'],
        variables: {
          initialValue: 5
        },
        scenario: [
          {
            run: 'outer-keyword',
            params: ['{{initialValue}}'],
            returns: 'result'
          },
          { assert: 'result == 20' }  // (5 * 2) + 10
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });
  });

  describe('Keyword Parameter Validation', () => {
    test('should handle missing parameters gracefully', async () => {
      const yamlTest = {
        test: 'Missing Parameter Test',
        network: network,
        keywords: ['./yaml-tests/test-keywords.yaml'],
        scenario: [
          {
            run: 'setup-test-tokens',
            params: [10000]  // Missing 'recipients' parameter
          }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(false);
      expect(result.stderr || result.stdout).toContain('parameter');
    });

    test('should handle extra parameters', async () => {
      const yamlTest = {
        test: 'Extra Parameter Test',
        network: network,
        keywords: ['./yaml-tests/test-keywords.yaml'],
        setup: {
          alice: '10 ETH'
        },
        scenario: [
          {
            run: 'check-balance-range',
            params: ['alice', '1 ETH', '20 ETH', 'extra', 'params'],
            returns: 'balance'
          }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      // Should either succeed (ignoring extra params) or fail gracefully
      expect(result.stdout || result.stderr).toBeDefined();
    });
  });

  describe('Keyword Libraries', () => {
    test('should import multiple keyword libraries', async () => {
      // Create second keyword library
      const secondLibPath = path.join(__dirname, '../yaml-tests/second-keywords.yaml');
      const secondLib = `
keywords:
  second-lib-keyword:
    description: "Keyword from second library"
    params: [message]
    steps:
      - log: "Second lib says: {{message}}"
      - return: "second-lib-executed"
`;
      await fs.writeFile(secondLibPath, secondLib);

      const yamlTest = {
        test: 'Multiple Library Test',
        network: network,
        keywords: [
          './yaml-tests/test-keywords.yaml',
          './yaml-tests/second-keywords.yaml'
        ],
        setup: {
          alice: '10 ETH',
          bob: '10 ETH'
        },
        scenario: [
          {
            run: 'setup-test-tokens',
            params: [5000, ['alice']],
            returns: 'token1'
          },
          {
            run: 'second-lib-keyword',
            params: ['Hello from test'],
            returns: 'secondResult'
          },
          { assert: 'secondResult == "second-lib-executed"' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Second lib says');
    });

    test('should handle keyword library conflicts', async () => {
      // Create conflicting keyword library
      const conflictLibPath = path.join(__dirname, '../yaml-tests/conflict-keywords.yaml');
      const conflictLib = `
keywords:
  check-balance-range:  # Same name as in test-keywords.yaml
    description: "Conflicting keyword"
    params: [account]
    steps:
      - log: "This is the conflicting version"
      - return: "conflict"
`;
      await fs.writeFile(conflictLibPath, conflictLib);

      const yamlTest = {
        test: 'Keyword Conflict Test',
        network: network,
        keywords: [
          './yaml-tests/test-keywords.yaml',
          './yaml-tests/conflict-keywords.yaml'  // Later import should override
        ],
        setup: {
          alice: '10 ETH'
        },
        scenario: [
          {
            run: 'check-balance-range',
            params: ['alice'],  // Using conflicting version (1 param)
            returns: 'result'
          },
          { assert: 'result == "conflict"' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      // Should use the later imported version
      expect(result.stdout).toContain('conflicting version');
    });
  });

  describe('Inline Keywords', () => {
    test('should define and use inline keywords', async () => {
      const yamlTest = {
        test: 'Inline Keyword Test',
        network: network,
        keywords: {
          'inline-setup': {
            description: 'Inline setup keyword',
            params: ['balance'],
            steps: [
              { alice: '{{balance}}' },
              { bob: '{{balance}}' },
              { log: 'Setup complete with {{balance}} each' }
            ]
          },
          'inline-check': {
            description: 'Inline check keyword',
            params: ['account', 'expected'],
            steps: [
              { get: 'actual = balance({{account}})' },
              { assert: '{{actual}} >= {{expected}}' },
              { return: '{{actual}}' }
            ]
          }
        },
        scenario: [
          {
            run: 'inline-setup',
            params: ['5 ETH']
          },
          {
            run: 'inline-check',
            params: ['alice', '5 ETH'],
            returns: 'aliceBalance'
          },
          {
            run: 'inline-check',
            params: ['bob', '5 ETH'],
            returns: 'bobBalance'
          },
          { assert: 'aliceBalance == bobBalance' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Setup complete');
    });
  });

  describe('Keywords with Complex Logic', () => {
    test('should handle keywords with conditionals and loops', async () => {
      const complexLibPath = path.join(__dirname, '../yaml-tests/complex-keywords.yaml');
      const complexLib = `
keywords:
  distribute-conditionally:
    description: "Distribute tokens based on conditions"
    params: [token, accounts, threshold]
    steps:
      - foreach:
          item: account
          in: "{{accounts}}"
        do:
          - get: "bal = balance({{account}})"
          - if: "{{bal}} > {{threshold}}"
            then:
              - token.transfer: "deployer -> {{account}}, 1000"
              - log: "{{account}} received 1000 tokens (balance > threshold)"
            else:
              - token.transfer: "deployer -> {{account}}, 500"
              - log: "{{account}} received 500 tokens (balance <= threshold)"

  recursive-sum:
    description: "Recursive-like sum calculation"
    params: [numbers]
    steps:
      - set:
          total: 0
      - foreach:
          item: num
          in: "{{numbers}}"
        do:
          - set:
              total: "{{total}} + {{num}}"
      - return: "{{total}}"
`;
      await fs.writeFile(complexLibPath, complexLib);

      const yamlTest = {
        test: 'Complex Keyword Logic Test',
        network: network,
        keywords: ['./yaml-tests/complex-keywords.yaml'],
        setup: {
          alice: '10 ETH',
          bob: '3 ETH',
          charlie: '7 ETH'
        },
        contracts: {
          token: 'ERC20("ComplexToken", "CPLX", 10000)'
        },
        scenario: [
          {
            run: 'distribute-conditionally',
            params: ['token', ['alice', 'bob', 'charlie'], '5 ETH']
          },
          { call: 'token.balanceOf(alice)', returns: 'aliceTokens' },
          { assert: 'aliceTokens == 1000' },  // alice > 5 ETH
          { call: 'token.balanceOf(bob)', returns: 'bobTokens' },
          { assert: 'bobTokens == 500' },  // bob <= 5 ETH
          { call: 'token.balanceOf(charlie)', returns: 'charlieTokens' },
          { assert: 'charlieTokens == 1000' }  // charlie > 5 ETH
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.passed).toBe(3);
    });
  });
});