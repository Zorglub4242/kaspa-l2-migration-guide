const stats = require('simple-statistics');
const chalk = require('chalk');
const { TestDatabase } = require('./database');
const { TimeSeriesTracker } = require('./time-series');

class AnalyticsEngine {
  constructor(database = null) {
    this.db = database || new TestDatabase();
    this.timeSeriesTracker = new TimeSeriesTracker(this.db);
    this.isInitialized = false;
  }

  async initialize() {
    if (!this.isInitialized) {
      await this.db.initialize();
      await this.timeSeriesTracker.initialize();
      this.isInitialized = true;
    }
  }

  // Comprehensive network performance analysis
  async analyzeNetworkPerformance(options = {}) {
    await this.initialize();
    
    const networks = options.networks || ['sepolia', 'kasplex', 'igra'];
    const timeRange = {
      since: options.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
      until: options.until || new Date().toISOString()
    };
    
    const analysis = {
      timeRange,
      networks: {},
      comparative: {},
      trends: {},
      regressions: [],
      recommendations: [],
      generatedAt: new Date()
    };
    
    // Analyze each network
    for (const networkName of networks) {
      console.log(chalk.blue(`📊 Analyzing ${networkName} performance...`));
      
      try {
        const networkAnalysis = await this.analyzeIndividualNetwork(networkName, timeRange);
        analysis.networks[networkName] = networkAnalysis;
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Could not analyze ${networkName}: ${error.message}`));
        analysis.networks[networkName] = { error: error.message };
      }
    }
    
    // Comparative analysis
    analysis.comparative = await this.performComparativeAnalysis(networks, timeRange);
    
    // Trend analysis
    analysis.trends = await this.analyzeTrends(networks, timeRange);
    
    // Regression detection
    analysis.regressions = await this.detectAllRegressions(networks, timeRange);
    
    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis);
    
    return analysis;
  }

  async analyzeIndividualNetwork(networkName, timeRange) {
    const networkResults = this.db.getNetworkResults();
    const testResults = this.db.getTestResults();
    
    // Filter by network and time range
    const networkData = networkResults.filter(result => 
      result.network_name === networkName &&
      new Date(result.start_time) >= new Date(timeRange.since) &&
      new Date(result.start_time) <= new Date(timeRange.until)
    );
    
    if (networkData.length === 0) {
      return { message: 'No data available for this time range' };
    }
    
    // Calculate basic statistics
    const successRates = networkData.map(r => r.success_rate);
    const durations = networkData.map(r => r.duration).filter(d => d > 0);
    const gasUsed = networkData.map(r => r.total_gas_used).filter(g => g > 0);
    
    const basicStats = {
      testRuns: networkData.length,
      successRate: {
        mean: stats.mean(successRates),
        min: Math.min(...successRates),
        max: Math.max(...successRates),
        stdDev: stats.standardDeviation(successRates)
      },
      duration: durations.length > 0 ? {
        mean: stats.mean(durations),
        median: stats.median(durations),
        min: Math.min(...durations),
        max: Math.max(...durations),
        stdDev: stats.standardDeviation(durations)
      } : null,
      gasUsage: gasUsed.length > 0 ? {
        mean: stats.mean(gasUsed),
        median: stats.median(gasUsed),
        min: Math.min(...gasUsed),
        max: Math.max(...gasUsed),
        total: gasUsed.reduce((sum, g) => sum + g, 0)
      } : null
    };
    
    // Test type breakdown
    const testTypeStats = await this.analyzeTestTypePerformance(networkName, timeRange);
    
    // Performance over time
    const performanceTimeline = await this.getPerformanceTimeline(networkName, timeRange);
    
    // Reliability metrics
    const reliabilityMetrics = await this.calculateReliabilityMetrics(networkName, timeRange);
    
    return {
      basicStats,
      testTypeStats,
      performanceTimeline,
      reliabilityMetrics
    };
  }

  async analyzeTestTypePerformance(networkName, timeRange) {
    const testResults = this.db.getTestResults(null, networkName);
    
    const filteredResults = testResults.filter(result =>
      new Date(result.start_time) >= new Date(timeRange.since) &&
      new Date(result.start_time) <= new Date(timeRange.until)
    );
    
    const testTypes = [...new Set(filteredResults.map(r => r.test_type))];
    const typeStats = {};
    
    for (const testType of testTypes) {
      const typeResults = filteredResults.filter(r => r.test_type === testType);
      
      if (typeResults.length === 0) continue;
      
      const successes = typeResults.filter(r => r.success).length;
      const durations = typeResults.map(r => r.duration).filter(d => d > 0);
      const gasUsed = typeResults.map(r => r.gas_used).filter(g => g > 0);
      
      typeStats[testType] = {
        totalTests: typeResults.length,
        successRate: successes / typeResults.length,
        avgDuration: durations.length > 0 ? stats.mean(durations) : 0,
        avgGasUsed: gasUsed.length > 0 ? stats.mean(gasUsed) : 0,
        reliability: this.calculateTestTypeReliability(typeResults)
      };
    }
    
    return typeStats;
  }

  calculateTestTypeReliability(typeResults) {
    if (typeResults.length === 0) return 0;
    
    // Calculate reliability based on success rate and consistency
    const successRate = typeResults.filter(r => r.success).length / typeResults.length;
    const durations = typeResults.map(r => r.duration).filter(d => d > 0);
    
    if (durations.length < 2) return successRate;
    
    const avgDuration = stats.mean(durations);
    const stdDev = stats.standardDeviation(durations);
    const consistency = stdDev > 0 ? Math.max(0, 1 - (stdDev / avgDuration)) : 1;
    
    // Weighted combination of success rate and consistency
    return (successRate * 0.7) + (consistency * 0.3);
  }

  async getPerformanceTimeline(networkName, timeRange) {
    const networkResults = this.db.getNetworkResults();
    const timelineData = networkResults
      .filter(result => 
        result.network_name === networkName &&
        new Date(result.start_time) >= new Date(timeRange.since) &&
        new Date(result.start_time) <= new Date(timeRange.until)
      )
      .map(result => ({
        timestamp: new Date(result.start_time),
        successRate: result.success_rate,
        duration: result.duration,
        gasUsed: result.total_gas_used,
        testCount: result.total_tests
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    return timelineData;
  }

  async calculateReliabilityMetrics(networkName, timeRange) {
    const timeline = await this.getPerformanceTimeline(networkName, timeRange);
    
    if (timeline.length === 0) {
      return { uptime: 0, consistency: 0, availability: 0 };
    }
    
    // Calculate uptime (percentage of successful test runs)
    const successfulRuns = timeline.filter(t => t.successRate > 0.9).length;
    const uptime = successfulRuns / timeline.length;
    
    // Calculate consistency (based on standard deviation of success rates)
    const successRates = timeline.map(t => t.successRate);
    const consistency = successRates.length > 1 ? 
      Math.max(0, 1 - (stats.standardDeviation(successRates) / stats.mean(successRates))) : 1;
    
    // Calculate availability (percentage of time network was responsive)
    const responsiveRuns = timeline.filter(t => t.duration > 0 && t.duration < 300000).length; // Less than 5 minutes
    const availability = responsiveRuns / timeline.length;
    
    // Calculate MTBF (Mean Time Between Failures) and MTTR (Mean Time To Recovery)
    const failures = timeline.filter(t => t.successRate < 0.5);
    const mtbf = failures.length > 0 ? 
      (timeline[timeline.length - 1].timestamp - timeline[0].timestamp) / failures.length : 
      Infinity;
    
    return {
      uptime,
      consistency,
      availability,
      mtbf: mtbf === Infinity ? null : mtbf,
      totalRuns: timeline.length,
      failureCount: failures.length
    };
  }

  async performComparativeAnalysis(networks, timeRange) {
    const comparison = {
      rankings: {},
      strengths: {},
      weaknesses: {},
      statistical_tests: {}
    };
    
    const metrics = ['success_rate', 'duration', 'gas_used', 'reliability'];
    
    for (const metric of metrics) {
      const networkValues = {};
      
      // Collect data for each network
      for (const networkName of networks) {
        try {
          const networkData = await this.getNetworkMetricValues(networkName, metric, timeRange);
          if (networkData.length > 0) {
            networkValues[networkName] = networkData;
          }
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Could not get ${metric} for ${networkName}: ${error.message}`));
        }
      }
      
      if (Object.keys(networkValues).length < 2) continue;
      
      // Rank networks for this metric
      const rankings = this.rankNetworks(networkValues, metric);
      comparison.rankings[metric] = rankings;
      
      // Statistical significance testing
      if (Object.keys(networkValues).length === 2) {
        const networkNames = Object.keys(networkValues);
        const statTest = this.performTTest(
          networkValues[networkNames[0]], 
          networkValues[networkNames[1]]
        );
        comparison.statistical_tests[`${metric}_${networkNames[0]}_vs_${networkNames[1]}`] = statTest;
      }
      
      // ANOVA for multiple networks
      if (Object.keys(networkValues).length > 2) {
        const anova = this.performANOVA(Object.values(networkValues));
        comparison.statistical_tests[`${metric}_anova`] = anova;
      }
    }
    
    // Identify strengths and weaknesses
    for (const networkName of networks) {
      comparison.strengths[networkName] = this.identifyNetworkStrengths(networkName, comparison.rankings);
      comparison.weaknesses[networkName] = this.identifyNetworkWeaknesses(networkName, comparison.rankings);
    }
    
    return comparison;
  }

  async getNetworkMetricValues(networkName, metric, timeRange) {
    switch (metric) {
      case 'success_rate':
        const networkResults = this.db.getNetworkResults();
        return networkResults
          .filter(r => r.network_name === networkName)
          .map(r => r.success_rate);
      
      case 'duration':
        const durations = this.db.getNetworkResults();
        return durations
          .filter(r => r.network_name === networkName && r.duration > 0)
          .map(r => r.duration);
      
      case 'gas_used':
        const gasResults = this.db.getNetworkResults();
        return gasResults
          .filter(r => r.network_name === networkName && r.total_gas_used > 0)
          .map(r => r.total_gas_used);
      
      case 'reliability':
        const reliability = await this.calculateReliabilityMetrics(networkName, timeRange);
        return [reliability.uptime];
      
      default:
        return [];
    }
  }

  rankNetworks(networkValues, metric) {
    const networkStats = {};
    
    // Calculate statistics for each network
    for (const [networkName, values] of Object.entries(networkValues)) {
      networkStats[networkName] = {
        mean: stats.mean(values),
        median: stats.median(values),
        stdDev: values.length > 1 ? stats.standardDeviation(values) : 0,
        count: values.length
      };
    }
    
    // Determine ranking order (higher is better for success_rate, lower for duration/gas_used)
    const higherIsBetter = metric === 'success_rate' || metric === 'reliability';
    
    // Sort networks by mean value
    const sorted = Object.entries(networkStats).sort(([, a], [, b]) => 
      higherIsBetter ? b.mean - a.mean : a.mean - b.mean
    );
    
    return sorted.map(([networkName, stats], index) => ({
      rank: index + 1,
      networkName,
      ...stats,
      percentile: ((sorted.length - index) / sorted.length) * 100
    }));
  }

  performTTest(sample1, sample2) {
    if (sample1.length < 2 || sample2.length < 2) {
      return { valid: false, reason: 'Insufficient data for t-test' };
    }
    
    const mean1 = stats.mean(sample1);
    const mean2 = stats.mean(sample2);
    const var1 = stats.variance(sample1);
    const var2 = stats.variance(sample2);
    const n1 = sample1.length;
    const n2 = sample2.length;
    
    // Welch's t-test (unequal variances)
    const pooledStdErr = Math.sqrt((var1 / n1) + (var2 / n2));
    const tStatistic = (mean1 - mean2) / pooledStdErr;
    
    // Degrees of freedom (Welch-Satterthwaite equation)
    const df = Math.pow((var1/n1) + (var2/n2), 2) / 
               (Math.pow(var1/n1, 2)/(n1-1) + Math.pow(var2/n2, 2)/(n2-1));
    
    // Effect size (Cohen's d)
    const pooledStdDev = Math.sqrt(((n1-1)*var1 + (n2-1)*var2) / (n1+n2-2));
    const cohensD = (mean1 - mean2) / pooledStdDev;
    
    return {
      valid: true,
      tStatistic,
      degreesOfFreedom: df,
      pValue: this.estimatePValue(Math.abs(tStatistic), df), // Simplified p-value estimation
      cohensD,
      effectSize: this.interpretEffectSize(Math.abs(cohensD)),
      significant: Math.abs(tStatistic) > 2.0, // Rough significance test
      meanDifference: mean1 - mean2,
      percentDifference: ((mean1 - mean2) / mean2) * 100
    };
  }

  performANOVA(groups) {
    if (groups.length < 2) {
      return { valid: false, reason: 'Need at least 2 groups for ANOVA' };
    }
    
    const allValues = groups.flat();
    const grandMean = stats.mean(allValues);
    
    // Between-group sum of squares
    let ssBetween = 0;
    let totalN = 0;
    const groupMeans = [];
    
    for (const group of groups) {
      if (group.length === 0) continue;
      const groupMean = stats.mean(group);
      groupMeans.push(groupMean);
      ssBetween += group.length * Math.pow(groupMean - grandMean, 2);
      totalN += group.length;
    }
    
    // Within-group sum of squares
    let ssWithin = 0;
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const groupMean = groupMeans[i];
      for (const value of group) {
        ssWithin += Math.pow(value - groupMean, 2);
      }
    }
    
    const dfBetween = groups.length - 1;
    const dfWithin = totalN - groups.length;
    const msBetween = ssBetween / dfBetween;
    const msWithin = ssWithin / dfWithin;
    const fStatistic = msBetween / msWithin;
    
    return {
      valid: true,
      fStatistic,
      dfBetween,
      dfWithin,
      pValue: this.estimateFPValue(fStatistic, dfBetween, dfWithin),
      significant: fStatistic > 3.0, // Rough significance test
      ssBetween,
      ssWithin,
      msBetween,
      msWithin
    };
  }

  // Simplified p-value estimation (for demonstration purposes)
  estimatePValue(tStat, df) {
    // Very rough approximation - in production, use proper statistical library
    if (tStat > 3) return 0.001;
    if (tStat > 2.5) return 0.01;
    if (tStat > 2) return 0.05;
    if (tStat > 1.5) return 0.1;
    return 0.2;
  }

  estimateFPValue(fStat, dfBetween, dfWithin) {
    // Very rough approximation
    if (fStat > 5) return 0.001;
    if (fStat > 3.5) return 0.01;
    if (fStat > 2.5) return 0.05;
    return 0.1;
  }

  interpretEffectSize(cohensD) {
    if (cohensD < 0.2) return 'negligible';
    if (cohensD < 0.5) return 'small';
    if (cohensD < 0.8) return 'medium';
    return 'large';
  }

  identifyNetworkStrengths(networkName, rankings) {
    const strengths = [];
    
    for (const [metric, ranking] of Object.entries(rankings)) {
      const networkRank = ranking.find(r => r.networkName === networkName);
      if (networkRank && networkRank.rank === 1) {
        strengths.push({
          metric,
          rank: networkRank.rank,
          value: networkRank.mean,
          advantage: 'market_leader'
        });
      } else if (networkRank && networkRank.rank <= 2 && ranking.length > 2) {
        strengths.push({
          metric,
          rank: networkRank.rank,
          value: networkRank.mean,
          advantage: 'top_performer'
        });
      }
    }
    
    return strengths;
  }

  identifyNetworkWeaknesses(networkName, rankings) {
    const weaknesses = [];
    
    for (const [metric, ranking] of Object.entries(rankings)) {
      const networkRank = ranking.find(r => r.networkName === networkName);
      if (networkRank && networkRank.rank === ranking.length && ranking.length > 1) {
        weaknesses.push({
          metric,
          rank: networkRank.rank,
          value: networkRank.mean,
          severity: 'needs_improvement'
        });
      } else if (networkRank && networkRank.percentile < 40) {
        weaknesses.push({
          metric,
          rank: networkRank.rank,
          value: networkRank.mean,
          severity: 'below_average'
        });
      }
    }
    
    return weaknesses;
  }

  async analyzeTrends(networks, timeRange) {
    const trends = {};
    
    const metrics = ['success_rate', 'response_time', 'gas_used', 'tps'];
    
    for (const networkName of networks) {
      trends[networkName] = {};
      
      for (const metricName of metrics) {
        try {
          const trend = await this.timeSeriesTracker.analyzeTrends(metricName, {
            networkName,
            since: timeRange.since,
            limit: 50
          });
          
          trends[networkName][metricName] = trend;
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Could not analyze trends for ${networkName}:${metricName}`));
        }
      }
    }
    
    return trends;
  }

  async detectAllRegressions(networks, timeRange) {
    const allRegressions = [];
    
    for (const networkName of networks) {
      try {
        const regressions = await this.timeSeriesTracker.detectRegressions({
          networkName,
          since: timeRange.since
        });
        
        allRegressions.push(...regressions);
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Could not detect regressions for ${networkName}`));
      }
    }
    
    return allRegressions.sort((a, b) => {
      const severityOrder = { 'severe': 3, 'moderate': 2, 'minor': 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  generateRecommendations(analysis) {
    const recommendations = [];
    
    // Performance recommendations
    for (const [networkName, networkData] of Object.entries(analysis.networks)) {
      if (networkData.error) continue;
      
      const reliability = networkData.reliabilityMetrics;
      
      // Reliability recommendations
      if (reliability && reliability.uptime < 0.95) {
        recommendations.push({
          type: 'reliability',
          severity: 'high',
          network: networkName,
          issue: 'Low uptime',
          recommendation: `${networkName} uptime is ${(reliability.uptime * 100).toFixed(1)}%. Investigate failure causes and improve error handling.`,
          metric: 'uptime',
          currentValue: reliability.uptime,
          targetValue: 0.95
        });
      }
      
      if (reliability && reliability.consistency < 0.8) {
        recommendations.push({
          type: 'consistency',
          severity: 'medium',
          network: networkName,
          issue: 'Inconsistent performance',
          recommendation: `${networkName} shows inconsistent performance. Consider optimizing for more predictable response times.`,
          metric: 'consistency',
          currentValue: reliability.consistency,
          targetValue: 0.8
        });
      }
    }
    
    // Regression recommendations
    for (const regression of analysis.regressions) {
      recommendations.push({
        type: 'regression',
        severity: regression.severity,
        network: regression.networkName,
        issue: `Performance regression in ${regression.metricName}`,
        recommendation: `${regression.metricName} has degraded by ${regression.percentageChange.toFixed(1)}%. Investigate recent changes and optimize.`,
        metric: regression.metricName,
        trend: regression.trend,
        confidence: regression.confidence
      });
    }
    
    // Comparative recommendations
    if (analysis.comparative.rankings) {
      for (const [metric, rankings] of Object.entries(analysis.comparative.rankings)) {
        const worst = rankings[rankings.length - 1];
        const best = rankings[0];
        
        if (rankings.length > 1 && worst.percentile < 30) {
          recommendations.push({
            type: 'comparative',
            severity: 'medium',
            network: worst.networkName,
            issue: `Poor ${metric} performance`,
            recommendation: `${worst.networkName} ranks last in ${metric}. Consider implementing optimizations similar to ${best.networkName}.`,
            metric: metric,
            currentRank: worst.rank,
            benchmark: best.networkName
          });
        }
      }
    }
    
    return recommendations.sort((a, b) => {
      const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  // Export analytics data
  async exportAnalytics(analysis, format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(analysis, null, 2);
      
      case 'csv':
        return this.convertAnalyticsToCSV(analysis);
      
      case 'summary':
        return this.generateAnalyticsSummary(analysis);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  convertAnalyticsToCSV(analysis) {
    // Convert key metrics to CSV format
    let csv = 'network,metric,value,rank,percentile\\n';
    
    if (analysis.comparative.rankings) {
      for (const [metric, rankings] of Object.entries(analysis.comparative.rankings)) {
        for (const ranking of rankings) {
          csv += `${ranking.networkName},${metric},${ranking.mean},${ranking.rank},${ranking.percentile}\\n`;
        }
      }
    }
    
    return csv;
  }

  generateAnalyticsSummary(analysis) {
    let summary = 'BLOCKCHAIN NETWORK ANALYTICS SUMMARY\\n';
    summary += '='.repeat(50) + '\\n\\n';
    
    // Time range
    summary += `Analysis Period: ${analysis.timeRange.since} to ${analysis.timeRange.until}\\n`;
    summary += `Generated: ${analysis.generatedAt.toISOString()}\\n\\n`;
    
    // Network overview
    summary += 'NETWORK OVERVIEW\\n';
    summary += '-'.repeat(20) + '\\n';
    
    for (const [networkName, networkData] of Object.entries(analysis.networks)) {
      if (networkData.error) {
        summary += `${networkName}: ${networkData.error}\\n`;
        continue;
      }
      
      const reliability = networkData.reliabilityMetrics;
      summary += `${networkName}:\\n`;
      summary += `  Test Runs: ${networkData.basicStats.testRuns}\\n`;
      summary += `  Avg Success Rate: ${(networkData.basicStats.successRate.mean * 100).toFixed(1)}%\\n`;
      
      if (reliability) {
        summary += `  Uptime: ${(reliability.uptime * 100).toFixed(1)}%\\n`;
        summary += `  Consistency: ${(reliability.consistency * 100).toFixed(1)}%\\n`;
      }
      summary += '\\n';
    }
    
    // Top recommendations
    if (analysis.recommendations.length > 0) {
      summary += 'TOP RECOMMENDATIONS\\n';
      summary += '-'.repeat(20) + '\\n';
      
      analysis.recommendations.slice(0, 5).forEach((rec, index) => {
        summary += `${index + 1}. [${rec.severity.toUpperCase()}] ${rec.issue}\\n`;
        summary += `   ${rec.recommendation}\\n\\n`;
      });
    }
    
    // Regression alerts
    if (analysis.regressions.length > 0) {
      summary += 'PERFORMANCE REGRESSIONS\\n';
      summary += '-'.repeat(25) + '\\n';
      
      analysis.regressions.forEach(regression => {
        summary += `${regression.networkName}: ${regression.metricName} degraded by ${regression.percentageChange.toFixed(1)}% (${regression.severity})\\n`;
      });
      summary += '\\n';
    }
    
    return summary;
  }
}

module.exports = { AnalyticsEngine };