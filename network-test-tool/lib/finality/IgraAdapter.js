const { ethers } = require('ethers');
const { BaseNetworkAdapter } = require('./BaseNetworkAdapter');
const { logger } = require('../utils/logger');

/**
 * Igra Network Adapter - Extends BaseNetworkAdapter for Igra Network
 * Implements network-specific gas strategies and transaction patterns
 * 
 * Note: Igra-specific configurations are inferred from general patterns
 * as no specific Igra configuration was found in the existing codebase.
 */
class IgraAdapter extends BaseNetworkAdapter {
  constructor(networkName, rpcUrl, privateKey, chainId = null) {
    super(networkName, rpcUrl, privateKey);
    this.expectedChainId = chainId;
    this.currency = 'ETH'; // Assuming ETH-compatible
    
    // Igra-specific configurations (inferred from Ethereum patterns)
    this.networkConfig = this.getNetworkConfig();
    
    // Reinitialize finality thresholds and gas strategies with proper config
    this.finalityThresholds = this.getDefaultFinalityThresholds();
    this.gasStrategies = this.getDefaultGasStrategies();
    this.retryConfig = this.getDefaultRetryConfig();
  }

  // Get network-specific configuration
  getNetworkConfig() {
    // Default Igra configuration based on typical L2 patterns
    const baseConfig = {
      name: 'igra',
      chainId: this.expectedChainId || 421614, // Placeholder chain ID
      gasPrice: ethers.utils.parseUnits("10", "gwei"), // Conservative 10 gwei
      gasLimit: 2000000, // 2M gas limit
      baseFeeMultiplier: 1.1,
      priorityFeeMultiplier: 1.05,
      blockConfirmationTarget: 6, // Fast L2 finality
      mevBaseline: 25, // Moderate MEV activity assumption
      timeout: 45000, // 45 second timeout
      retryDelay: 20000 // 20 second retry delay
    };

    // Network-specific configurations based on chain ID (if available)
    const knownNetworks = {
      421614: { // Arbitrum Sepolia (example)
        name: 'igra-testnet',
        gasPrice: ethers.utils.parseUnits("0.1", "gwei"),
        blockConfirmationTarget: 3
      },
      42161: { // Arbitrum One (example)
        name: 'igra-mainnet', 
        gasPrice: ethers.utils.parseUnits("0.25", "gwei"),
        blockConfirmationTarget: 5,
        mevBaseline: 40
      }
    };

    const specificConfig = knownNetworks[this.expectedChainId];
    return specificConfig ? { ...baseConfig, ...specificConfig } : baseConfig;
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
      
      // Update network config if we detected a different chain
      if (this.expectedChainId && this.chainId !== this.expectedChainId) {
        logger.warning(`Expected chain ID ${this.expectedChainId}, got ${this.chainId}`);
        // Update config for detected chain
        this.networkConfig = this.getNetworkConfigForChainId(this.chainId);
      }
      
      // Check balance
      const balance = await this.signer.getBalance();
      const minBalance = ethers.utils.parseEther("0.01"); // 0.01 ETH minimum
      
      if (balance.lt(minBalance)) {
        logger.warning(`⚠️ Low balance: ${ethers.utils.formatEther(balance)} ${this.currency}`);
        logger.warning(`💡 Ensure you have sufficient ${this.currency} for testing`);
      }
      
      // Get initial network conditions
      const conditions = await this.getNetworkConditions();
      
      logger.success(`✅ Initialized ${this.networkName} adapter (Chain ID: ${this.chainId})`);
      logger.info(`💰 Balance: ${ethers.utils.formatEther(balance)} ${this.currency}`);
      logger.info(`📊 Gas price: ${ethers.utils.formatUnits(conditions.gasPrice, 'gwei')} gwei`);
      logger.info(`🏗️ Latest block: ${conditions.blockNumber}`);
      
      return true;
      
    } catch (error) {
      logger.error(`❌ Failed to initialize ${this.networkName} adapter: ${error.message}`);
      
      // Generic troubleshooting hints for L2 networks
      if (error.message.includes('timeout') || error.message.includes('network')) {
        logger.warning('💡 Igra network troubleshooting:');
        logger.warning('   - Check if network is operational');
        logger.warning('   - Verify RPC URL is correct');
        logger.warning('   - Try again in a few minutes');
      }
      
      throw error;
    }
  }

  // Get network configuration for detected chain ID
  getNetworkConfigForChainId(chainId) {
    // Known L2 configurations that might be Igra-compatible
    const l2Configs = {
      10: { // Optimism
        name: 'optimism',
        gasPrice: ethers.utils.parseUnits("0.001", "gwei"),
        blockConfirmationTarget: 3,
        mevBaseline: 15
      },
      42161: { // Arbitrum One
        name: 'arbitrum',
        gasPrice: ethers.utils.parseUnits("0.1", "gwei"),
        blockConfirmationTarget: 3,
        mevBaseline: 20
      },
      137: { // Polygon
        name: 'polygon',
        gasPrice: ethers.utils.parseUnits("30", "gwei"),
        blockConfirmationTarget: 5,
        mevBaseline: 35
      },
      100: { // Gnosis
        name: 'gnosis',
        gasPrice: ethers.utils.parseUnits("2", "gwei"),
        blockConfirmationTarget: 4,
        mevBaseline: 10
      }
    };

    const config = l2Configs[chainId];
    if (config) {
      return {
        ...this.networkConfig,
        ...config,
        chainId
      };
    }

    // Default for unknown chain IDs
    return {
      ...this.networkConfig,
      name: `igra-${chainId}`,
      chainId
    };
  }

  // Submit transaction with Igra-specific optimizations
  async submitTransaction(contract, params = []) {
    const gasOverrides = await this.getGasOverrides();
    
    return this.withRetry(async () => {
      // Create a simple test transaction
      const tx = {
        to: this.signer.address,
        value: ethers.utils.parseEther('0'), // No value transfer
        data: '0x', // No data for simple transaction
        ...gasOverrides
      };

      // Add timeout to sendTransaction
      const sendTxPromise = this.signer.sendTransaction(tx);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Transaction submission timeout")), 
                   this.networkConfig.timeout);
      });
      
      const txResponse = await Promise.race([sendTxPromise, timeoutPromise]);
      
      logger.info(`📤 Igra transaction submitted: ${txResponse.hash}`);
      
      return txResponse;
    });
  }

  // Wait for transaction confirmation
  async waitForConfirmation(txHash, confirmations = 1) {
    return this.withRetry(async () => {
      const receipt = await this.provider.waitForTransaction(
        txHash, 
        confirmations, 
        this.networkConfig.timeout
      );
      
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
        balanceEth: ethers.utils.formatEther(balance),
        networkCongestion: await this.estimateNetworkCongestion(block),
        currency: this.currency
      };
    });
  }

  // Estimate network congestion for Igra/L2
  async estimateNetworkCongestion(block) {
    try {
      const gasPrice = await this.provider.getGasPrice();
      const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      
      // Get block utilization
      const gasUsedRatio = block.gasUsed && block.gasLimit ? 
        block.gasUsed.toNumber() / block.gasLimit.toNumber() : 0;
      
      // L2 congestion scoring (different from L1)
      let congestionScore = 0;
      
      // Gas price factor (30% weight) - L2s typically have low gas prices
      const baseGasPriceGwei = parseFloat(ethers.utils.formatUnits(this.networkConfig.gasPrice, 'gwei'));
      if (gasPriceGwei > baseGasPriceGwei * 3) congestionScore += 30;
      else if (gasPriceGwei > baseGasPriceGwei * 2) congestionScore += 20;
      else if (gasPriceGwei > baseGasPriceGwei * 1.5) congestionScore += 10;
      
      // Block utilization factor (50% weight)
      congestionScore += gasUsedRatio * 50;
      
      // Network responsiveness factor (20% weight)
      const expectedBlockTime = 2; // ~2 seconds for typical L2
      const actualBlockTime = Date.now() / 1000 - block.timestamp;
      if (actualBlockTime > expectedBlockTime * 4) {
        congestionScore += 20;
      } else if (actualBlockTime > expectedBlockTime * 2) {
        congestionScore += 10;
      }
      
      return {
        score: Math.min(100, congestionScore),
        level: congestionScore > 60 ? 'high' : congestionScore > 30 ? 'medium' : 'low',
        gasPrice: gasPriceGwei,
        blockUtilization: gasUsedRatio,
        networkType: 'igra-l2'
      };
      
    } catch (error) {
      logger.warning(`Could not estimate Igra network congestion: ${error.message}`);
      return { score: 30, level: 'low', gasPrice: 10, blockUtilization: 0, networkType: 'igra-l2' };
    }
  }

  // Get gas overrides with L2 optimizations
  async getGasOverrides() {
    try {
      const currentGasPrice = await this.provider.getGasPrice();
      const networkConditions = await this.getCurrentMevConditions();
      
      // Start with network config defaults
      let gasPrice = this.networkConfig.gasPrice;
      let gasLimit = this.networkConfig.gasLimit;
      
      // Adjust for current conditions
      const mevScore = networkConditions?.currentScore || 0;
      const currentGasPriceGwei = parseFloat(ethers.utils.formatUnits(currentGasPrice, 'gwei'));
      const configGasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      
      // L2-style gas adjustments (more conservative)
      if (currentGasPriceGwei > configGasPriceGwei * 2) {
        gasPrice = gasPrice.mul(130).div(100); // 30% increase
      } else if (currentGasPriceGwei > configGasPriceGwei * 1.5) {
        gasPrice = gasPrice.mul(115).div(100); // 15% increase
      }
      
      // MEV adjustment (conservative for L2)
      if (mevScore > 60) {
        gasPrice = gasPrice.mul(110).div(100); // 10% increase
      } else if (mevScore > 40) {
        gasPrice = gasPrice.mul(105).div(100); // 5% increase
      }
      
      // Ensure minimum gas price
      const minGasPrice = ethers.utils.parseUnits("0.001", "gwei"); // Very low for L2
      if (gasPrice.lt(minGasPrice)) {
        gasPrice = minGasPrice;
      }
      
      return {
        gasPrice,
        gasLimit: ethers.BigNumber.from(gasLimit),
        type: 2 // EIP-1559 transaction type (if supported)
      };
      
    } catch (error) {
      logger.warning(`Could not get optimal Igra gas overrides: ${error.message}`);
      // Fallback to network config defaults
      return {
        gasPrice: this.networkConfig.gasPrice,
        gasLimit: ethers.BigNumber.from(this.networkConfig.gasLimit),
        type: 0 // Legacy transaction type
      };
    }
  }

  // Get default finality thresholds (fast L2 finality)
  getDefaultFinalityThresholds() {
    return {
      immediate: 1,
      standard: this.networkConfig.blockConfirmationTarget, // 6 blocks
      safe: this.networkConfig.blockConfirmationTarget + 2, // 8 blocks
      finalized: this.networkConfig.blockConfirmationTarget + 4 // 10 blocks
    };
  }

  // Get default gas strategies for Igra/L2
  getDefaultGasStrategies() {
    return {
      economy: {
        gasPrice: this.networkConfig.gasPrice.mul(80).div(100), // 80% of base
        gasLimit: this.networkConfig.gasLimit,
        maxWaitTime: 240000 // 4 minutes
      },
      standard: {
        gasPrice: this.networkConfig.gasPrice,
        gasLimit: this.networkConfig.gasLimit,
        maxWaitTime: 180000 // 3 minutes
      },
      fast: {
        gasPrice: this.networkConfig.gasPrice.mul(120).div(100), // 120% of base
        gasLimit: this.networkConfig.gasLimit,
        maxWaitTime: 90000 // 1.5 minutes
      },
      mevProtected: {
        gasPrice: this.networkConfig.gasPrice.mul(110).div(100), // 110% of base
        gasLimit: this.networkConfig.gasLimit,
        maxWaitTime: 120000 // 2 minutes
      }
    };
  }

  // L2-specific retry configuration
  getDefaultRetryConfig() {
    const baseConfig = super.getDefaultRetryConfig();
    
    return {
      ...baseConfig,
      maxRetries: 4, // Fewer retries for fast L2
      baseDelay: this.networkConfig.retryDelay, // 20 seconds
      maxDelay: 90000, // 1.5 minutes max
      backoffMultiplier: 1.6,
      retryOnCodes: [
        'NONCE_TOO_LOW',
        'REPLACEMENT_UNDERPRICED', 
        'NETWORK_ERROR',
        'TIMEOUT',
        'SERVER_ERROR',
        'INSUFFICIENT_FUNDS',
        'CONNECTION_FAILED',
        'L2_ERROR'
      ]
    };
  }

  // Enhanced error retry detection for Igra/L2
  shouldRetryError(error) {
    const errorMessage = error.message.toLowerCase();
    
    // Base retry conditions from parent
    if (super.shouldRetryError(error)) {
      return true;
    }
    
    // L2-specific retry conditions
    const l2RetryConditions = [
      'transaction underpriced',
      'nonce too low',
      'replacement transaction underpriced',
      'already known',
      'gas price too low',
      'insufficient funds',
      'timeout',
      'connection',
      'network error',
      'rpc error',
      'l2 error',
      'sequencer',
      'batch'
    ];
    
    return l2RetryConditions.some(condition => 
      errorMessage.includes(condition)
    );
  }

  // Export adapter state for debugging
  exportState() {
    const baseState = super.exportState();
    
    return {
      ...baseState,
      igraSpecific: {
        networkConfig: this.networkConfig,
        expectedChainId: this.expectedChainId,
        currency: this.currency,
        networkType: 'L2',
        gasPriceGwei: ethers.utils.formatUnits(this.networkConfig.gasPrice, 'gwei')
      }
    };
  }
}

module.exports = { IgraAdapter };