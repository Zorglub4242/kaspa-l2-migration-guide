const { TestDatabase } = require('./database');
let stats;
try {
  stats = require('simple-statistics');
} catch (error) {
  // Fallback when simple-statistics is not available
  stats = {
    mean: (arr) => arr.reduce((a, b) => a + b, 0) / arr.length,
    standardDeviation: (arr) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length);
    },
    linearRegression: () => ({ m: 0, b: 0 }),
    rSquared: () => 0,
    tTest: () => ({ testStatistic: 0, pValue: 1 }),
    anova: () => ({ fStatistic: 0, pValue: 1 })
  };
}
const chalk = require('chalk');

class TimeSeriesTracker {
  constructor(database = null) {
    this.db = database || new TestDatabase();
    this.isInitialized = false;
  }

  async initialize() {
    if (!this.isInitialized) {
      await this.db.initialize();
      this.isInitialized = true;
    }
  }

  // Record performance metrics
  async recordMetric(runId, networkName, metricName, metricValue, options = {}) {
    await this.initialize();
    
    const metricData = {
      runId,
      networkName,
      metricName,
      metricValue,
      metricUnit: options.unit || '',
      timestamp: options.timestamp || new Date().toISOString(),
      testType: options.testType,
      additionalData: options.additionalData || {}
    };
    
    return this.db.insertPerformanceMetric(metricData);
  }

  // Record multiple metrics at once
  async recordMetrics(runId, networkName, metrics, options = {}) {
    await this.initialize();
    
    const timestamp = options.timestamp || new Date().toISOString();
    const promises = [];
    
    for (const [metricName, metricValue] of Object.entries(metrics)) {
      if (typeof metricValue === 'number' && !isNaN(metricValue)) {
        promises.push(this.recordMetric(runId, networkName, metricName, metricValue, {
          ...options,
          timestamp
        }));
      }
    }
    
    await Promise.all(promises);
  }

  // Get time series data for a specific metric
  async getTimeSeries(metricName, options = {}) {
    await this.initialize();
    
    const queryOptions = {
      metricName,
      ...options
    };
    
    const metrics = this.db.getPerformanceMetrics(queryOptions);
    
    return metrics.map(metric => ({
      timestamp: new Date(metric.timestamp),
      value: metric.metric_value,
      networkName: metric.network_name,
      testType: metric.test_type,
      unit: metric.metric_unit,
      additionalData: JSON.parse(metric.additional_data || '{}')
    }));
  }

  // Get aggregated metrics over time periods
  async getAggregatedTimeSeries(metricName, aggregation = 'hour', options = {}) {
    await this.initialize();
    
    const timeSeries = await this.getTimeSeries(metricName, options);
    
    if (timeSeries.length === 0) {
      return [];
    }
    
    // Group by time period
    const grouped = this.groupByTimePeriod(timeSeries, aggregation);
    
    // Calculate aggregated values
    return Object.entries(grouped).map(([period, values]) => {
      const numValues = values.map(v => v.value);
      
      return {
        period,
        timestamp: new Date(period),
        count: values.length,
        min: Math.min(...numValues),
        max: Math.max(...numValues),
        mean: stats.mean(numValues),
        median: stats.median(numValues),
        stdDev: numValues.length > 1 ? stats.standardDeviation(numValues) : 0,
        values: numValues
      };
    }).sort((a, b) => a.timestamp - b.timestamp);
  }

  groupByTimePeriod(timeSeries, aggregation) {
    const grouped = {};
    
    timeSeries.forEach(point => {
      let periodKey;
      const date = point.timestamp;
      
      switch (aggregation) {
        case 'minute':
          periodKey = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
                              date.getHours(), date.getMinutes()).toISOString();
          break;
        case 'hour':
          periodKey = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
                              date.getHours()).toISOString();
          break;
        case 'day':
          periodKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          weekStart.setHours(0, 0, 0, 0);
          periodKey = weekStart.toISOString();
          break;
        case 'month':
          periodKey = new Date(date.getFullYear(), date.getMonth()).toISOString();
          break;
        default:
          periodKey = date.toISOString();
      }
      
      if (!grouped[periodKey]) {
        grouped[periodKey] = [];
      }
      grouped[periodKey].push(point);
    });
    
    return grouped;
  }

  // Calculate trends and detect regressions
  async analyzeTrends(metricName, options = {}) {
    await this.initialize();
    
    const timeSeries = await this.getTimeSeries(metricName, {
      ...options,
      limit: options.limit || 100
    });
    
    if (timeSeries.length < 3) {
      return {
        trend: 'insufficient_data',
        confidence: 0,
        message: 'Need at least 3 data points for trend analysis'
      };
    }
    
    // Prepare data for analysis
    const values = timeSeries.map(point => point.value);
    const timestamps = timeSeries.map(point => point.timestamp.getTime());
    
    // Convert to [x, y] pairs for regression
    const dataPoints = timestamps.map((timestamp, index) => [timestamp, values[index]]);
    
    // Linear regression
    const regression = stats.linearRegression(dataPoints);
    const rSquared = stats.rSquared(dataPoints, regression);
    
    // Trend analysis
    const slope = regression.m;
    const trendDirection = this.classifyTrend(slope, values);
    
    // Detect outliers
    const outliers = this.detectOutliers(values);
    
    // Recent performance vs baseline
    const recentValues = values.slice(-Math.min(10, Math.floor(values.length / 3)));
    const baselineValues = values.slice(0, Math.floor(values.length / 2));
    
    const recentMean = stats.mean(recentValues);
    const baselineMean = stats.mean(baselineValues);
    const percentageChange = ((recentMean - baselineMean) / baselineMean) * 100;
    
    return {
      trend: trendDirection,
      slope,
      confidence: rSquared,
      percentageChange,
      outliers: {
        count: outliers.length,
        indices: outliers,
        values: outliers.map(i => values[i])
      },
      statistics: {
        count: values.length,
        mean: stats.mean(values),
        median: stats.median(values),
        min: Math.min(...values),
        max: Math.max(...values),
        stdDev: stats.standardDeviation(values)
      },
      recent: {
        count: recentValues.length,
        mean: recentMean,
        vs_baseline: percentageChange
      },
      regression: {
        slope,
        intercept: regression.b,
        rSquared
      }
    };
  }

  classifyTrend(slope, values) {
    const meanValue = stats.mean(values);
    const relativeSlope = Math.abs(slope) / meanValue;
    
    if (relativeSlope < 0.001) {
      return 'stable';
    } else if (slope > 0) {
      return relativeSlope > 0.05 ? 'strongly_increasing' : 'increasing';
    } else {
      return relativeSlope > 0.05 ? 'strongly_decreasing' : 'decreasing';
    }
  }

  detectOutliers(values) {
    if (values.length < 4) return [];
    
    const q1 = stats.quantile(values, 0.25);
    const q3 = stats.quantile(values, 0.75);
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outliers = [];
    values.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        outliers.push(index);
      }
    });
    
    return outliers;
  }

  // Compare metrics across networks
  async compareNetworks(metricName, options = {}) {
    await this.initialize();
    
    const networkStats = new Map();
    
    // Get data for each network
    const networks = options.networks || ['sepolia', 'kasplex', 'igra'];
    
    for (const networkName of networks) {
      const timeSeries = await this.getTimeSeries(metricName, {
        ...options,
        networkName
      });
      
      if (timeSeries.length === 0) continue;
      
      const values = timeSeries.map(point => point.value);
      const trends = await this.analyzeTrends(metricName, { ...options, networkName });
      
      networkStats.set(networkName, {
        networkName,
        dataPoints: timeSeries.length,
        statistics: {
          mean: stats.mean(values),
          median: stats.median(values),
          min: Math.min(...values),
          max: Math.max(...values),
          stdDev: values.length > 1 ? stats.standardDeviation(values) : 0
        },
        trends,
        latestValue: values[values.length - 1],
        latestTimestamp: timeSeries[timeSeries.length - 1].timestamp
      });
    }
    
    // Calculate comparative statistics
    const allNetworkStats = Array.from(networkStats.values());
    const comparison = this.calculateNetworkComparison(allNetworkStats, metricName);
    
    return {
      metricName,
      networks: Object.fromEntries(networkStats),
      comparison,
      generatedAt: new Date()
    };
  }

  calculateNetworkComparison(networkStats, metricName) {
    if (networkStats.length === 0) return null;
    
    // Find best and worst performing networks
    const byMean = [...networkStats].sort((a, b) => a.statistics.mean - b.statistics.mean);
    const byStdDev = [...networkStats].sort((a, b) => a.statistics.stdDev - b.statistics.stdDev);
    
    // Performance rankings (lower is generally better for most metrics)
    const isLowerBetter = this.isLowerBetterMetric(metricName);
    
    const best = isLowerBetter ? byMean[0] : byMean[byMean.length - 1];
    const worst = isLowerBetter ? byMean[byMean.length - 1] : byMean[0];
    const mostConsistent = byStdDev[0];
    const leastConsistent = byStdDev[byStdDev.length - 1];
    
    // Calculate relative performance
    const meanValues = networkStats.map(stat => stat.statistics.mean);
    const overallMean = stats.mean(meanValues);
    
    return {
      best: {
        network: best.networkName,
        value: best.statistics.mean,
        advantage: Math.abs(((best.statistics.mean - worst.statistics.mean) / worst.statistics.mean) * 100)
      },
      worst: {
        network: worst.networkName,
        value: worst.statistics.mean
      },
      mostConsistent: {
        network: mostConsistent.networkName,
        stdDev: mostConsistent.statistics.stdDev
      },
      leastConsistent: {
        network: leastConsistent.networkName,
        stdDev: leastConsistent.statistics.stdDev
      },
      overallMean,
      relativePerformance: networkStats.map(stat => ({
        network: stat.networkName,
        relativeToMean: ((stat.statistics.mean - overallMean) / overallMean) * 100,
        consistencyScore: 100 - (stat.statistics.stdDev / stat.statistics.mean) * 100
      }))
    };
  }

  isLowerBetterMetric(metricName) {
    const lowerIsBetter = [
      'response_time', 'latency', 'block_time', 'finality_time',
      'gas_price', 'error_rate', 'failure_rate', 'duration'
    ];
    
    return lowerIsBetter.some(metric => metricName.toLowerCase().includes(metric));
  }

  // Detect performance regressions
  async detectRegressions(options = {}) {
    await this.initialize();
    
    const regressions = [];
    const metrics = options.metrics || [
      'success_rate', 'response_time', 'gas_used', 'tps', 'block_time'
    ];
    
    const thresholds = {
      success_rate: { type: 'decrease', threshold: 5 }, // 5% decrease is concerning
      response_time: { type: 'increase', threshold: 20 }, // 20% increase is concerning
      gas_used: { type: 'increase', threshold: 15 }, // 15% increase is concerning
      tps: { type: 'decrease', threshold: 10 }, // 10% decrease is concerning
      block_time: { type: 'increase', threshold: 25 }, // 25% increase is concerning
      ...options.thresholds
    };
    
    for (const metricName of metrics) {
      try {
        const trends = await this.analyzeTrends(metricName, {
          since: options.since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
          networkName: options.networkName
        });
        
        const threshold = thresholds[metricName];
        if (!threshold || trends.trend === 'insufficient_data') continue;
        
        const isRegression = this.isRegression(trends, threshold);
        
        if (isRegression) {
          regressions.push({
            metricName,
            networkName: options.networkName,
            severity: this.calculateRegressionSeverity(trends, threshold),
            trend: trends.trend,
            percentageChange: trends.percentageChange,
            confidence: trends.confidence,
            detectedAt: new Date(),
            details: trends
          });
        }
        
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Could not analyze trends for ${metricName}: ${error.message}`));
      }
    }
    
    return regressions;
  }

  isRegression(trends, threshold) {
    const change = Math.abs(trends.percentageChange);
    
    if (threshold.type === 'increase') {
      return trends.percentageChange > threshold.threshold && trends.confidence > 0.3;
    } else if (threshold.type === 'decrease') {
      return trends.percentageChange < -threshold.threshold && trends.confidence > 0.3;
    }
    
    return false;
  }

  calculateRegressionSeverity(trends, threshold) {
    const change = Math.abs(trends.percentageChange);
    const baseThreshold = threshold.threshold;
    
    if (change < baseThreshold * 1.5) return 'minor';
    if (change < baseThreshold * 3) return 'moderate';
    return 'severe';
  }

  // Export time series data
  async exportTimeSeriesData(metricName, format = 'json', options = {}) {
    await this.initialize();
    
    const timeSeries = await this.getTimeSeries(metricName, options);
    
    switch (format.toLowerCase()) {
      case 'csv':
        return this.exportToCSV(timeSeries, metricName);
      case 'json':
        return JSON.stringify(timeSeries, null, 2);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  exportToCSV(timeSeries, metricName) {
    if (timeSeries.length === 0) {
      return 'timestamp,value,network_name,test_type,unit\\n';
    }
    
    const header = 'timestamp,value,network_name,test_type,unit\\n';
    const rows = timeSeries.map(point => 
      `${point.timestamp.toISOString()},${point.value},${point.networkName},${point.testType || ''},${point.unit || ''}`
    ).join('\\n');
    
    return header + rows;
  }

  // Utility methods
  async getAvailableMetrics(options = {}) {
    await this.initialize();
    
    const query = `
      SELECT DISTINCT metric_name, metric_unit, COUNT(*) as count
      FROM performance_metrics
      ${options.networkName ? 'WHERE network_name = ?' : ''}
      GROUP BY metric_name, metric_unit
      ORDER BY count DESC
    `;
    
    const stmt = this.db.db.prepare(query);
    const params = options.networkName ? [options.networkName] : [];
    
    return stmt.all(...params);
  }

  async getMetricSummary(metricName, options = {}) {
    await this.initialize();
    
    const timeSeries = await this.getTimeSeries(metricName, options);
    
    if (timeSeries.length === 0) {
      return null;
    }
    
    const values = timeSeries.map(point => point.value);
    const timeRange = {
      start: timeSeries[0].timestamp,
      end: timeSeries[timeSeries.length - 1].timestamp,
      duration: timeSeries[timeSeries.length - 1].timestamp - timeSeries[0].timestamp
    };
    
    return {
      metricName,
      dataPoints: timeSeries.length,
      timeRange,
      statistics: {
        mean: stats.mean(values),
        median: stats.median(values),
        min: Math.min(...values),
        max: Math.max(...values),
        stdDev: values.length > 1 ? stats.standardDeviation(values) : 0,
        variance: values.length > 1 ? stats.variance(values) : 0
      },
      unit: timeSeries[0].unit
    };
  }
}

module.exports = { TimeSeriesTracker };