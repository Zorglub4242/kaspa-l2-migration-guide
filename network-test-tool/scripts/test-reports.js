#!/usr/bin/env node

/**
 * Test script for report generation
 * Creates a simple HTML report from database data
 */

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

async function generateTestReport() {
  console.log(chalk.cyan('📊 Generating test report...'));

  let db;
  let data = {
    hasDatabase: false,
    testResults: [],
    contractDeployments: [],
    networks: []
  };

  try {
    // Try to connect to database
    db = new Database('./data/test-results.db', {
      readonly: true,
      fileMustExist: true
    });
    data.hasDatabase = true;
    console.log(chalk.green('✅ Connected to database'));

    // Get test results summary
    const testSummary = db.prepare(`
      SELECT
        chain_id,
        COUNT(*) as total_tests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as passed_tests,
        AVG(execution_time) as avg_execution_time,
        SUM(gas_used) as total_gas_used
      FROM test_results
      GROUP BY chain_id
    `).all();

    // Get recent test results
    const recentTests = db.prepare(`
      SELECT * FROM test_results
      ORDER BY timestamp DESC
      LIMIT 20
    `).all();

    // Get contract deployments
    const contracts = db.prepare(`
      SELECT * FROM contract_deployments
      WHERE is_active = 1
      ORDER BY chain_id, contract_type, contract_name
    `).all();

    data.testSummary = testSummary;
    data.recentTests = recentTests;
    data.contracts = contracts;

  } catch (error) {
    console.warn(chalk.yellow(`⚠️ Database not available: ${error.message}`));
    console.log(chalk.gray('Using sample data instead'));

    // Use sample data
    data.testSummary = [
      { chain_id: 11155111, total_tests: 50, passed_tests: 48, avg_execution_time: 1200, total_gas_used: 5000000 },
      { chain_id: 167012, total_tests: 45, passed_tests: 45, avg_execution_time: 800, total_gas_used: 4500000 },
      { chain_id: 19416, total_tests: 40, passed_tests: 38, avg_execution_time: 900, total_gas_used: 4000000 }
    ];
  } finally {
    if (db) db.close();
  }

  // Generate HTML report
  const html = generateHTML(data);

  // Save report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `test-report-${timestamp}.html`;
  const filepath = path.join('reports', filename);

  await fs.mkdir('reports', { recursive: true });
  await fs.writeFile(filepath, html);

  console.log(chalk.green(`✅ Report saved to: ${filepath}`));
  return filepath;
}

function generateHTML(data) {
  const networkNames = {
    11155111: 'Ethereum Sepolia',
    167012: 'Kasplex L2',
    19416: 'Igra L2'
  };

  const networkIcons = {
    11155111: '🔷',
    167012: '🟢',
    19416: '🟣'
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Network Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .header h1 {
            font-size: 36px;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }

        .header p {
            opacity: 0.9;
            font-size: 14px;
        }

        .status-badge {
            display: inline-block;
            background: ${data.hasDatabase ? '#2ecc71' : '#f39c12'};
            padding: 5px 15px;
            border-radius: 20px;
            margin-top: 10px;
            font-size: 12px;
        }

        .content {
            padding: 40px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }

        .summary-card {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }

        .summary-card:hover {
            transform: translateY(-5px);
        }

        .network-name {
            font-size: 20px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .network-icon {
            font-size: 28px;
        }

        .metric {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(0,0,0,0.1);
        }

        .metric:last-child {
            border-bottom: none;
        }

        .metric-label {
            color: #7f8c8d;
            font-size: 14px;
        }

        .metric-value {
            font-weight: bold;
            color: #2c3e50;
        }

        .success-rate {
            font-size: 32px;
            font-weight: bold;
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            margin-top: 15px;
        }

        .rate-high { color: #27ae60; }
        .rate-medium { color: #f39c12; }
        .rate-low { color: #e74c3c; }

        .section-title {
            font-size: 24px;
            color: #2c3e50;
            margin: 40px 0 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #3498db;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        th, td {
            padding: 15px;
            text-align: left;
        }

        tbody tr {
            border-bottom: 1px solid #ecf0f1;
            transition: background 0.3s ease;
        }

        tbody tr:hover {
            background: #f8f9fa;
        }

        .status-passed {
            color: #27ae60;
            font-weight: bold;
        }

        .status-failed {
            color: #e74c3c;
            font-weight: bold;
        }

        .footer {
            background: #2c3e50;
            color: white;
            text-align: center;
            padding: 30px;
            margin-top: 40px;
        }

        .footer p {
            opacity: 0.8;
            font-size: 14px;
        }

        @media print {
            body {
                background: white;
            }
            .container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Network Test Report</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <div class="status-badge">
                ${data.hasDatabase ? '✅ Database Connected' : '⚠️ Using Sample Data'}
            </div>
        </div>

        <div class="content">
            ${data.testSummary && data.testSummary.length > 0 ? `
            <div class="summary-grid">
                ${data.testSummary.map(network => {
                  const successRate = network.total_tests > 0
                    ? ((network.passed_tests / network.total_tests) * 100).toFixed(1)
                    : 0;
                  const rateClass = successRate >= 95 ? 'rate-high' : successRate >= 80 ? 'rate-medium' : 'rate-low';

                  return `
                    <div class="summary-card">
                        <div class="network-name">
                            <span class="network-icon">${networkIcons[network.chain_id] || '⚪'}</span>
                            ${networkNames[network.chain_id] || `Chain ${network.chain_id}`}
                        </div>
                        <div class="metric">
                            <span class="metric-label">Chain ID:</span>
                            <span class="metric-value">${network.chain_id}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Total Tests:</span>
                            <span class="metric-value">${network.total_tests}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Passed Tests:</span>
                            <span class="metric-value">${network.passed_tests}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Avg Execution:</span>
                            <span class="metric-value">${(network.avg_execution_time / 1000).toFixed(2)}s</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Total Gas:</span>
                            <span class="metric-value">${(network.total_gas_used / 1e6).toFixed(2)}M</span>
                        </div>
                        <div class="success-rate ${rateClass}">
                            ${successRate}%
                        </div>
                    </div>
                  `;
                }).join('')}
            </div>
            ` : '<p>No test data available</p>'}

            ${data.contracts && data.contracts.length > 0 ? `
            <h2 class="section-title">📝 Deployed Contracts</h2>
            <table>
                <thead>
                    <tr>
                        <th>Network</th>
                        <th>Contract</th>
                        <th>Type</th>
                        <th>Address</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.contracts.slice(0, 10).map(contract => `
                        <tr>
                            <td>${networkNames[contract.chain_id] || `Chain ${contract.chain_id}`}</td>
                            <td>${contract.contract_name}</td>
                            <td>${contract.contract_type}</td>
                            <td style="font-family: monospace; font-size: 12px;">
                                ${contract.contract_address.substring(0, 10)}...${contract.contract_address.substring(contract.contract_address.length - 8)}
                            </td>
                            <td class="${contract.health_status === 'healthy' ? 'status-passed' : 'status-failed'}">
                                ${contract.health_status === 'healthy' ? '✅ Healthy' : '⚠️ Unknown'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}

            ${data.recentTests && data.recentTests.length > 0 ? `
            <h2 class="section-title">📊 Recent Test Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Network</th>
                        <th>Test Name</th>
                        <th>Execution Time</th>
                        <th>Gas Used</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.recentTests.slice(0, 10).map(test => `
                        <tr>
                            <td>${networkNames[test.chain_id] || `Chain ${test.chain_id}`}</td>
                            <td>${test.test_name}</td>
                            <td>${(test.execution_time / 1000).toFixed(3)}s</td>
                            <td>${test.gas_used ? (test.gas_used / 1000).toFixed(0) + 'k' : 'N/A'}</td>
                            <td class="${test.success ? 'status-passed' : 'status-failed'}">
                                ${test.success ? '✅ Passed' : '❌ Failed'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}
        </div>

        <div class="footer">
            <p>Generated by Network Test Tool - Report System v1.0.0</p>
            <p>© 2025 Kaspa L2 Testing Team</p>
        </div>
    </div>
</body>
</html>`;
}

// Run the test
generateTestReport().catch(error => {
  console.error(chalk.red(`❌ Error generating report: ${error.message}`));
  process.exit(1);
});