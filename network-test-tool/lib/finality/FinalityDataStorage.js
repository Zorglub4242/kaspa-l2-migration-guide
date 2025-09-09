const { DataStorage } = require('../../utils/data-storage');
const { logger } = require('../utils/logger');
const path = require('path');

/**
 * Enhanced Data Storage for Finality Measurements with MEV Awareness
 * Extends the existing battle-tested DataStorage system with finality-specific features
 */
class FinalityDataStorage extends DataStorage {
  constructor(options = {}) {
    super(options);
    
    // MEV-specific tracking
    this.mevEvents = [];
    this.reorganizationEvents = [];
    this.finalityAdjustments = [];
  }

  // Enhanced transaction recording with finality and MEV data
  async recordTransaction(networkName, operationType, transactionData) {
    // Extend existing transaction structure with finality + MEV fields
    const enhancedTransaction = {
      ...transactionData,
      // Existing fields preserved: executionTime, confirmationTime, gasUsed, etc.
      
      // Finality-specific fields
      finalityTime: transactionData.finalityTime || null,
      finalityThreshold: transactionData.finalityThreshold || null,
      confirmationDepth: transactionData.confirmationDepth || null,
      finalityAdjustment: transactionData.finalityAdjustment || null,
      
      // MEV-specific context
      mevContext: {
        mevActivityScore: transactionData.mevActivityScore || 0,
        blockPosition: transactionData.blockPosition || null,
        gasRankInBlock: transactionData.gasRankInBlock || null,
        reorgDetected: transactionData.reorgDetected || false,
        mevOpportunityScore: transactionData.mevOpportunityScore || 0,
        competingTransactions: transactionData.competingTransactions || 0,
        mevBotPresence: transactionData.mevBotPresence || false
      },
      
      // Network health at time of transaction
      networkHealth: {
        healthScore: transactionData.networkHealthScore || null,
        congestionLevel: transactionData.congestionLevel || 'normal',
        mevIntensity: transactionData.mevIntensity || 'low'
      }
    };

    // Use existing parent recordTransaction method
    return super.recordTransaction(networkName, operationType, enhancedTransaction);
  }

  // Record finality-specific measurement
  async recordFinalityMeasurement(networkName, measurementData) {
    const measurement = {
      measurementId: this.generateOperationId(),
      timestamp: new Date().toISOString(),
      network: networkName,
      
      // Core finality metrics
      transactionHash: measurementData.transactionHash,
      initialConfirmationTime: measurementData.initialConfirmationTime,
      finalityTime: measurementData.finalityTime,
      finalityThreshold: measurementData.finalityThreshold,
      actualConfirmations: measurementData.actualConfirmations,
      
      // Statistical categorization
      category: measurementData.category || 'standard', // fastest, lowest, median, etc.
      
      // MEV impact assessment
      mevImpact: {
        mevScoreDuringTx: measurementData.mevScoreDuringTx || 0,
        finalityAdjusted: measurementData.finalityAdjusted || false,
        adjustmentReason: measurementData.adjustmentReason || null,
        originalThreshold: measurementData.originalThreshold || null,
        adjustedThreshold: measurementData.adjustedThreshold || null
      },
      
      // Cost analysis
      costAnalysis: {
        transactionCost: measurementData.transactionCost || 0,
        gasPremium: measurementData.gasPremium || 0,
        mevPremium: measurementData.mevPremium || 0,
        finalityCostPerSecond: measurementData.finalityCostPerSecond || 0
      }
    };

    // Add to finality-specific collection
    if (!this.currentSession.finalityMeasurements) {
      this.currentSession.finalityMeasurements = [];
    }
    this.currentSession.finalityMeasurements.push(measurement);
    
    logger.info(`📊 Recorded finality measurement: ${measurementData.finalityTime}ms on ${networkName}`);
    return measurement.measurementId;
  }

  // Record MEV-related events
  async recordMevEvent(networkName, eventData) {
    const mevEvent = {
      eventId: this.generateOperationId(),
      timestamp: new Date().toISOString(),
      network: networkName,
      eventType: eventData.eventType, // 'high_activity', 'reorg_detected', 'threshold_adjusted'
      mevScore: eventData.mevScore,
      blockNumber: eventData.blockNumber,
      transactionHash: eventData.transactionHash || null,
      impact: eventData.impact,
      details: eventData.details || {}
    };

    this.mevEvents.push(mevEvent);
    
    // Also record in session for persistence
    if (!this.currentSession.mevEvents) {
      this.currentSession.mevEvents = [];
    }
    this.currentSession.mevEvents.push(mevEvent);
    
    return mevEvent.eventId;
  }

  // Record reorganization events
  async recordReorganization(networkName, reorgData) {
    const reorg = {
      reorgId: this.generateOperationId(),
      timestamp: new Date().toISOString(),
      network: networkName,
      originalBlockHash: reorgData.originalBlockHash,
      newBlockHash: reorgData.newBlockHash,
      blockNumber: reorgData.blockNumber,
      reorgDepth: reorgData.reorgDepth,
      affectedTransactions: reorgData.affectedTransactions || [],
      likelyMevCause: reorgData.likelyMevCause || false,
      mevEvidenceScore: reorgData.mevEvidenceScore || 0
    };

    this.reorganizationEvents.push(reorg);
    
    if (!this.currentSession.reorganizationEvents) {
      this.currentSession.reorganizationEvents = [];
    }
    this.currentSession.reorganizationEvents.push(reorg);
    
    logger.warning(`🔄 Recorded reorganization: depth ${reorgData.reorgDepth} on ${networkName}`);
    return reorg.reorgId;
  }

  // Enhanced analytics for finality measurements
  buildFinalityAnalysis() {
    if (!this.currentSession.finalityMeasurements) {
      return { error: 'No finality measurements recorded' };
    }

    const measurements = this.currentSession.finalityMeasurements;
    const byNetwork = {};
    
    // Group by network
    measurements.forEach(m => {
      if (!byNetwork[m.network]) {
        byNetwork[m.network] = [];
      }
      byNetwork[m.network].push(m);
    });

    const analysis = {
      totalMeasurements: measurements.length,
      networks: Object.keys(byNetwork),
      networkAnalysis: {},
      overallMetrics: this.calculateOverallFinalityMetrics(measurements),
      mevImpactAnalysis: this.analyzeMevImpact(measurements),
      fastestFinality: this.findFastestFinality(measurements),
      lowestCostFinality: this.findLowestCostFinality(measurements),
      recommendedNetworks: this.generateNetworkRecommendations(byNetwork)
    };

    // Analyze each network
    Object.entries(byNetwork).forEach(([network, networkMeasurements]) => {
      analysis.networkAnalysis[network] = this.analyzeNetworkFinality(networkMeasurements);
    });

    return analysis;
  }

  calculateOverallFinalityMetrics(measurements) {
    const finalityTimes = measurements.map(m => m.finalityTime).filter(t => t !== null);
    const costs = measurements.map(m => m.costAnalysis.transactionCost).filter(c => c > 0);
    
    return {
      count: finalityTimes.length,
      fastest: Math.min(...finalityTimes),
      slowest: Math.max(...finalityTimes),
      median: this.calculateMedian(finalityTimes),
      mean: finalityTimes.reduce((a, b) => a + b, 0) / finalityTimes.length,
      p90: this.calculatePercentile(finalityTimes, 90),
      p95: this.calculatePercentile(finalityTimes, 95),
      p99: this.calculatePercentile(finalityTimes, 99),
      
      // Cost metrics
      lowestCost: costs.length > 0 ? Math.min(...costs) : 0,
      highestCost: costs.length > 0 ? Math.max(...costs) : 0,
      averageCost: costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0
    };
  }

  analyzeMevImpact(measurements) {
    const mevAffected = measurements.filter(m => m.mevImpact.finalityAdjusted);
    const highMevPeriods = measurements.filter(m => m.mevImpact.mevScoreDuringTx > 70);
    
    return {
      totalMevAffected: mevAffected.length,
      mevAffectedPercentage: (mevAffected.length / measurements.length) * 100,
      highMevPeriods: highMevPeriods.length,
      averageMevScore: measurements.reduce((sum, m) => sum + m.mevImpact.mevScoreDuringTx, 0) / measurements.length,
      averageAdjustment: mevAffected.length > 0 ? 
        mevAffected.reduce((sum, m) => sum + (m.mevImpact.adjustedThreshold - m.mevImpact.originalThreshold), 0) / mevAffected.length : 0,
      mevReorganizations: this.reorganizationEvents.filter(r => r.likelyMevCause).length
    };
  }

  findFastestFinality(measurements) {
    const fastest = measurements.reduce((prev, current) => 
      (current.finalityTime < prev.finalityTime) ? current : prev
    );
    
    return {
      network: fastest.network,
      finalityTime: fastest.finalityTime,
      transactionHash: fastest.transactionHash,
      mevConditions: fastest.mevImpact.mevScoreDuringTx,
      reliability: fastest.mevImpact.mevScoreDuringTx < 30 ? 'high' : 'medium'
    };
  }

  findLowestCostFinality(measurements) {
    const lowestCost = measurements.reduce((prev, current) => 
      (current.costAnalysis.transactionCost < prev.costAnalysis.transactionCost) ? current : prev
    );
    
    return {
      network: lowestCost.network,
      cost: lowestCost.costAnalysis.transactionCost,
      finalityTime: lowestCost.finalityTime,
      costPerSecond: lowestCost.costAnalysis.finalityCostPerSecond,
      mevPremium: lowestCost.costAnalysis.mevPremium
    };
  }

  generateNetworkRecommendations(byNetwork) {
    const recommendations = {};
    
    Object.entries(byNetwork).forEach(([network, measurements]) => {
      const metrics = this.analyzeNetworkFinality(measurements);
      
      recommendations[network] = {
        bestFor: [],
        warnings: [],
        mevRisk: metrics.mevRisk,
        overallScore: metrics.overallScore
      };
      
      // Determine what each network is best for
      if (metrics.averageFinality === Math.min(...Object.values(byNetwork).map(m => this.analyzeNetworkFinality(m).averageFinality))) {
        recommendations[network].bestFor.push('Fastest finality');
      }
      
      if (metrics.averageCost === Math.min(...Object.values(byNetwork).map(m => this.analyzeNetworkFinality(m).averageCost))) {
        recommendations[network].bestFor.push('Lowest cost');
      }
      
      if (metrics.mevRisk === 'low') {
        recommendations[network].bestFor.push('MEV-sensitive applications');
      }
      
      // Generate warnings
      if (metrics.mevRisk === 'high') {
        recommendations[network].warnings.push('High MEV activity may affect finality');
      }
      
      if (metrics.reliability < 95) {
        recommendations[network].warnings.push('Lower reliability due to infrastructure issues');
      }
    });
    
    return recommendations;
  }

  analyzeNetworkFinality(measurements) {
    const finalityTimes = measurements.map(m => m.finalityTime).filter(t => t !== null);
    const costs = measurements.map(m => m.costAnalysis.transactionCost).filter(c => c > 0);
    const mevScores = measurements.map(m => m.mevImpact.mevScoreDuringTx);
    
    return {
      measurementCount: measurements.length,
      averageFinality: finalityTimes.reduce((a, b) => a + b, 0) / finalityTimes.length,
      medianFinality: this.calculateMedian(finalityTimes),
      averageCost: costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0,
      mevRisk: this.calculateMevRisk(mevScores),
      reliability: this.calculateReliability(measurements),
      overallScore: this.calculateOverallScore(measurements)
    };
  }

  calculateMevRisk(mevScores) {
    const averageMev = mevScores.reduce((a, b) => a + b, 0) / mevScores.length;
    if (averageMev > 70) return 'high';
    if (averageMev > 40) return 'medium';
    return 'low';
  }

  calculateReliability(measurements) {
    const successful = measurements.filter(m => m.finalityTime !== null).length;
    return (successful / measurements.length) * 100;
  }

  calculateOverallScore(measurements) {
    // Composite score based on speed, cost, and reliability
    const speedScore = 100 - (this.analyzeNetworkFinality(measurements).averageFinality / 1000); // Lower is better
    const costScore = 100 - (this.analyzeNetworkFinality(measurements).averageCost * 1000); // Lower is better  
    const reliabilityScore = this.calculateReliability(measurements);
    
    return Math.round((speedScore + costScore + reliabilityScore) / 3);
  }

  // Utility methods
  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Override parent finalization to include finality-specific exports
  async finalizeSession(summary = {}) {
    // Add finality-specific summary
    const finalitySummary = {
      ...summary,
      totalFinalityMeasurements: this.currentSession.finalityMeasurements?.length || 0,
      totalMevEvents: this.mevEvents.length,
      totalReorganizations: this.reorganizationEvents.length
    };

    // Generate finality analysis
    if (this.currentSession.finalityMeasurements?.length > 0) {
      const finalityAnalysis = this.buildFinalityAnalysis();
      
      // Save finality-specific analytics
      const finalityAnalyticsFile = path.join(this.analyticsDir, `finality-analysis-${this.currentSession.sessionId}.json`);
      await this.saveJSON(finalityAnalyticsFile, finalityAnalysis);
    }

    // Call parent finalization
    return super.finalizeSession(finalitySummary);
  }
}

module.exports = { FinalityDataStorage };