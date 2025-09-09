const { ethers } = require('ethers');
const { BaseNetworkAdapter } = require('./BaseNetworkAdapter');
const { logger } = require('../utils/logger');

/**
 * Kasplex Network Adapter - Extends BaseNetworkAdapter for Kasplex L2
 * Implements network-specific gas strategies and transaction patterns
 */
class KasplexAdapter extends BaseNetworkAdapter {
  constructor(networkName, rpcUrl, privateKey, chainId = null) {
    super(networkName, rpcUrl, privateKey);
    this.expectedChainId = chainId || 167012; // Default Kasplex testnet
    this.currency = 'KAS';
    
    // Kasplex-specific configurations based on battle-tested deployment scripts
    this.networkConfig = this.getNetworkConfig();
    
    // Reinitialize finality thresholds and gas strategies with proper config
    this.finalityThresholds = this.getDefaultFinalityThresholds();
    this.gasStrategies = this.getDefaultGasStrategies();
    this.retryConfig = this.getDefaultRetryConfig();
  }

  // Get network-specific configuration
  getNetworkConfig() {
    return {
      name: 'kasplex',
      chainId: 167012, // Kasplex testnet
      gasPrice: ethers.utils.parseUnits("2000", "gwei"), // Battle-tested from existing scripts
      gasLimit: 1000000, // Conservative 1M gas limit for Kasplex
      maxGasLimit: ethers.utils.parseUnits("5000000", "wei"), // Max 5M gas
      gasBufferMultiplier: 1.20, // 20% buffer as used in deployment scripts
      blockConfirmationTarget: 8, // Faster finality than Ethereum
      mevBaseline: 10, // Kasplex has minimal MEV activity
      timeout: 30000, // 30 second timeout (from deployment script)
      retryDelay: 15000, // 15 second retry delay
      explorerBaseUrl: 'https://explorer.testnet.kasplextest.xyz',
      faucetUrls: [
        'https://faucet.zealousswap.com/',
        'https://app.kaspafinance.io/faucets'
      ]
    };
  }

  // Initialize the adapter
  async initialize() {
    try {
      // Create provider
      this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
      
      // Create signer
      this.signer = new ethers.Wallet(this.privateKey, this.provider);
      
      // Verify network
      const network = await this.provider.getNetwork();
      this.chainId = network.chainId;
      
      // Verify we're on Kasplex
      if (this.chainId !== this.networkConfig.chainId) {
        logger.warning(`Expected Kasplex chain ID ${this.networkConfig.chainId}, got ${this.chainId}`);
      }
      
      // Check balance
      const balance = await this.signer.getBalance();
      const minBalance = ethers.utils.parseEther("0.001"); // 0.001 KAS minimum
      
      if (balance.lt(minBalance)) {
        logger.warning(`⚠️ Low balance: ${ethers.utils.formatEther(balance)} KAS`);
        logger.warning(`💡 Get free KAS from faucets:`);
        this.networkConfig.faucetUrls.forEach(url => logger.warning(`   - ${url}`));
      }
      
      // Get initial network conditions
      const conditions = await this.getNetworkConditions();
      
      logger.success(`✅ Initialized ${this.networkName} adapter (Chain ID: ${this.chainId})`);
      logger.info(`💰 Balance: ${ethers.utils.formatEther(balance)} KAS`);
      logger.info(`📊 Gas price: ${ethers.utils.formatUnits(conditions.gasPrice, 'gwei')} gwei`);
      logger.info(`🏗️ Latest block: ${conditions.blockNumber}`);
      logger.info(`🔗 Explorer: ${this.networkConfig.explorerBaseUrl}`);
      
      return true;
      
    } catch (error) {
      logger.error(`❌ Failed to initialize ${this.networkName} adapter: ${error.message}`);
      
      // Kasplex-specific troubleshooting hints
      if (error.message.includes('timeout') || error.message.includes('network')) {
        logger.warning('💡 Kasplex network troubleshooting:');
        logger.warning('   - Check if Kasplex testnet is operational');
        logger.warning('   - Try again in a few minutes');
        logger.warning('   - Verify RPC URL: https://rpc.kasplextest.xyz');
      }
      
      throw error;
    }
  }

  // Submit transaction with Kasplex-specific optimizations
  async submitTransaction(contract, params = []) {
    const gasOverrides = await this.getGasOverrides();
    
    return this.withRetry(async () => {
      // Create a simple test transaction for Kasplex
      const tx = {
        to: this.signer.address,
        value: ethers.utils.parseEther('0'), // No value transfer
        data: '0x', // No data for simple transaction
        ...gasOverrides
      };

      // Add timeout to sendTransaction (from deployment script pattern)
      const sendTxPromise = this.signer.sendTransaction(tx);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Transaction submission timeout after 30 seconds")), 
                   this.networkConfig.timeout);
      });
      
      const txResponse = await Promise.race([sendTxPromise, timeoutPromise]);
      
      logger.info(`📤 Kasplex transaction submitted: ${txResponse.hash}`);
      logger.info(`🔗 Explorer: ${this.networkConfig.explorerBaseUrl}/tx/${txResponse.hash}`);
      
      return txResponse;
    });
  }

  // Wait for transaction confirmation
  async waitForConfirmation(txHash, confirmations = 1) {
    return this.withRetry(async () => {
      const receipt = await this.provider.waitForTransaction(txHash, confirmations, this.networkConfig.timeout);
      
      if (!receipt) {
        throw new Error(`Transaction ${txHash} not found after confirmation wait`);
      }
      
      if (receipt.status === 0) {
        throw new Error(`Transaction ${txHash} failed with status 0`);
      }
      
      return receipt;
    });
  }

  // Get current network conditions
  async getNetworkConditions() {
    return this.withRetry(async () => {
      const blockNumber = await this.provider.getBlockNumber();
      const block = await this.provider.getBlock(blockNumber);
      const gasPrice = await this.provider.getGasPrice();
      const balance = await this.signer.getBalance();
      
      return {
        blockNumber,
        timestamp: block.timestamp,
        gasPrice: gasPrice.toString(),
        gasPriceGwei: ethers.utils.formatUnits(gasPrice, 'gwei'),
        baseFee: block.baseFeePerGas?.toString() || null,
        balance: balance.toString(),
        balanceKas: ethers.utils.formatEther(balance),
        networkCongestion: await this.estimateNetworkCongestion(block),
        currency: 'KAS'
      };
    });
  }

  // Estimate network congestion for Kasplex
  async estimateNetworkCongestion(block) {
    try {
      const gasPrice = await this.provider.getGasPrice();
      const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      
      // Get block utilization
      const gasUsedRatio = block.gasUsed && block.gasLimit ? 
        block.gasUsed.toNumber() / block.gasLimit.toNumber() : 0;
      
      // Kasplex congestion scoring (different from Ethereum)
      let congestionScore = 0;
      
      // Gas price factor (40% weight) - Kasplex uses higher base gas prices
      const baseGasPriceGwei = 2000; // Expected base for Kasplex
      if (gasPriceGwei > baseGasPriceGwei * 2) congestionScore += 40;
      else if (gasPriceGwei > baseGasPriceGwei * 1.5) congestionScore += 25;
      else if (gasPriceGwei > baseGasPriceGwei * 1.2) congestionScore += 15;
      
      // Block utilization factor (35% weight)
      congestionScore += gasUsedRatio * 35;
      
      // Network stability factor (25% weight) - Kasplex is newer network
      // Use block time consistency as a proxy for stability
      const expectedBlockTime = 1; // ~1 second for Kasplex
      const actualBlockTime = Date.now() / 1000 - block.timestamp;
      if (actualBlockTime > expectedBlockTime * 3) {
        congestionScore += 25;
      } else if (actualBlockTime > expectedBlockTime * 2) {
        congestionScore += 15;
      } else if (actualBlockTime > expectedBlockTime * 1.5) {
        congestionScore += 10;
      }
      
      return {
        score: Math.min(100, congestionScore),
        level: congestionScore > 60 ? 'high' : congestionScore > 30 ? 'medium' : 'low',
        gasPrice: gasPriceGwei,
        blockUtilization: gasUsedRatio,
        networkType: 'kasplex-l2'
      };
      
    } catch (error) {
      logger.warning(`Could not estimate Kasplex network congestion: ${error.message}`);
      return { score: 25, level: 'low', gasPrice: 2000, blockUtilization: 0, networkType: 'kasplex-l2' };
    }
  }

  // Get gas overrides using battle-tested Kasplex patterns
  async getGasOverrides() {
    try {
      const currentGasPrice = await this.provider.getGasPrice();
      const networkConditions = await this.getCurrentMevConditions();
      
      // Start with proven Kasplex gas settings
      let gasPrice = this.networkConfig.gasPrice;
      let gasLimit = this.networkConfig.gasLimit;
      
      // Adjust for current network conditions
      const mevScore = networkConditions?.currentScore || 0;
      const currentGasPriceGwei = parseFloat(ethers.utils.formatUnits(currentGasPrice, 'gwei'));
      const configGasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      
      // Kasplex-specific gas adjustments (conservative due to fast finality)
      if (currentGasPriceGwei > configGasPriceGwei * 2) {
        // Network congestion detected
        gasPrice = gasPrice.mul(150).div(100); // 50% increase
      } else if (currentGasPriceGwei > configGasPriceGwei * 1.5) {
        gasPrice = gasPrice.mul(125).div(100); // 25% increase
      }
      
      // MEV adjustment (minimal for Kasplex)
      if (mevScore > 50) {
        gasPrice = gasPrice.mul(110).div(100); // 10% increase for MEV protection
      }
      
      // Apply gas buffer from deployment script pattern
      gasLimit = Math.floor(gasLimit * this.networkConfig.gasBufferMultiplier);
      
      // Ensure we don't exceed maximum gas limit
      if (gasLimit > this.networkConfig.maxGasLimit.toNumber()) {
        gasLimit = this.networkConfig.maxGasLimit.toNumber();
      }
      
      // Ensure minimum gas price to avoid orphan transactions
      const minGasPrice = ethers.utils.parseUnits("1000", "gwei"); // Minimum 1000 gwei
      if (gasPrice.lt(minGasPrice)) {
        gasPrice = minGasPrice;
      }
      
      return {
        gasPrice,
        gasLimit: ethers.BigNumber.from(gasLimit),
        type: 0 // Legacy transaction type
      };
      
    } catch (error) {
      logger.warning(`Could not get optimal Kasplex gas overrides: ${error.message}`);
      // Fallback to network config defaults
      return {
        gasPrice: this.networkConfig.gasPrice,
        gasLimit: ethers.BigNumber.from(this.networkConfig.gasLimit),
        type: 0
      };
    }
  }

  // Get default finality thresholds (faster than Ethereum)
  getDefaultFinalityThresholds() {
    return {
      immediate: 1,
      standard: this.networkConfig.blockConfirmationTarget, // 8 blocks
      safe: this.networkConfig.blockConfirmationTarget + 2, // 10 blocks
      finalized: this.networkConfig.blockConfirmationTarget + 4 // 12 blocks
    };
  }

  // Get default gas strategies for Kasplex
  getDefaultGasStrategies() {
    return {
      economy: {
        gasPrice: this.networkConfig.gasPrice.mul(80).div(100), // 80% of base (1600 gwei)
        gasLimit: this.networkConfig.gasLimit,
        maxWaitTime: 180000 // 3 minutes
      },
      standard: {
        gasPrice: this.networkConfig.gasPrice, // 2000 gwei
        gasLimit: this.networkConfig.gasLimit,
        maxWaitTime: 120000 // 2 minutes
      },
      fast: {
        gasPrice: this.networkConfig.gasPrice.mul(125).div(100), // 125% of base (2500 gwei)
        gasLimit: this.networkConfig.gasLimit,
        maxWaitTime: 60000 // 1 minute
      },
      mevProtected: {
        gasPrice: this.networkConfig.gasPrice.mul(110).div(100), // 110% of base (2200 gwei)
        gasLimit: this.networkConfig.gasLimit,
        maxWaitTime: 90000 // 1.5 minutes
      }
    };
  }

  // Kasplex-specific retry configuration
  getDefaultRetryConfig() {
    const baseConfig = super.getDefaultRetryConfig();
    
    return {
      ...baseConfig,
      maxRetries: 4, // Fewer retries due to faster finality
      baseDelay: this.networkConfig.retryDelay, // 15 seconds
      maxDelay: 60000, // 1 minute max
      backoffMultiplier: 1.5, // Gentler backoff
      retryOnCodes: [
        'NONCE_TOO_LOW',
        'REPLACEMENT_UNDERPRICED', 
        'NETWORK_ERROR',
        'TIMEOUT',
        'SERVER_ERROR',
        'INSUFFICIENT_FUNDS',
        'CONNECTION_RESET'
      ]
    };
  }

  // Enhanced error retry detection for Kasplex
  shouldRetryError(error) {
    const errorMessage = error.message.toLowerCase();
    
    // Base retry conditions from parent
    if (super.shouldRetryError(error)) {
      return true;
    }
    
    // Kasplex-specific retry conditions
    const kasplexRetryConditions = [
      'transaction underpriced',
      'nonce too low', 
      'replacement transaction underpriced',
      'already known',
      'gas price too low',
      'insufficient funds',
      'timeout',
      'connection reset',
      'network error',
      'rpc error',
      'kaspa',
      'kasplex'
    ];
    
    return kasplexRetryConditions.some(condition => 
      errorMessage.includes(condition)
    );
  }

  // Get Kasplex-specific explorer URLs
  getExplorerUrl(txHash = null, address = null) {
    const baseUrl = this.networkConfig.explorerBaseUrl;
    
    if (txHash) {
      return `${baseUrl}/tx/${txHash}`;
    } else if (address) {
      return `${baseUrl}/address/${address}`;
    } else {
      return baseUrl;
    }
  }

  // Estimate transaction cost in USD (simplified)
  async estimateCostUSD(gasUsed) {
    try {
      const gasPrice = this.networkConfig.gasPrice;
      const costKAS = gasUsed * parseFloat(ethers.utils.formatUnits(gasPrice, 'ether'));
      
      // Simplified KAS to USD conversion (would need real price feed)
      const kasToUsd = 0.1; // Approximate placeholder
      return costKAS * kasToUsd;
      
    } catch (error) {
      logger.warning(`Could not estimate USD cost: ${error.message}`);
      return 0;
    }
  }

  // Export adapter state for debugging
  exportState() {
    const baseState = super.exportState();
    
    return {
      ...baseState,
      kasplexSpecific: {
        networkConfig: this.networkConfig,
        expectedChainId: this.expectedChainId,
        currency: this.currency,
        explorerBaseUrl: this.networkConfig.explorerBaseUrl,
        faucetUrls: this.networkConfig.faucetUrls,
        gasPriceGwei: ethers.utils.formatUnits(this.networkConfig.gasPrice, 'gwei')
      }
    };
  }
}

module.exports = { KasplexAdapter };