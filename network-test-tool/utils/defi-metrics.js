const { ethers } = require('ethers');
const { logger } = require('./logger');
const { priceFetcher } = require('./price-fetcher');

/**
 * DeFi-specific metrics calculation utilities
 * Handles performance analysis for cross-network DeFi testing
 */

class DeFiMetrics {
  constructor() {
    this.gasTracker = new Map();
    this.operationTimes = new Map();
    this.slippageData = [];
    this.failureReasons = new Map();
  }

  // Track gas usage for different DeFi operations
  recordGasUsage(operation, network, gasUsed, gasPrice) {
    const key = `${operation}_${network}`;
    if (!this.gasTracker.has(key)) {
      this.gasTracker.set(key, []);
    }
    
    this.gasTracker.get(key).push({
      gasUsed: parseInt(gasUsed.toString()),
      gasPrice: parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei')),
      cost: parseFloat(ethers.utils.formatEther(gasUsed.mul(gasPrice))),
      timestamp: Date.now()
    });
  }

  // Track operation execution times
  recordExecutionTime(operation, network, startTime, endTime, success = true) {
    const key = `${operation}_${network}`;
    if (!this.operationTimes.has(key)) {
      this.operationTimes.set(key, []);
    }
    
    this.operationTimes.get(key).push({
      executionTime: endTime - startTime,
      success,
      timestamp: Date.now()
    });
  }

  // Track DEX-specific slippage data
  recordSlippage(network, expectedAmount, actualAmount, tokenPair) {
    const slippage = expectedAmount > 0 ? 
      ((expectedAmount - actualAmount) / expectedAmount) * 100 : 0;
    
    this.slippageData.push({
      network,
      slippage: Math.max(0, slippage), // Ensure non-negative
      expectedAmount: parseFloat(expectedAmount),
      actualAmount: parseFloat(actualAmount),
      tokenPair,
      timestamp: Date.now()
    });
  }

  // Track failure reasons for analysis
  recordFailure(operation, network, reason) {
    const key = `${operation}_${network}`;
    const count = this.failureReasons.get(key) || {};
    count[reason] = (count[reason] || 0) + 1;
    this.failureReasons.set(key, count);
  }

  // Calculate average gas cost for an operation across networks
  getAverageGasCost(operation) {
    const results = {};
    
    for (const [key, data] of this.gasTracker.entries()) {
      if (key.startsWith(operation)) {
        const network = key.split('_')[1];
        const avgGas = data.reduce((sum, item) => sum + item.gasUsed, 0) / data.length;
        const avgCost = data.reduce((sum, item) => sum + item.cost, 0) / data.length;
        
        results[network] = {
          averageGasUsed: Math.round(avgGas),
          averageCostETH: avgCost.toFixed(8),
          dataPoints: data.length
        };
      }
    }
    
    return results;
  }

  // Calculate operation throughput (operations per second)
  calculateThroughput(operation, network) {
    const key = `${operation}_${network}`;
    const times = this.operationTimes.get(key) || [];
    
    if (times.length === 0) return 0;
    
    const successfulOps = times.filter(t => t.success);
    const totalTime = successfulOps.reduce((sum, t) => sum + t.executionTime, 0);
    
    return successfulOps.length > 0 ? (successfulOps.length * 1000) / totalTime : 0;
  }

  // Get slippage statistics for DEX operations
  getSlippageStats(network = null) {
    const filteredData = network ? 
      this.slippageData.filter(d => d.network === network) : 
      this.slippageData;
    
    if (filteredData.length === 0) {
      return { averageSlippage: 0, maxSlippage: 0, dataPoints: 0 };
    }
    
    const slippages = filteredData.map(d => d.slippage);
    const average = slippages.reduce((sum, s) => sum + s, 0) / slippages.length;
    const max = Math.max(...slippages);
    
    return {
      averageSlippage: parseFloat(average.toFixed(4)),
      maxSlippage: parseFloat(max.toFixed(4)),
      dataPoints: filteredData.length
    };
  }

  // Calculate success rate for operations
  getSuccessRate(operation, network) {
    const key = `${operation}_${network}`;
    const times = this.operationTimes.get(key) || [];
    
    if (times.length === 0) return 1.0;
    
    const successful = times.filter(t => t.success).length;
    return successful / times.length;
  }

  // Get detailed failure analysis
  getFailureAnalysis(operation = null) {
    const analysis = {};
    
    for (const [key, reasons] of this.failureReasons.entries()) {
      if (operation === null || key.startsWith(operation)) {
        analysis[key] = {
          totalFailures: Object.values(reasons).reduce((sum, count) => sum + count, 0),
          reasons: Object.entries(reasons)
            .sort(([,a], [,b]) => b - a)
            .map(([reason, count]) => ({ reason, count }))
        };
      }
    }
    
    return analysis;
  }

  // Compare networks for a specific DeFi operation
  async compareNetworks(operation, networks) {
    const comparison = {};
    
    for (const network of networks) {
      const gasCosts = this.getAverageGasCost(operation)[network] || {};
      const throughput = this.calculateThroughput(operation, network);
      const successRate = this.getSuccessRate(operation, network);
      const slippageStats = this.getSlippageStats(network);
      
      // Get USD cost if available
      let usdCost = null;
      if (gasCosts.averageCostETH) {
        try {
          const costData = await priceFetcher.getUSDValue(network, gasCosts.averageCostETH);
          usdCost = costData.success ? costData.usdValue : null;
        } catch (error) {
          logger.warning(`Failed to get USD cost for ${network}: ${error.message}`);
        }
      }
      
      comparison[network] = {
        gasMetrics: gasCosts,
        throughputTPS: parseFloat(throughput.toFixed(3)),
        successRate: parseFloat((successRate * 100).toFixed(1)),
        slippage: slippageStats,
        usdCost: usdCost ? `$${usdCost.toFixed(4)}` : 'N/A',
        recommendation: this._getRecommendation(operation, throughput, successRate, usdCost)
      };
    }
    
    return comparison;
  }

  // Get recommendation based on metrics
  _getRecommendation(operation, throughput, successRate, usdCost) {
    if (successRate < 0.8) return 'Reliability Issues';
    if (throughput > 5) return 'High Performance';
    if (usdCost && usdCost < 0.01) return 'Cost Efficient';
    if (throughput > 1 && successRate > 0.95) return 'Balanced';
    return 'Standard Performance';
  }

  // Generate comprehensive DeFi performance report
  async generateReport(networks) {
    const report = {
      timestamp: new Date().toISOString(),
      networks: networks,
      summary: {},
      detailed: {},
      recommendations: []
    };

    // Generate summary for each network
    for (const network of networks) {
      const networkSummary = {
        totalOperations: 0,
        averageSuccessRate: 0,
        totalGasUsed: 0,
        averageThroughput: 0
      };

      // Aggregate data across all operations for this network
      const operationKeys = [...this.operationTimes.keys()].filter(k => k.endsWith(`_${network}`));
      
      for (const key of operationKeys) {
        const times = this.operationTimes.get(key) || [];
        networkSummary.totalOperations += times.length;
        networkSummary.averageSuccessRate += this.getSuccessRate(key.split('_')[0], network);
        networkSummary.averageThroughput += this.calculateThroughput(key.split('_')[0], network);
      }

      if (operationKeys.length > 0) {
        networkSummary.averageSuccessRate = (networkSummary.averageSuccessRate / operationKeys.length) * 100;
        networkSummary.averageThroughput = networkSummary.averageThroughput / operationKeys.length;
      }

      report.summary[network] = networkSummary;
    }

    // Generate detailed comparisons for each operation type
    const operations = [...new Set([...this.operationTimes.keys()].map(k => k.split('_')[0]))];
    
    for (const operation of operations) {
      report.detailed[operation] = await this.compareNetworks(operation, networks);
    }

    // Generate recommendations
    report.recommendations = this._generateRecommendations(report.summary, report.detailed);

    return report;
  }

  // Generate network recommendations based on report data
  _generateRecommendations(summary, detailed) {
    const recommendations = [];
    
    // Find best network for each metric
    const networks = Object.keys(summary);
    
    // Best for cost efficiency
    const costEfficient = networks.reduce((best, network) => 
      summary[network].averageThroughput > summary[best].averageThroughput ? network : best
    );
    
    // Best for reliability
    const mostReliable = networks.reduce((best, network) =>
      summary[network].averageSuccessRate > summary[best].averageSuccessRate ? network : best
    );

    recommendations.push({
      category: 'Cost Efficiency',
      winner: costEfficient,
      reason: `Highest average throughput: ${summary[costEfficient].averageThroughput.toFixed(2)} TPS`
    });

    recommendations.push({
      category: 'Reliability',
      winner: mostReliable,
      reason: `Highest success rate: ${summary[mostReliable].averageSuccessRate.toFixed(1)}%`
    });

    return recommendations;
  }

  // Reset metrics for new test run
  reset() {
    this.gasTracker.clear();
    this.operationTimes.clear();
    this.slippageData = [];
    this.failureReasons.clear();
  }

  // Export data for external analysis
  exportData() {
    return {
      gasTracker: Object.fromEntries(this.gasTracker),
      operationTimes: Object.fromEntries(this.operationTimes),
      slippageData: this.slippageData,
      failureReasons: Object.fromEntries(this.failureReasons)
    };
  }
}

// Export singleton instance
const defiMetrics = new DeFiMetrics();
module.exports = { defiMetrics, DeFiMetrics };