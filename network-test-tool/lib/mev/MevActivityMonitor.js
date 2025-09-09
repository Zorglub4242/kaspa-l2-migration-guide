const { logger } = require('../utils/logger');
const { PrecisionTimer } = require('../utils/PrecisionTimer');

/**
 * MEV Activity Monitor - Real-time MEV detection and scoring
 * Provides 0-100 scoring system for MEV activity levels
 */
class MevActivityMonitor {
  constructor(networkName, provider) {
    this.networkName = networkName;
    this.provider = provider;
    this.currentScore = 0;
    this.recentBlocks = [];
    this.mevBotAddresses = new Set();
    this.gasThresholds = this.initializeGasThresholds(networkName);
    this.monitoringActive = false;
    
    // Known MEV bot patterns (can be expanded)
    this.initializeKnownMevBots();
  }
  
  initializeGasThresholds(networkName) {
    // Network-specific gas thresholds for MEV detection
    switch (networkName.toLowerCase()) {
      case 'ethereum':
      case 'sepolia':
        return {
          highGas: 100, // Gwei
          extremeGas: 500,
          gasVarianceThreshold: 50
        };
      case 'kasplex':
        return {
          highGas: 3000, // Gwei (Kasplex uses higher gas)
          extremeGas: 10000,
          gasVarianceThreshold: 1000
        };
      default:
        return {
          highGas: 50,
          extremeGas: 200,
          gasVarianceThreshold: 25
        };
    }
  }
  
  initializeKnownMevBots() {
    // Known MEV bot addresses (Ethereum mainnet examples)
    const knownBots = [
      '0x00000000003b3cc22af3ae1eac0440bcee416b40', // Flashbots
      '0x56178a0d5f301baf6cf3e17126ea0b6c4e9b2b3e', // MEV bot
      // Add more as needed
    ];
    
    knownBots.forEach(address => this.mevBotAddresses.add(address.toLowerCase()));
  }
  
  // Start real-time MEV monitoring
  async startMonitoring(intervalMs = 12000) { // Default: ~block time
    if (this.monitoringActive) {
      logger.warning('MEV monitoring already active');
      return;
    }
    
    this.monitoringActive = true;
    logger.info(`🤖 Starting MEV monitoring for ${this.networkName}`);
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.analyzeLatestBlock();
      } catch (error) {
        logger.error(`MEV monitoring error: ${error.message}`);
      }
    }, intervalMs);
  }
  
  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringActive = false;
      logger.info(`🤖 Stopped MEV monitoring for ${this.networkName}`);
    }
  }
  
  // Analyze latest block for MEV activity
  async analyzeLatestBlock() {
    try {
      const latestBlock = await this.provider.getBlockWithTransactions('latest');
      if (!latestBlock || !latestBlock.transactions) {
        return;
      }
      
      const analysis = await this.analyzeMevInBlock(latestBlock);
      this.updateMevScore(analysis);
      
      // Keep recent block history
      this.recentBlocks.push({
        blockNumber: latestBlock.number,
        timestamp: latestBlock.timestamp,
        mevScore: analysis.mevScore,
        analysis
      });
      
      // Keep only last 10 blocks
      if (this.recentBlocks.length > 10) {
        this.recentBlocks.shift();
      }
      
    } catch (error) {
      logger.error(`Block analysis error: ${error.message}`);
    }
  }
  
  // Comprehensive MEV analysis for a block
  async analyzeMevInBlock(block) {
    const transactions = block.transactions || [];
    if (transactions.length === 0) {
      return { mevScore: 0, indicators: {} };
    }
    
    const indicators = {
      gasVariance: this.calculateGasVariance(transactions),
      highGasTransactions: this.countHighGasTransactions(transactions),
      mevBotActivity: this.identifyMevBotActivity(transactions),
      arbitragePatterns: this.detectArbitragePatterns(transactions),
      sandwichAttacks: this.detectSandwichPatterns(transactions),
      liquidationActivity: this.detectLiquidationActivity(transactions),
      gasCompetition: this.analyzeGasCompetition(transactions),
      dexVolume: this.estimateDexVolume(transactions)
    };
    
    const mevScore = this.calculateMevScore(indicators);
    
    return {
      blockNumber: block.number,
      timestamp: block.timestamp,
      transactionCount: transactions.length,
      mevScore,
      indicators,
      riskLevel: this.categorizeMevRisk(mevScore)
    };
  }
  
  calculateGasVariance(transactions) {
    const gasPrices = transactions.map(tx => 
      parseFloat(tx.gasPrice ? tx.gasPrice.toString() : '0')
    ).filter(price => price > 0);
    
    if (gasPrices.length < 2) return 0;
    
    const mean = gasPrices.reduce((sum, price) => sum + price, 0) / gasPrices.length;
    const variance = gasPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / gasPrices.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize to 0-100 scale
    return Math.min(100, (stdDev / this.gasThresholds.gasVarianceThreshold) * 100);
  }
  
  countHighGasTransactions(transactions) {
    const highGasTxs = transactions.filter(tx => {
      const gasPrice = parseFloat(tx.gasPrice ? tx.gasPrice.toString() : '0') / 1e9; // Convert to Gwei
      return gasPrice > this.gasThresholds.highGas;
    });
    
    return (highGasTxs.length / transactions.length) * 100;
  }
  
  identifyMevBotActivity(transactions) {
    const botTxs = transactions.filter(tx => 
      this.mevBotAddresses.has(tx.from?.toLowerCase()) || 
      this.mevBotAddresses.has(tx.to?.toLowerCase())
    );
    
    return (botTxs.length / transactions.length) * 100;
  }
  
  detectArbitragePatterns(transactions) {
    // Simple pattern detection - look for similar value transfers in opposite directions
    let arbitrageScore = 0;
    const valueMap = new Map();
    
    transactions.forEach(tx => {
      const value = tx.value?.toString();
      if (value && value !== '0') {
        valueMap.set(value, (valueMap.get(value) || 0) + 1);
      }
    });
    
    // Count repeated values as potential arbitrage
    for (const [value, count] of valueMap) {
      if (count >= 2) {
        arbitrageScore += count * 5; // Each repeated value adds to score
      }
    }
    
    return Math.min(100, arbitrageScore);
  }
  
  detectSandwichPatterns(transactions) {
    // Look for transaction patterns: high gas -> normal gas -> high gas
    let sandwichScore = 0;
    
    for (let i = 1; i < transactions.length - 1; i++) {
      const prevGas = parseFloat(transactions[i-1].gasPrice?.toString() || '0');
      const currentGas = parseFloat(transactions[i].gasPrice?.toString() || '0');
      const nextGas = parseFloat(transactions[i+1].gasPrice?.toString() || '0');
      
      // Pattern: high-low-high gas prices
      if (prevGas > currentGas * 1.5 && nextGas > currentGas * 1.5) {
        sandwichScore += 10;
      }
    }
    
    return Math.min(100, sandwichScore);
  }
  
  detectLiquidationActivity(transactions) {
    // Look for transactions to known DeFi protocols with high gas
    const defiProtocols = [
      '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9', // Aave
      '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b', // Compound
      // Add more DeFi protocol addresses
    ];
    
    const liquidationTxs = transactions.filter(tx => {
      const isDefiInteraction = defiProtocols.some(protocol => 
        tx.to?.toLowerCase() === protocol.toLowerCase()
      );
      const hasHighGas = parseFloat(tx.gasPrice?.toString() || '0') > this.gasThresholds.highGas * 1e9;
      
      return isDefiInteraction && hasHighGas;
    });
    
    return (liquidationTxs.length / transactions.length) * 100;
  }
  
  analyzeGasCompetition(transactions) {
    const sortedByGas = [...transactions]
      .filter(tx => tx.gasPrice)
      .sort((a, b) => parseFloat(b.gasPrice.toString()) - parseFloat(a.gasPrice.toString()));
    
    if (sortedByGas.length < 2) return 0;
    
    const topGas = parseFloat(sortedByGas[0].gasPrice.toString());
    const medianGas = parseFloat(sortedByGas[Math.floor(sortedByGas.length / 2)].gasPrice.toString());
    
    if (medianGas === 0) return 0;
    
    const gasRatio = topGas / medianGas;
    return Math.min(100, (gasRatio - 1) * 10); // Scale gas competition
  }
  
  estimateDexVolume(transactions) {
    // Estimate DEX activity by looking at swap-like patterns
    const potentialSwaps = transactions.filter(tx => {
      const value = parseFloat(tx.value?.toString() || '0');
      const gasLimit = parseFloat(tx.gasLimit?.toString() || '0');
      
      // Heuristic: high gas limit transactions with value
      return gasLimit > 100000 && value > 0;
    });
    
    return (potentialSwaps.length / transactions.length) * 100;
  }
  
  calculateMevScore(indicators) {
    // Weighted MEV score calculation
    const weights = {
      gasVariance: 0.20,
      highGasTransactions: 0.15,
      mevBotActivity: 0.25,
      arbitragePatterns: 0.15,
      sandwichAttacks: 0.10,
      liquidationActivity: 0.05,
      gasCompetition: 0.05,
      dexVolume: 0.05
    };
    
    let score = 0;
    for (const [indicator, value] of Object.entries(indicators)) {
      const weight = weights[indicator] || 0;
      score += value * weight;
    }
    
    return Math.min(100, Math.max(0, Math.round(score)));
  }
  
  updateMevScore(analysis) {
    // Exponential moving average for smooth score updates
    const alpha = 0.3; // Smoothing factor
    this.currentScore = Math.round(alpha * analysis.mevScore + (1 - alpha) * this.currentScore);
    
    // Log significant MEV activity changes
    if (Math.abs(analysis.mevScore - this.currentScore) > 20) {
      const direction = analysis.mevScore > this.currentScore ? 'increased' : 'decreased';
      logger.warning(`🤖 MEV activity ${direction} significantly: ${this.currentScore} -> ${analysis.mevScore}`);
    }
  }
  
  categorizeMevRisk(score) {
    if (score >= 80) return 'extreme';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }
  
  // Public API methods
  getCurrentScore() {
    return this.currentScore;
  }
  
  async getCurrentMevConditions() {
    if (this.recentBlocks.length === 0) {
      await this.analyzeLatestBlock();
    }
    
    const recentScores = this.recentBlocks.slice(-5).map(b => b.mevScore);
    const averageRecent = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    
    return {
      currentScore: this.currentScore,
      averageRecent: Math.round(averageRecent),
      trend: this.calculateTrend(recentScores),
      riskLevel: this.categorizeMevRisk(this.currentScore),
      recommendation: this.generateRecommendation(this.currentScore),
      lastUpdated: new Date().toISOString()
    };
  }
  
  calculateTrend(scores) {
    if (scores.length < 2) return 'stable';
    
    const first = scores[0];
    const last = scores[scores.length - 1];
    const change = last - first;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }
  
  generateRecommendation(score) {
    if (score >= 80) {
      return {
        action: 'delay_testing',
        reason: 'Extreme MEV activity detected',
        suggestedDelay: '30-60 minutes',
        finalityAdjustment: '+10 blocks'
      };
    } else if (score >= 60) {
      return {
        action: 'increase_threshold',
        reason: 'High MEV activity may cause reorganizations',
        finalityAdjustment: '+5 blocks',
        gasStrategy: 'use_premium_gas'
      };
    } else if (score >= 40) {
      return {
        action: 'monitor_closely',
        reason: 'Moderate MEV activity',
        finalityAdjustment: '+2 blocks'
      };
    } else {
      return {
        action: 'proceed_normally',
        reason: 'Low MEV activity',
        finalityAdjustment: 'none'
      };
    }
  }
  
  // Get historical MEV data
  getRecentHistory(blocks = 10) {
    return this.recentBlocks.slice(-blocks);
  }
  
  // Export MEV data for analysis
  exportMevData() {
    return {
      networkName: this.networkName,
      currentScore: this.currentScore,
      recentBlocks: this.recentBlocks,
      gasThresholds: this.gasThresholds,
      monitoringActive: this.monitoringActive,
      exportTimestamp: new Date().toISOString()
    };
  }
}

module.exports = { MevActivityMonitor };