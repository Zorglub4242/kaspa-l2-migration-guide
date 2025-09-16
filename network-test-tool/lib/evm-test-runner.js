const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const { TestResult, Logger, measureTime, retryWithBackoff } = require('./test-utils');
const { DeploymentUtils } = require('./deployment-utils');
const { GasManager } = require('./gas-manager');
const { getNetworkConfig } = require('./networks');
const { ContractRegistry } = require('./contract-registry');

class EVMCompatibilityTester {
  constructor(network, options = {}) {
    this.network = network;
    this.options = options;
    this.config = getNetworkConfig(network.chainId);
    this.logger = new Logger(network, 'EVMTest');
    this.results = new TestResult('EVM-Compatibility', network);
    this.signer = null;
    this.gasManager = null;
    this.deploymentUtils = null;
  }

  // Helper function to load contract ABI from artifacts
  loadContractABI(contractName) {
    try {
      const artifactPath = path.join(
        __dirname, '..',
        'artifacts', 'contracts',
        `${contractName}.sol`,
        `${contractName}.json`
      );

      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Contract artifact not found: ${artifactPath}`);
      }

      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      return artifact.abi;
    } catch (error) {
      this.logger.error(`Failed to load ABI for ${contractName}: ${error.message}`);
      throw error;
    }
  }

  // Helper function to get contract instance
  getContract(contractName, contractAddress) {
    const abi = this.loadContractABI(contractName);
    return new ethers.Contract(contractAddress, abi, this.signer);
  }

  async initialize(signer) {
    // Accept signer as parameter for CLI usage
    this.signer = signer;
    this.gasManager = new GasManager(this.network, this.signer.provider);
    this.deploymentUtils = new DeploymentUtils(this.network, this.signer);

    // Perform network health check
    await this.checkNetworkHealth();

    this.logger.info(`Initialized EVM compatibility tester for ${this.config.name}`);
  }

  async checkNetworkHealth() {
    try {
      this.logger.info('🏥 Checking network health...');

      const startTime = Date.now();

      // Check 1: Get block number
      const blockNumber = await this.signer.provider.getBlockNumber();
      const blockTime = Date.now() - startTime;

      this.logger.info(`📦 Current block: ${blockNumber} (${blockTime}ms response)`);

      // Check 2: Get gas price
      const gasPrice = await this.signer.provider.getGasPrice();
      const gasPriceGwei = ethers.utils.formatUnits(gasPrice, 'gwei');
      this.logger.info(`⛽ Network gas price: ${gasPriceGwei} gwei`);

      // Check 3: Get signer balance
      const balance = await this.signer.getBalance();
      const balanceEth = ethers.utils.formatEther(balance);
      this.logger.info(`💰 Signer balance: ${balanceEth} ETH`);

      // Warn if network is slow
      if (blockTime > 5000) {
        this.logger.warning(`⚠️ Network appears slow (${blockTime}ms response time)`);
        this.logger.warning(`   Consider using --max-retries 5 for better success rate`);
      }

      // Check balance is sufficient
      if (balance.lt(ethers.utils.parseEther('0.01'))) {
        this.logger.warning(`⚠️ Low balance detected. Tests may fail due to insufficient funds.`);
      }

      this.logger.success('✅ Network health check completed');

    } catch (error) {
      this.logger.error(`❌ Network health check failed: ${error.message}`);
      this.logger.warning('⚠️ Network may be unreachable or very slow');
      throw error;
    }
  }

  async getContractAddresses() {
    const registry = new ContractRegistry();
    await registry.initialize();

    // Get all EVM contracts from database
    const contracts = await registry.getActiveContractsByType(this.network.chainId, 'evm');

    // Check if we have all required contracts
    const requiredContracts = ['PrecompileTest', 'AssemblyTest'];
    const missingContracts = requiredContracts.filter(name => !contracts[name]);

    if (missingContracts.length > 0) {
      // Fallback to environment variables if database doesn't have contracts
      this.logger.warning('⚠️ Some contracts not found in database, trying .env fallback');
      return this.getContractAddressesFromEnv();
    }

    const addresses = {
      precompileTest: contracts.PrecompileTest.contract_address,
      assemblyTest: contracts.AssemblyTest.contract_address
    };

    this.logger.info(`✅ Loaded contract addresses from database`);
    this.logger.info(`   PrecompileTest: ${addresses.precompileTest}`);
    this.logger.info(`   AssemblyTest: ${addresses.assemblyTest}`);

    // Run health checks on the contracts
    await this.verifyContractHealth(addresses, registry);

    return addresses;
  }

  // Fallback method for backwards compatibility
  getContractAddressesFromEnv() {
    const chainId = this.network.chainId;
    let prefix;

    if (chainId === 167012) prefix = 'KASPLEX';
    else if (chainId === 19416) prefix = 'IGRA';
    else if (chainId === 11155111) prefix = 'SEPOLIA';
    else throw new Error(`Unsupported chain ID: ${chainId}`);

    const addresses = {
      precompileTest: process.env[`${prefix}_PRECOMPILE_TEST`],
      assemblyTest: process.env[`${prefix}_ASSEMBLY_TEST`]
    };

    // Verify all addresses are set
    for (const [name, address] of Object.entries(addresses)) {
      if (!address) {
        throw new Error(
          `Missing EVM contracts for ${this.config.name} (chain ${chainId}).\n` +
          `Run: npm run deploy:${this.network.name?.toLowerCase() || 'network'} --type evm\n` +
          `Or set ${prefix}_${name.toUpperCase()} in .env file`
        );
      }
    }

    this.logger.warning('⚠️ Using contract addresses from .env file (legacy mode)');
    return addresses;
  }

  async verifyContractHealth(addresses, registry) {
    if (!this.signer?.provider) {
      this.logger.warning('⚠️ No provider available for health checks');
      return;
    }

    try {
      const healthChecks = await registry.verifyContractsHealth(addresses, this.signer.provider);

      if (!healthChecks.allHealthy) {
        this.logger.warning('⚠️ Some contracts may not be responding properly:');
        for (const [name, status] of Object.entries(healthChecks.results)) {
          if (!status.healthy) {
            this.logger.error(`   ❌ ${name}: ${status.error}`);
          } else {
            this.logger.success(`   ✅ ${name}: healthy (${status.responseTime}ms)`);
          }
        }
        // Don't fail here, let the tests themselves fail if contracts are broken
      } else {
        this.logger.success('✅ All contracts verified and healthy');
      }
    } catch (error) {
      this.logger.warning(`⚠️ Could not verify contract health: ${error.message}`);
    }
  }

  async runAllTests(mode = 'standard', failedTestsOnly = null) {
    this.logger.info(`🧪 Starting EVM compatibility tests in ${mode} mode`);

    // If retrying failed tests only
    if (failedTestsOnly && failedTestsOnly.length > 0) {
      this.logger.warning(`🔄 Retrying ${failedTestsOnly.length} failed tests only`);
      return await this.runSpecificTests(failedTestsOnly);
    }

    const addresses = await this.getContractAddresses();
    const gasPrice = await this.gasManager.getGasPrice();

    // Test execution strategies
    switch (mode) {
      case 'sequential':
        await this.runTestsSequentially(addresses, gasPrice);
        break;
      case 'parallel':
        await this.runTestsInParallel(addresses, gasPrice);
        break;
      case 'diversified':
        await this.runDiversifiedTests(addresses, gasPrice);
        break;
      default:
        await this.runStandardTests(addresses, gasPrice);
    }

    this.printTestSummary();
    return this.results;
  }

  async runSpecificTests(testNames) {
    const addresses = await this.getContractAddresses();
    const gasPrice = await this.gasManager.getGasPrice();

    for (const testName of testNames) {
      this.logger.info(`🔄 Retrying test: ${testName}`);

      // Map test names to test functions
      const testMap = {
        'ecrecover': () => this.runSinglePrecompileTest('ecrecover', addresses.precompileTest, gasPrice),
        'sha256': () => this.runSinglePrecompileTest('sha256', addresses.precompileTest, gasPrice),
        'ripemd160': () => this.runSinglePrecompileTest('ripemd160', addresses.precompileTest, gasPrice),
        'modexp': () => this.runSinglePrecompileTest('modexp', addresses.precompileTest, gasPrice),
        'identity': () => this.runSinglePrecompileTest('identity', addresses.precompileTest, gasPrice),
        'bitwise operations': () => this.runSingleAssemblyTest('bitwise', addresses.assemblyTest, gasPrice),
        'memory operations': () => this.runSingleAssemblyTest('memory', addresses.assemblyTest, gasPrice),
        'storage operations': () => this.runSingleAssemblyTest('storage', addresses.assemblyTest, gasPrice)
      };

      const testFn = testMap[testName];
      if (testFn) {
        await testFn();
      } else {
        this.logger.warning(`Unknown test: ${testName}`);
      }
    }

    this.printTestSummary();
    return this.results;
  }

  async runStandardTests(addresses, gasPrice) {
    const tests = [
      () => this.testPrecompiles(addresses.precompileTest, gasPrice),
      () => this.testAssemblyOperations(addresses.assemblyTest, gasPrice)
    ];

    for (const test of tests) {
      await test();
    }
  }

  async runTestsSequentially(addresses, gasPrice) {
    this.logger.info('📋 Running tests sequentially with detailed logging');
    
    await this.testPrecompilesDetailed(addresses.precompileTest, gasPrice);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.testAssemblyOperationsDetailed(addresses.assemblyTest, gasPrice);
  }

  async runTestsInParallel(addresses, gasPrice) {
    this.logger.info('🚀 Running tests in parallel');
    
    const testPromises = [
      this.testPrecompiles(addresses.precompileTest, gasPrice),
      this.testAssemblyOperations(addresses.assemblyTest, gasPrice)
    ];

    await Promise.allSettled(testPromises);
  }

  async runDiversifiedTests(addresses, gasPrice) {
    this.logger.info('🎯 Running diversified test scenarios');
    
    // Run standard tests first
    await this.runStandardTests(addresses, gasPrice);
    
    // Add stress tests
    await this.testPrecompileStress(addresses.precompileTest, gasPrice);
    await this.testAssemblyStress(addresses.assemblyTest, gasPrice);
  }

  async testPrecompiles(contractAddress, gasPrice) {
    this.logger.info('🔧 Testing precompiled contracts');
    
    const contract = this.getContract("PrecompileTest", contractAddress);
    
    const precompileTests = [
      { name: 'ecrecover', method: 'testEcrecover', args: [] },
      { name: 'sha256', method: 'testSha256', args: [ethers.utils.toUtf8Bytes('test data for sha256')] },
      { name: 'ripemd160', method: 'testRipemd160', args: [ethers.utils.toUtf8Bytes('test data for ripemd160')] },
      { name: 'modexp', method: 'testModExp', args: [] },
      { name: 'identity', method: 'testIdentity', args: [ethers.utils.toUtf8Bytes('test data for identity')] }
    ];

    for (const test of precompileTests) {
      await this.runSingleTest(contract, test.method, test.name, gasPrice, test.args || []);
    }
  }

  async testPrecompilesDetailed(contractAddress, gasPrice) {
    const contract = this.getContract("PrecompileTest", contractAddress);
    
    const tests = [
      { name: 'ecrecover', method: 'testEcrecover', description: 'Elliptic curve signature recovery', args: [] },
      { name: 'sha256', method: 'testSha256', description: 'SHA-256 hash function', args: [ethers.utils.toUtf8Bytes('test data for sha256')] },
      { name: 'ripemd160', method: 'testRipemd160', description: 'RIPEMD-160 hash function', args: [ethers.utils.toUtf8Bytes('test data for ripemd160')] },
      { name: 'modexp', method: 'testModExp', description: 'Modular exponentiation', args: [] },
      { name: 'identity', method: 'testIdentity', description: 'Identity function', args: [ethers.utils.toUtf8Bytes('test data for identity')] }
    ];

    for (const test of tests) {
      this.logger.info(`🔍 Testing ${test.description}`);
      await this.runSingleTest(contract, test.method, test.name, gasPrice, test.args || []);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async testAssemblyOperations(contractAddress, gasPrice) {
    this.logger.info('⚙️ Testing assembly operations');
    
    const contract = this.getContract("AssemblyTest", contractAddress);
    
    const assemblyTests = [
      { name: 'basic-ops', method: 'testBasicAssembly' },
      { name: 'memory-ops', method: 'testMemoryOperations' },
      { name: 'storage-ops', method: 'testStorageAccess' },
      { name: 'call-ops', method: 'testCallDataOperations' }
    ];

    for (const test of assemblyTests) {
      await this.runSingleTest(contract, test.method, test.name, gasPrice, test.args || []);
    }
  }

  async testAssemblyOperationsDetailed(contractAddress, gasPrice) {
    const contract = this.getContract("AssemblyTest", contractAddress);
    
    const tests = [
      { name: 'basic-ops', method: 'testBasicAssembly', description: 'Basic arithmetic and logical operations' },
      { name: 'memory-ops', method: 'testMemoryOperations', description: 'Memory manipulation operations' },
      { name: 'storage-ops', method: 'testStorageAccess', description: 'Storage read/write operations' },
      { name: 'call-ops', method: 'testCallDataOperations', description: 'Call and return operations' }
    ];

    for (const test of tests) {
      this.logger.info(`🔧 Testing ${test.description}`);
      await this.runSingleTest(contract, test.method, test.name, gasPrice, test.args || []);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }


  async testPrecompileStress(contractAddress, gasPrice) {
    this.logger.info('🔥 Running precompile stress tests');

    const contract = this.getContract("PrecompileTest", contractAddress);

    // Run multiple iterations of each precompile test
    for (let i = 0; i < 3; i++) {
      await this.runSingleTest(contract, 'testEcrecover', `stress-ecrecover-${i}`, gasPrice, []);
      await this.runSingleTest(contract, 'testSha256', `stress-sha256-${i}`, gasPrice, [ethers.utils.toUtf8Bytes(`stress test data ${i}`)]);
    }
  }

  async testAssemblyStress(contractAddress, gasPrice) {
    this.logger.info('🔥 Running assembly stress tests');
    
    const contract = this.getContract("AssemblyTest", contractAddress);
    
    for (let i = 0; i < 2; i++) {
      await this.runSingleTest(contract, 'testBasicAssembly', `stress-basic-${i}`, gasPrice, []);
      await this.runSingleTest(contract, 'testMemoryOperations', `stress-memory-${i}`, gasPrice, []);
    }
  }

  async runSingleTest(contract, methodName, testName, gasPrice, args = [], retryCount = 0) {
    const maxRetries = this.options.maxRetries || 3;
    // Exponential backoff: 2s, 3s, 4.5s, 6.75s
    const retryDelay = Math.floor(2000 * Math.pow(1.5, retryCount));

    try {
      this.logger.info(`⚡ Running ${testName}...${retryCount > 0 ? ` (Attempt ${retryCount + 1}/${maxRetries + 1})` : ''}`);

      // Get fresh nonce to avoid conflicts (especially important for retries)
      const nonce = await this.signer.getTransactionCount('pending');
      if (retryCount > 0) {
        this.logger.info(`🔢 Using fresh nonce: ${nonce} (retry attempt)`);
      }

      // Get network-specific timeout
      const timeoutMs = this.getNetworkTimeout();

      // Network-specific gas limit
      const gasLimit = this.network.chainId === 19416 ? 1000000 : 3000000; // 1M for Igra, 3M for others

      // Execute test with proper timeout handling
      const testWithTimeout = () => {
        return new Promise((resolve, reject) => {
          let sendTimeoutHandle;
          let receiptTimeoutHandle;
          let transactionSent = false;

          // Phase 1 timeout: Transaction send (10 seconds)
          const sendTimeoutMs = 10000;

          // Start async operation
          measureTime(async () => {
            // Ensure gasPrice is a string or BigNumber, not an object
            const gasPriceValue = gasPrice.hex ? gasPrice : gasPrice;

            // Set timeout for sending transaction
            sendTimeoutHandle = setTimeout(() => {
              if (!transactionSent) {
                reject(new Error(`Transaction send timeout after ${sendTimeoutMs / 1000} seconds`));
              }
            }, sendTimeoutMs);

            // Send transaction with explicit nonce to prevent reuse
            const tx = await contract[methodName](...args, {
              gasPrice: gasPriceValue,
              gasLimit,
              nonce // Use explicit nonce to avoid conflicts
            });

            transactionSent = true;
            clearTimeout(sendTimeoutHandle);

            this.logger.info(`📤 Transaction sent: ${tx.hash}`);
            this.logger.info(`⏳ Waiting for confirmation...`);

            // Phase 2 timeout: Receipt wait (remaining time)
            const receiptTimeoutMs = timeoutMs - sendTimeoutMs;
            receiptTimeoutHandle = setTimeout(() => {
              reject(new Error(`Transaction confirmation timeout after ${receiptTimeoutMs / 1000} seconds`));
            }, receiptTimeoutMs);

            // Wait for receipt
            const receipt = await tx.wait(1); // Wait for 1 confirmation
            clearTimeout(receiptTimeoutHandle);

            this.logger.info(`✅ Confirmed in block ${receipt.blockNumber}`);

            return { tx, receipt };
          })
          .then(result => resolve(result))
          .catch(error => {
            clearTimeout(sendTimeoutHandle);
            clearTimeout(receiptTimeoutHandle);
            reject(error);
          });
        });
      };

      const { result, duration } = await testWithTimeout();

      this.results.addResult(testName, true, {
        duration,
        gasUsed: result.receipt.gasUsed.toNumber(),
        transactionHash: result.receipt.transactionHash,
        method: methodName,
        attempt: retryCount + 1
      });

      this.logger.success(`✅ ${testName} passed${retryCount > 0 ? ` (after ${retryCount + 1} attempts)` : ''}`);
      this.logger.transaction(result.receipt.transactionHash, testName);

    } catch (error) {
      // Handle transaction replaced errors specially
      if (error.code === 'TRANSACTION_REPLACED' && error.replacement) {
        // If the replacement transaction succeeded, consider the test passed
        if (error.receipt && error.receipt.status === 1) {
          this.logger.warning(`⚠️ Transaction was replaced but succeeded`);
          this.results.addResult(testName, true, {
            duration: 0,
            gasUsed: error.receipt.gasUsed?.toNumber() || 0,
            transactionHash: error.replacement.hash || error.receipt.transactionHash,
            method: methodName,
            replaced: true,
            attempt: retryCount + 1
          });
          this.logger.success(`✅ ${testName} passed (via replacement transaction)`);
          this.logger.transaction(error.replacement.hash || error.receipt.transactionHash, testName);
          return;
        }
      }

      const isTimeout = error.message.includes('timeout');
      const errorCategory = this.categorizeError(error);

      // Determine if we should retry
      const shouldRetry = retryCount < maxRetries && (isTimeout || errorCategory === 'network' || errorCategory === 'gas');

      if (shouldRetry) {
        this.logger.warning(`⚠️ ${testName} failed: ${error.message}`);
        this.logger.info(`🔄 Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.runSingleTest(contract, methodName, testName, gasPrice, args, retryCount + 1);
      }

      // Final failure - add to results
      const errorMsg = isTimeout ? 'Test timed out (may not be supported)' : error.message;
      this.results.addResult(testName, false, {
        error: errorMsg,
        method: methodName,
        timeout: isTimeout,
        category: errorCategory,
        attempts: retryCount + 1
      });

      if (isTimeout) {
        this.logger.warning(`⏱️ ${testName} timed out after ${retryCount + 1} attempts`);
      } else {
        this.logger.error(`❌ ${testName} failed after ${retryCount + 1} attempts: ${error.message}`);
      }
    }
  }

  getNetworkTimeout() {
    // Network-specific timeouts
    const timeouts = {
      19416: 60000,  // Igra - 60 seconds (very slow network)
      167012: 30000, // Kasplex - 30 seconds
      11155111: 20000 // Sepolia - 20 seconds
    };

    return timeouts[this.network.chainId] || 20000; // Default 20 seconds
  }

  categorizeError(error) {
    const errorMessage = error.message?.toLowerCase() || '';

    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return 'network';
    }
    if (errorMessage.includes('gas') || errorMessage.includes('underpriced')) {
      return 'gas';
    }
    if (errorMessage.includes('revert') || errorMessage.includes('execution failed')) {
      return 'contract';
    }
    if (errorMessage.includes('nonce')) {
      return 'nonce';
    }
    return 'unknown';
  }

  printTestSummary() {
    const summary = {
      'Network': this.config.name,
      'Total Tests': this.results.results.length,
      'Passed': this.results.results.filter(r => r.success).length,
      'Failed': this.results.results.filter(r => !r.success).length,
      'Success Rate': `${(this.results.getSuccessRate() * 100).toFixed(1)}%`,
      'Total Gas Used': this.results.gasUsage.total.toLocaleString()
    };

    console.log('\n🧪 EVM COMPATIBILITY TEST SUMMARY');
    console.log('='.repeat(50));
    
    for (const [key, value] of Object.entries(summary)) {
      console.log(`${key}: ${value}`);
    }

    if (this.results.results.some(r => !r.success)) {
      console.log('\n❌ Failed Tests:');
      this.results.results
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.operation}: ${r.error}`));
    }
  }
}

module.exports = { EVMCompatibilityTester };