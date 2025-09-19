const { exec, spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

class TestHelpers {
  constructor() {
    // toolPath points to the main network-test-tool directory
    this.toolPath = path.resolve(__dirname, '../..');
    // testPath points to yaml-system-e2e-tests directory
    this.testPath = path.resolve(__dirname, '..');
    this.network = process.env.TEST_NETWORK || 'kasplex';
    this.testResults = [];

    // Validate paths exist
    if (!fs.existsSync(this.toolPath)) {
      throw new Error(`Tool path does not exist: ${this.toolPath}`);
    }
    if (!fs.existsSync(path.join(this.toolPath, 'cli.js'))) {
      throw new Error(`CLI not found at: ${path.join(this.toolPath, 'cli.js')}`);
    }

    // Debug paths if needed
    if (process.env.DEBUG) {
      console.log('TestHelpers initialized:');
      console.log('  toolPath:', this.toolPath);
      console.log('  testPath:', this.testPath);
      console.log('  network:', this.network);
    }
  }

  /**
   * Execute a YAML test file
   * @param {string} yamlFile - Path to YAML test file
   * @param {Object} options - Execution options
   * @returns {Object} Test result
   */
  async executeYamlTest(yamlFile, options = {}) {
    // Validate YAML file exists
    if (!fs.existsSync(yamlFile)) {
      return {
        success: false,
        error: `YAML file not found: ${yamlFile}`,
        yamlFile,
        network: options.network || this.network,
        timestamp: new Date().toISOString()
      };
    }

    const network = options.network || this.network;
    const cmd = `node cli.js yaml "${yamlFile}" --networks ${network}`;

    try {
      console.log(`Executing YAML test:`);
      console.log(`  File: ${yamlFile}`);
      console.log(`  Network: ${network}`);
      console.log(`  Command: ${cmd}`);

      const { stdout, stderr } = await execPromise(cmd, {
        cwd: this.toolPath,
        env: { ...process.env, NODE_ENV: 'test' },
        timeout: options.timeout || 60000
      });

      const result = {
        success: true,
        stdout,
        stderr,
        yamlFile,
        network,
        timestamp: new Date().toISOString()
      };

      // Try to parse JSON output if present
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result.data = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // Not JSON output, that's fine
      }

      this.testResults.push(result);
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
        yamlFile,
        network,
        timestamp: new Date().toISOString()
      };
      this.testResults.push(result);
      return result;
    }
  }

  /**
   * Deploy a contract for testing
   * @param {string} contractPath - Path to Solidity contract
   * @param {string} contractName - Name of the contract
   * @returns {Object} Deployment result
   */
  async deployContract(contractPath, contractName) {
    const yamlContent = `
test: Deploy ${contractName}
network: ${this.network}

contracts:
  ${contractName.toLowerCase()}: file:${contractPath}#${contractName}

scenario:
  - log: "Deploying ${contractName}"
  - assert: exists(contracts.${contractName.toLowerCase()})

returns:
  address: contracts.${contractName.toLowerCase()}.address
`;

    const tempYaml = path.join(this.testPath, 'temp', `deploy-${Date.now()}.yaml`);
    await fs.ensureDir(path.dirname(tempYaml));
    await fs.writeFile(tempYaml, yamlContent);

    const result = await this.executeYamlTest(tempYaml);

    if (result.success && result.data && result.data.address) {
      return { success: true, address: result.data.address };
    }

    return { success: false, error: result.error || 'Deployment failed' };
  }

  /**
   * Check if a test output contains expected patterns
   * @param {string} output - Test output
   * @param {Array} patterns - Patterns to check
   * @returns {boolean} True if all patterns found
   */
  checkOutputPatterns(output, patterns) {
    for (const pattern of patterns) {
      if (typeof pattern === 'string') {
        if (!output.includes(pattern)) {
          console.log(`Pattern not found: ${pattern}`);
          return false;
        }
      } else if (pattern instanceof RegExp) {
        if (!pattern.test(output)) {
          console.log(`Regex pattern not found: ${pattern}`);
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Parse test results from output
   * @param {string} output - Test output
   * @returns {Object} Parsed results
   */
  parseTestResults(output) {
    const results = {
      passed: 0,
      failed: 0,
      errors: [],
      assertions: [],
      transactions: [],
      gasUsed: 0
    };

    // Parse passed/failed counts
    const passMatch = output.match(/(\d+)\s+passed/i);
    const failMatch = output.match(/(\d+)\s+failed/i);

    if (passMatch) results.passed = parseInt(passMatch[1]);
    if (failMatch) results.failed = parseInt(failMatch[1]);

    // Parse errors
    const errorMatches = output.match(/Error:([^\n]+)/gi);
    if (errorMatches) {
      results.errors = errorMatches.map(e => e.replace(/^Error:\s*/i, ''));
    }

    // Parse assertions
    const assertMatches = output.match(/✓\s+([^\n]+)/g);
    if (assertMatches) {
      results.assertions = assertMatches.map(a => a.replace(/^✓\s+/, ''));
    }

    // Parse transaction hashes
    const txMatches = output.match(/0x[a-fA-F0-9]{64}/g);
    if (txMatches) {
      results.transactions = [...new Set(txMatches)];
    }

    // Parse gas usage
    const gasMatch = output.match(/Gas Used:\s*(\d+)/i);
    if (gasMatch) {
      results.gasUsed = parseInt(gasMatch[1]);
    }

    return results;
  }

  /**
   * Create a temporary YAML test file
   * @param {Object} testDef - Test definition object
   * @returns {string} Path to created file
   */
  async createTempYaml(testDef) {
    const yaml = require('js-yaml');
    const tempDir = path.join(this.testPath, 'temp');
    await fs.ensureDir(tempDir);

    const fileName = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.yaml`;
    const filePath = path.join(tempDir, fileName);

    await fs.writeFile(filePath, yaml.dump(testDef));
    return filePath;
  }

  /**
   * Wait for a condition to be met
   * @param {Function} condition - Condition function
   * @param {number} timeout - Timeout in ms
   * @param {number} interval - Check interval in ms
   * @returns {boolean} True if condition met
   */
  async waitForCondition(condition, timeout = 30000, interval = 1000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    return false;
  }

  /**
   * Execute CLI command directly
   * @param {string} command - Command to execute
   * @param {Array} args - Command arguments
   * @returns {Object} Command result
   */
  async executeCommand(command, args = []) {
    const fullCommand = `node cli.js ${command} ${args.join(' ')}`;

    try {
      const { stdout, stderr } = await execPromise(fullCommand, {
        cwd: this.toolPath,
        timeout: 60000
      });

      return { success: true, stdout, stderr };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr
      };
    }
  }

  /**
   * Clean up temporary files and test artifacts
   */
  async cleanup() {
    const tempDir = path.join(this.testPath, 'temp');

    try {
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
        console.log(`Cleaned up temp directory: ${tempDir}`);
      }
    } catch (error) {
      console.error(`Failed to clean up temp directory: ${error.message}`);
    }

    // Save test results
    if (this.testResults.length > 0) {
      const resultsDir = path.join(this.testPath, 'test-results');

      try {
        await fs.ensureDir(resultsDir);

        const resultsFile = path.join(resultsDir,
          `results-${this.network}-${Date.now()}.json`);
        await fs.writeJson(resultsFile, this.testResults, { spaces: 2 });

        console.log(`Test results saved to: ${resultsFile}`);
      } catch (error) {
        console.error(`Failed to save test results: ${error.message}`);
      }
    }
  }

  /**
   * Get network configuration
   * @param {string} network - Network name
   * @returns {Object} Network config
   */
  async getNetworkConfig(network = null) {
    const result = await this.executeCommand('network:show', [network || this.network]);

    if (result.success) {
      try {
        return JSON.parse(result.stdout);
      } catch (e) {
        // Try to parse key-value pairs
        const config = {};
        const lines = result.stdout.split('\n');
        for (const line of lines) {
          const match = line.match(/(\w+):\s*(.+)/);
          if (match) {
            config[match[1].toLowerCase()] = match[2];
          }
        }
        return config;
      }
    }

    return null;
  }

  /**
   * Check if a contract exists at address
   * @param {string} address - Contract address
   * @returns {boolean} True if contract exists
   */
  async contractExists(address) {
    const yamlContent = `
test: Check Contract
network: ${this.network}

scenario:
  - call:
      to: "${address}"
      function: "0x" # Just check if contract exists
    returns: result

returns:
  exists: result != null
`;

    const tempYaml = await this.createTempYaml(yaml.load(yamlContent));
    const result = await this.executeYamlTest(tempYaml);

    return result.success && result.data && result.data.exists;
  }
}

module.exports = new TestHelpers();