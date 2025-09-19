const testHelpers = require('../utils/test-helpers');
const path = require('path');
const fs = require('fs-extra');

describe('Migrated JavaScript to YAML Tests', () => {
  const network = process.env.TEST_NETWORK || 'kasplex';

  beforeAll(async () => {
    console.log('Starting E2E tests for YAML system');
    console.log(`Network: ${network}`);
    console.log(`Working directory: ${process.cwd()}`);
  });

  afterAll(async () => {
    await testHelpers.cleanup();
  });

  describe('Migrated DeFi Tests', () => {
    test('should execute migrated complete-defi-suite.yaml', async () => {
      const yamlPath = path.join(__dirname, '../../migrations/defi/complete-defi-suite.yaml');

      // This test MUST NOT skip - we are testing the YAML system
      const exists = await fs.pathExists(yamlPath);
      expect(exists).toBe(true);

      const result = await testHelpers.executeYamlTest(yamlPath, { timeout: 120000 });

      // The YAML system must work - no skipping allowed
      expect(result.success).toBe(true);
      expect(result.stdout).toBeDefined();

      // Verify key DeFi operations were executed
      if (result.stdout) {
        const patterns = ['Token', 'transfer', 'approve', 'balance'];
        for (const pattern of patterns) {
          expect(result.stdout.toLowerCase()).toContain(pattern.toLowerCase());
        }
      }
    }, 120000);

    test('should execute sample migrated DeFi tests', async () => {
      const defiDir = path.join(__dirname, '../../migrations/defi');

      // Directory must exist - we're testing the YAML system
      const dirExists = await fs.pathExists(defiDir);
      expect(dirExists).toBe(true);

      const yamlFiles = await fs.readdir(defiDir);
      const defiTests = yamlFiles.filter(f => f.endsWith('.yaml') && !f.includes('SUMMARY'));

      expect(defiTests.length).toBeGreaterThan(0);

      // Test first file as a sample
      const testFile = defiTests[0];
      console.log(`Testing sample migrated file: ${testFile}`);

      const yamlPath = path.join(defiDir, testFile);
      const result = await testHelpers.executeYamlTest(yamlPath, {
        timeout: 60000,
        network: network
      });

      // Must succeed - no skipping
      expect(result.success).toBe(true);
      expect(result.stdout).toBeDefined();
    }, 60000);

    test('should validate DeFi YAML structure', async () => {
      const yamlPath = path.join(__dirname, '../../migrations/defi/complete-defi-suite.yaml');

      const exists = await fs.pathExists(yamlPath);
      expect(exists).toBe(true);

      const yaml = require('js-yaml');
      const content = await fs.readFile(yamlPath, 'utf8');
      const testDef = yaml.load(content);

      // Validate structure
      expect(testDef).toHaveProperty('test');
      expect(testDef).toHaveProperty('scenario');
      expect(Array.isArray(testDef.scenario)).toBe(true);
      expect(testDef.scenario.length).toBeGreaterThan(0);

      // Validate DeFi-specific elements
      if (testDef.contracts) {
        expect(testDef.contracts).toHaveProperty('usdc');
        expect(testDef.contracts).toHaveProperty('dai');
      }

      // Check for key DeFi operations in scenario
      const scenarioStr = JSON.stringify(testDef.scenario);
      expect(scenarioStr).toMatch(/transfer|approve|swap|deposit|borrow/i);
    });
  });

  describe('Migrated Load Tests', () => {
    test('should execute minimal load test', async () => {

      // Create minimal load test
      const minimalLoadTest = {
        test: 'Minimal Load Test',
        network: network,
        setup: {
          master: '10 ETH'
        },
        scenario: [
          { log: 'Starting minimal load test' },
          { transfer: 'master -> master, 0.001 ETH' },
          { log: 'Load test completed' }
        ]
      };

      const tempYaml = await testHelpers.createTempYaml(minimalLoadTest);
      const result = await testHelpers.executeYamlTest(tempYaml, { timeout: 30000 });

      expect(result.success).toBe(true);
      if (result.stdout) {
        expect(result.stdout).toContain('Load test completed');
      }
    }, 30000);

    test('should validate load test metrics', async () => {
      const loadTestDef = {
        test: 'Load Test Metrics Validation',
        network: network,
        variables: {
          testTransactions: 10
        },
        setup: {
          master: '10 ETH'
        },
        scenario: [
          { set: { startTime: 'timestamp()' } },

          {
            repeat: '{{testTransactions}}',
            do: [
              { transfer: 'master -> master, 0' }
            ]
          },

          { set: { endTime: 'timestamp()' } },
          { set: { duration: '{{endTime}} - {{startTime}}' } },
          { set: { tps: '{{testTransactions}} * 1000 / {{duration}}' } },

          { log: 'TPS: {{tps}}' },
          { assert: 'tps > 0' },
          { assert: 'duration > 0' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(loadTestDef);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      if (result.stdout) {
        expect(result.stdout).toContain('TPS:');
      }
    }, 30000);

    test('should handle parallel load generation', async () => {
      const parallelLoadTest = {
        test: 'Parallel Load Test',
        network: network,
        setup: {
          alice: '5 ETH',
          bob: '5 ETH',
          charlie: '5 ETH'
        },
        scenario: [
          {
            parallel: {
              maxConcurrency: 3,
              actions: [
                { transfer: 'alice -> bob, 0.01 ETH' },
                { transfer: 'bob -> charlie, 0.01 ETH' },
                { transfer: 'charlie -> alice, 0.01 ETH' }
              ]
            }
          },
          { log: 'Parallel transfers completed' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(parallelLoadTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      if (result.stdout) {
        expect(result.stdout).toContain('Parallel transfers completed');
      }
    }, 30000);

    test('should validate migrated load tests exist', async () => {
      const loadDir = path.join(__dirname, '../../migrations/load');

      const dirExists = await fs.pathExists(loadDir);
      expect(dirExists).toBe(true);

      const files = await fs.readdir(loadDir);
      const loadTests = files.filter(f => f.endsWith('.yaml'));

      // Verify at least one load test was migrated
      expect(loadTests.length).toBeGreaterThan(0);
    });
  });

  describe('Migration Validation', () => {
    test('should verify no JavaScript test files remain', async () => {
      const scriptsDir = path.join(__dirname, '../../scripts');

      const dirExists = await fs.pathExists(scriptsDir);
      expect(dirExists).toBe(true);

      const files = await fs.readdir(scriptsDir);

      // Check that old test files have been removed
      const oldTestFiles = files.filter(f =>
        f.includes('complete-defi-suite.js') ||
        f.includes('deploy-defi-suite.js') ||
        f.includes('enhanced-defi-comprehensive.js') ||
        f.startsWith('load-test-') && f.endsWith('.js')
      );

      expect(oldTestFiles.length).toBe(0);
    });

    test('should verify migration scripts exist', async () => {
      const migrationScripts = [
        path.join(__dirname, '../../scripts/migrate-defi-tests.js'),
        path.join(__dirname, '../../scripts/migrate-load-tests.js')
      ];

      for (const script of migrationScripts) {
        const exists = await fs.pathExists(script);
        expect(exists).toBe(true);
      }
    });

    test('should verify package.json uses YAML tests', async () => {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      const packageJson = await fs.readJson(packageJsonPath);

      // Check that test scripts reference YAML files
      expect(packageJson.scripts['test:defi']).toContain('yaml');
      expect(packageJson.scripts['test:load']).toContain('yaml');

      // Verify new YAML scripts were added
      expect(packageJson.scripts['yaml:defi-suite']).toBeDefined();
      expect(packageJson.scripts['yaml:load-simple']).toBeDefined();
      expect(packageJson.scripts['yaml:defi-all']).toBeDefined();
      expect(packageJson.scripts['yaml:load-all']).toBeDefined();
    });
  });

  describe('Backwards Compatibility', () => {
    test('should support both old and new test formats', async () => {
      // Test that YAML tests can replicate JavaScript test functionality
      const compatTest = {
        test: 'Backwards Compatibility Test',
        network: network,
        contracts: {
          token: 'ERC20("CompatToken", "COMPAT", 1000000)'
        },
        setup: {
          alice: '10 ETH',
          bob: '10 ETH'
        },
        scenario: [
          // Replicate common JavaScript test patterns
          { 'token.transfer': 'deployer -> alice, 1000' },
          {
            call: 'token.balanceOf(alice)',
            returns: 'balance'
          },
          { assert: 'balance == 1000' },

          // Async operations
          { wait: 1000 },

          // Error handling
          {
            try: [
              { 'token.transfer': 'alice -> bob, 10000000', from: 'alice' }
            ],
            catch: [
              { log: 'Transfer failed as expected' }
            ]
          }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(compatTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });
  });

  describe('Performance Comparison', () => {
    test('should measure YAML test execution time', async () => {
      const perfTest = {
        test: 'Performance Measurement',
        network: network,
        scenario: [
          { set: { startTime: 'timestamp()' } },

          {
            repeat: 10,
            do: [
              { transfer: 'alice -> bob, 0.001 ETH' }
            ]
          },

          { set: { endTime: 'timestamp()' } },
          { set: { executionTime: '{{endTime}} - {{startTime}}' } },
          { log: 'Execution time: {{executionTime}}ms' },

          // Ensure reasonable performance
          { assert: 'executionTime < 60000' } // Less than 60 seconds
        ],
        setup: {
          alice: '10 ETH',
          bob: '10 ETH'
        }
      };

      const yamlFile = await testHelpers.createTempYaml(perfTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      if (result.stdout) {
        expect(result.stdout).toContain('Execution time:');

        // Parse execution time from output
        const timeMatch = result.stdout.match(/Execution time: (\d+)ms/);
        if (timeMatch) {
          const time = parseInt(timeMatch[1]);
          expect(time).toBeLessThan(60000);
        }
      }
    });
  });
});