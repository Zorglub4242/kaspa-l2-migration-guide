const { logger } = require('../utils/logger');
const { PrecisionTimer } = require('../utils/PrecisionTimer');

/**
 * Reorganization Monitor - Detects MEV-related block reorganizations
 * Monitors block hash changes and assesses MEV causation
 */
class ReorganizationMonitor {
  constructor(networkName, provider) {
    this.networkName = networkName;
    this.provider = provider;
    this.blockHashCache = new Map(); // blockNumber -> blockHash
    this.reorgEvents = [];
    this.monitoringDepth = 20; // Monitor last 20 blocks for reorgs
    this.pollingInterval = 5000; // 5 seconds
    this.isMonitoring = false;
  }

  // Start monitoring for reorganizations
  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warning('Reorganization monitoring already active');
      return;
    }

    this.isMonitoring = true;
    logger.info(`🔄 Starting reorganization monitoring for ${this.networkName}`);

    // Initialize block hash cache
    await this.initializeBlockCache();

    // Start polling for changes
    this.monitoringLoop = setInterval(async () => {
      try {
        await this.checkForReorganizations();
      } catch (error) {
        logger.error(`Reorg monitoring error: ${error.message}`);
      }
    }, this.pollingInterval);
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringLoop) {
      clearInterval(this.monitoringLoop);
      this.isMonitoring = false;
      logger.info(`🔄 Stopped reorganization monitoring for ${this.networkName}`);
    }
  }

  // Initialize block hash cache with recent blocks
  async initializeBlockCache() {
    try {
      const latestBlockNumber = await this.provider.getBlockNumber();
      
      for (let i = 0; i < this.monitoringDepth; i++) {
        const blockNumber = latestBlockNumber - i;
        if (blockNumber >= 0) {
          const block = await this.provider.getBlock(blockNumber);
          if (block) {
            this.blockHashCache.set(blockNumber, {
              hash: block.hash,
              timestamp: block.timestamp,
              cached: Date.now()
            });
          }
        }
      }
      
      logger.info(`📦 Initialized block cache with ${this.blockHashCache.size} blocks`);
    } catch (error) {
      logger.error(`Failed to initialize block cache: ${error.message}`);
    }
  }

  // Check for reorganizations by comparing cached vs current block hashes
  async checkForReorganizations() {
    const latestBlockNumber = await this.provider.getBlockNumber();
    const reorgsDetected = [];

    // Check each cached block
    for (const [blockNumber, cachedData] of this.blockHashCache.entries()) {
      if (blockNumber > latestBlockNumber) continue;

      try {
        const currentBlock = await this.provider.getBlock(blockNumber);
        
        if (currentBlock && currentBlock.hash !== cachedData.hash) {
          // Reorganization detected!
          const reorgEvent = await this.analyzeReorganization(
            blockNumber, 
            cachedData.hash, 
            currentBlock.hash,
            currentBlock
          );
          
          reorgsDetected.push(reorgEvent);
          this.reorgEvents.push(reorgEvent);
          
          // Update cache with new hash
          this.blockHashCache.set(blockNumber, {
            hash: currentBlock.hash,
            timestamp: currentBlock.timestamp,
            cached: Date.now()
          });
        }
      } catch (error) {
        logger.error(`Error checking block ${blockNumber}: ${error.message}`);
      }
    }

    // Add new blocks to cache
    await this.updateBlockCache(latestBlockNumber);

    // Report reorganizations
    if (reorgsDetected.length > 0) {
      logger.warning(`🔄 Detected ${reorgsDetected.length} reorganization(s) on ${this.networkName}`);
      reorgsDetected.forEach(reorg => {
        logger.warning(`   Block ${reorg.blockNumber}: depth ${reorg.reorgDepth}, MEV likelihood: ${reorg.mevLikelihood}`);
      });
    }

    return reorgsDetected;
  }

  // Analyze a detected reorganization
  async analyzeReorganization(blockNumber, originalHash, newHash, newBlock) {
    const reorgEvent = {
      reorgId: this.generateReorgId(),
      timestamp: new Date().toISOString(),
      network: this.networkName,
      blockNumber,
      originalBlockHash: originalHash,
      newBlockHash: newHash,
      detectionTime: Date.now(),
      reorgDepth: await this.calculateReorgDepth(blockNumber),
      affectedTransactions: await this.getAffectedTransactions(originalHash, newHash),
      mevAnalysis: await this.assessMevCausation(newBlock),
      likelyMevCause: false, // Will be determined by MEV analysis
      mevEvidenceScore: 0
    };

    // Assess if this reorganization was likely caused by MEV
    reorgEvent.likelyMevCause = reorgEvent.mevAnalysis.evidenceScore > 50;
    reorgEvent.mevEvidenceScore = reorgEvent.mevAnalysis.evidenceScore;

    return reorgEvent;
  }

  // Calculate the depth of reorganization
  async calculateReorgDepth(startBlock) {
    let depth = 1;
    let currentBlock = startBlock + 1;
    const maxDepth = 10; // Practical limit

    try {
      while (depth < maxDepth) {
        const cachedData = this.blockHashCache.get(currentBlock);
        if (!cachedData) break;

        const currentBlockData = await this.provider.getBlock(currentBlock);
        if (!currentBlockData || currentBlockData.hash === cachedData.hash) {
          break; // Found stable block
        }

        depth++;
        currentBlock++;
      }
    } catch (error) {
      logger.error(`Error calculating reorg depth: ${error.message}`);
    }

    return depth;
  }

  // Get transactions affected by reorganization
  async getAffectedTransactions(originalHash, newHash) {
    const affected = [];

    try {
      // This would require storing transaction data for comparison
      // For now, return placeholder structure
      affected.push({
        txHash: 'placeholder',
        status: 'removed_or_modified',
        gasPrice: 0,
        potentialMevTarget: false
      });
    } catch (error) {
      logger.error(`Error getting affected transactions: ${error.message}`);
    }

    return affected;
  }

  // Assess MEV causation likelihood
  async assessMevCausation(newBlock) {
    const analysis = {
      evidenceScore: 0,
      indicators: {},
      reasoning: []
    };

    try {
      // Get block with transactions for analysis
      const blockWithTxs = await this.provider.getBlockWithTransactions(newBlock.number);
      
      if (!blockWithTxs || !blockWithTxs.transactions) {
        return analysis;
      }

      const transactions = blockWithTxs.transactions;

      // Indicator 1: High gas price variance
      const gasVariance = this.calculateGasVariance(transactions);
      if (gasVariance > 50) {
        analysis.evidenceScore += 20;
        analysis.indicators.highGasVariance = gasVariance;
        analysis.reasoning.push('High gas price variance suggests MEV competition');
      }

      // Indicator 2: Sandwich attack patterns
      const sandwichScore = this.detectSandwichPatterns(transactions);
      if (sandwichScore > 30) {
        analysis.evidenceScore += 25;
        analysis.indicators.sandwichPatterns = sandwichScore;
        analysis.reasoning.push('Sandwich attack patterns detected');
      }

      // Indicator 3: Arbitrage opportunities
      const arbitrageScore = this.detectArbitragePatterns(transactions);
      if (arbitrageScore > 20) {
        analysis.evidenceScore += 15;
        analysis.indicators.arbitrageActivity = arbitrageScore;
        analysis.reasoning.push('Arbitrage activity detected');
      }

      // Indicator 4: Liquidation activity
      const liquidationScore = this.detectLiquidationActivity(transactions);
      if (liquidationScore > 10) {
        analysis.evidenceScore += 15;
        analysis.indicators.liquidationActivity = liquidationScore;
        analysis.reasoning.push('Liquidation activity present');
      }

      // Indicator 5: Block value extraction
      const extractionScore = this.estimateValueExtraction(transactions);
      if (extractionScore > 1000) { // $1000+ extracted
        analysis.evidenceScore += 25;
        analysis.indicators.valueExtraction = extractionScore;
        analysis.reasoning.push(`Significant value extraction: $${extractionScore}`);
      }

      analysis.evidenceScore = Math.min(100, analysis.evidenceScore);
      
    } catch (error) {
      logger.error(`Error in MEV causation assessment: ${error.message}`);
    }

    return analysis;
  }

  // Utility methods for MEV pattern detection
  calculateGasVariance(transactions) {
    const gasPrices = transactions
      .map(tx => parseFloat(tx.gasPrice?.toString() || '0'))
      .filter(price => price > 0);

    if (gasPrices.length < 2) return 0;

    const mean = gasPrices.reduce((sum, price) => sum + price, 0) / gasPrices.length;
    const variance = gasPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / gasPrices.length;
    const stdDev = Math.sqrt(variance);

    return Math.min(100, (stdDev / mean) * 100); // Coefficient of variation
  }

  detectSandwichPatterns(transactions) {
    let sandwichScore = 0;

    // Look for high-low-high gas price patterns
    for (let i = 1; i < transactions.length - 1; i++) {
      const prevGas = parseFloat(transactions[i-1].gasPrice?.toString() || '0');
      const currentGas = parseFloat(transactions[i].gasPrice?.toString() || '0');
      const nextGas = parseFloat(transactions[i+1].gasPrice?.toString() || '0');

      if (prevGas > currentGas * 1.5 && nextGas > currentGas * 1.5) {
        sandwichScore += 10;
      }
    }

    return Math.min(100, sandwichScore);
  }

  detectArbitragePatterns(transactions) {
    // Look for transactions with similar values in opposite directions
    const valueMap = new Map();
    let arbitrageScore = 0;

    transactions.forEach(tx => {
      const value = tx.value?.toString();
      if (value && value !== '0') {
        valueMap.set(value, (valueMap.get(value) || 0) + 1);
      }
    });

    for (const [value, count] of valueMap) {
      if (count >= 2) {
        arbitrageScore += count * 5;
      }
    }

    return Math.min(100, arbitrageScore);
  }

  detectLiquidationActivity(transactions) {
    // Simplified liquidation detection
    const highGasTxs = transactions.filter(tx => {
      const gasPrice = parseFloat(tx.gasPrice?.toString() || '0');
      const gasLimit = parseFloat(tx.gasLimit?.toString() || '0');
      return gasPrice > 50e9 && gasLimit > 200000; // High gas, complex transaction
    });

    return (highGasTxs.length / transactions.length) * 100;
  }

  estimateValueExtraction(transactions) {
    // Simplified value extraction estimation
    // In practice, this would analyze DEX trades, arbitrage profits, etc.
    const highValueTxs = transactions.filter(tx => {
      const value = parseFloat(tx.value?.toString() || '0');
      return value > 1e18; // > 1 ETH
    });

    return highValueTxs.length * 500; // Rough estimate of $500 per high-value tx
  }

  // Update block cache with new blocks
  async updateBlockCache(latestBlockNumber) {
    // Add new blocks to cache
    const cachedNumbers = Array.from(this.blockHashCache.keys());
    const maxCached = Math.max(...cachedNumbers, 0);

    for (let blockNumber = maxCached + 1; blockNumber <= latestBlockNumber; blockNumber++) {
      try {
        const block = await this.provider.getBlock(blockNumber);
        if (block) {
          this.blockHashCache.set(blockNumber, {
            hash: block.hash,
            timestamp: block.timestamp,
            cached: Date.now()
          });
        }
      } catch (error) {
        logger.error(`Error caching block ${blockNumber}: ${error.message}`);
      }
    }

    // Remove old blocks to maintain cache size
    const sortedNumbers = Array.from(this.blockHashCache.keys()).sort((a, b) => b - a);
    if (sortedNumbers.length > this.monitoringDepth) {
      const toRemove = sortedNumbers.slice(this.monitoringDepth);
      toRemove.forEach(blockNumber => this.blockHashCache.delete(blockNumber));
    }
  }

  // Public API methods
  async detectReorganization(txHash, blockNumber) {
    const cachedData = this.blockHashCache.get(blockNumber);
    if (!cachedData) {
      return { reorgDetected: false, reason: 'Block not in cache' };
    }

    try {
      const currentBlock = await this.provider.getBlock(blockNumber);
      
      if (!currentBlock) {
        return { reorgDetected: false, reason: 'Block not found' };
      }

      if (currentBlock.hash !== cachedData.hash) {
        const reorgEvent = await this.analyzeReorganization(
          blockNumber,
          cachedData.hash,
          currentBlock.hash,
          currentBlock
        );

        return {
          reorgDetected: true,
          reorgEvent,
          reorgDepth: reorgEvent.reorgDepth,
          likelyMevCause: reorgEvent.likelyMevCause,
          mevEvidenceScore: reorgEvent.mevEvidenceScore
        };
      }

      return { reorgDetected: false, reason: 'Block hash unchanged' };
      
    } catch (error) {
      logger.error(`Error detecting reorganization: ${error.message}`);
      return { reorgDetected: false, reason: `Error: ${error.message}` };
    }
  }

  getRecentReorganizations(count = 10) {
    return this.reorgEvents.slice(-count);
  }

  getReorganizationStats() {
    const totalReorgs = this.reorgEvents.length;
    const mevRelated = this.reorgEvents.filter(r => r.likelyMevCause).length;
    
    return {
      totalReorganizations: totalReorgs,
      mevRelatedReorgs: mevRelated,
      mevReorgPercentage: totalReorgs > 0 ? (mevRelated / totalReorgs) * 100 : 0,
      averageDepth: totalReorgs > 0 ? 
        this.reorgEvents.reduce((sum, r) => sum + r.reorgDepth, 0) / totalReorgs : 0,
      lastReorgTime: totalReorgs > 0 ? this.reorgEvents[totalReorgs - 1].timestamp : null
    };
  }

  generateReorgId() {
    return `reorg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  // Export reorganization data
  exportReorgData() {
    return {
      networkName: this.networkName,
      reorgEvents: this.reorgEvents,
      stats: this.getReorganizationStats(),
      monitoringConfig: {
        depth: this.monitoringDepth,
        pollingInterval: this.pollingInterval,
        isMonitoring: this.isMonitoring
      },
      exportTimestamp: new Date().toISOString()
    };
  }
}

module.exports = { ReorganizationMonitor };