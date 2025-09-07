const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Multi-Network DeFi Comparison Test
 * Runs identical test suites on ETH Sepolia and Kasplex V2
 * Generates comprehensive comparative analysis
 */

class MultiNetworkTester {
  constructor() {
    this.results = {};
    this.networks = ['sepolia', 'kasplex'];
    this.startTime = Date.now();
  }

  async runCommand(command, network) {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Running on ${network}: ${command}`);
      exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Error on ${network}: ${error.message}`);
          resolve({ success: false, error: error.message, stdout, stderr });
        } else {
          console.log(`✅ Completed on ${network}`);
          resolve({ success: true, stdout, stderr });
        }
      });
    });
  }

  async testNetwork(network) {
    console.log(`\n🌐 TESTING NETWORK: ${network.toUpperCase()}`);
    console.log('='.repeat(60));

    const testStart = Date.now();
    
    try {
      // Set network environment
      process.env.NETWORK = network;
      
      // Run the enhanced test suite
      const result = await this.runCommand(
        `npx hardhat run scripts/enhanced-defi-comprehensive.js --network ${network}`, 
        network
      );

      const duration = Date.now() - testStart;

      if (result.success) {
        // Parse results from output
        const metrics = this.parseResults(result.stdout, network);
        
        this.results[network] = {
          success: true,
          duration,
          metrics,
          output: result.stdout,
          timestamp: new Date().toISOString()
        };
        
        console.log(`✅ ${network} test completed in ${duration}ms`);
      } else {
        this.results[network] = {
          success: false,
          duration,
          error: result.error,
          output: result.stdout,
          stderr: result.stderr,
          timestamp: new Date().toISOString()
        };
        
        console.log(`❌ ${network} test failed: ${result.error}`);
      }
      
    } catch (error) {
      this.results[network] = {
        success: false,
        error: error.message,
        duration: Date.now() - testStart,
        timestamp: new Date().toISOString()
      };
    }
  }

  parseResults(stdout, network) {
    // Extract metrics from stdout
    const lines = stdout.split('\n');
    const metrics = {
      network: network,
      transactions: 0,
      gasUsed: 0,
      duration: 0,
      tps: 0,
      deployments: {},
      costs: {}
    };

    // Parse transaction counts
    const txMatch = stdout.match(/Total Transactions: (\\d+)/);
    if (txMatch) metrics.transactions = parseInt(txMatch[1]);

    // Parse gas usage
    const gasMatch = stdout.match(/Total Gas: ([\\d,]+)/);
    if (gasMatch) metrics.gasUsed = parseInt(gasMatch[1].replace(/,/g, ''));

    // Parse TPS
    const tpsMatch = stdout.match(/Throughput: ([\\d.]+) TPS/);
    if (tpsMatch) metrics.tps = parseFloat(tpsMatch[1]);

    // Parse duration
    const durationMatch = stdout.match(/Total Duration: (\\d+)ms/);
    if (durationMatch) metrics.duration = parseInt(durationMatch[1]);

    // Parse contract addresses
    const addressMatches = stdout.matchAll(/([\\w]+): (0x[a-fA-F0-9]{40})/g);
    for (const match of addressMatches) {
      metrics.deployments[match[1]] = match[2];
    }

    return metrics;
  }

  async generateComparativeReport() {
    console.log('\n📊 GENERATING COMPARATIVE ANALYSIS');
    console.log('='.repeat(60));

    const totalDuration = Date.now() - this.startTime;
    
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalTestDuration: totalDuration,
        networks: this.networks,
        comparisonType: 'ETH_Sepolia_vs_Kasplex_V2'
      },
      results: this.results,
      comparison: this.generateComparison(),
      summary: this.generateSummary()
    };

    // Save detailed JSON report
    const jsonPath = path.join(process.cwd(), 'test-results', 'network-comparison.json');
    await fs.mkdir(path.dirname(jsonPath), { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

    // Generate markdown report
    await this.generateMarkdownReport(report);
    
    // Generate Discord summary
    await this.generateDiscordSummary(report);

    console.log('✅ Comparative analysis complete!');
    console.log(`📁 Reports saved to: test-results/`);
    
    return report;
  }

  generateComparison() {
    const sepolia = this.results.sepolia;
    const kasplex = this.results.kasplex;

    if (!sepolia?.success || !kasplex?.success) {
      return { error: 'Both networks must complete successfully for comparison' };
    }

    const comparison = {
      performance: {
        tps: {
          sepolia: sepolia.metrics.tps,
          kasplex: kasplex.metrics.tps,
          winner: sepolia.metrics.tps > kasplex.metrics.tps ? 'Sepolia' : 'Kasplex',
          difference: Math.abs(sepolia.metrics.tps - kasplex.metrics.tps).toFixed(2)
        },
        duration: {
          sepolia: sepolia.metrics.duration,
          kasplex: kasplex.metrics.duration,
          winner: sepolia.metrics.duration < kasplex.metrics.duration ? 'Sepolia' : 'Kasplex',
          difference: Math.abs(sepolia.metrics.duration - kasplex.metrics.duration)
        },
        gasEfficiency: {
          sepolia: sepolia.metrics.gasUsed,
          kasplex: kasplex.metrics.gasUsed,
          winner: sepolia.metrics.gasUsed < kasplex.metrics.gasUsed ? 'Sepolia' : 'Kasplex',
          difference: Math.abs(sepolia.metrics.gasUsed - kasplex.metrics.gasUsed)
        }
      },
      networkInfo: {
        sepolia: {
          chainId: '11155111',
          explorer: 'https://sepolia.etherscan.io',
          type: 'Ethereum L1 Testnet'
        },
        kasplex: {
          chainId: '167012',
          explorer: 'https://explorer.testnet.kasplextest.xyz',
          type: 'Kasplex L2'
        }
      }
    };

    return comparison;
  }

  generateSummary() {
    const successful = Object.values(this.results).filter(r => r.success).length;
    const failed = Object.values(this.results).filter(r => !r.success).length;

    return {
      networksTest: this.networks.length,
      successful,
      failed,
      overallSuccess: failed === 0,
      totalDuration: Date.now() - this.startTime
    };
  }

  async generateMarkdownReport(report) {
    const markdown = `# 🌐 Multi-Network DeFi Comparison Report

## 📊 Executive Summary

**Test Completion**: ${report.summary.successful}/${report.summary.networksTest} networks successful  
**Total Duration**: ${report.summary.totalDuration}ms  
**Timestamp**: ${report.metadata.timestamp}  

## 🏆 Performance Winners

${report.comparison.error ? `⚠️ ${report.comparison.error}` : `
| Metric | Sepolia | Kasplex | Winner | Difference |
|--------|---------|---------|---------|------------|
| **TPS** | ${report.comparison.performance.tps.sepolia} | ${report.comparison.performance.tps.kasplex} | 🏆 ${report.comparison.performance.tps.winner} | ${report.comparison.performance.tps.difference} |
| **Duration** | ${report.comparison.performance.duration.sepolia}ms | ${report.comparison.performance.duration.kasplex}ms | 🏆 ${report.comparison.performance.duration.winner} | ${report.comparison.performance.duration.difference}ms |
| **Gas Used** | ${report.comparison.performance.gasEfficiency.sepolia.toLocaleString()} | ${report.comparison.performance.gasEfficiency.kasplex.toLocaleString()} | 🏆 ${report.comparison.performance.gasEfficiency.winner} | ${report.comparison.performance.gasEfficiency.difference.toLocaleString()} |
`}

## 📋 Network Details

### ETH Sepolia
- **Chain ID**: 11155111
- **Type**: Ethereum L1 Testnet
- **Explorer**: [sepolia.etherscan.io](https://sepolia.etherscan.io)
- **Status**: ${this.results.sepolia?.success ? '✅ Success' : '❌ Failed'}

### Kasplex V2
- **Chain ID**: 167012
- **Type**: Kasplex L2
- **Explorer**: [explorer.testnet.kasplextest.xyz](https://explorer.testnet.kasplextest.xyz)
- **Status**: ${this.results.kasplex?.success ? '✅ Success' : '❌ Failed'}

## 📊 Detailed Results

${Object.entries(this.results).map(([network, result]) => `
### ${network.toUpperCase()}
- **Success**: ${result.success ? '✅' : '❌'}
- **Duration**: ${result.duration}ms
${result.success ? `
- **Transactions**: ${result.metrics?.transactions || 'N/A'}
- **TPS**: ${result.metrics?.tps || 'N/A'}
- **Gas Used**: ${result.metrics?.gasUsed?.toLocaleString() || 'N/A'}
` : `
- **Error**: ${result.error}
`}
`).join('')}

## 🔗 Contract Deployments

${Object.entries(this.results).map(([network, result]) => `
### ${network.toUpperCase()} Contracts
${result.success && result.metrics?.deployments ? 
  Object.entries(result.metrics.deployments).map(([name, address]) => 
    `- **${name}**: \`${address}\` ([View](${network === 'sepolia' ? 'https://sepolia.etherscan.io/address/' : 'https://explorer.testnet.kasplextest.xyz/address/'}${address}))`
  ).join('\n') 
  : 'Deployment failed or data unavailable'}
`).join('')}

---
*Generated: ${new Date().toISOString()}*  
*Enhanced Multi-Network Load Tester v1.0*
`;

    const markdownPath = path.join(process.cwd(), 'test-results', 'NETWORK-COMPARISON.md');
    await fs.writeFile(markdownPath, markdown);
  }

  async generateDiscordSummary(report) {
    const summary = `🌐 **Multi-Network DeFi Test Results** 🌐

${report.summary.overallSuccess ? '✅' : '⚠️'} **${report.summary.successful}/${report.summary.networksTest} Networks Successful**

${!report.comparison.error ? `
🏆 **Performance Winners:**
• **Speed**: ${report.comparison.performance.tps.winner} (${report.comparison.performance.tps.difference} TPS difference)
• **Efficiency**: ${report.comparison.performance.duration.winner} (${report.comparison.performance.duration.difference}ms faster)
• **Gas Usage**: ${report.comparison.performance.gasEfficiency.winner} (${report.comparison.performance.gasEfficiency.difference.toLocaleString()} gas difference)

📊 **Head-to-Head:**
• **ETH Sepolia**: ${this.results.sepolia?.metrics?.tps || 'N/A'} TPS, ${this.results.sepolia?.metrics?.duration || 'N/A'}ms
• **Kasplex V2**: ${this.results.kasplex?.metrics?.tps || 'N/A'} TPS, ${this.results.kasplex?.metrics?.duration || 'N/A'}ms
` : '⚠️ Comparison unavailable - check individual network results'}

📁 **Full analysis available in network-comparison reports!**

*Multi-Network Load Tester - ${new Date().toLocaleDateString()}*
`;

    const discordPath = path.join(process.cwd(), 'test-results', 'DISCORD-COMPARISON.txt');
    await fs.writeFile(discordPath, summary);
  }
}

async function main() {
  console.log('🚀 MULTI-NETWORK DEFI COMPARISON TEST');
  console.log('='.repeat(80));
  console.log('🌐 Testing: ETH Sepolia vs Kasplex V2');
  console.log('📊 Comparing: TPS, Gas Usage, Transaction Times, Costs');
  console.log();

  const tester = new MultiNetworkTester();

  // Test each network
  for (const network of tester.networks) {
    await tester.testNetwork(network);
  }

  // Generate comparative analysis
  const report = await tester.generateComparativeReport();

  console.log('\n🎉 MULTI-NETWORK COMPARISON COMPLETE!');
  console.log(`📊 Total Duration: ${report.summary.totalDuration}ms`);
  console.log(`✅ Successful: ${report.summary.successful}/${report.summary.networksTest}`);
  console.log('📁 Check test-results/ for detailed reports');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MultiNetworkTester };