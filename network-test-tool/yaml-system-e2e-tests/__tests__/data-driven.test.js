const testHelpers = require('../utils/test-helpers');
const path = require('path');
const fs = require('fs-extra');

describe('Data-Driven Testing Tests', () => {
  const network = process.env.TEST_NETWORK || 'kasplex';

  beforeAll(async () => {
    // Create test data files
    const dataDir = path.join(__dirname, '../test-data');
    await fs.ensureDir(dataDir);

    // Create CSV test data
    const csvData = `account,amount,recipient
alice,100,bob
bob,200,charlie
charlie,300,alice
dave,150,eve
eve,250,dave`;
    await fs.writeFile(path.join(dataDir, 'transfers.csv'), csvData);

    // Create JSON test data
    const jsonData = {
      testCases: [
        { name: 'test1', value: 100, expected: 200 },
        { name: 'test2', value: 200, expected: 400 },
        { name: 'test3', value: 300, expected: 600 }
      ],
      accounts: [
        { address: 'alice', balance: '10 ETH' },
        { address: 'bob', balance: '5 ETH' },
        { address: 'charlie', balance: '3 ETH' }
      ]
    };
    await fs.writeJson(path.join(dataDir, 'test-data.json'), jsonData);

    // Create JSON Lines data
    const jsonlData = [
      { operation: 'add', a: 10, b: 20, expected: 30 },
      { operation: 'multiply', a: 5, b: 6, expected: 30 },
      { operation: 'subtract', a: 50, b: 20, expected: 30 }
    ].map(obj => JSON.stringify(obj)).join('\n');
    await fs.writeFile(path.join(dataDir, 'operations.jsonl'), jsonlData);
  });

  describe('CSV Data Source', () => {
    test('should load and iterate CSV data', async () => {
      const yamlTest = {
        test: 'CSV Data Test',
        network: network,
        data: {
          transfers: {
            source: 'csv',
            path: './test-data/transfers.csv'
          }
        },
        contracts: {
          token: 'ERC20("DataToken", "DTK", 10000)'
        },
        setup: {
          alice: '10 ETH',
          bob: '10 ETH',
          charlie: '10 ETH',
          dave: '10 ETH',
          eve: '10 ETH'
        },
        scenario: [
          // Distribute initial tokens
          { 'token.transfer': 'deployer -> alice, 1000' },
          { 'token.transfer': 'deployer -> bob, 1000' },
          { 'token.transfer': 'deployer -> charlie, 1000' },
          { 'token.transfer': 'deployer -> dave, 1000' },
          { 'token.transfer': 'deployer -> eve, 1000' },

          // Process transfers from CSV
          {
            foreach: {
              item: 'transfer',
              in: '{{data.transfers}}'
            },
            do: [
              { log: 'Processing transfer: {{transfer.account}} -> {{transfer.recipient}}, {{transfer.amount}}' },
              { 'token.transfer': '{{transfer.account}} -> {{transfer.recipient}}, {{transfer.amount}}',
                from: '{{transfer.account}}' }
            ]
          },

          // Verify final balances
          { call: 'token.balanceOf(alice)', returns: 'aliceBalance' },
          { call: 'token.balanceOf(bob)', returns: 'bobBalance' },
          { assert: 'aliceBalance > 0' },
          { assert: 'bobBalance > 0' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Processing transfer');
    });

    test('should filter CSV data', async () => {
      const yamlTest = {
        test: 'CSV Filter Test',
        network: network,
        data: {
          largeTransfers: {
            source: 'csv',
            path: './test-data/transfers.csv',
            filter: 'amount > 150'
          }
        },
        scenario: [
          { set: { count: 0 } },
          {
            foreach: {
              item: 'transfer',
              in: '{{data.largeTransfers}}'
            },
            do: [
              { log: 'Large transfer: {{transfer.amount}}' },
              { set: { count: '{{count}} + 1' } }
            ]
          },
          { assert: 'count == 3' }  // 200, 300, 250
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Large transfer');
    });
  });

  describe('JSON Data Source', () => {
    test('should load and use JSON data', async () => {
      const yamlTest = {
        test: 'JSON Data Test',
        network: network,
        data: {
          testData: {
            source: 'json',
            path: './test-data/test-data.json'
          }
        },
        contracts: {
          calc: `file:${path.join(__dirname, '../contracts/Calculator.sol')}#Calculator`
        },
        scenario: [
          // Process test cases
          {
            foreach: {
              item: 'testCase',
              in: '{{data.testData.testCases}}'
            },
            do: [
              { call: 'calc.multiply({{testCase.value}}, 2)', returns: 'result' },
              { assert: 'result == {{testCase.expected}}' },
              { log: '{{testCase.name}} passed: {{testCase.value}} * 2 = {{result}}' }
            ]
          },

          // Setup accounts from JSON
          {
            foreach: {
              item: 'account',
              in: '{{data.testData.accounts}}'
            },
            do: [
              { '{{account.address}}': '{{account.balance}}' }
            ]
          }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test1 passed');
      expect(result.stdout).toContain('test2 passed');
      expect(result.stdout).toContain('test3 passed');
    });

    test('should handle JSON Lines format', async () => {
      const yamlTest = {
        test: 'JSONL Data Test',
        network: network,
        data: {
          operations: {
            source: 'jsonl',
            path: './test-data/operations.jsonl'
          }
        },
        contracts: {
          calc: `file:${path.join(__dirname, '../contracts/Calculator.sol')}#Calculator`
        },
        scenario: [
          {
            foreach: {
              item: 'op',
              in: '{{data.operations}}'
            },
            do: [
              {
                if: 'op.operation == "add"',
                then: [
                  { call: 'calc.add({{op.a}}, {{op.b}})', returns: 'result' }
                ]
              },
              {
                if: 'op.operation == "multiply"',
                then: [
                  { call: 'calc.multiply({{op.a}}, {{op.b}})', returns: 'result' }
                ]
              },
              {
                if: 'op.operation == "subtract"',
                then: [
                  { call: 'calc.subtract({{op.a}}, {{op.b}})', returns: 'result' }
                ]
              },
              { assert: 'result == {{op.expected}}' },
              { log: '{{op.operation}}: {{op.a}}, {{op.b}} = {{result}}' }
            ]
          }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('add:');
      expect(result.stdout).toContain('multiply:');
      expect(result.stdout).toContain('subtract:');
    });
  });

  describe('Database Data Source', () => {
    test('should query database for test data', async () => {
      // Create a test SQLite database
      const dbPath = path.join(__dirname, '../test-data/test.db');
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);

      // Create and populate test table
      db.exec(`
        CREATE TABLE IF NOT EXISTS test_accounts (
          id INTEGER PRIMARY KEY,
          name TEXT,
          initial_balance REAL,
          transfer_amount REAL
        );

        DELETE FROM test_accounts;

        INSERT INTO test_accounts (name, initial_balance, transfer_amount) VALUES
        ('alice', 10.0, 1.5),
        ('bob', 8.0, 2.0),
        ('charlie', 5.0, 0.5);
      `);
      db.close();

      const yamlTest = {
        test: 'Database Query Test',
        network: network,
        data: {
          accounts: {
            source: 'database',
            connection: `sqlite:${dbPath}`,
            query: 'SELECT * FROM test_accounts WHERE initial_balance > 5'
          }
        },
        setup: {
          alice: '10 ETH',
          bob: '10 ETH',
          charlie: '10 ETH'
        },
        scenario: [
          { set: { processedCount: 0 } },
          {
            foreach: {
              item: 'account',
              in: '{{data.accounts}}'
            },
            do: [
              { log: 'Processing {{account.name}}: balance={{account.initial_balance}}, transfer={{account.transfer_amount}}' },
              { transfer: '{{account.name}} -> deployer, {{account.transfer_amount}} ETH' },
              { set: { processedCount: '{{processedCount}} + 1' } }
            ]
          },
          { assert: 'processedCount == 2' }  // Only alice and bob (> 5)
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Processing alice');
      expect(result.stdout).toContain('Processing bob');
      expect(result.stdout).not.toContain('Processing charlie');
    });
  });

  describe('API Data Source', () => {
    test('should fetch data from API endpoints', async () => {
      // Mock API endpoint (would normally be external)
      const yamlTest = {
        test: 'API Data Test',
        network: network,
        data: {
          apiData: {
            source: 'api',
            url: 'https://jsonplaceholder.typicode.com/users',
            limit: 3  // Only get first 3 users
          }
        },
        scenario: [
          { set: { userCount: 0 } },
          {
            foreach: {
              item: 'user',
              in: '{{data.apiData}}'
            },
            do: [
              { log: 'User: {{user.name}} ({{user.email}})' },
              { set: { userCount: '{{userCount}} + 1' } }
            ]
          },
          { assert: 'userCount >= 3' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      // This might fail in offline environments
      if (result.success) {
        expect(result.stdout).toContain('User:');
      } else {
        // API might be unavailable, that's OK for testing
        expect(result.stderr || result.stdout).toContain('api');
      }
    });
  });

  describe('Data Transformations', () => {
    test('should transform data before use', async () => {
      const yamlTest = {
        test: 'Data Transform Test',
        network: network,
        data: {
          transfers: {
            source: 'csv',
            path: './test-data/transfers.csv',
            transform: {
              amount: 'amount * 2',  // Double all amounts
              recipient: 'recipient.toUpperCase()'
            }
          }
        },
        scenario: [
          {
            foreach: {
              item: 'transfer',
              in: '{{data.transfers}}'
            },
            do: [
              { log: 'Transformed: {{transfer.account}} -> {{transfer.recipient}}, {{transfer.amount}}' }
            ]
          }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('BOB');  // Uppercase
      expect(result.stdout).toContain('200');  // 100 * 2
    });

    test('should aggregate data', async () => {
      const yamlTest = {
        test: 'Data Aggregation Test',
        network: network,
        data: {
          transfers: {
            source: 'csv',
            path: './test-data/transfers.csv'
          }
        },
        scenario: [
          // Calculate total amount
          { set: { total: 0 } },
          {
            foreach: {
              item: 'transfer',
              in: '{{data.transfers}}'
            },
            do: [
              { set: { total: '{{total}} + {{transfer.amount}}' } }
            ]
          },
          { assert: 'total == 1000' },  // 100+200+300+150+250
          { log: 'Total transfer amount: {{total}}' },

          // Calculate average
          { set: { average: '{{total}} / {{data.transfers.length}}' } },
          { assert: 'average == 200' },
          { log: 'Average transfer: {{average}}' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Total transfer amount: 1000');
      expect(result.stdout).toContain('Average transfer: 200');
    });
  });

  describe('Parameterized Testing', () => {
    test('should run parameterized tests from data', async () => {
      // Create parameterized test data
      const testParams = [
        { a: 10, b: 20, operation: 'add', expected: 30 },
        { a: 50, b: 20, operation: 'subtract', expected: 30 },
        { a: 5, b: 6, operation: 'multiply', expected: 30 },
        { a: 60, b: 2, operation: 'divide', expected: 30 }
      ];

      await fs.writeJson(
        path.join(__dirname, '../test-data/params.json'),
        testParams
      );

      const yamlTest = {
        test: 'Parameterized Test',
        network: network,
        data: {
          testParams: {
            source: 'json',
            path: './test-data/params.json'
          }
        },
        contracts: {
          calc: `file:${path.join(__dirname, '../contracts/Calculator.sol')}#Calculator`
        },
        scenario: [
          { set: { passedTests: 0 } },
          { set: { failedTests: 0 } },
          {
            foreach: {
              item: 'param',
              in: '{{data.testParams}}'
            },
            do: [
              { log: 'Testing: {{param.a}} {{param.operation}} {{param.b}} = {{param.expected}}' },
              {
                if: 'param.operation == "add"',
                then: [
                  { call: 'calc.add({{param.a}}, {{param.b}})', returns: 'result' }
                ]
              },
              {
                if: 'param.operation == "subtract"',
                then: [
                  { call: 'calc.subtract({{param.a}}, {{param.b}})', returns: 'result' }
                ]
              },
              {
                if: 'param.operation == "multiply"',
                then: [
                  { call: 'calc.multiply({{param.a}}, {{param.b}})', returns: 'result' }
                ]
              },
              {
                if: 'param.operation == "divide"',
                then: [
                  { call: 'calc.divide({{param.a}}, {{param.b}})', returns: 'result' }
                ]
              },
              {
                if: 'result == {{param.expected}}',
                then: [
                  { log: '✓ Test passed' },
                  { set: { passedTests: '{{passedTests}} + 1' } }
                ],
                else: [
                  { log: '✗ Test failed: got {{result}}' },
                  { set: { failedTests: '{{failedTests}} + 1' } }
                ]
              }
            ]
          },
          { assert: 'passedTests == 4' },
          { assert: 'failedTests == 0' },
          { log: 'All {{passedTests}} tests passed!' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('✓ Test passed');
      expect(result.stdout).toContain('All 4 tests passed!');
    });
  });

  describe('Data Caching', () => {
    test('should cache and reuse data', async () => {
      const yamlTest = {
        test: 'Data Caching Test',
        network: network,
        data: {
          cachedData: {
            source: 'csv',
            path: './test-data/transfers.csv',
            cache: true
          }
        },
        scenario: [
          // First access
          { set: { firstAccess: '{{data.cachedData.length}}' } },
          { log: 'First access: {{firstAccess}} records' },

          // Second access (should use cache)
          { set: { secondAccess: '{{data.cachedData.length}}' } },
          { log: 'Second access: {{secondAccess}} records' },

          { assert: 'firstAccess == secondAccess' },
          { assert: 'firstAccess == 5' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('First access: 5 records');
      expect(result.stdout).toContain('Second access: 5 records');
    });
  });
});