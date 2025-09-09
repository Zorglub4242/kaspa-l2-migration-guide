const { logger } = require('../utils/logger');
const { PrecisionTimer } = require('../utils/PrecisionTimer');
const { MevActivityMonitor } = require('../mev/MevActivityMonitor');
const { ReorganizationMonitor } = require('../mev/ReorganizationMonitor');

/**
 * Base Network Adapter - Abstract interface with MEV awareness
 * All network-specific adapters extend this class
 */
class BaseNetworkAdapter {
  constructor(networkName, rpcUrl, privateKey) {
    this.networkName = networkName;
    this.rpcUrl = rpcUrl;
    this.privateKey = privateKey;
    
    // Will be initialized by subclasses
    this.provider = null;
    this.signer = null;
    this.chainId = null;
    
    // MEV and monitoring components
    this.mevMonitor = null;
    this.reorgMonitor = null;
    
    // Network-specific configurations - initialized by subclasses
    this.finalityThresholds = null;
    this.gasStrategies = null;
    this.retryConfig = null;
    
    // Performance tracking
    this.stats = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalFinalityTime: 0,
      mevAdjustments: 0
    };
  }

  // Abstract methods that must be implemented by subclasses
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  async submitTransaction(contract, params) {
    throw new Error('submitTransaction() must be implemented by subclass');
  }

  async waitForConfirmation(txHash, confirmations = 1) {
    throw new Error('waitForConfirmation() must be implemented by subclass');
  }

  async getNetworkConditions() {
    throw new Error('getNetworkConditions() must be implemented by subclass');
  }

  getDefaultFinalityThresholds() {
    throw new Error('getDefaultFinalityThresholds() must be implemented by subclass');
  }

  getDefaultGasStrategies() {
    throw new Error('getDefaultGasStrategies() must be implemented by subclass');
  }

  // Common MEV-aware finality measurement
  async measureFinality(txHash, customThreshold = null) {
    const startTime = PrecisionTimer.now();
    const measurement = {
      txHash,
      networkName: this.networkName,
      startTime,
      customThreshold,
      phases: {}
    };

    try {
      // Get MEV conditions at start
      const initialMevConditions = this.mevMonitor ? 
        await this.mevMonitor.getCurrentMevConditions() : 
        { currentScore: 0, riskLevel: 'minimal' };

      measurement.initialMevConditions = initialMevConditions;

      // Phase 1: Wait for initial confirmation
      const confirmationStart = PrecisionTimer.now();
      const receipt = await this.waitForConfirmation(txHash, 1);
      const confirmationTime = PrecisionTimer.elapsedMs(confirmationStart);
      
      measurement.phases.initialConfirmation = {
        time: confirmationTime,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString()
      };

      // Determine finality threshold (possibly adjusted for MEV)
      const baseThreshold = customThreshold || this.finalityThresholds.standard;
      const adjustedThreshold = this.adjustThresholdForMev(baseThreshold, initialMevConditions);
      
      measurement.baseThreshold = baseThreshold;
      measurement.adjustedThreshold = adjustedThreshold;
      measurement.mevAdjustment = adjustedThreshold - baseThreshold;

      // Phase 2: Wait for finality
      const finalityStart = PrecisionTimer.now();
      await this.waitForConfirmation(txHash, adjustedThreshold);
      const finalityTime = PrecisionTimer.elapsedMs(finalityStart);

      measurement.phases.finality = {
        time: finalityTime,
        threshold: adjustedThreshold,
        totalConfirmations: adjustedThreshold
      };

      // Check for reorganizations during finality period
      if (this.reorgMonitor) {
        const reorgCheck = await this.reorgMonitor.detectReorganization(txHash, receipt.blockNumber);
        measurement.reorganizationDetected = reorgCheck.reorgDetected;
        if (reorgCheck.reorgDetected) {
          measurement.reorganizationDetails = reorgCheck.reorgEvent;
          logger.warning(`🔄 Reorganization detected during finality measurement: ${txHash}`);
        }
      }

      // Get final MEV conditions
      const finalMevConditions = this.mevMonitor ? 
        await this.mevMonitor.getCurrentMevConditions() : 
        { currentScore: 0, riskLevel: 'minimal' };

      measurement.finalMevConditions = finalMevConditions;

      // Calculate total times
      const totalTime = PrecisionTimer.elapsedMs(startTime);
      measurement.totalTime = totalTime;
      measurement.confirmationTime = confirmationTime;
      measurement.finalityTime = finalityTime;

      // Update statistics
      this.updateStats(measurement);

      logger.success(`✅ Finality measured: ${this.networkName} - ${finalityTime.toFixed(2)}ms (${adjustedThreshold} confirmations)`);
      
      return measurement;

    } catch (error) {
      const totalTime = PrecisionTimer.elapsedMs(startTime);
      const failedMeasurement = {
        ...measurement,
        error: error.message,
        failed: true,
        totalTime
      };

      this.stats.failedTransactions++;
      logger.error(`❌ Finality measurement failed: ${this.networkName} - ${error.message}`);
      
      return failedMeasurement;
    }
  }

  // Adjust finality threshold based on MEV conditions
  adjustThresholdForMev(baseThreshold, mevConditions) {
    const mevScore = mevConditions.currentScore || 0;
    
    if (mevScore >= 80) {
      return baseThreshold + 8; // High MEV: +8 blocks
    } else if (mevScore >= 60) {
      return baseThreshold + 5; // Medium-high MEV: +5 blocks
    } else if (mevScore >= 40) {
      return baseThreshold + 2; // Medium MEV: +2 blocks
    } else {
      return baseThreshold; // Low MEV: no adjustment
    }
  }

  // Initialize MEV monitoring
  async initializeMevMonitoring() {
    if (!this.provider) {
      throw new Error('Provider must be initialized before MEV monitoring');
    }

    this.mevMonitor = new MevActivityMonitor(this.networkName, this.provider);
    this.reorgMonitor = new ReorganizationMonitor(this.networkName, this.provider);

    // Start monitoring
    await this.mevMonitor.startMonitoring();
    await this.reorgMonitor.startMonitoring();

    logger.info(`🤖 MEV monitoring initialized for ${this.networkName}`);
  }

  // Stop MEV monitoring
  stopMevMonitoring() {
    if (this.mevMonitor) {
      this.mevMonitor.stopMonitoring();
    }
    if (this.reorgMonitor) {
      this.reorgMonitor.stopMonitoring();
    }
    logger.info(`🤖 MEV monitoring stopped for ${this.networkName}`);
  }

  // Get default retry configuration
  getDefaultRetryConfig() {
    return {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryOnCodes: ['NONCE_TOO_LOW', 'REPLACEMENT_UNDERPRICED', 'NETWORK_ERROR']
    };
  }

  // Retry mechanism with exponential backoff (reusing existing patterns)
  async withRetry(operation, config = {}) {
    const retryConfig = { ...this.retryConfig, ...config };
    const { maxRetries, baseDelay, backoffMultiplier } = retryConfig;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        const shouldRetry = this.shouldRetryError(error);
        if (!shouldRetry) {
          throw error;
        }

        const delay = Math.min(
          baseDelay * Math.pow(backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        );

        logger.warning(`🔄 Retry attempt ${attempt}/${maxRetries} in ${delay}ms: ${error.message}`);
        await PrecisionTimer.sleep(delay);
      }
    }
  }

  // Determine if error should trigger retry
  shouldRetryError(error) {
    const errorMessage = error.message.toLowerCase();
    
    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return true;
    }
    
    // Nonce errors
    if (errorMessage.includes('nonce')) {
      return true;
    }
    
    // Gas price errors
    if (errorMessage.includes('underpriced') || errorMessage.includes('replacement')) {
      return true;
    }
    
    return false;
  }

  // Update performance statistics
  updateStats(measurement) {
    this.stats.totalTransactions++;
    
    if (measurement.failed) {
      this.stats.failedTransactions++;
    } else {
      this.stats.successfulTransactions++;
      this.stats.totalFinalityTime += measurement.finalityTime;
      
      if (measurement.mevAdjustment > 0) {
        this.stats.mevAdjustments++;
      }
    }
  }

  // Get performance statistics
  getStats() {
    const stats = { ...this.stats };
    
    if (stats.successfulTransactions > 0) {
      stats.averageFinalityTime = stats.totalFinalityTime / stats.successfulTransactions;
      stats.successRate = (stats.successfulTransactions / stats.totalTransactions) * 100;
      stats.mevAdjustmentRate = (stats.mevAdjustments / stats.successfulTransactions) * 100;
    } else {
      stats.averageFinalityTime = 0;
      stats.successRate = 0;
      stats.mevAdjustmentRate = 0;
    }
    
    return stats;
  }

  // Get current MEV conditions
  async getCurrentMevConditions() {
    return this.mevMonitor ? await this.mevMonitor.getCurrentMevConditions() : null;
  }

  // Get reorganization statistics
  getReorganizationStats() {
    return this.reorgMonitor ? this.reorgMonitor.getReorganizationStats() : null;
  }

  // Health check
  async healthCheck() {
    const health = {
      network: this.networkName,
      rpcConnected: false,
      blockNumber: null,
      chainId: null,
      mevMonitoring: false,
      lastError: null
    };

    try {
      // Test RPC connection
      const blockNumber = await this.provider.getBlockNumber();
      const network = await this.provider.getNetwork();
      
      health.rpcConnected = true;
      health.blockNumber = blockNumber;
      health.chainId = network.chainId;
      health.mevMonitoring = this.mevMonitor && this.mevMonitor.monitoringActive;
      
    } catch (error) {
      health.lastError = error.message;
    }

    return health;
  }

  // Cleanup resources
  async cleanup() {
    this.stopMevMonitoring();
    
    if (this.provider && this.provider.removeAllListeners) {
      this.provider.removeAllListeners();
    }
    
    logger.info(`🧹 Cleaned up resources for ${this.networkName}`);
  }

  // Export adapter state for debugging
  exportState() {
    return {
      networkName: this.networkName,
      rpcUrl: this.rpcUrl,
      chainId: this.chainId,
      finalityThresholds: this.finalityThresholds,
      gasStrategies: this.gasStrategies,
      stats: this.getStats(),
      mevData: this.mevMonitor ? this.mevMonitor.exportMevData() : null,
      reorgData: this.reorgMonitor ? this.reorgMonitor.exportReorgData() : null,
      exportTimestamp: new Date().toISOString()
    };
  }
}

module.exports = { BaseNetworkAdapter };