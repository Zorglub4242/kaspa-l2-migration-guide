const { ethers } = require('ethers');
const { BaseNetworkAdapter } = require('./BaseNetworkAdapter');
const { logger } = require('../utils/logger');

/**
 * Ethereum Network Adapter - Extends BaseNetworkAdapter for Ethereum/Sepolia
 * Implements network-specific gas strategies and transaction patterns
 */
class EthereumAdapter extends BaseNetworkAdapter {
  constructor(networkName, rpcUrl, privateKey, chainId = null) {
    // Set network config first before calling super
    const tempConfig = networkName && rpcUrl && privateKey;
    
    super(networkName, rpcUrl, privateKey);
    this.expectedChainId = chainId;
    this.currency = 'ETH';
    
    // Ethereum-specific configurations
    this.networkConfig = this.getNetworkConfig();
    
    // Reinitialize finality thresholds and gas strategies with proper config
    this.finalityThresholds = this.getDefaultFinalityThresholds();
    this.gasStrategies = this.getDefaultGasStrategies();
    this.retryConfig = this.getDefaultRetryConfig();
  }

  // Get network-specific configuration
  getNetworkConfig() {
    // Detect network based on chain ID or name
    if (this.expectedChainId === 11155111 || this.networkName.toLowerCase().includes('sepolia')) {
      return {
        name: 'sepolia',
        chainId: 11155111,
        gasPrice: ethers.utils.parseUnits("25", "gwei"), // Battle-tested from existing scripts
        gasLimit: 5000000,
        baseFeeMultiplier: 2.0,
        priorityFeeMultiplier: 1.2,
        blockConfirmationTarget: 12, // Standard Ethereum finality
        mevBaseline: 40 // Sepolia has moderate MEV activity
      };
    } else if (this.expectedChainId === 1 || this.networkName.toLowerCase().includes('mainnet')) {
      return {
        name: 'mainnet',
        chainId: 1,
        gasPrice: ethers.utils.parseUnits("30", "gwei"), // Higher for mainnet
        gasLimit: 500000,
        baseFeeMultiplier: 1.25,
        priorityFeeMultiplier: 1.1,
        blockConfirmationTarget: 15, // Conservative for mainnet
        mevBaseline: 70 // Mainnet has high MEV activity
      };
    } else {
      // Generic Ethereum-compatible network
      return {
        name: 'ethereum-compatible',
        chainId: this.expectedChainId,
        gasPrice: ethers.utils.parseUnits("20", "gwei"),
        gasLimit: 1000000,
        baseFeeMultiplier: 1.5,
        priorityFeeMultiplier: 1.15,
        blockConfirmationTarget: 12,
        mevBaseline: 30
      };
    }
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
      }
      
      // Update network config based on actual chain ID
      if (this.chainId !== this.networkConfig.chainId) {
        this.networkConfig = this.getNetworkConfigForChainId(this.chainId);
      }
      
      // Get initial network conditions
      const conditions = await this.getNetworkConditions();
      
      logger.success(`✅ Initialized ${this.networkName} adapter (Chain ID: ${this.chainId})`);
      logger.info(`📊 Current gas price: ${ethers.utils.formatUnits(conditions.gasPrice, 'gwei')} gwei`);
      logger.info(`🏗️ Latest block: ${conditions.blockNumber}`);
      
      return true;
      
    } catch (error) {
      logger.error(`❌ Failed to initialize ${this.networkName} adapter: ${error.message}`);
      throw error;
    }
  }

  // Get network configuration for detected chain ID
  getNetworkConfigForChainId(chainId) {
    const configs = {
      1: { // Mainnet
        name: 'mainnet',
        gasPrice: ethers.utils.parseUnits("30", "gwei"),
        gasLimit: 500000,
        baseFeeMultiplier: 1.25,
        priorityFeeMultiplier: 1.1,
        blockConfirmationTarget: 15,
        mevBaseline: 70
      },
      11155111: { // Sepolia
        name: 'sepolia',
        gasPrice: ethers.utils.parseUnits("25", "gwei"),
        gasLimit: 5000000,
        baseFeeMultiplier: 2.0,
        priorityFeeMultiplier: 1.2,
        blockConfirmationTarget: 12,
        mevBaseline: 40
      },
      5: { // Goerli (deprecated but might be used)
        name: 'goerli',
        gasPrice: ethers.utils.parseUnits("20", "gwei"),
        gasLimit: 8000000,
        baseFeeMultiplier: 1.5,
        priorityFeeMultiplier: 1.15,
        blockConfirmationTarget: 10,
        mevBaseline: 35
      }
    };

    return configs[chainId] || {
      name: `ethereum-${chainId}`,
      gasPrice: ethers.utils.parseUnits("20", "gwei"),
      gasLimit: 1000000,
      baseFeeMultiplier: 1.5,
      priorityFeeMultiplier: 1.15,
      blockConfirmationTarget: 12,
      mevBaseline: 30
    };
  }

  // Submit transaction with Ethereum-specific optimizations
  async submitTransaction(contract, params = []) {
    const gasOverrides = await this.getGasOverrides();
    
    return this.withRetry(async () => {
      // Create a simple increment transaction for testing
      // In a real implementation, this would use the provided contract
      const tx = {
        to: this.signer.address,
        value: ethers.utils.parseEther('0'), // No value transfer
        data: '0x', // No data for simple transaction
        ...gasOverrides
      };

      const txResponse = await this.signer.sendTransaction(tx);
      
      logger.info(`📤 Transaction submitted: ${txResponse.hash}`);
      return txResponse;
    });
  }

  // Wait for transaction confirmation
  async waitForConfirmation(txHash, confirmations = 1) {
    return this.withRetry(async () => {
      const receipt = await this.provider.waitForTransaction(txHash, confirmations);
      
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
        networkCongestion: await this.estimateNetworkCongestion(block)
      };
    });
  }

  // Estimate network congestion based on gas prices and block utilization
  async estimateNetworkCongestion(block) {
    try {
      const gasPrice = await this.provider.getGasPrice();
      const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      
      // Get block utilization
      const gasUsedRatio = block.gasUsed && block.gasLimit ? 
        block.gasUsed.toNumber() / block.gasLimit.toNumber() : 0;
      
      // Congestion scoring (0-100)
      let congestionScore = 0;
      
      // Gas price factor (30% weight)
      if (gasPriceGwei > 100) congestionScore += 30;
      else if (gasPriceGwei > 50) congestionScore += 20;
      else if (gasPriceGwei > 20) congestionScore += 10;
      
      // Block utilization factor (40% weight)
      congestionScore += gasUsedRatio * 40;
      
      // Historical comparison (30% weight)
      const avgGasPrice = this.networkConfig.gasPrice;
      const avgGasPriceGwei = parseFloat(ethers.utils.formatUnits(avgGasPrice, 'gwei'));
      if (gasPriceGwei > avgGasPriceGwei * 1.5) {
        congestionScore += 20;
      } else if (gasPriceGwei > avgGasPriceGwei * 1.2) {
        congestionScore += 10;
      }
      
      return {
        score: Math.min(100, congestionScore),
        level: congestionScore > 70 ? 'high' : congestionScore > 40 ? 'medium' : 'low',
        gasPrice: gasPriceGwei,
        blockUtilization: gasUsedRatio
      };
      
    } catch (error) {
      logger.warning(`Could not estimate network congestion: ${error.message}`);
      return { score: 50, level: 'unknown', gasPrice: 0, blockUtilization: 0 };
    }
  }

  // Get gas overrides using battle-tested patterns
  async getGasOverrides() {
    try {
      const currentGasPrice = await this.provider.getGasPrice();
      const networkConditions = await this.getCurrentMevConditions();
      
      let gasPrice = this.networkConfig.gasPrice;
      let gasLimit = this.networkConfig.gasLimit;
      
      // Adjust gas price based on current conditions and MEV
      const mevScore = networkConditions?.currentScore || 0;
      let gasMultiplier = 1.0;
      
      // Base adjustment for current network conditions
      const currentGasPriceGwei = parseFloat(ethers.utils.formatUnits(currentGasPrice, 'gwei'));
      const configGasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      
      if (currentGasPriceGwei > configGasPriceGwei * 1.5) {
        gasMultiplier = 1.3; // Network is congested
      } else if (currentGasPriceGwei > configGasPriceGwei * 1.2) {
        gasMultiplier = 1.15;
      }
      
      // MEV-based adjustment (following existing patterns)
      if (mevScore > 70) {
        gasMultiplier *= 1.25; // High MEV activity
      } else if (mevScore > 50) {
        gasMultiplier *= 1.1; // Moderate MEV activity
      }
      
      // Apply multiplier to gas price
      gasPrice = gasPrice.mul(Math.round(gasMultiplier * 100)).div(100);
      
      // Ensure minimum gas price (avoid orphan transactions like in existing scripts)
      const minGasPrice = ethers.utils.parseUnits("2", "gwei"); // Minimum 2 gwei
      if (gasPrice.lt(minGasPrice)) {
        gasPrice = minGasPrice;
      }
      
      return {
        gasPrice,
        gasLimit,
        type: 0 // Legacy transaction type for compatibility
      };
      
    } catch (error) {
      logger.warning(`Could not get optimal gas overrides: ${error.message}`);
      // Fallback to network config defaults
      return {
        gasPrice: this.networkConfig.gasPrice,
        gasLimit: this.networkConfig.gasLimit,
        type: 0
      };
    }
  }

  // Get default finality thresholds
  getDefaultFinalityThresholds() {
    return {
      immediate: 1,
      standard: this.networkConfig.blockConfirmationTarget,
      safe: this.networkConfig.blockConfirmationTarget + 3,
      finalized: this.networkConfig.blockConfirmationTarget + 8
    };
  }

  // Get default gas strategies
  getDefaultGasStrategies() {
    return {
      economy: {
        gasPrice: this.networkConfig.gasPrice.mul(80).div(100), // 80% of base
        gasLimit: this.networkConfig.gasLimit,
        maxWaitTime: 300000 // 5 minutes
      },
      standard: {
        gasPrice: this.networkConfig.gasPrice,
        gasLimit: this.networkConfig.gasLimit,
        maxWaitTime: 180000 // 3 minutes
      },
      fast: {
        gasPrice: this.networkConfig.gasPrice.mul(130).div(100), // 130% of base
        gasLimit: this.networkConfig.gasLimit,
        maxWaitTime: 60000 // 1 minute
      },
      mevProtected: {
        gasPrice: this.networkConfig.gasPrice.mul(150).div(100), // 150% of base
        gasLimit: Math.floor(this.networkConfig.gasLimit * 1.1), // 110% of base limit
        maxWaitTime: 90000 // 1.5 minutes
      }
    };
  }

  // Network-specific retry configuration
  getDefaultRetryConfig() {
    const baseConfig = super.getDefaultRetryConfig();
    
    return {
      ...baseConfig,
      // Ethereum-specific retry settings
      maxRetries: 5, // Based on successful retry-enhanced script
      baseDelay: 30000, // 30 seconds base delay (from existing script)
      maxDelay: 120000, // 2 minutes max
      backoffMultiplier: 2,
      retryOnCodes: [
        'NONCE_TOO_LOW',
        'REPLACEMENT_UNDERPRICED', 
        'NETWORK_ERROR',
        'TIMEOUT',
        'SERVER_ERROR',
        'INSUFFICIENT_FUNDS'
      ]
    };
  }

  // Enhanced error retry detection for Ethereum
  shouldRetryError(error) {
    const errorMessage = error.message.toLowerCase();
    
    // Base retry conditions from parent
    if (super.shouldRetryError(error)) {
      return true;
    }
    
    // Ethereum-specific retry conditions
    const ethereumRetryConditions = [
      'transaction underpriced',
      'nonce too low',
      'replacement transaction underpriced',
      'already known',
      'gas price too low',
      'insufficient funds for gas * price + value',
      'max fee per gas less than block base fee',
      'timeout',
      'connection reset',
      'socket hang up'
    ];
    
    return ethereumRetryConditions.some(condition => 
      errorMessage.includes(condition)
    );
  }

  // Export adapter state for debugging
  exportState() {
    const baseState = super.exportState();
    
    return {
      ...baseState,
      ethereumSpecific: {
        networkConfig: this.networkConfig,
        expectedChainId: this.expectedChainId,
        currency: this.currency,
        currentGasStrategy: 'standard'
      }
    };
  }
}

module.exports = { EthereumAdapter };