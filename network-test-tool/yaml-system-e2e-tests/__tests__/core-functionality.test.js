const testHelpers = require('../utils/test-helpers');
const path = require('path');
const fs = require('fs-extra');

describe('Core YAML Functionality Tests', () => {
  const network = process.env.TEST_NETWORK || 'kasplex';

  describe('Basic Test Execution', () => {
    test('should execute a simple transfer test', async () => {
      const yamlTest = {
        test: 'Simple Transfer Test',
        network: network,
        setup: {
          alice: '10 ETH',
          bob: '0 ETH'
        },
        scenario: [
          { transfer: 'alice -> bob, 1 ETH' },
          { assert: 'balance(bob) >= 1 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Test completed successfully');

      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.passed).toBeGreaterThan(0);
      expect(parsed.failed).toBe(0);
    });

    test('should handle account creation with specific balances', async () => {
      const yamlTest = {
        test: 'Account Creation Test',
        network: network,
        setup: {
          alice: '5.5 ETH',
          bob: '2.25 ETH',
          charlie: '0.001 ETH'
        },
        scenario: [
          { assert: 'balance(alice) >= 5 ETH' },
          { assert: 'balance(bob) >= 2 ETH' },
          { assert: 'balance(charlie) >= 0.001 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.assertions.length).toBe(3);
    });
  });

  describe('Contract Deployment', () => {
    test('should deploy standard ERC20 contract', async () => {
      const yamlTest = {
        test: 'ERC20 Deployment Test',
        network: network,
        contracts: {
          token: 'ERC20("TestToken", "TEST", 1000000)'
        },
        scenario: [
          { call: 'token.name()', returns: 'tokenName' },
          { assert: 'tokenName == "TestToken"' },
          { call: 'token.totalSupply()', returns: 'supply' },
          { assert: 'supply == 1000000' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Contract deployed');
    });

    test('should deploy multiple contracts', async () => {
      const yamlTest = {
        test: 'Multi-Contract Deployment',
        network: network,
        contracts: {
          token1: 'ERC20("Token1", "TK1", 1000)',
          token2: 'ERC20("Token2", "TK2", 2000)',
          nft: 'ERC721("MyNFT", "NFT")'
        },
        scenario: [
          { assert: 'exists(contracts.token1)' },
          { assert: 'exists(contracts.token2)' },
          { assert: 'exists(contracts.nft)' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.passed).toBe(3);
    });
  });

  describe('Contract Interactions', () => {
    test('should execute contract function calls', async () => {
      const yamlTest = {
        test: 'Contract Interaction Test',
        network: network,
        setup: {
          alice: '10 ETH',
          bob: '10 ETH'
        },
        contracts: {
          token: 'ERC20("TestToken", "TEST", 1000000)'
        },
        scenario: [
          { 'token.transfer': 'deployer -> alice, 1000' },
          { call: 'token.balanceOf(alice)', returns: 'aliceBalance' },
          { assert: 'aliceBalance == 1000' },
          { 'token.transfer': 'alice -> bob, 500', from: 'alice' },
          { call: 'token.balanceOf(bob)', returns: 'bobBalance' },
          { assert: 'bobBalance == 500' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('transferred');
    });

    test('should handle contract approval and transferFrom', async () => {
      const yamlTest = {
        test: 'Approval Flow Test',
        network: network,
        setup: {
          alice: '10 ETH',
          bob: '10 ETH'
        },
        contracts: {
          token: 'ERC20("TestToken", "TEST", 10000)'
        },
        scenario: [
          { 'token.transfer': 'deployer -> alice, 1000' },
          { 'token.approve': 'alice -> bob, 500', from: 'alice' },
          { call: 'token.allowance(alice, bob)', returns: 'allowance' },
          { assert: 'allowance == 500' },
          { 'token.transferFrom': 'alice -> bob, 400', from: 'bob' },
          { call: 'token.balanceOf(bob)', returns: 'bobBalance' },
          { assert: 'bobBalance == 400' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });
  });

  describe('Assertions and Expressions', () => {
    test('should evaluate mathematical expressions', async () => {
      const yamlTest = {
        test: 'Math Expression Test',
        network: network,
        variables: {
          x: 10,
          y: 20,
          z: 5
        },
        scenario: [
          { assert: 'x + y == 30' },
          { assert: 'y - z == 15' },
          { assert: 'x * z == 50' },
          { assert: 'y / z == 4' },
          { assert: '(x + y) * z == 150' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.passed).toBe(5);
    });

    test('should handle comparison operators', async () => {
      const yamlTest = {
        test: 'Comparison Test',
        network: network,
        setup: {
          alice: '10 ETH',
          bob: '5 ETH'
        },
        scenario: [
          { assert: 'balance(alice) > balance(bob)' },
          { assert: 'balance(bob) < balance(alice)' },
          { assert: 'balance(alice) >= 10 ETH' },
          { assert: 'balance(bob) <= 10 ETH' },
          { assert: 'balance(alice) != balance(bob)' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.failed).toBe(0);
    });

    test('should handle REVERT assertions', async () => {
      const yamlTest = {
        test: 'Revert Test',
        network: network,
        setup: {
          alice: '1 ETH'
        },
        contracts: {
          token: 'ERC20("TestToken", "TEST", 1000)'
        },
        scenario: [
          { 'token.transfer': 'alice -> bob, 1000', from: 'alice' },
          { assert: 'REVERT("ERC20: transfer amount exceeds balance")' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('reverted');
    });
  });

  describe('Variables and Context', () => {
    test('should handle variable assignment and usage', async () => {
      const yamlTest = {
        test: 'Variable Test',
        network: network,
        variables: {
          amount: '1000',
          recipient: 'bob'
        },
        setup: {
          alice: '10 ETH',
          bob: '0 ETH'
        },
        contracts: {
          token: 'ERC20("TestToken", "TEST", 10000)'
        },
        scenario: [
          { set: { transferAmount: '{{amount}}' } },
          { 'token.transfer': 'deployer -> alice, {{transferAmount}}' },
          { call: 'token.balanceOf(alice)', returns: 'aliceTokens' },
          { assert: 'aliceTokens == {{amount}}' },
          { set: { halfAmount: '{{amount}} / 2' } },
          { 'token.transfer': 'alice -> {{recipient}}, {{halfAmount}}', from: 'alice' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });

    test('should handle built-in functions', async () => {
      const yamlTest = {
        test: 'Built-in Functions Test',
        network: network,
        scenario: [
          { set: { randomNum: 'random(1, 100)' } },
          { assert: '{{randomNum}} >= 1 && {{randomNum}} <= 100' },
          { set: { randomAddr: 'randomAddress()' } },
          { assert: 'exists({{randomAddr}})' },
          { set: { numbers: '[10, 20, 30, 40, 50]' } },
          { assert: 'avg({{numbers}}) == 30' },
          { assert: 'sum({{numbers}}) == 150' },
          { assert: 'min({{numbers}}) == 10' },
          { assert: 'max({{numbers}}) == 50' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.passed).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid YAML gracefully', async () => {
      const invalidYaml = `
test: Invalid Test
network: ${network}
scenario:
  - invalid_action: this should fail
`;
      const yamlFile = await testHelpers.createTempYaml(invalidYaml);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(false);
      expect(result.stderr || result.stdout).toContain('error');
    });

    test('should handle missing required fields', async () => {
      const yamlTest = {
        // Missing 'test' field
        network: network,
        scenario: [
          { assert: 'true' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(false);
    });

    test('should handle network errors gracefully', async () => {
      const yamlTest = {
        test: 'Network Error Test',
        network: 'invalid_network',
        scenario: [
          { assert: 'true' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile, { network: 'invalid_network' });

      expect(result.success).toBe(false);
      expect(result.stderr || result.stdout).toContain('network');
    });
  });
});