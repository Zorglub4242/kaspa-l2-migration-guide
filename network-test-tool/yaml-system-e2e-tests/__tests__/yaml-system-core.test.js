const testHelpers = require('../utils/test-helpers');
const path = require('path');
const fs = require('fs-extra');

describe('YAML System Core Functionality', () => {
  const network = process.env.TEST_NETWORK || 'kasplex';

  beforeAll(() => {
    console.log('Testing YAML system core functionality');
    console.log(`Network: ${network}`);
  });

  afterAll(async () => {
    await testHelpers.cleanup();
  });

  describe('Basic YAML Execution', () => {
    test('should execute a simple YAML test', async () => {
      const simpleTest = {
        test: 'Simple YAML Test',
        network: network,
        scenario: [
          { log: 'Test started' },
          { set: { value: 42 } },
          { assert: 'value == 42' },
          { log: 'Test completed' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(simpleTest);
      const result = await testHelpers.executeYamlTest(yamlFile, { timeout: 15000 });

      expect(result.success).toBe(true);
      if (result.stdout) {
        expect(result.stdout).toContain('Test completed');
      }
    }, 20000);

    test('should handle basic transfers', async () => {
      const transferTest = {
        test: 'Basic Transfer Test',
        network: network,
        setup: {
          alice: '1 ETH'
        },
        scenario: [
          { log: 'Performing transfer' },
          { transfer: 'alice -> alice, 0' },
          { log: 'Transfer done' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(transferTest);
      const result = await testHelpers.executeYamlTest(yamlFile, { timeout: 30000 });

      expect(result.success).toBe(true);
    }, 35000);
  });

  describe('Migration Validation', () => {
    test('should verify DeFi migrations exist', async () => {
      const defiDir = path.join(__dirname, '../../migrations/defi');
      const exists = await fs.pathExists(defiDir);
      expect(exists).toBe(true);

      if (exists) {
        const files = await fs.readdir(defiDir);
        const yamlFiles = files.filter(f => f.endsWith('.yaml'));
        expect(yamlFiles.length).toBeGreaterThan(0);
      }
    });

    test('should verify load test migrations exist', async () => {
      const loadDir = path.join(__dirname, '../../migrations/load');
      const exists = await fs.pathExists(loadDir);
      expect(exists).toBe(true);

      if (exists) {
        const files = await fs.readdir(loadDir);
        const yamlFiles = files.filter(f => f.endsWith('.yaml'));
        expect(yamlFiles.length).toBeGreaterThan(0);
      }
    });

    test('should verify old JavaScript files removed', async () => {
      const scriptsDir = path.join(__dirname, '../../scripts');
      const exists = await fs.pathExists(scriptsDir);

      if (exists) {
        const files = await fs.readdir(scriptsDir);
        const oldTests = files.filter(f =>
          f.includes('complete-defi-suite.js') ||
          f.includes('deploy-defi-suite.js') ||
          f.includes('enhanced-defi-comprehensive.js') ||
          (f.startsWith('load-test-') && f.endsWith('.js'))
        );
        expect(oldTests.length).toBe(0);
      }
    });
  });

  describe('YAML System Features', () => {
    test('should support variables', async () => {
      const varTest = {
        test: 'Variable Test',
        network: network,
        variables: {
          amount: 100,
          message: 'Hello YAML'
        },
        scenario: [
          { log: '{{message}}' },
          { set: { double: '{{amount}} * 2' } },
          { assert: 'double == 200' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(varTest);
      const result = await testHelpers.executeYamlTest(yamlFile, { timeout: 15000 });

      expect(result.success).toBe(true);
    }, 20000);

    test('should support conditions', async () => {
      const conditionTest = {
        test: 'Condition Test',
        network: network,
        scenario: [
          { set: { x: 10 } },
          {
            if: 'x > 5',
            then: [
              { log: 'x is greater than 5' },
              { set: { result: 'pass' } }
            ],
            else: [
              { set: { result: 'fail' } }
            ]
          },
          { assert: 'result == "pass"' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(conditionTest);
      const result = await testHelpers.executeYamlTest(yamlFile, { timeout: 15000 });

      expect(result.success).toBe(true);
    }, 20000);
  });
});