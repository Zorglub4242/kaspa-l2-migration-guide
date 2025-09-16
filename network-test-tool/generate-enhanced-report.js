#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

/**
 * Enhanced Comprehensive Blockchain Analysis Report Generator
 * Features detailed transaction analysis, contract deployment tracking,
 * cross-network comparisons, and USD cost calculations via CoinGecko
 */

// Network configurations with CoinGecko token IDs
const NETWORKS = {
  11155111: { 
    name: "Ethereum Sepolia", 
    explorer: "https://sepolia.etherscan.io", 
    token: "ETH", 
    color: "#3498db",
    coingeckoId: "ethereum"
  },
  167012: { 
    name: "Kasplex L2", 
    explorer: "https://explorer.testnet.kasplextest.xyz", 
    token: "KAS", 
    color: "#e74c3c",
    coingeckoId: "kaspa"
  },
  19416: { 
    name: "Igra L2", 
    explorer: "https://explorer.caravel.igralabs.com", 
    token: "iKAS", 
    color: "#f39c12",
    coingeckoId: "kaspa" // Using Kaspa as proxy
  }
};

// Command line argument parsing
const args = process.argv.slice(2);
const options = {
  since: null,
  latest: false,
  output: 'enhanced-blockchain-analysis.html',
  help: false
};

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  switch(args[i]) {
    case '--since':
      options.since = args[++i];
      break;
    case '--latest':
      options.latest = true;
      break;
    case '--output':
    case '-o':
      options.output = args[++i];
      break;
    case '--help':
    case '-h':
      options.help = true;
      break;
  }
}

if (options.help) {
  console.log(`
Enhanced Blockchain Analysis Report Generator

Usage: node generate-enhanced-report.js [options]

Options:
  --since <date>     Only include results since date (YYYY-MM-DD)
  --latest           Only use latest results for each network
  --output, -o       Output filename (default: enhanced-blockchain-analysis.html)
  --help, -h         Show this help message

Features:
  - Detailed transaction-level analysis
  - Contract deployment tracking with costs and timing
  - Cross-network comparison tables  
  - Clickable explorer links for all contracts and transactions
  - Gas pricing in Gwei, native tokens, and USD values
  - Real-time price data via CoinGecko API
`);
  process.exit(0);
}

/**
 * Fetch current cryptocurrency prices from CoinGecko
 */
async function fetchCryptoPrices() {
  return new Promise((resolve, reject) => {
    const coinIds = Object.values(NETWORKS)
      .map(n => n.coingeckoId)
      .filter((id, index, array) => array.indexOf(id) === index) // Remove duplicates
      .join(',');
    
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const prices = JSON.parse(data);
          resolve(prices);
        } catch (error) {
          console.warn('⚠️  Failed to fetch crypto prices, using fallback values');
          resolve({
            ethereum: { usd: 2500 },
            kaspa: { usd: 0.15 }
          });
        }
      });
    }).on('error', (error) => {
      console.warn('⚠️  Network error fetching prices, using fallback values');
      resolve({
        ethereum: { usd: 2500 },
        kaspa: { usd: 0.15 }
      });
    });
  });
}

/**
 * Convert gas cost to USD
 */
function calculateUSDCost(gasCost, gasPrice, chainId, prices) {
  const network = NETWORKS[chainId];
  if (!network || !prices) return 'N/A';
  
  const priceData = prices[network.coingeckoId];
  if (!priceData) return 'N/A';
  
  // Convert gas cost (wei) to native token
  const nativeAmount = parseFloat(gasCost) / 1e18;
  const usdCost = nativeAmount * priceData.usd;
  
  return usdCost.toFixed(6);
}

/**
 * Convert gas price to Gwei
 */
function toGwei(gasPrice) {
  return (parseFloat(gasPrice) / 1e9).toFixed(2);
}

/**
 * Convert gas cost to native token
 */
function toNativeToken(gasCost) {
  return (parseFloat(gasCost) / 1e18).toFixed(6);
}

/**
 * Load and parse test results
 */
function loadTestResults() {
  const testResultsDir = path.join(__dirname, 'test-results');
  
  if (!fs.existsSync(testResultsDir)) {
    console.error('❌ Test results directory not found:', testResultsDir);
    process.exit(1);
  }
  
  const files = fs.readdirSync(testResultsDir)
    .filter(f => f.endsWith('.json'))
    .filter(f => {
      if (options.latest) {
        return f.includes('-latest.json');
      }
      return true;
    })
    .filter(f => {
      if (options.since) {
        const match = f.match(/(\d{4}-\d{2}-\d{2})/);
        if (match) {
          const fileDate = match[1];
          return fileDate >= options.since;
        }
      }
      return true;
    });
  
  console.log(`📊 Loading ${files.length} test result files...`);
  
  const results = {};
  
  for (const file of files) {
    try {
      const filePath = path.join(testResultsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Handle both DeFi and EVM data structures
      let chainId;
      if (data.metadata && data.metadata.network) {
        // DeFi structure
        chainId = data.metadata.network.chainId;
      } else if (data.network && data.network.chainId) {
        // EVM structure
        chainId = data.network.chainId;
      } else {
        console.warn(`⚠️  Skipping file with unknown structure: ${file}`);
        continue;
      }
      
      if (!results[chainId]) {
        results[chainId] = [];
      }
      
      results[chainId].push({
        filename: file,
        data: data,
        type: data.metadata ? 'defi' : 'evm'
      });
    } catch (error) {
      console.warn(`⚠️  Skipping invalid file ${file}:`, error.message);
    }
  }
  
  return results;
}

/**
 * Generate Enhanced HTML Report
 */
async function generateEnhancedHTMLReport(testResults, prices) {
  const generatedDate = new Date().toISOString().split('T')[0];
  
  // Calculate cross-network summary
  let totalNetworks = 0;
  let totalContracts = 0;
  let totalTransactions = 0;
  let totalGasUsed = 0;
  let totalUSDCost = 0;
  
  const networkSummaries = {};
  
  for (const [chainId, results] of Object.entries(testResults)) {
    totalNetworks++;
    const network = NETWORKS[chainId];
    
    // Get the latest DeFi and EVM results for this network
    const defiResult = results.find(r => r.type === 'defi')?.data;
    const evmResult = results.find(r => r.type === 'evm')?.data;
    
    let contracts = 0;
    let transactions = 0;
    let gasUsed = 0;
    let successRate = 'N/A';
    let networkUSDCost = 0;
    
    // Process DeFi data if available
    if (defiResult) {
      contracts = Object.keys(defiResult.contracts || {}).length;
      transactions = defiResult.transactions?.length || 0;
      gasUsed = parseInt(defiResult.performance?.totalGasUsed?.replace(/,/g, '') || '0');
      successRate = defiResult.performance?.successRate || 'N/A';
      
      // Calculate USD cost for DeFi transactions
      if (defiResult.transactions) {
        for (const tx of defiResult.transactions) {
          const usdCost = parseFloat(calculateUSDCost(tx.gasCost, tx.gasPrice, chainId, prices));
          if (!isNaN(usdCost)) networkUSDCost += usdCost;
        }
      }
    }
    
    // Process EVM data if available (add to existing data)
    if (evmResult) {
      const evmTests = evmResult.tests || [];
      const evmTransactions = evmTests.length;
      const evmGasUsed = evmTests.reduce((sum, test) => sum + parseInt(test.gasUsed || '0'), 0);
      const evmSuccessRate = evmTests.filter(test => test.success).length / evmTests.length * 100;
      
      transactions += evmTransactions;
      gasUsed += evmGasUsed;
      
      // If no DeFi data, use EVM success rate
      if (!defiResult) {
        successRate = `${evmSuccessRate.toFixed(1)}%`;
      }
    }
    
    totalContracts += contracts;
    totalTransactions += transactions;
    totalGasUsed += gasUsed;
    totalUSDCost += networkUSDCost;
    
    networkSummaries[chainId] = {
      name: network?.name || `Network ${chainId}`,
      contracts,
      transactions,
      gasUsed,
      successRate,
      hasDefi: !!defiResult,
      hasEvm: !!evmResult,
      usdCost: networkUSDCost
    };
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced Blockchain Analysis Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            border-radius: 10px;
            margin-top: 20px;
            margin-bottom: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 40px 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
            margin: -20px -20px 40px -20px;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .header h2 {
            font-size: 1.2em;
            opacity: 0.9;
            margin-bottom: 20px;
        }

        .badges {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin: 20px 0;
            flex-wrap: wrap;
        }

        .badge {
            background: rgba(255,255,255,0.2);
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            backdrop-filter: blur(10px);
        }

        .executive-summary {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            border-left: 5px solid #28a745;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .summary-card .number {
            font-size: 2em;
            font-weight: bold;
            color: #28a745;
            margin-bottom: 10px;
        }

        .tabs {
            display: flex;
            border-bottom: 2px solid #ddd;
            margin-bottom: 20px;
            overflow-x: auto;
        }

        .tab {
            padding: 15px 25px;
            cursor: pointer;
            border: none;
            background: none;
            font-size: 16px;
            color: #666;
            border-bottom: 3px solid transparent;
            transition: all 0.3s ease;
            white-space: nowrap;
        }

        .tab.active {
            color: #007bff;
            border-bottom-color: #007bff;
            font-weight: bold;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .network-section {
            margin-bottom: 40px;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 10px;
            border-left: 5px solid #007bff;
        }

        .network-header {
            display: flex;
            align-items: center;
            margin-bottom: 25px;
        }

        .network-badge {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            margin-right: 15px;
        }

        .network-title {
            font-size: 1.8em;
            font-weight: bold;
            color: #333;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .data-table th {
            background: #007bff;
            color: white;
            padding: 15px 10px;
            text-align: left;
            font-weight: bold;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .data-table td {
            padding: 12px 10px;
            border-bottom: 1px solid #eee;
            vertical-align: top;
        }

        .data-table tr:hover {
            background-color: #f8f9fa;
        }

        .data-table tr:last-child td {
            border-bottom: none;
        }

        .explorer-link {
            color: #007bff;
            text-decoration: none;
            font-weight: bold;
            transition: color 0.3s ease;
        }

        .explorer-link:hover {
            color: #0056b3;
            text-decoration: underline;
        }

        .status-success {
            color: #28a745;
            font-weight: bold;
        }

        .status-failed {
            color: #dc3545;
            font-weight: bold;
        }

        .gas-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
            font-size: 0.85em;
        }

        .gas-gwei { color: #6c757d; }
        .gas-native { color: #495057; }
        .gas-usd { color: #28a745; font-weight: bold; }

        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-left: 4px solid #007bff;
        }

        .metric-card .value {
            font-size: 1.8em;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 8px;
        }

        .metric-card .label {
            color: #6c757d;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .comparison-table {
            width: 100%;
            margin-top: 30px;
        }

        .comparison-table th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .chart-container {
            margin: 30px 0;
            padding: 20px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .chart-title {
            text-align: center;
            margin-bottom: 20px;
            font-size: 1.4em;
            font-weight: bold;
            color: #333;
        }

        .timestamp {
            color: #6c757d;
            font-size: 0.8em;
            font-family: 'Courier New', monospace;
        }

        @media (max-width: 768px) {
            .container { margin: 10px; padding: 15px; }
            .header h1 { font-size: 2em; }
            .tabs { flex-wrap: wrap; }
            .tab { padding: 10px 15px; font-size: 14px; }
            .data-table { font-size: 0.8em; }
            .network-section { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Enhanced Blockchain Analysis Report</h1>
            <h2>Comprehensive Multi-Network Performance Analysis</h2>
            <div class="badges">
                <div class="badge">📊 Transaction Level Details</div>
                <div class="badge">💰 Real-Time USD Pricing</div>
                <div class="badge">🔗 Explorer Integration</div>
                <div class="badge">⚡ Cross-Network Comparison</div>
            </div>
            <p style="margin-top: 20px; opacity: 0.8;">Generated on ${generatedDate}</p>
        </div>

        <div class="executive-summary">
            <h3 style="margin-bottom: 20px; color: #333;">📋 Executive Summary</h3>
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="number">${totalNetworks}</div>
                    <div>Networks Tested</div>
                </div>
                <div class="summary-card">
                    <div class="number">${totalContracts.toLocaleString()}</div>
                    <div>Total Contracts Deployed</div>
                </div>
                <div class="summary-card">
                    <div class="number">${totalTransactions.toLocaleString()}</div>
                    <div>Total Transactions</div>
                </div>
                <div class="summary-card">
                    <div class="number">${totalGasUsed.toLocaleString()}</div>
                    <div>Total Gas Used</div>
                </div>
                <div class="summary-card">
                    <div class="number">$${totalUSDCost.toFixed(2)}</div>
                    <div>Total USD Cost</div>
                </div>
            </div>
        </div>

        <div class="tabs">
            <button class="tab active" onclick="openTab(event, 'cross-network-comparison')">📊 Cross-Network Comparison</button>
            ${Object.keys(testResults).map(chainId => {
              const network = NETWORKS[chainId];
              return `<button class="tab" onclick="openTab(event, 'network-${chainId}')">${network?.name || chainId}</button>`;
            }).join('')}
            <button class="tab" onclick="openTab(event, 'contract-analysis')">📋 Contract Analysis</button>
            <button class="tab" onclick="openTab(event, 'transaction-analysis')">💸 Transaction Analysis</button>
        </div>

        <div id="cross-network-comparison" class="tab-content active">
            <h2 style="margin-bottom: 25px;">📊 Cross-Network Performance Comparison</h2>
            
            <table class="data-table comparison-table">
                <thead>
                    <tr>
                        <th>Network</th>
                        <th>Contracts Deployed</th>
                        <th>Total Transactions</th>
                        <th>Gas Used</th>
                        <th>Success Rate</th>
                        <th>Avg Gas/Tx</th>
                        <th>Est. USD Cost</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(networkSummaries).map(([chainId, summary]) => {
                      const network = NETWORKS[chainId];
                      const avgGas = summary.transactions > 0 ? (summary.gasUsed / summary.transactions).toLocaleString() : 'N/A';
                      
                      // Calculate estimated USD cost for this network
                      let networkUSDCost = 0;
                      const results = testResults[chainId];
                      const latest = results?.[results.length - 1]?.data;
                      if (latest?.transactions) {
                        for (const tx of latest.transactions) {
                          const usdCost = parseFloat(calculateUSDCost(tx.gasCost, tx.gasPrice, chainId, prices));
                          if (!isNaN(usdCost)) networkUSDCost += usdCost;
                        }
                      }
                      
                      return `
                        <tr>
                            <td>
                                <div style="display: flex; align-items: center;">
                                    <div class="network-badge" style="background-color: ${network?.color || '#999'};"></div>
                                    ${summary.name}
                                </div>
                            </td>
                            <td>${summary.contracts}</td>
                            <td>${summary.transactions.toLocaleString()}</td>
                            <td>${summary.gasUsed.toLocaleString()}</td>
                            <td class="status-success">${summary.successRate}</td>
                            <td>${avgGas}</td>
                            <td class="gas-usd">$${networkUSDCost.toFixed(2)}</td>
                        </tr>
                      `;
                    }).join('')}
                </tbody>
            </table>

            <div class="chart-container">
                <div class="chart-title">Gas Usage Comparison Across Networks</div>
                <canvas id="gasComparisonChart"></canvas>
            </div>
        </div>

        ${Object.entries(testResults).map(([chainId, results]) => {
          const network = NETWORKS[chainId];
          const latest = results[results.length - 1]?.data;
          
          if (!latest) return '';
          
          return `
            <div id="network-${chainId}" class="tab-content">
                <div class="network-section">
                    <div class="network-header">
                        <div class="network-badge" style="background-color: ${network?.color || '#999'};"></div>
                        <div class="network-title">${network?.name || `Network ${chainId}`}</div>
                    </div>

                    <div class="summary-grid">
                        <div class="metric-card">
                            <div class="value">${Object.keys(latest.contracts || {}).length}</div>
                            <div class="label">Contracts Deployed</div>
                        </div>
                        <div class="metric-card">
                            <div class="value">${(latest.transactions?.length || 0).toLocaleString()}</div>
                            <div class="label">Total Transactions</div>
                        </div>
                        <div class="metric-card">
                            <div class="value">${latest.performance?.totalGasUsed || 'N/A'}</div>
                            <div class="label">Total Gas Used</div>
                        </div>
                        <div class="metric-card">
                            <div class="value">${latest.performance?.successRate || 'N/A'}</div>
                            <div class="label">Success Rate</div>
                        </div>
                    </div>

                    <h3 style="margin: 30px 0 15px 0;">📋 Contract Deployments</h3>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Contract Name</th>
                                <th>Address</th>
                                <th>Gas Used</th>
                                <th>Gas Cost</th>
                                <th>Explorer</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(latest.contracts || {}).map(([name, contract]) => {
                              const gasUsed = contract.gasUsed || 'Unknown';
                              const explorerUrl = contract.explorerLink?.replace('Local Network', network?.explorer || '');
                              
                              return `
                                <tr>
                                    <td><strong>${name}</strong></td>
                                    <td><code>${contract.address}</code></td>
                                    <td>${typeof gasUsed === 'number' ? gasUsed.toLocaleString() : gasUsed}</td>
                                    <td>
                                        <div class="gas-info">
                                            <span class="gas-native">~${network?.token || 'Token'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        ${explorerUrl && explorerUrl !== 'Local Network/address/' + contract.address 
                                          ? `<a href="${explorerUrl}" target="_blank" class="explorer-link">🔍 View</a>`
                                          : 'N/A'
                                        }
                                    </td>
                                </tr>
                              `;
                            }).join('')}
                        </tbody>
                    </table>

                    <h3 style="margin: 30px 0 15px 0;">💸 Transaction Details</h3>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Hash</th>
                                <th>Gas Used</th>
                                <th>Gas Price</th>
                                <th>Cost Analysis</th>
                                <th>Timestamp</th>
                                <th>Status</th>
                                <th>Explorer</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(latest.transactions || []).map(tx => {
                              const gasPrice = tx.gasPrice || '0';
                              const gasCost = tx.gasCost || '0';
                              const usdCost = calculateUSDCost(gasCost, gasPrice, chainId, prices);
                              
                              return `
                                <tr>
                                    <td><strong>${tx.type?.replace(/_/g, ' ') || 'Unknown'}</strong></td>
                                    <td><code style="font-size: 0.8em;">${tx.hash?.substring(0, 12)}...${tx.hash?.substring(tx.hash.length - 8)}</code></td>
                                    <td>${(tx.gasUsed || 0).toLocaleString()}</td>
                                    <td>${toGwei(gasPrice)} Gwei</td>
                                    <td>
                                        <div class="gas-info">
                                            <span class="gas-gwei">${toGwei(gasPrice)} Gwei</span>
                                            <span class="gas-native">${toNativeToken(gasCost)} ${network?.token || 'Token'}</span>
                                            <span class="gas-usd">$${usdCost}</span>
                                        </div>
                                    </td>
                                    <td class="timestamp">${new Date(tx.timestamp).toLocaleString()}</td>
                                    <td class="status-${tx.status === 'success' ? 'success' : 'failed'}">${tx.status || 'Unknown'}</td>
                                    <td>
                                        ${tx.explorerLink 
                                          ? `<a href="${tx.explorerLink}" target="_blank" class="explorer-link">🔍 View</a>`
                                          : 'N/A'
                                        }
                                    </td>
                                </tr>
                              `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
          `;
        }).join('')}

        <div id="contract-analysis" class="tab-content">
            <h2 style="margin-bottom: 25px;">📋 Comprehensive Contract Analysis</h2>
            
            ${Object.entries(testResults).map(([chainId, results]) => {
              const network = NETWORKS[chainId];
              const latest = results[results.length - 1]?.data;
              
              if (!latest || !latest.contracts) return '';
              
              return `
                <div class="network-section">
                    <div class="network-header">
                        <div class="network-badge" style="background-color: ${network?.color || '#999'};"></div>
                        <div class="network-title">${network?.name || `Network ${chainId}`} Contracts</div>
                    </div>
                    
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Contract Name</th>
                                <th>Address</th>
                                <th>Deployment Tx</th>
                                <th>Gas Used</th>
                                <th>Deploy Cost</th>
                                <th>Explorer Links</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(latest.contracts).map(([name, contract]) => {
                              const gasUsed = contract.gasUsed || 'Unknown';
                              const contractExplorer = contract.explorerLink?.replace('Local Network', network?.explorer || '');
                              const txExplorer = contract.deploymentTx && contract.deploymentTx !== 'Unknown' 
                                ? `${network?.explorer || ''}/tx/${contract.deploymentTx}` 
                                : null;
                              
                              return `
                                <tr>
                                    <td><strong>${name}</strong></td>
                                    <td><code>${contract.address}</code></td>
                                    <td><code style="font-size: 0.8em;">${contract.deploymentTx === 'Unknown' ? 'N/A' : contract.deploymentTx?.substring(0, 16) + '...'}</code></td>
                                    <td>${typeof gasUsed === 'number' ? gasUsed.toLocaleString() : gasUsed}</td>
                                    <td>
                                        <div class="gas-info">
                                            <span class="gas-native">${network?.token || 'Token'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        ${contractExplorer && contractExplorer !== 'Local Network/address/' + contract.address 
                                          ? `<a href="${contractExplorer}" target="_blank" class="explorer-link">📋 Contract</a>`
                                          : ''
                                        }
                                        ${txExplorer 
                                          ? ` <a href="${txExplorer}" target="_blank" class="explorer-link">💸 Deploy Tx</a>`
                                          : ''
                                        }
                                    </td>
                                </tr>
                              `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
              `;
            }).join('')}
        </div>

        <div id="transaction-analysis" class="tab-content">
            <h2 style="margin-bottom: 25px;">💸 Comprehensive Transaction Analysis</h2>
            
            ${Object.entries(testResults).map(([chainId, results]) => {
              const network = NETWORKS[chainId];
              const latest = results[results.length - 1]?.data;
              
              if (!latest || !latest.transactions) return '';
              
              return `
                <div class="network-section">
                    <div class="network-header">
                        <div class="network-badge" style="background-color: ${network?.color || '#999'};"></div>
                        <div class="network-title">${network?.name || `Network ${chainId}`} Transactions</div>
                    </div>
                    
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Transaction Type</th>
                                <th>Transaction Hash</th>
                                <th>Block</th>
                                <th>Gas Used</th>
                                <th>Gas Price (Gwei)</th>
                                <th>Native Cost</th>
                                <th>USD Cost</th>
                                <th>Timestamp</th>
                                <th>Status</th>
                                <th>Explorer</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${latest.transactions.map(tx => {
                              const gasPrice = tx.gasPrice || '0';
                              const gasCost = tx.gasCost || '0';
                              const usdCost = calculateUSDCost(gasCost, gasPrice, chainId, prices);
                              
                              return `
                                <tr>
                                    <td><strong>${tx.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'}</strong></td>
                                    <td><code style="font-size: 0.8em;">${tx.hash || 'N/A'}</code></td>
                                    <td>${tx.blockNumber || 'N/A'}</td>
                                    <td>${(tx.gasUsed || 0).toLocaleString()}</td>
                                    <td>${toGwei(gasPrice)}</td>
                                    <td>${toNativeToken(gasCost)} ${network?.token || 'Token'}</td>
                                    <td class="gas-usd">$${usdCost}</td>
                                    <td class="timestamp">${tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'N/A'}</td>
                                    <td class="status-${tx.status === 'success' ? 'success' : 'failed'}">${tx.status?.toUpperCase() || 'UNKNOWN'}</td>
                                    <td>
                                        ${tx.explorerLink 
                                          ? `<a href="${tx.explorerLink}" target="_blank" class="explorer-link">🔍 View Transaction</a>`
                                          : 'N/A'
                                        }
                                    </td>
                                </tr>
                              `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
              `;
            }).join('')}
        </div>

        <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 10px; text-align: center; color: #6c757d;">
            <p>📊 Enhanced Report Generated: ${new Date().toLocaleString()}</p>
            <p>💰 Prices provided by CoinGecko API • 🔗 Explorer links open in new tab</p>
            <p>⚡ Cross-network analysis across ${totalNetworks} blockchain networks</p>
        </div>
    </div>

    <script>
        function openTab(evt, tabName) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tab-content");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].classList.remove("active");
            }
            tablinks = document.getElementsByClassName("tab");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].classList.remove("active");
            }
            document.getElementById(tabName).classList.add("active");
            evt.currentTarget.classList.add("active");
        }

        // Initialize gas comparison chart
        const ctx = document.getElementById('gasComparisonChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [${Object.keys(networkSummaries).map(chainId => `"${NETWORKS[chainId]?.name || chainId}"`).join(', ')}],
                    datasets: [{
                        label: 'Total Gas Used',
                        data: [${Object.values(networkSummaries).map(s => s.gasUsed).join(', ')}],
                        backgroundColor: [${Object.keys(networkSummaries).map(chainId => `"${NETWORKS[chainId]?.color || '#999'}"`).join(', ')}],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Gas Used'
                            }
                        }
                    }
                }
            });
        }
    </script>
</body>
</html>`;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Enhanced Blockchain Analysis Report Generator');
  console.log('===============================================');
  
  try {
    // Fetch cryptocurrency prices
    console.log('💰 Fetching cryptocurrency prices from CoinGecko...');
    const prices = await fetchCryptoPrices();
    console.log('✅ Price data loaded successfully');
    
    // Load test results
    console.log('📊 Loading test results...');
    const testResults = loadTestResults();
    
    if (Object.keys(testResults).length === 0) {
      console.error('❌ No test results found. Please run some tests first.');
      process.exit(1);
    }
    
    console.log(`✅ Loaded results for ${Object.keys(testResults).length} networks`);
    
    // Generate enhanced HTML report
    console.log('📝 Generating enhanced HTML report...');
    const htmlContent = await generateEnhancedHTMLReport(testResults, prices);
    
    // Write report to file
    fs.writeFileSync(options.output, htmlContent);
    
    console.log('✅ Enhanced report generated successfully!');
    console.log(`📄 Report saved to: ${options.output}`);
    console.log('🌐 Open the file in your browser to view the interactive report');
    
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}