const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');

class ResultsAnalyzer {
  constructor(options = {}) {
    this.options = {
      resultsDir: options.resultsDir || 'test-results',
      ...options
    };
  }

  async viewResults(options = {}) {
    try {
      const files = await this.getResultFiles(options);
      
      if (files.length === 0) {
        console.log(chalk.yellow('📁 No test results found'));
        return;
      }

      if (options.latest) {
        await this.displayLatestResults(files);
      } else if (options.since) {
        await this.displayResultsSince(files, new Date(options.since));
      } else {
        await this.displayAllResults(files, options);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to analyze results:'), error.message);
    }
  }

  async compareNetworks(options = {}) {
    try {
      const files = await this.getResultFiles(options);
      
      if (files.length === 0) {
        console.log(chalk.yellow('📁 No test results found for comparison'));
        return;
      }

      const results = await this.loadResults(files);
      const comparison = this.buildNetworkComparison(results);
      
      this.displayNetworkComparison(comparison);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to compare networks:'), error.message);
    }
  }

  async getResultFiles(options = {}) {
    const resultsPath = path.join(process.cwd(), this.options.resultsDir);
    
    try {
      const files = await fs.readdir(resultsPath);
      
      let resultFiles = files
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(resultsPath, file),
          stats: null
        }));

      // Get file stats and sort by modification time
      for (const file of resultFiles) {
        try {
          const stats = await fs.stat(file.path);
          file.stats = stats;
          file.timestamp = stats.mtime;
        } catch (error) {
          // Skip files we can't read
          continue;
        }
      }

      // Filter and sort
      resultFiles = resultFiles
        .filter(file => file.stats)
        .sort((a, b) => b.timestamp - a.timestamp);

      // Apply filters
      if (options.network) {
        resultFiles = resultFiles.filter(file => 
          file.name.includes(options.network) || 
          file.name.includes(this.getChainIdForNetwork(options.network))
        );
      }

      if (options.type) {
        resultFiles = resultFiles.filter(file => 
          file.name.includes(options.type.toLowerCase())
        );
      }

      return resultFiles;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow(`📁 Results directory not found: ${resultsPath}`));
        return [];
      }
      throw error;
    }
  }

  async displayLatestResults(files) {
    if (files.length === 0) return;
    
    console.log(chalk.cyan.bold('📊 Latest Test Results'));
    console.log(chalk.gray('='.repeat(50)));
    
    const latestFile = files[0];
    const results = await this.loadResultFile(latestFile.path);
    
    this.displayResultSummary(results, latestFile);
    this.displayDetailedResults(results);
  }

  async displayResultsSince(files, sinceDate) {
    const recentFiles = files.filter(file => file.timestamp > sinceDate);
    
    if (recentFiles.length === 0) {
      console.log(chalk.yellow(`📁 No results found since ${sinceDate.toLocaleDateString()}`));
      return;
    }
    
    console.log(chalk.cyan.bold(`📊 Test Results Since ${sinceDate.toLocaleDateString()}`));
    console.log(chalk.gray('='.repeat(50)));
    
    for (const file of recentFiles.slice(0, 10)) { // Limit to 10 most recent
      const results = await this.loadResultFile(file.path);
      this.displayResultSummary(results, file);
      console.log('');
    }
  }

  async displayAllResults(files, options) {
    const limit = options.limit || 20;
    const displayFiles = files.slice(0, limit);
    
    console.log(chalk.cyan.bold('📊 All Test Results'));
    console.log(chalk.gray('='.repeat(50)));
    
    const table = new Table({
      head: ['Date', 'Duration', 'Networks', 'Tests', 'Success Rate', 'File'],
      colWidths: [12, 10, 12, 15, 12, 30]
    });
    
    for (const file of displayFiles) {
      try {
        const results = await this.loadResultFile(file.path);
        const summary = this.calculateSummary(results);
        
        table.push([
          file.timestamp.toLocaleDateString(),
          this.formatDuration(summary.duration),
          summary.networks.toString(),
          summary.totalTests.toString(),
          `${(summary.successRate * 100).toFixed(1)}%`,
          file.name.substring(0, 25) + '...'
        ]);
        
      } catch (error) {
        // Skip corrupted files
        continue;
      }
    }
    
    console.log(table.toString());
    
    if (files.length > limit) {
      console.log(chalk.gray(`... and ${files.length - limit} more files`));
    }
  }

  async loadResults(files) {
    const results = [];
    
    for (const file of files) {
      try {
        const data = await this.loadResultFile(file.path);
        results.push({
          file: file.name,
          timestamp: file.timestamp,
          data
        });
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Skipping corrupted file: ${file.name}`));
      }
    }
    
    return results;
  }

  async loadResultFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  displayResultSummary(results, file) {
    const summary = this.calculateSummary(results);
    
    console.log(chalk.cyan(`📄 ${file.name}`));
    console.log(`📅 Date: ${file.timestamp.toLocaleString()}`);
    console.log(`⏱️  Duration: ${this.formatDuration(summary.duration)}`);
    console.log(`🌐 Networks: ${summary.networks}`);
    console.log(`🧪 Total Tests: ${summary.totalTests}`);
    console.log(`✅ Success Rate: ${(summary.successRate * 100).toFixed(1)}%`);
    
    if (summary.gasUsed > 0) {
      console.log(`⛽ Gas Used: ${this.formatNumber(summary.gasUsed)}`);
    }
  }

  displayDetailedResults(results) {
    if (results.results) {
      console.log(chalk.yellow('\\n🔍 Network Details:'));
      
      for (const [networkName, networkResult] of Object.entries(results.results)) {
        if (!networkResult || !networkResult.summary) continue;
        
        const { summary } = networkResult;
        const statusIcon = summary.overallSuccessRate === 1.0 ? '✅' : '⚠️';
        
        console.log(`\\n  ${statusIcon} ${networkName.toUpperCase()}:`);
        console.log(`    Tests: ${summary.successfulTests}/${summary.totalTests}`);
        console.log(`    Success Rate: ${(summary.overallSuccessRate * 100).toFixed(1)}%`);
        console.log(`    Duration: ${this.formatDuration(summary.totalDuration)}`);
        
        if (summary.totalGasUsed > 0) {
          console.log(`    Gas Used: ${this.formatNumber(summary.totalGasUsed)}`);
        }
        
        // Show failed tests
        if (networkResult.tests) {
          const failedTests = [];
          for (const [testType, testResult] of networkResult.tests) {
            if (!testResult.success) {
              failedTests.push(testType);
            }
          }
          
          if (failedTests.length > 0) {
            console.log(chalk.red(`    Failed: ${failedTests.join(', ')}`));
          }
        }
      }
    }
  }

  buildNetworkComparison(results) {
    const networks = new Map();
    
    // Aggregate results by network
    for (const result of results) {
      if (!result.data.results) continue;
      
      for (const [networkName, networkResult] of Object.entries(result.data.results)) {
        if (!networks.has(networkName)) {
          networks.set(networkName, {
            name: networkName,
            testRuns: 0,
            totalTests: 0,
            successfulTests: 0,
            totalDuration: 0,
            totalGasUsed: 0,
            averageSuccessRate: 0,
            testTypes: new Map()
          });
        }
        
        const network = networks.get(networkName);
        network.testRuns++;
        
        if (networkResult.summary) {
          network.totalTests += networkResult.summary.totalTests || 0;
          network.successfulTests += networkResult.summary.successfulTests || 0;
          network.totalDuration += networkResult.summary.totalDuration || 0;
          network.totalGasUsed += networkResult.summary.totalGasUsed || 0;
        }
        
        // Aggregate test types
        if (networkResult.tests) {
          for (const [testType, testResult] of Object.entries(networkResult.tests)) {
            if (!network.testTypes.has(testType)) {
              network.testTypes.set(testType, {
                runs: 0,
                successes: 0,
                totalDuration: 0,
                totalGasUsed: 0
              });
            }
            
            const testTypeStats = network.testTypes.get(testType);
            testTypeStats.runs++;
            if (testResult.success) testTypeStats.successes++;
            testTypeStats.totalDuration += testResult.duration || 0;
            testTypeStats.totalGasUsed += testResult.gasUsed || 0;
          }
        }
      }
    }
    
    // Calculate averages
    for (const network of networks.values()) {
      network.averageSuccessRate = network.totalTests > 0 ? 
        network.successfulTests / network.totalTests : 0;
      network.averageDuration = network.testRuns > 0 ? 
        network.totalDuration / network.testRuns : 0;
    }
    
    return Array.from(networks.values());
  }

  displayNetworkComparison(networks) {
    console.log(chalk.cyan.bold('🆚 Network Comparison'));
    console.log(chalk.gray('='.repeat(60)));
    
    // Overall comparison table
    const overallTable = new Table({
      head: ['Network', 'Test Runs', 'Avg Success Rate', 'Avg Duration', 'Total Gas Used'],
      colWidths: [15, 12, 16, 14, 16]
    });
    
    networks.forEach(network => {
      overallTable.push([
        network.name,
        network.testRuns.toString(),
        `${(network.averageSuccessRate * 100).toFixed(1)}%`,
        this.formatDuration(network.averageDuration),
        this.formatNumber(network.totalGasUsed)
      ]);
    });
    
    console.log(overallTable.toString());
    
    // Test type comparison
    console.log(chalk.yellow('\\n📋 Test Type Performance:'));
    
    const allTestTypes = new Set();
    networks.forEach(network => {
      network.testTypes.forEach((_, testType) => allTestTypes.add(testType));
    });
    
    allTestTypes.forEach(testType => {
      console.log(chalk.cyan(`\\n${testType.toUpperCase()} Tests:`));
      
      const testTable = new Table({
        head: ['Network', 'Runs', 'Success Rate', 'Avg Duration'],
        colWidths: [15, 8, 14, 14]
      });
      
      networks.forEach(network => {
        const testStats = network.testTypes.get(testType);
        if (testStats) {
          const successRate = testStats.runs > 0 ? 
            (testStats.successes / testStats.runs * 100).toFixed(1) : '0.0';
          const avgDuration = testStats.runs > 0 ? 
            testStats.totalDuration / testStats.runs : 0;
          
          testTable.push([
            network.name,
            testStats.runs.toString(),
            `${successRate}%`,
            this.formatDuration(avgDuration)
          ]);
        }
      });
      
      console.log(testTable.toString());
    });
    
    // Performance insights
    this.displayPerformanceInsights(networks);
  }

  displayPerformanceInsights(networks) {
    console.log(chalk.magenta.bold('\\n💡 Performance Insights:'));
    console.log(chalk.gray('='.repeat(40)));
    
    // Find best and worst performing networks
    const sortedBySuccessRate = [...networks].sort((a, b) => b.averageSuccessRate - a.averageSuccessRate);
    const sortedBySpeed = [...networks].sort((a, b) => a.averageDuration - b.averageDuration);
    
    if (sortedBySuccessRate.length > 0) {
      const best = sortedBySuccessRate[0];
      const worst = sortedBySuccessRate[sortedBySuccessRate.length - 1];
      
      console.log(`🏆 Most Reliable: ${best.name} (${(best.averageSuccessRate * 100).toFixed(1)}% success rate)`);
      if (sortedBySuccessRate.length > 1) {
        console.log(`⚠️  Least Reliable: ${worst.name} (${(worst.averageSuccessRate * 100).toFixed(1)}% success rate)`);
      }
    }
    
    if (sortedBySpeed.length > 0) {
      const fastest = sortedBySpeed[0];
      const slowest = sortedBySpeed[sortedBySpeed.length - 1];
      
      console.log(`⚡ Fastest: ${fastest.name} (${this.formatDuration(fastest.averageDuration)} avg)`);
      if (sortedBySpeed.length > 1) {
        console.log(`🐌 Slowest: ${slowest.name} (${this.formatDuration(slowest.averageDuration)} avg)`);
      }
    }
    
    // Gas efficiency
    const gasEfficient = [...networks]
      .filter(n => n.totalGasUsed > 0)
      .sort((a, b) => a.totalGasUsed - b.totalGasUsed);
    
    if (gasEfficient.length > 0) {
      console.log(`💰 Most Gas Efficient: ${gasEfficient[0].name} (${this.formatNumber(gasEfficient[0].totalGasUsed)} total)`);
    }
  }

  calculateSummary(results) {
    let totalTests = 0;
    let successfulTests = 0;
    let duration = 0;
    let gasUsed = 0;
    let networks = 0;
    
    if (results.results) {
      networks = Object.keys(results.results).length;
      
      for (const networkResult of Object.values(results.results)) {
        if (networkResult.summary) {
          totalTests += networkResult.summary.totalTests || 0;
          successfulTests += networkResult.summary.successfulTests || 0;
          gasUsed += networkResult.summary.totalGasUsed || 0;
        }
      }
    }
    
    if (results.duration) {
      duration = results.duration;
    } else if (results.summary?.totalDuration) {
      duration = results.summary.totalDuration;
    }
    
    return {
      totalTests,
      successfulTests,
      successRate: totalTests > 0 ? successfulTests / totalTests : 0,
      duration,
      gasUsed,
      networks
    };
  }

  getChainIdForNetwork(networkName) {
    const chainIds = {
      'sepolia': '11155111',
      'kasplex': '167012',
      'igra': '19416'
    };
    return chainIds[networkName.toLowerCase()] || '';
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  formatNumber(num) {
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(1)}B`;
    } else if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }
}

module.exports = { ResultsAnalyzer };