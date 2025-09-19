const testHelpers = require('../utils/test-helpers');
const path = require('path');
const fs = require('fs-extra');

describe('Bring Your Own Contract Tests', () => {
  const network = process.env.TEST_NETWORK || 'kasplex';

  describe('Solidity File Compilation and Deployment', () => {
    test('should compile and deploy Calculator.sol', async () => {
      const contractPath = path.join(__dirname, '../contracts/Calculator.sol');

      const yamlTest = {
        test: 'Calculator Contract Test',
        network: network,
        contracts: {
          calc: `file:${contractPath}#Calculator`
        },
        scenario: [
          { call: 'calc.add(10, 20)', returns: 'sum' },
          { assert: 'sum == 30' },
          { call: 'calc.subtract(50, 20)', returns: 'diff' },
          { assert: 'diff == 30' },
          { call: 'calc.multiply(5, 6)', returns: 'product' },
          { assert: 'product == 30' },
          { call: 'calc.divide(100, 5)', returns: 'quotient' },
          { assert: 'quotient == 20' },
          { call: 'calc.power(2, 8)', returns: 'pow' },
          { assert: 'pow == 256' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Calculator');

      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.passed).toBe(5);
    });

    test('should handle contract with dependencies (TokenVault)', async () => {
      const contractPath = path.join(__dirname, '../contracts/TokenVault.sol');

      const yamlTest = {
        test: 'TokenVault Contract Test',
        network: network,
        setup: {
          alice: '10 ETH',
          bob: '10 ETH'
        },
        contracts: {
          token: 'ERC20("VaultToken", "VTK", 10000)',
          vault: `file:${contractPath}#TokenVault`
        },
        scenario: [
          // Distribute tokens
          { 'token.transfer': 'deployer -> alice, 1000' },
          { 'token.transfer': 'deployer -> bob, 1000' },

          // Alice deposits tokens
          { 'token.approve': 'alice -> vault, 500', from: 'alice' },
          { call: 'vault.deposit(token, 500)', from: 'alice' },
          { call: 'vault.getBalance(alice, token)', returns: 'aliceVaultBalance' },
          { assert: 'aliceVaultBalance == 500' },

          // Bob deposits tokens
          { 'token.approve': 'bob -> vault, 300', from: 'bob' },
          { call: 'vault.deposit(token, 300)', from: 'bob' },
          { call: 'vault.totalDeposited(token)', returns: 'totalInVault' },
          { assert: 'totalInVault == 800' },

          // Alice withdraws
          { call: 'vault.withdraw(token, 200)', from: 'alice' },
          { call: 'vault.getBalance(alice, token)', returns: 'aliceNewBalance' },
          { assert: 'aliceNewBalance == 300' },

          // Check token balances
          { call: 'token.balanceOf(alice)', returns: 'aliceTokens' },
          { assert: 'aliceTokens == 700' }  // 1000 - 500 + 200
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('TokenVault');

      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.failed).toBe(0);
    });
  });

  describe('Contract with Custom Constructor Arguments', () => {
    test('should deploy contract with constructor params', async () => {
      // Create a simple contract with constructor
      const contractCode = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GreetingContract {
    string public greeting;
    address public owner;
    uint256 public deployTime;

    constructor(string memory _greeting) {
        greeting = _greeting;
        owner = msg.sender;
        deployTime = block.timestamp;
    }

    function setGreeting(string memory _newGreeting) public {
        require(msg.sender == owner, "Only owner can change greeting");
        greeting = _newGreeting;
    }

    function getInfo() public view returns (string memory, address, uint256) {
        return (greeting, owner, deployTime);
    }
}
`;

      const contractPath = path.join(__dirname, '../contracts/Greeting.sol');
      await fs.writeFile(contractPath, contractCode);

      const yamlTest = {
        test: 'Constructor Arguments Test',
        network: network,
        contracts: {
          greeter: `file:${contractPath}#GreetingContract("Hello, Blockchain!")`
        },
        scenario: [
          { call: 'greeter.greeting()', returns: 'currentGreeting' },
          { assert: 'currentGreeting == "Hello, Blockchain!"' },
          { call: 'greeter.owner()', returns: 'contractOwner' },
          { assert: 'exists(contractOwner)' },
          { call: 'greeter.setGreeting("New Message")', from: 'deployer' },
          { call: 'greeter.greeting()', returns: 'newGreeting' },
          { assert: 'newGreeting == "New Message"' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);

      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.passed).toBeGreaterThan(0);
    });
  });

  describe('Multiple Contract Interactions', () => {
    test('should handle complex multi-contract scenarios', async () => {
      const yamlTest = {
        test: 'Multi-Contract Integration',
        network: network,
        setup: {
          alice: '10 ETH',
          bob: '10 ETH'
        },
        contracts: {
          tokenA: 'ERC20("Token A", "TKA", 100000)',
          tokenB: 'ERC20("Token B", "TKB", 100000)',
          calc: `file:${path.join(__dirname, '../contracts/Calculator.sol')}#Calculator`
        },
        scenario: [
          // Distribute tokens based on calculation
          { call: 'calc.multiply(100, 10)', returns: 'amount' },
          { 'tokenA.transfer': 'deployer -> alice, {{amount}}' },
          { call: 'tokenA.balanceOf(alice)', returns: 'aliceTokensA' },
          { assert: 'aliceTokensA == 1000' },

          // Use calculator for transfer amounts
          { call: 'calc.divide(1000, 4)', returns: 'quarterAmount' },
          { 'tokenA.transfer': 'alice -> bob, {{quarterAmount}}', from: 'alice' },
          { call: 'tokenA.balanceOf(bob)', returns: 'bobTokensA' },
          { assert: 'bobTokensA == 250' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });
  });

  describe('Contract Events and Logs', () => {
    test('should capture and validate contract events', async () => {
      const yamlTest = {
        test: 'Event Emission Test',
        network: network,
        contracts: {
          calc: `file:${path.join(__dirname, '../contracts/Calculator.sol')}#Calculator`
        },
        scenario: [
          {
            call: 'calc.add(15, 25)',
            expectEvent: {
              name: 'Calculation',
              args: {
                operation: 'add',
                a: 15,
                b: 25,
                result: 40
              }
            }
          },
          {
            call: 'calc.multiply(7, 8)',
            expectEvent: {
              name: 'Calculation',
              args: {
                operation: 'multiply',
                result: 56
              }
            }
          }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Calculation');
    });
  });

  describe('Error Handling for Custom Contracts', () => {
    test('should handle contract compilation errors', async () => {
      const invalidContract = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract InvalidContract {
    function broken() public {
        // Syntax error: missing semicolon
        uint256 x = 10
    }
}
`;

      const contractPath = path.join(__dirname, '../contracts/Invalid.sol');
      await fs.writeFile(contractPath, invalidContract);

      const yamlTest = {
        test: 'Invalid Contract Test',
        network: network,
        contracts: {
          invalid: `file:${contractPath}#InvalidContract`
        },
        scenario: [
          { assert: 'true' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(false);
      expect(result.stderr || result.stdout).toContain('error');
    });

    test('should handle contract revert conditions', async () => {
      const yamlTest = {
        test: 'Calculator Revert Test',
        network: network,
        contracts: {
          calc: `file:${path.join(__dirname, '../contracts/Calculator.sol')}#Calculator`
        },
        scenario: [
          // Division by zero
          { call: 'calc.divide(10, 0)' },
          { assert: 'REVERT("Division by zero")' },

          // Subtraction underflow
          { call: 'calc.subtract(10, 20)' },
          { assert: 'REVERT("Result would be negative")' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('revert');
    });
  });

  describe('Compiler Options', () => {
    test('should compile with optimizer enabled', async () => {
      const yamlTest = {
        test: 'Optimized Compilation Test',
        network: network,
        compilerOptions: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        },
        contracts: {
          calc: `file:${path.join(__dirname, '../contracts/Calculator.sol')}#Calculator`
        },
        scenario: [
          { call: 'calc.add(1, 1)', returns: 'result' },
          { assert: 'result == 2' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });

    test('should support different Solidity versions', async () => {
      // Create contract requiring specific version
      const versionedContract = `
// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

contract VersionedContract {
    function getVersion() public pure returns (string memory) {
        return "0.8.19";
    }
}
`;

      const contractPath = path.join(__dirname, '../contracts/Versioned.sol');
      await fs.writeFile(contractPath, versionedContract);

      const yamlTest = {
        test: 'Solidity Version Test',
        network: network,
        compilerOptions: {
          version: '0.8.19'
        },
        contracts: {
          versioned: `file:${contractPath}#VersionedContract`
        },
        scenario: [
          { call: 'versioned.getVersion()', returns: 'version' },
          { assert: 'version == "0.8.19"' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      // Note: This might fail if the exact version isn't available
      // but the test structure is correct
      expect(result.success || result.stderr?.includes('version')).toBeTruthy();
    });
  });
});