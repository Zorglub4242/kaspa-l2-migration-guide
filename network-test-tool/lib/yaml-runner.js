const { YAMLTestParser } = require('./yaml-parser');
const { YAMLTestExecutor } = require('./yaml-executor');
const { ResourcePool } = require('./resource-pool');
const { TestDatabase } = require('./database');
const { getNetworkConfig } = require('./networks');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

class YAMLTestRunner {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      saveResults: options.saveResults !== false,
      parallel: options.parallel || false,
      ...options
    };

    this.parser = new YAMLTestParser();
    this.resourcePool = new ResourcePool();
    this.database = new TestDatabase();
    this.results = [];
  }

  /**
   * Run a YAML test file
   * @param {string} filePath - Path to YAML test file
   * @param {Object} options - Runtime options
   */
  async run(filePath, options = {}) {
    console.log(chalk.blue.bold('\n╔══════════════════════════════════════════╗'));
    console.log(chalk.blue.bold('║     YAML Test Runner - Starting...      ║'));
    console.log(chalk.blue.bold('╚══════════════════════════════════════════╝\n'));

    try {
      // Initialize database
      await this.database.initialize();

      // Parse YAML file
      console.log(chalk.cyan('📄 Parsing YAML test file...'));
      const testDefinition = await this.parser.parseFile(filePath);

      // Override with runtime options
      if (options.networks) {
        testDefinition.network = options.networks.split(',');
      }
      if (options.data) {
        testDefinition.data = options.data;
      }

      // Ensure network is an array
      const networks = Array.isArray(testDefinition.network)
        ? testDefinition.network
        : [testDefinition.network];

      console.log(chalk.cyan(`🌐 Target networks: ${networks.join(', ')}`));

      // Run test on each network
      if (this.options.parallel && networks.length > 1) {
        await this.runParallel(testDefinition, networks);
      } else {
        await this.runSequential(testDefinition, networks);
      }

      // Generate summary
      this.printSummary();

      // Save results if enabled
      if (this.options.saveResults) {
        await this.saveResults(filePath);
      }

      return this.results;

    } catch (error) {
      console.error(chalk.red(`\n❌ Test execution failed: ${error.message}`));

      if (this.options.verbose) {
        console.error(chalk.gray(error.stack));
      }

      throw error;

    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  /**
   * Run tests sequentially
   * @param {Object} testDefinition - Test definition
   * @param {Array} networks - Networks to test
   */
  async runSequential(testDefinition, networks) {
    for (const networkName of networks) {
      try {
        const result = await this.runOnNetwork(testDefinition, networkName);
        this.results.push(result);
      } catch (error) {
        console.error(chalk.red(`Failed on network ${networkName}: ${error.message}`));

        this.results.push({
          testName: testDefinition.test,
          network: networkName,
          passed: false,
          error: error.message
        });

        if (!this.options.continueOnError) {
          throw error;
        }
      }
    }
  }

  /**
   * Run tests in parallel
   * @param {Object} testDefinition - Test definition
   * @param {Array} networks - Networks to test
   */
  async runParallel(testDefinition, networks) {
    console.log(chalk.cyan(`⚡ Running tests in parallel on ${networks.length} networks`));

    const promises = networks.map(networkName =>
      this.runOnNetwork(testDefinition, networkName).catch(error => ({
        testName: testDefinition.test,
        network: networkName,
        passed: false,
        error: error.message
      }))
    );

    const results = await Promise.all(promises);
    this.results.push(...results);
  }

  /**
   * Run test on a specific network
   * @param {Object} testDefinition - Test definition
   * @param {string} networkName - Network name
   */
  async runOnNetwork(testDefinition, networkName) {
    // Get network configuration
    const networkConfig = getNetworkConfig(networkName);

    if (!networkConfig) {
      throw new Error(`Unknown network: ${networkName}`);
    }

    // Create executor for this network
    const executor = new YAMLTestExecutor(this.resourcePool, {
      verbose: this.options.verbose
    });

    // Execute test
    const result = await executor.execute(testDefinition, networkConfig);

    // Store in database
    if (this.options.saveResults) {
      await this.storeResult(result);
    }

    return result;
  }

  /**
   * Store test result in database
   * @param {Object} result - Test result
   */
  async storeResult(result) {
    try {
      // If we have a TestResult object, use its save method
      if (result.testResult) {
        await result.testResult.save();
        console.log(chalk.gray('  💾 Result saved to database'));
        return;
      }

      // Fallback to direct insertion (shouldn't normally reach here)
      const testResult = {
        runId: result.runId,
        testName: result.testName,
        network: result.network,
        success: result.passed,
        duration: result.summary?.duration || 0,
        gasUsed: result.summary?.gasUsed || 0,
        metrics: result.metrics,
        summary: result.summary
      };

      this.database.insertTestResult(testResult);
      console.log(chalk.gray('  💾 Result saved to database'));
    } catch (error) {
      console.warn(chalk.yellow(`  ⚠️ Could not save result: ${error.message}`));
    }
  }

  /**
   * Save results to file
   * @param {string} yamlPath - Original YAML file path
   */
  async saveResults(yamlPath) {
    const timestamp = Date.now();
    const baseName = path.basename(yamlPath, path.extname(yamlPath));
    const outputPath = path.join(
      'test-results',
      `yaml-${baseName}-${timestamp}.json`
    );

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write results
    fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
    console.log(chalk.green(`\n📁 Results saved to: ${outputPath}`));
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log(chalk.cyan('\n═══ Test Summary ═══\n'));

    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;

    for (const result of this.results) {
      const status = result.passed ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED');
      console.log(`${status} - ${result.testName} on ${result.network}`);

      if (result.metrics) {
        console.log(chalk.gray(`  Metrics:`));
        for (const [key, value] of Object.entries(result.metrics)) {
          console.log(chalk.gray(`    ${key}: ${JSON.stringify(value)}`));
        }
      }

      if (result.error) {
        console.log(chalk.red(`  Error: ${result.error}`));
      }
    }

    console.log(chalk.cyan('\n═══════════════════\n'));
    console.log(chalk.bold(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`));

    const successRate = total > 0 ? (passed / total * 100).toFixed(1) : 0;
    console.log(chalk.bold(`Success Rate: ${successRate}%`));
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.resourcePool.cleanup();
    this.database.close();
  }

  /**
   * Run multiple YAML test files
   * @param {Array<string>} filePaths - Paths to YAML test files
   * @param {Object} options - Runtime options
   */
  async runMultiple(filePaths, options = {}) {
    console.log(chalk.blue(`\n🔄 Running ${filePaths.length} test files...\n`));

    const allResults = [];

    for (const filePath of filePaths) {
      console.log(chalk.cyan(`\n📋 Test file: ${filePath}`));

      try {
        const results = await this.run(filePath, options);
        allResults.push(...results);
      } catch (error) {
        console.error(chalk.red(`Failed to run ${filePath}: ${error.message}`));

        if (!options.continueOnError) {
          throw error;
        }
      }
    }

    return allResults;
  }

  /**
   * Discover and run all YAML tests in a directory
   * @param {string} directory - Directory path
   * @param {Object} options - Runtime options
   */
  async runDirectory(directory = './test-yaml', options = {}) {
    console.log(chalk.blue(`\n🔍 Discovering YAML tests in ${directory}...\n`));

    const files = this.discoverTests(directory);

    if (files.length === 0) {
      console.log(chalk.yellow('No YAML test files found'));
      return [];
    }

    console.log(chalk.cyan(`Found ${files.length} test files`));
    return await this.runMultiple(files, options);
  }

  /**
   * Discover YAML test files in a directory
   * @param {string} directory - Directory path
   * @returns {Array<string>} List of YAML file paths
   */
  discoverTests(directory) {
    const files = [];

    if (!fs.existsSync(directory)) {
      return files;
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        // Recurse into subdirectories
        files.push(...this.discoverTests(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        files.push(fullPath);
      }
    }

    return files;
  }
}

/**
 * CLI entry point
 * @param {string} filePath - YAML test file path
 * @param {Object} options - CLI options
 */
async function runYAMLTest(filePath, options = {}) {
  const runner = new YAMLTestRunner(options);
  return await runner.run(filePath, options);
}

module.exports = {
  YAMLTestRunner,
  runYAMLTest
};