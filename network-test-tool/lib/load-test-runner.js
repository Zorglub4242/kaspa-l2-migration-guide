const { ethers } = require("hardhat");
const { TestResult, Logger, measureTime, retryWithBackoff, formatGas, formatDuration } = require('./test-utils');
const { DeploymentUtils } = require('./deployment-utils');
const { GasManager } = require('./gas-manager');

class LoadTestRunner {
  constructor(network, options = {}) {
    this.network = network;
    this.options = {
      maxConcurrency: options.maxConcurrency || 10,
      retryAttempts: options.retryAttempts || 3,
      baseDelay: options.baseDelay || 1000,
      timeout: options.timeout || 60000,
      ...options
    };
    this.logger = new Logger(network, 'LoadTest');
    this.results = new TestResult('LoadTest', network);
    this.signer = null;
    this.gasManager = null;
  }

  async initialize() {
    [this.signer] = await ethers.getSigners();
    this.gasManager = new GasManager(this.network, this.signer.provider);
    this.deploymentUtils = new DeploymentUtils(this.network, this.signer);
    
    this.logger.info(`Initialized load test runner for ${this.network.name}`);
  }

  async runSimpleLoad(contractAddress, transactionCount = 5) {
    // If no contract address provided, get it from the registry
    if (!contractAddress) {
      const { ContractRegistry } = require('./contract-registry');
      const registry = new ContractRegistry();
      const contracts = await registry.getActiveContractsByType(this.network.chainId, 'all');

      if (contracts && contracts.SimpleStorage) {
        contractAddress = contracts.SimpleStorage.contract_address;
        this.logger.info(`📍 Using SimpleStorage at ${contractAddress}`);
      } else {
        throw new Error(`SimpleStorage contract not found for ${this.network.name}. Please deploy it first with: npm run deploy:${this.network.name.toLowerCase()}`);
      }
    }

    this.logger.info(`🚀 Starting simple load test: ${transactionCount} transactions`);

    const contract = await ethers.getContractAt("SimpleStorage", contractAddress, this.signer);
    const gasPrice = await this.gasManager.getGasPrice();
    
    for (let i = 0; i < transactionCount; i++) {
      try {
        const value = Math.floor(Math.random() * 1000000);
        this.logger.info(`📤 Sending transaction ${i + 1}/${transactionCount} (value: ${value})`);
        
        const { result, duration } = await measureTime(async () => {
          const tx = await contract.store(value, { gasPrice });
          const receipt = await tx.wait();
          return { tx, receipt };
        });

        this.results.addResult(`store-${i + 1}`, true, {
          duration,
          gasUsed: result.receipt.gasUsed.toNumber(),
          transactionHash: result.receipt.transactionHash,
          value
        });

        this.logger.success(`✅ Transaction ${i + 1} completed in ${formatDuration(duration)}`);
        
        if (i < transactionCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        this.results.addResult(`store-${i + 1}`, false, {
          error: error.message
        });
        this.logger.error(`❌ Transaction ${i + 1} failed: ${error.message}`);
      }
    }

    return this.results;
  }

  async runStressTest(contractAddress, options = {}) {
    const {
      duration = 60000, // 1 minute
      maxTPS = 10,
      rampUpTime = 10000 // 10 seconds
    } = options;

    // If no contract address provided, get it from the registry
    if (!contractAddress) {
      const { ContractRegistry } = require('./contract-registry');
      const registry = new ContractRegistry();
      const contracts = await registry.getActiveContractsByType(this.network.chainId, 'all');

      if (contracts && contracts.SimpleStorage) {
        contractAddress = contracts.SimpleStorage.contract_address;
        this.logger.info(`📍 Using SimpleStorage at ${contractAddress}`);
      } else {
        throw new Error(`SimpleStorage contract not found for ${this.network.name}. Please deploy it first with: npm run deploy:${this.network.name.toLowerCase()}`);
      }
    }

    this.logger.info(`🔥 Starting stress test: ${formatDuration(duration)} at max ${maxTPS} TPS`);

    const contract = await ethers.getContractAt("SimpleStorage", contractAddress, this.signer);
    const gasPrice = await this.gasManager.getGasPrice();
    
    const startTime = Date.now();
    const endTime = startTime + duration;
    let transactionCount = 0;
    const activeTransactions = new Set();

    while (Date.now() < endTime) {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      
      // Calculate current TPS based on ramp-up
      const currentTPS = Math.min(maxTPS, (elapsed / rampUpTime) * maxTPS);
      const intervalMs = Math.max(100, 1000 / currentTPS);
      
      if (activeTransactions.size < this.options.maxConcurrency) {
        const txId = ++transactionCount;
        const txPromise = this.executeStressTransaction(contract, gasPrice, txId);
        
        activeTransactions.add(txPromise);
        txPromise.finally(() => activeTransactions.delete(txPromise));
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    // Wait for remaining transactions
    await Promise.allSettled([...activeTransactions]);
    
    this.logger.success(`🏁 Stress test completed: ${transactionCount} transactions sent`);
    return this.results;
  }

  async executeStressTransaction(contract, gasPrice, txId) {
    try {
      const value = Math.floor(Math.random() * 1000000);
      
      const { result, duration } = await measureTime(async () => {
        const tx = await contract.store(value, { 
          gasPrice,
          gasLimit: 50000 
        });
        const receipt = await tx.wait();
        return { tx, receipt };
      });

      this.results.addResult(`stress-tx-${txId}`, true, {
        duration,
        gasUsed: result.receipt.gasUsed.toNumber(),
        transactionHash: result.receipt.transactionHash,
        value
      });

    } catch (error) {
      this.results.addResult(`stress-tx-${txId}`, false, {
        error: error.message
      });
    }
  }

  async runBurstTest(contractAddress, burstSize = 10, burstCount = 3, burstInterval = 5000) {
    this.logger.info(`💥 Starting burst test: ${burstCount} bursts of ${burstSize} transactions`);
    
    const contract = await ethers.getContractAt("SimpleStorage", contractAddress, this.signer);
    const gasPrice = await this.gasManager.getGasPrice();

    for (let burst = 0; burst < burstCount; burst++) {
      this.logger.info(`🚀 Starting burst ${burst + 1}/${burstCount}`);
      
      const burstPromises = [];
      for (let i = 0; i < burstSize; i++) {
        const txPromise = this.executeBurstTransaction(contract, gasPrice, `${burst + 1}-${i + 1}`);
        burstPromises.push(txPromise);
      }

      const burstResults = await Promise.allSettled(burstPromises);
      const successful = burstResults.filter(r => r.status === 'fulfilled').length;
      
      this.logger.info(`📊 Burst ${burst + 1} completed: ${successful}/${burstSize} successful`);
      
      if (burst < burstCount - 1) {
        this.logger.info(`⏳ Waiting ${formatDuration(burstInterval)} before next burst`);
        await new Promise(resolve => setTimeout(resolve, burstInterval));
      }
    }

    return this.results;
  }

  async executeBurstTransaction(contract, gasPrice, txId) {
    try {
      const value = Math.floor(Math.random() * 1000000);
      
      const { result, duration } = await measureTime(async () => {
        const tx = await contract.store(value, { gasPrice });
        const receipt = await tx.wait();
        return { tx, receipt };
      });

      this.results.addResult(`burst-tx-${txId}`, true, {
        duration,
        gasUsed: result.receipt.gasUsed.toNumber(),
        transactionHash: result.receipt.transactionHash,
        value
      });

    } catch (error) {
      this.results.addResult(`burst-tx-${txId}`, false, {
        error: error.message
      });
    }
  }

  async measureMaxTPS(contractAddress, testDuration = 30000) {
    this.logger.info(`📊 Measuring maximum TPS for ${formatDuration(testDuration)}`);
    
    const contract = await ethers.getContractAt("SimpleStorage", contractAddress, this.signer);
    const gasPrice = await this.gasManager.getGasPrice();
    
    let currentTPS = 1;
    let maxSuccessfulTPS = 0;
    const stepSize = 2;
    
    while (currentTPS <= 50) { // Reasonable upper limit
      this.logger.info(`🔬 Testing TPS: ${currentTPS}`);
      
      const testSuccess = await this.testTPSLevel(contract, gasPrice, currentTPS, testDuration / 3);
      
      if (testSuccess) {
        maxSuccessfulTPS = currentTPS;
        this.logger.success(`✅ TPS ${currentTPS} successful`);
        currentTPS += stepSize;
      } else {
        this.logger.warning(`❌ TPS ${currentTPS} failed, max TPS found: ${maxSuccessfulTPS}`);
        break;
      }
    }

    this.logger.success(`🏆 Maximum sustainable TPS: ${maxSuccessfulTPS}`);
    return { maxTPS: maxSuccessfulTPS, results: this.results };
  }

  async testTPSLevel(contract, gasPrice, targetTPS, duration) {
    const intervalMs = 1000 / targetTPS;
    const startTime = Date.now();
    const endTime = startTime + duration;
    let successCount = 0;
    let totalCount = 0;
    const activeTransactions = new Set();

    while (Date.now() < endTime) {
      if (activeTransactions.size < this.options.maxConcurrency) {
        totalCount++;
        const txPromise = this.testTransaction(contract, gasPrice, totalCount)
          .then(() => successCount++)
          .catch(() => {});
        
        activeTransactions.add(txPromise);
        txPromise.finally(() => activeTransactions.delete(txPromise));
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    await Promise.allSettled([...activeTransactions]);
    
    const successRate = successCount / totalCount;
    return successRate >= 0.9; // 90% success rate threshold
  }

  async testTransaction(contract, gasPrice, txId) {
    const value = Math.floor(Math.random() * 1000000);
    const tx = await contract.store(value, { 
      gasPrice,
      gasLimit: 50000 
    });
    return await tx.wait();
  }

  printSummary() {
    const summary = {
      'Total Operations': this.results.results.length,
      'Successful': this.results.results.filter(r => r.success).length,
      'Failed': this.results.results.filter(r => !r.success).length,
      'Success Rate': `${(this.results.getSuccessRate() * 100).toFixed(1)}%`,
      'Total Duration': formatDuration(this.results.getDuration()),
      'Total Gas': formatGas(this.results.gasUsage.total)
    };

    console.log('\n📊 LOAD TEST SUMMARY');
    console.log('='.repeat(40));
    for (const [key, value] of Object.entries(summary)) {
      console.log(`${key}: ${value}`);
    }
  }
}

module.exports = { LoadTestRunner };