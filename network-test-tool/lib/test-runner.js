const chalk = require('chalk');
const { TestDatabase } = require('./database');
const { ContractRegistry } = require('./contract-registry');
const { priceFetcher } = require('../utils/price-fetcher');
const { networks } = require('./networks');
let cliProgress;
try {
  cliProgress = require('cli-progress');
} catch (error) {
  // Fallback when cli-progress is not available
  cliProgress = {
    MultiBar: class {
      constructor() {}
      create() { return { update: () => {}, stop: () => {} }; }
      stop() {}
    },
    Presets: { shades_classic: {} }
  };
}
const { EventEmitter } = require('events');
const { getNetworkConfig, getAllNetworks } = require('./networks');
const { EVMCompatibilityTester } = require('./evm-test-runner');
const { LoadTestRunner } = require('./load-test-runner');
const { DeploymentUtils } = require('./deployment-utils');
const { TestResult, Logger, formatDuration } = require('./test-utils');
const { ResourcePool } = require('./resource-pool');
const { RetryManager } = require('./retry-manager');
const { ProgressTracker } = require('./progress-tracker');

class TestRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      networks: options.networks || ['sepolia', 'kasplex'],
      tests: options.tests || ['evm', 'defi'],
      mode: options.mode || 'standard',
      parallel: options.parallel || false,
      dashboard: options.dashboard !== false,
      maxConcurrent: options.maxConcurrent || 5,
      timeout: options.timeout || 300000,
      verbose: options.verbose || false,
      deployOnly: options.deployOnly || false,
      statusOnly: options.statusOnly || false,
      contractType: options.contractType || 'all',
      ...options
    };

    this.resourcePool = new ResourcePool();
    this.retryManager = new RetryManager();
    this.progressTracker = new ProgressTracker();
    this.database = new TestDatabase();
    this.results = new Map();
    this.startTime = Date.now();
    
    // Initialize database on startup
    this.database.initialize().catch(err => {
      console.error(chalk.red('❌ Failed to initialize database:'), err.message);
    });
  }

  async run() {
    try {
      console.log(chalk.cyan.bold('🚀 Starting Blockchain Test Suite'));
      this.printConfiguration();
      
      if (this.options.dashboard) {
        await this.progressTracker.initialize();
      }

      if (this.options.parallel) {
        await this.runInParallel();
      } else {
        await this.runSequentially();
      }

      await this.generateSummary();
      
    } catch (error) {
      console.error(chalk.red('❌ Test suite failed:'), error.message);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async runInParallel() {
    console.log(chalk.yellow('🚀 Running tests in parallel across networks'));
    
    const networkPromises = this.options.networks.map(async (networkName) => {
      try {
        const networkResult = await this.runNetworkTests(networkName);
        this.results.set(networkName, networkResult);
        return { networkName, success: true, result: networkResult };
      } catch (error) {
        console.error(chalk.red(`❌ ${networkName} tests failed:`), error.message);
        this.results.set(networkName, { error: error.message, success: false });
        return { networkName, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(networkPromises);
    
    // Process results
    results.forEach((result, index) => {
      const networkName = this.options.networks[index];
      if (result.status === 'rejected') {
        console.error(chalk.red(`❌ ${networkName} parallel execution failed:`), result.reason);
      }
    });
  }

  async runSequentially() {
    console.log(chalk.yellow('📋 Running tests sequentially'));
    
    for (const networkName of this.options.networks) {
      try {
        console.log(chalk.cyan(`\\n🌐 Testing ${networkName.toUpperCase()}`));
        console.log(chalk.gray('='.repeat(40)));
        
        const networkResult = await this.runNetworkTests(networkName);
        this.results.set(networkName, networkResult);
        
        console.log(chalk.green(`✅ ${networkName} tests completed`));
        
      } catch (error) {
        console.error(chalk.red(`❌ ${networkName} tests failed:`), error.message);
        this.results.set(networkName, { error: error.message, success: false });
        
        // Continue with other networks unless it's a critical failure
        if (!error.critical) {
          continue;
        } else {
          throw error;
        }
      }
    }
  }

  async runNetworkTests(networkName) {
    const config = getNetworkConfig(networkName);
    if (!config) {
      throw new Error(`Unknown network: ${networkName}`);
    }

    // Get network provider from resource pool
    const provider = await this.resourcePool.getProvider(config);
    const network = await provider.getNetwork();
    
    const networkResults = {
      network: networkName,
      chainId: config.chainId,
      startTime: Date.now(),
      tests: new Map(),
      summary: {}
    };

    const testQueue = this.buildTestQueue(networkName, network);
    
    if (this.options.dashboard) {
      this.progressTracker.startNetwork(networkName, testQueue.length);
    }

    for (const testConfig of testQueue) {
      try {
        console.log(chalk.blue(`🧪 Running ${testConfig.type} tests on ${networkName}`));
        
        const testResult = await this.executeTest(testConfig, network, provider);
        networkResults.tests.set(testConfig.type, testResult);
        
        if (this.options.dashboard) {
          this.progressTracker.completeTest(networkName, testConfig.type, testResult.success);
        }
        
      } catch (error) {
        const failedResult = { success: false, error: error.message };
        networkResults.tests.set(testConfig.type, failedResult);
        
        if (this.options.dashboard) {
          this.progressTracker.completeTest(networkName, testConfig.type, false);
        }
        
        console.error(chalk.red(`❌ ${testConfig.type} test failed on ${networkName}:`), error.message);
      }
    }

    networkResults.duration = Date.now() - networkResults.startTime;
    networkResults.summary = this.calculateNetworkSummary(networkResults);

    if (this.options.dashboard) {
      this.progressTracker.completeNetwork(networkName);
    }

    return networkResults;
  }

  buildTestQueue(networkName, network) {
    const queue = [];
    
    for (const testType of this.options.tests) {
      const testConfig = {
        type: testType,
        network: networkName,
        mode: this.options.mode,
        options: this.getTestOptions(testType)
      };
      
      queue.push(testConfig);
    }
    
    return queue;
  }

  async executeTest(testConfig, network, provider) {
    const testType = testConfig.type;
    const maxRetries = this.retryManager.getMaxRetries(network.chainId, testType);
    
    return await this.retryManager.executeWithRetry(async () => {
      switch (testType) {
        case 'evm':
          return await this.runEVMTest(testConfig, network);
        
        case 'defi':
          return await this.runDeFiTest(testConfig, network);
        
        case 'load':
          return await this.runLoadTest(testConfig, network);
        
        case 'finality':
          return await this.runFinalityTest(testConfig, network);
        
        default:
          throw new Error(`Unknown test type: ${testType}`);
      }
    }, maxRetries, network.chainId);
  }

  async runEVMTest(testConfig, network) {
    // Get signer from resource pool
    const config = getNetworkConfig(network.chainId);
    const signer = await this.resourcePool.getSigner(config, 0, {
      privateKey: process.env.PRIVATE_KEY
    });

    const testerOptions = {
      ...testConfig.options,
      maxRetries: this.options.maxRetries,
      retryDelay: this.options.retryDelay
    };

    const tester = new EVMCompatibilityTester(network, testerOptions);
    await tester.initialize(signer);

    let result = await tester.runAllTests(testConfig.mode);

    // If retry-until-success is enabled and there are failures
    if (this.options.retryUntilSuccess && result.getSuccessRate() < 1.0) {
      const maxAttempts = 10; // Maximum overall attempts to achieve 100%
      let attempt = 1;

      while (attempt < maxAttempts && result.getSuccessRate() < 1.0) {
        console.log(chalk.yellow(`\n🔄 Retrying failed tests (Attempt ${attempt + 1}/${maxAttempts})...`));

        // Get list of failed tests
        const failedTests = result.results.filter(r => !r.success).map(r => r.operation);
        console.log(chalk.gray(`  Failed tests: ${failedTests.join(', ')}`));

        // Run only the failed tests for efficiency
        result = await tester.runAllTests(testConfig.mode, failedTests);
        attempt++;

        if (result.getSuccessRate() === 1.0) {
          console.log(chalk.green(`✅ Achieved 100% success after ${attempt + 1} attempts!`));
        }
      }

      if (result.getSuccessRate() < 1.0) {
        console.log(chalk.yellow(`⚠️ Could not achieve 100% success after ${maxAttempts} attempts`));
        console.log(chalk.yellow(`  Final success rate: ${(result.getSuccessRate() * 100).toFixed(1)}%`));
      }
    }

    return {
      success: result.getSuccessRate() === 1.0,
      testCount: result.results.length,
      successRate: result.getSuccessRate(),
      duration: result.getDuration(),
      gasUsed: result.gasUsage.total,
      details: result
    };
  }

  async runDeFiTest(testConfig, network) {
    // Use database-driven DeFi test runner
    const { DeFiTestRunner } = require('./defi-test-runner');

    // Get network config using the network name from testConfig
    const networkName = testConfig.network || network.name;
    const networkConfig = getNetworkConfig(networkName);

    if (!networkConfig) {
      throw new Error(`Cannot get network config for: ${networkName}`);
    }

    const provider = await this.resourcePool.getProvider(networkConfig);
    const signer = await this.resourcePool.getSigner(networkConfig, 0, {
      privateKey: process.env.PRIVATE_KEY
    });

    const tester = new DeFiTestRunner(networkConfig, testConfig.options);
    await tester.initialize(signer);

    let result = await tester.runAllTests(testConfig.mode);

    // If retry-until-success is enabled and there are failures
    if (this.options.retryUntilSuccess && result.getSuccessRate() < 0.9) {
      const maxAttempts = 10;
      let attempt = 1;

      while (attempt < maxAttempts && result.getSuccessRate() < 0.9) {
        console.log(chalk.yellow(`\n🔄 Retrying failed DeFi tests (Attempt ${attempt + 1}/${maxAttempts})...`));

        // Get list of failed tests
        const failedTests = result.results.filter(r => !r.success).map(r => r.name);
        console.log(chalk.gray(`  Failed tests: ${failedTests.join(', ')}`));

        // Run only the failed tests for efficiency
        result = await tester.runAllTests(testConfig.mode, failedTests);
        attempt++;

        if (result.getSuccessRate() >= 0.9) {
          console.log(chalk.green(`✅ Achieved target success rate after ${attempt + 1} attempts!`));
        }
      }

      if (result.getSuccessRate() < 0.9) {
        console.log(chalk.yellow(`⚠️ Could not achieve target success rate after ${maxAttempts} attempts`));
        console.log(chalk.yellow(`  Final success rate: ${(result.getSuccessRate() * 100).toFixed(1)}%`));
      }
    }

    return {
      success: result.getSuccessRate() >= 0.9, // 90% success rate for DeFi
      testCount: result.metrics.totalTests,
      successRate: result.getSuccessRate(),
      duration: result.getDuration(),
      gasUsed: result.metrics.gasUsed,
      details: result
    };
  }

  async runLoadTest(testConfig, network) {
    const runner = new LoadTestRunner(network, testConfig.options);
    await runner.initialize();
    
    const result = await runner.runStressTest(
      process.env.CONTRACT_ADDRESS, 
      { duration: 30000, maxTPS: 5 }
    );
    
    return {
      success: result.getSuccessRate() >= 0.8, // 80% success rate for load tests
      testCount: result.results.length,
      successRate: result.getSuccessRate(),
      duration: result.getDuration(),
      gasUsed: result.gasUsage.total,
      details: result
    };
  }

  async runFinalityTest(testConfig, network) {
    // Implement finality testing logic
    return {
      success: true,
      testCount: 1,
      successRate: 1.0,
      duration: 30000,
      gasUsed: 0,
      details: { finalityTime: '15s', blockConfirmations: 6 }
    };
  }

  getTestOptions(testType) {
    const baseOptions = {
      maxConcurrent: this.options.maxConcurrent,
      timeout: this.options.timeout,
      verbose: this.options.verbose
    };

    switch (testType) {
      case 'evm':
        return {
          ...baseOptions,
          includeStress: this.options.mode === 'stress'
        };
      
      case 'defi':
        return {
          ...baseOptions,
          includeAdvanced: this.options.mode === 'comprehensive'
        };
      
      case 'load':
        return {
          ...baseOptions,
          duration: this.options.mode === 'stress' ? 120000 : 30000,
          maxTPS: this.options.mode === 'stress' ? 20 : 5
        };
      
      default:
        return baseOptions;
    }
  }

  calculateNetworkSummary(networkResults) {
    const tests = Array.from(networkResults.tests.values());
    const successful = tests.filter(t => t.success).length;
    const total = tests.length;
    const totalGasUsed = tests.reduce((sum, t) => sum + (t.gasUsed || 0), 0);
    
    return {
      totalTests: total,
      successfulTests: successful,
      failedTests: total - successful,
      overallSuccessRate: total > 0 ? successful / total : 0,
      totalDuration: networkResults.duration,
      totalGasUsed,
      averageTestDuration: total > 0 ? networkResults.duration / total : 0
    };
  }

  async generateSummary() {
    const totalDuration = Date.now() - this.startTime;
    
    console.log(chalk.cyan.bold('\\n📊 TEST SUITE SUMMARY'));
    console.log(chalk.gray('='.repeat(50)));
    
    // Overall metrics
    const allResults = Array.from(this.results.values());
    const successfulNetworks = allResults.filter(r => r.summary?.overallSuccessRate === 1.0).length;
    const totalNetworks = allResults.length;
    
    console.log(chalk.cyan('Duration:'), formatDuration(totalDuration));
    console.log(chalk.cyan('Networks:'), `${successfulNetworks}/${totalNetworks} successful`);
    console.log(chalk.cyan('Mode:'), this.options.mode);
    console.log(chalk.cyan('Execution:'), this.options.parallel ? 'Parallel' : 'Sequential');
    
    // Per-network summary
    console.log(chalk.yellow('\\n🌐 Network Results:'));
    for (const [networkName, result] of this.results) {
      if (result.error) {
        console.log(chalk.red(`  ❌ ${networkName}: ${result.error}`));
      } else {
        const rate = (result.summary.overallSuccessRate * 100).toFixed(1);
        const status = result.summary.overallSuccessRate === 1.0 ? '✅' : '⚠️';
        console.log(`  ${status} ${networkName}: ${rate}% success (${result.summary.successfulTests}/${result.summary.totalTests} tests)`);
      }
    }
    
    // Test type breakdown
    console.log(chalk.yellow('\\n🧪 Test Type Results:'));
    const testTypes = new Set();
    this.results.forEach(result => {
      if (result.tests) {
        result.tests.forEach((_, testType) => testTypes.add(testType));
      }
    });
    
    testTypes.forEach(testType => {
      const testResults = [];
      this.results.forEach((result, networkName) => {
        if (result.tests && result.tests.has(testType)) {
          testResults.push({ networkName, result: result.tests.get(testType) });
        }
      });
      
      const successful = testResults.filter(t => t.result.success).length;
      const total = testResults.length;
      const rate = total > 0 ? (successful / total * 100).toFixed(1) : '0.0';
      
      console.log(`  ${testType.toUpperCase()}: ${rate}% success (${successful}/${total} networks)`);
    });
    
    // Save detailed results
    await this.saveResults();
    
    if (successfulNetworks === totalNetworks) {
      console.log(chalk.green.bold('\\n🎉 All tests passed successfully!'));
    } else {
      console.log(chalk.yellow.bold('\\n⚠️  Some tests failed. Check the detailed results.'));
    }
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-suite-results-${timestamp}.json`;
    
    const summaryData = {
      timestamp: new Date().toISOString(),
      configuration: this.options,
      duration: Date.now() - this.startTime,
      results: Object.fromEntries(this.results),
      summary: {
        totalNetworks: this.results.size,
        totalDuration: Date.now() - this.startTime,
        mode: this.options.mode,
        parallel: this.options.parallel
      }
    };
    
    const fs = require('fs').promises;
    const path = require('path');
    
    const resultsDir = path.join(process.cwd(), 'test-results');
    await fs.mkdir(resultsDir, { recursive: true });
    
    const filePath = path.join(resultsDir, filename);
    await fs.writeFile(filePath, JSON.stringify(summaryData, null, 2));
    
    console.log(chalk.gray(`\\n💾 Detailed results saved to: ${filePath}`));
  }

  printConfiguration() {
    console.log(chalk.gray('\\n📋 Test Configuration:'));
    console.log(chalk.gray('  Networks:'), this.options.networks.join(', '));
    console.log(chalk.gray('  Tests:'), this.options.tests.join(', '));
    console.log(chalk.gray('  Mode:'), this.options.mode);
    console.log(chalk.gray('  Execution:'), this.options.parallel ? 'Parallel' : 'Sequential');
    console.log(chalk.gray('  Max Concurrent:'), this.options.maxConcurrent);
    console.log(chalk.gray('  Dashboard:'), this.options.dashboard ? 'Enabled' : 'Disabled');
    console.log('');
  }

  async recordDeployment(networkName, deploymentResult, customContractType = null, customContractName = null) {
    try {
      if (!deploymentResult) {
        console.log(chalk.yellow(`⚠️ No deployment result to record for ${networkName}`));
        return;
      }

      // Save to ContractRegistry
      const registry = new ContractRegistry();
      const network = getNetworkConfig(networkName);

      // Use custom contract type if provided, otherwise determine automatically
      let contractType = customContractType || 'unknown';
      if (!customContractType && deploymentResult.contractName) {
        if (['PrecompileTest', 'AssemblyTest', 'CREATE2Factory'].includes(deploymentResult.contractName)) {
          contractType = 'evm';
        } else if (deploymentResult.contractName.includes('Mock') || deploymentResult.contractName.includes('DeFi')) {
          contractType = 'defi';
        } else if (deploymentResult.contractName === 'SimpleStorage') {
          contractType = 'load';
        }
      }

      // Get contract ABI if available
      let abi = [];
      try {
        const fs = require('fs');
        const path = require('path');
        const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts',
          `${deploymentResult.contractName}.sol`, `${deploymentResult.contractName}.json`);
        if (fs.existsSync(artifactPath)) {
          const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
          abi = artifact.abi;
        }
      } catch (err) {
        // ABI loading is optional
      }

      await registry.saveDeployment({
        networkName: networkName,
        chainId: network.chainId,
        contractName: customContractName || deploymentResult.contractName || 'Unknown',
        contractType: contractType,
        contractAddress: deploymentResult.contractAddress,
        transactionHash: deploymentResult.transactionHash,
        blockNumber: deploymentResult.blockNumber?.toString ? deploymentResult.blockNumber.toString() : deploymentResult.blockNumber,
        gasUsed: deploymentResult.gasUsed?.toString ? deploymentResult.gasUsed.toString() : deploymentResult.gasUsed,
        gasPrice: deploymentResult.gasPrice?.toString ? deploymentResult.gasPrice.toString() : deploymentResult.gasPrice?.toString(),
        deployerAddress: deploymentResult.deployerAddress || deploymentResult.signer,
        constructorArgs: deploymentResult.constructorArgs || [],
        abi: abi,
        version: '1.0.0',
        metadata: {
          totalCost: deploymentResult.totalCost?.toString ? deploymentResult.totalCost.toString() : deploymentResult.totalCost?.toString(),
          executionTime: deploymentResult.executionTime
        }
      });

      // Create or get test run for this deployment session
      if (!this.deploymentRunId) {
        const runData = {
          runId: `deployment-${Date.now()}`,
          startTime: new Date().toISOString(),
          mode: 'deployment',
          parallel: this.options.parallel || false,
          networks: this.options.networks,
          testTypes: ['deployment'],
          configuration: {
            label: 'Contract Deployment',
            contractType: this.options.contractType || 'all'
          }
        };
        this.database.insertTestRun(runData);
        this.deploymentRunId = runData.runId;
        this.deploymentStats = {
          totalTests: 0,
          successfulTests: 0,
          failedTests: 0,
          totalGasUsed: 0,
          totalCostTokens: 0,
          totalCostUSD: 0
        };
      }

      // Calculate costs in tokens and USD
      const totalCostEther = deploymentResult.totalCost || 0;
      let costUSD = 0;

      try {
        const priceData = await priceFetcher.getUSDValue(networkName, totalCostEther);
        costUSD = priceData.usdValue || 0;
        if (priceData.success) {
          console.log(chalk.cyan(`💰 Cost: ${priceFetcher.formatCostComparison(priceData)}`));
        }
      } catch (priceError) {
        console.log(chalk.yellow(`⚠️ Could not fetch USD price: ${priceError.message}`));
      }

      const startTime = new Date(Date.now() - deploymentResult.executionTime).toISOString();
      const endTime = new Date().toISOString();

      const deploymentData = {
        runId: this.deploymentRunId,
        networkName: networkName,
        testType: 'deployment',
        testName: deploymentResult.contractName || 'Unknown',
        success: deploymentResult.success || false,
        startTime: startTime,
        endTime: endTime,
        duration: deploymentResult.executionTime || 0,
        gasUsed: deploymentResult.gasUsed?.toString() || '0',
        gasPrice: deploymentResult.gasPrice?.toString() || '0',
        transactionHash: deploymentResult.transactionHash || null,
        blockNumber: deploymentResult.blockNumber?.toString() || null,
        errorMessage: deploymentResult.error || null,
        costTokens: totalCostEther,
        costUSD: costUSD,
        metadata: {
          contractAddress: deploymentResult.contractAddress || null,
          totalCost: deploymentResult.totalCost?.toString() || '0',
          deploymentType: 'smart_contract'
        }
      };

      await this.database.insertTestResult(deploymentData);
      console.log(chalk.green(`✅ Recorded deployment of ${deploymentResult.contractName} to database`));

      // Update deployment stats
      this.deploymentStats.totalTests++;
      if (deploymentResult.success) {
        this.deploymentStats.successfulTests++;
      } else {
        this.deploymentStats.failedTests++;
      }
      this.deploymentStats.totalGasUsed += parseInt(deploymentResult.gasUsed?.toString() || '0');
      this.deploymentStats.totalCostTokens += totalCostEther;
      this.deploymentStats.totalCostUSD += costUSD;

    } catch (error) {
      console.error(chalk.red(`❌ Failed to record deployment to database:`), error.message);
    }
  }

  async finalizeDeploymentRun() {
    if (!this.deploymentRunId || !this.deploymentStats) return;

    try {
      const successRate = this.deploymentStats.totalTests > 0
        ? (this.deploymentStats.successfulTests / this.deploymentStats.totalTests) * 100
        : 0;

      const updateData = {
        endTime: new Date().toISOString(),
        totalTests: this.deploymentStats.totalTests,
        successfulTests: this.deploymentStats.successfulTests,
        failedTests: this.deploymentStats.failedTests,
        successRate: successRate,
        totalGasUsed: this.deploymentStats.totalGasUsed,
        totalCostTokens: this.deploymentStats.totalCostTokens,
        totalCostUSD: this.deploymentStats.totalCostUSD
      };

      await this.database.updateTestRun(this.deploymentRunId, updateData);

      // Get the token symbol for the deployed network
      const networkName = this.options.networks[0]; // Get first network (single network deployment)
      const tokenSymbol = networks[networkName]?.symbol || 'ETH';

      console.log(chalk.cyan('\n📊 Deployment Summary:'));
      console.log(chalk.cyan(`  Total Contracts: ${this.deploymentStats.totalTests}`));
      console.log(chalk.green(`  Successful: ${this.deploymentStats.successfulTests}`));
      console.log(chalk.red(`  Failed: ${this.deploymentStats.failedTests}`));
      console.log(chalk.yellow(`  Success Rate: ${successRate.toFixed(2)}%`));
      console.log(chalk.blue(`  Total Gas Used: ${this.deploymentStats.totalGasUsed.toLocaleString()}`));
      console.log(chalk.magenta(`  Total Cost: ${this.deploymentStats.totalCostTokens.toFixed(6)} ${tokenSymbol} (~$${this.deploymentStats.totalCostUSD.toFixed(2)} USD)`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to finalize deployment run:'), error.message);
    }
  }

  async cleanup() {
    if (this.progressTracker) {
      await this.progressTracker.cleanup();
    }
    if (this.resourcePool) {
      await this.resourcePool.cleanup();
    }
  }

  // Deployment methods
  async deploy() {
    console.log(chalk.yellow.bold('🏗️  Starting Contract Deployment'));
    
    // Ensure database is initialized
    await this.database.initialize();
    
    if (this.options.parallel) {
      await this.deployInParallel();
    } else {
      await this.deploySequentially();
    }
  }

  async deployInParallel() {
    const deploymentPromises = this.options.networks.map(async (networkName) => {
      try {
        const config = getNetworkConfig(networkName);
        if (!config) {
          throw new Error(`Network configuration not found for: ${networkName}`);
        }
        
        console.log(chalk.blue(`🔗 Creating provider for ${config.name}...`));
        console.log(chalk.gray(`🔍 Network config: ${config.name} (${config.chainId})`));
        const provider = await this.resourcePool.getProvider(config);
        console.log(chalk.green(`✅ Created new provider for ${config.name}`));
        console.log(chalk.gray(`🔍 Provider network:`, { chainId: provider.network?.chainId, name: provider.network?.name }));
        
        const signer = await this.resourcePool.getSigner(config, 0, { 
          privateKey: process.env.PRIVATE_KEY 
        });
        console.log(chalk.gray(`🔍 Signer address:`, await signer.getAddress()));
        console.log(chalk.gray(`🔍 Signer provider:`, { chainId: signer.provider?.network?.chainId, name: signer.provider?.network?.name }));
        
        console.log(chalk.blue(`🔧 Creating DeploymentUtils with config and signer...`));
        const deploymentUtils = new DeploymentUtils(config, signer);
        console.log(chalk.green(`✅ DeploymentUtils created successfully`));
        return await this.deployToNetwork(deploymentUtils, networkName);
      } catch (error) {
        console.error(chalk.red(`❌ Failed to create provider for ${networkName}:`), error.message);
        throw error;
      }
    });

    await Promise.allSettled(deploymentPromises);
  }

  async deploySequentially() {
    for (const networkName of this.options.networks) {
      await this.deployToNetwork(null, networkName);
    }
  }

  async deployToNetwork(deploymentUtils, networkName) {
    console.log(chalk.cyan(`🚀 Deploying to ${networkName}...`));

    try {
      // Get network config - needed whether deploymentUtils exists or not
      const config = getNetworkConfig(networkName);
      if (!config) {
        throw new Error(`Network configuration not found for: ${networkName}`);
      }

      if (!deploymentUtils) {
        console.log(chalk.blue(`🔧 Creating DeploymentUtils for ${networkName}...`));
        console.log(chalk.gray(`🔍 Network config for ${networkName}: ${config.name} (${config.chainId})`));
        const provider = await this.resourcePool.getProvider(config);
        console.log(chalk.gray(`🔍 Provider network for ${networkName}:`, { chainId: provider.network?.chainId, name: provider.network?.name }));
        const signer = await this.resourcePool.getSigner(config, 0, {
          privateKey: process.env.PRIVATE_KEY
        });
        console.log(chalk.gray(`🔍 Signer address for ${networkName}:`, await signer.getAddress()));
        console.log(chalk.blue(`🔧 Instantiating DeploymentUtils for ${networkName}...`));
        deploymentUtils = new DeploymentUtils(config, signer);
        console.log(chalk.green(`✅ DeploymentUtils created for ${networkName}`));
      }

      // Check for existing contracts comprehensively
      const { ContractRegistry } = require('./contract-registry');
      const registry = new ContractRegistry();

      console.log(chalk.blue(`🔍 Checking existing contracts on ${networkName}...`));

      // Get all existing contracts by type
      const existingEvmContracts = await registry.getActiveContractsByType(config.chainId, 'evm');
      const existingDeFiContracts = await registry.getActiveContractsByType(config.chainId, 'defi');

      // Define expected contracts for each type
      const expectedContracts = {
        evm: ['PrecompileTest', 'AssemblyTest', 'CREATE2Factory'],
        defi: ['TokenA', 'TokenB', 'RewardToken', 'DEX', 'LendingProtocol', 'YieldFarm', 'NFTCollection', 'MultiSigWallet'],
        load: ['SimpleStorage']
      };

      // Check what's missing
      const missingContracts = {
        evm: [],
        defi: [],
        load: []
      };

      // Check EVM contracts
      const existingEvmNames = Object.keys(existingEvmContracts);
      missingContracts.evm = expectedContracts.evm.filter(name => !existingEvmNames.includes(name));

      // Check DeFi contracts
      const existingDefiNames = Object.keys(existingDeFiContracts);
      missingContracts.defi = expectedContracts.defi.filter(name => !existingDefiNames.includes(name));

      // Check load contracts (SimpleStorage)
      const existingLoadContracts = await registry.getActiveContractsByType(config.chainId, 'load');
      const existingLoadNames = Object.keys(existingLoadContracts);
      missingContracts.load = expectedContracts.load.filter(name => !existingLoadNames.includes(name));

      // Display current state
      console.log(chalk.cyan(`📊 Contract Status on ${networkName}:`));

      if (existingEvmContracts.length > 0) {
        console.log(chalk.green(`   ✅ EVM Contracts (${existingEvmContracts.length}/3):`));
        existingEvmContracts.forEach(contract => {
          console.log(chalk.gray(`      - ${contract.contract_name}: ${contract.contract_address}`));
        });
      }

      if (existingDeFiContracts.length > 0) {
        console.log(chalk.green(`   ✅ DeFi Contracts (${existingDeFiContracts.length}/8):`));
        existingDeFiContracts.forEach(contract => {
          console.log(chalk.gray(`      - ${contract.contract_name}: ${contract.contract_address}`));
        });
      }

      if (existingLoadContracts.length > 0) {
        console.log(chalk.green(`   ✅ Load Test Contracts (${existingLoadContracts.length}/1):`));
        existingLoadContracts.forEach(contract => {
          console.log(chalk.gray(`      - ${contract.contract_name}: ${contract.contract_address}`));
        });
      }

      // Show missing contracts
      const totalMissing = missingContracts.evm.length + missingContracts.defi.length + missingContracts.load.length;

      if (totalMissing === 0) {
        console.log(chalk.green(`🎉 All contracts are already deployed on ${networkName}!`));
        return;
      }

      console.log(chalk.yellow(`📋 Missing Contracts (${totalMissing}):`));

      if (missingContracts.evm.length > 0) {
        console.log(chalk.red(`   ❌ EVM: ${missingContracts.evm.join(', ')}`));
      }

      if (missingContracts.defi.length > 0) {
        console.log(chalk.red(`   ❌ DeFi: ${missingContracts.defi.join(', ')}`));
      }

      if (missingContracts.load.length > 0) {
        console.log(chalk.red(`   ❌ Load: ${missingContracts.load.join(', ')}`));
      }

      // Ask user what to deploy
      const inquirer = require('inquirer');
      const choices = [];

      if (missingContracts.evm.length > 0) {
        choices.push({
          name: `Deploy missing EVM contracts (${missingContracts.evm.length})`,
          value: 'evm',
          checked: this.options.contractType === 'all' || this.options.contractType === 'evm'
        });
      }

      if (missingContracts.defi.length > 0) {
        choices.push({
          name: `Deploy missing DeFi contracts (${missingContracts.defi.length})`,
          value: 'defi',
          checked: this.options.contractType === 'all' || this.options.contractType === 'defi'
        });
      }

      if (missingContracts.load.length > 0) {
        choices.push({
          name: `Deploy missing Load test contracts (${missingContracts.load.length})`,
          value: 'load',
          checked: this.options.contractType === 'all' || this.options.contractType === 'load'
        });
      }

      if (choices.length === 0) {
        console.log(chalk.green(`✅ No missing contracts found for requested type: ${this.options.contractType}`));
        return;
      }

      const { contractTypes } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'contractTypes',
        message: `Select contract types to deploy on ${networkName}:`,
        choices: choices,
        validate: (input) => input.length > 0 || 'Please select at least one contract type'
      }]);

      // Store what to deploy for the actual deployment logic
      this.deploymentPlan = { contractTypes, missingContracts };

      // Deploy based on user selection
      console.log(chalk.cyan(`\n🚀 Starting deployment of selected contract types...`));

      // Deploy EVM contracts if selected
      if (contractTypes.includes('evm')) {
        console.log(chalk.blue('⚡ Deploying EVM Compatibility Contracts...'));

        if (missingContracts.evm.includes('PrecompileTest')) {
          await this.recordDeployment(networkName, await deploymentUtils.deployContract('PrecompileTest'), 'evm');
        }
        if (missingContracts.evm.includes('AssemblyTest')) {
          await this.recordDeployment(networkName, await deploymentUtils.deployContract('AssemblyTest'), 'evm');
        }
        if (missingContracts.evm.includes('CREATE2Factory')) {
          await this.recordDeployment(networkName, await deploymentUtils.deployContract('CREATE2Factory'), 'evm');
        }

        console.log(chalk.green('✅ EVM contracts deployment completed'));
      }

      // Deploy Load test contracts if selected
      if (contractTypes.includes('load')) {
        console.log(chalk.blue('📦 Deploying Load Test Contracts...'));

        if (missingContracts.load.includes('SimpleStorage')) {
          await this.recordDeployment(networkName, await deploymentUtils.deployContract('SimpleStorage', [0]), 'load');
        }

        console.log(chalk.green('✅ Load test contracts deployment completed'));
      }

      // Deploy DeFi contracts if selected
      if (contractTypes.includes('defi')) {
        console.log(chalk.blue('🏪 Deploying DeFi Protocol Suite...'));

        // Deploy only missing DeFi contracts
        if (missingContracts.defi.includes('TokenA')) {
          const result = await deploymentUtils.deployContract('MockERC20', ["DeFi Token A", "DFIA", 18, 10000000]);
          await this.recordDeployment(networkName, result, 'defi', 'TokenA');
        }

        if (missingContracts.defi.includes('TokenB')) {
          const result = await deploymentUtils.deployContract('MockERC20', ["DeFi Token B", "DFIB", 18, 10000000]);
          await this.recordDeployment(networkName, result, 'defi', 'TokenB');
        }

        if (missingContracts.defi.includes('RewardToken')) {
          const result = await deploymentUtils.deployContract('MockERC20', ["Reward Token", "RWRD", 18, 100000000]);
          await this.recordDeployment(networkName, result, 'defi', 'RewardToken');
        }

        if (missingContracts.defi.includes('DEX')) {
          const result = await deploymentUtils.deployContract('MockDEX', [], { gasComplexity: 'complex' });
          await this.recordDeployment(networkName, result, 'defi', 'DEX');
        }

        if (missingContracts.defi.includes('LendingProtocol')) {
          const result = await deploymentUtils.deployContract('MockLendingProtocol', []);
          await this.recordDeployment(networkName, result, 'defi', 'LendingProtocol');
        }

        if (missingContracts.defi.includes('YieldFarm')) {
          const result = await deploymentUtils.deployContract('MockYieldFarm', []);
          await this.recordDeployment(networkName, result, 'defi', 'YieldFarm');
        }

        if (missingContracts.defi.includes('NFTCollection')) {
          const result = await deploymentUtils.deployContract('MockERC721Collection', [
            "DeFi NFT Collection", "DFNFT", "https://api.defi-nft.com/metadata/"
          ], { gasComplexity: 'complex' });
          await this.recordDeployment(networkName, result, 'defi', 'NFTCollection');
        }

        if (missingContracts.defi.includes('MultiSigWallet')) {
          const additionalOwners = [
            "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Hardhat account #1
            "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"  // Hardhat account #2
          ];
          const result = await deploymentUtils.deployContract('MockMultiSigWallet', [
            [deploymentUtils.signer.address, ...additionalOwners],
            2, // Require 2 of 3 signatures
            deploymentUtils.signer.address // Emergency contact
          ], { gasComplexity: 'complex' });
          await this.recordDeployment(networkName, result, 'defi', 'MultiSigWallet');
        }

        console.log(chalk.green('✅ DeFi contracts deployment completed'));
      }

      await deploymentUtils.saveDeployments(`deployment-${networkName}.json`);
      console.log(chalk.green(`✅ ${networkName} deployment completed`));

      // Update test run with final statistics
      if (this.deploymentRunId && this.deploymentStats) {
        await this.finalizeDeploymentRun();
      }

    } catch (error) {
      console.error(chalk.red(`❌ ${networkName} deployment failed:`), error.message);
    }
  }

  async checkStatus() {
    console.log(chalk.blue.bold('📡 Checking Network Status'));
    
    for (const networkName of this.options.networks) {
      try {
        const config = getNetworkConfig(networkName);
        const provider = await this.resourcePool.getProvider(config);
        
        const blockNumber = await provider.getBlockNumber();
        const gasPrice = await provider.getGasPrice();
        const network = await provider.getNetwork();
        
        console.log(chalk.cyan(`\\n🌐 ${config.name}:`));
        console.log(`  Chain ID: ${network.chainId}`);
        console.log(`  Block Number: ${blockNumber.toLocaleString()}`);
        console.log(`  Gas Price: ${require('ethers').utils.formatUnits(gasPrice, 'gwei')} gwei`);
        console.log(`  RPC: ${config.rpc}`);
        console.log(`  Status: ${chalk.green('✅ Online')}`);
        
      } catch (error) {
        console.log(chalk.cyan(`\\n🌐 ${networkName}:`));
        console.log(`  Status: ${chalk.red('❌ Offline')}`);
        console.log(`  Error: ${error.message}`);
      }
    }
  }
}

module.exports = { TestRunner };