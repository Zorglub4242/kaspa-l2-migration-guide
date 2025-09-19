const express = require('express');
const path = require('path');
const fs = require('fs');
const { TestDatabase } = require('./lib/database');
const { NetworkConfigLoader } = require('./lib/network-config-loader');
const { priceFetcher } = require('./utils/price-fetcher');
const chalk = require('chalk');

class CostDashboardServer {
    constructor(port = 3000) {
        this.app = express();
        this.port = port;
        this.database = new TestDatabase();
        this.networkLoader = new NetworkConfigLoader();
        this.priceFetcher = priceFetcher;
        this.networks = new Map();

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));
    }

    setupRoutes() {
        // API Routes
        this.app.get('/api/networks', this.getNetworks.bind(this));
        this.app.get('/api/runs', this.getRuns.bind(this));
        this.app.get('/api/comparison', this.getComparison.bind(this));
        this.app.get('/api/comparison/run/:runId', this.getRunComparison.bind(this));
        this.app.get('/api/prices', this.getPrices.bind(this));
        this.app.get('/api/export/csv', this.exportCSV.bind(this));
        this.app.get('/api/export/pdf', this.exportPDF.bind(this));

        // Serve dashboard HTML
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
        });

        // Serve comparison page
        this.app.get('/comparison', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'comparison.html'));
        });
    }

    async initialize() {
        try {
            // Initialize database
            await this.database.initialize();
            console.log(chalk.green('✓ Database initialized'));

            // Load all network configurations
            await this.networkLoader.loadAll();
            const networks = this.networkLoader.getAllNetworks();
            for (const network of networks) {
                this.networks.set(network.id, network);
            }
            console.log(chalk.green(`✓ Loaded ${this.networks.size} network configurations`));

            // Price fetcher is already initialized as singleton
            console.log(chalk.green('✓ Price fetcher ready'));

        } catch (error) {
            console.error(chalk.red('Failed to initialize dashboard:'), error);
            throw error;
        }
    }

    // API endpoint to get all configured networks
    async getNetworks(req, res) {
        try {
            const networksArray = Array.from(this.networks.values()).map(network => ({
                id: network.id,
                name: network.name,
                chainId: network.chainId,
                symbol: network.symbol,
                type: network.type || 'testnet'
            }));

            res.json({ success: true, networks: networksArray });
        } catch (error) {
            console.error(chalk.red('Error fetching networks:'), error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // API endpoint to get test runs with cost calculations
    async getRuns(req, res) {
        try {
            const { startDate, endDate, networks, runId } = req.query;

            let query = 'SELECT * FROM test_results WHERE 1=1';
            const params = [];

            if (runId) {
                query += ' AND run_id = ?';
                params.push(runId);
            }

            if (startDate) {
                query += ' AND start_time >= ?';
                params.push(new Date(startDate).toISOString());
            }

            if (endDate) {
                query += ' AND start_time <= ?';
                params.push(new Date(endDate).toISOString());
            }

            if (networks) {
                const networkList = networks.split(',').map(n => n.trim());
                const placeholders = networkList.map(() => '?').join(',');
                query += ` AND network_name IN (${placeholders})`;
                params.push(...networkList);
            }

            query += ' ORDER BY start_time DESC';

            const runs = this.database.db.prepare(query).all(...params);

            // Group by run_id and calculate costs
            const runMap = new Map();

            for (const test of runs) {
                if (!runMap.has(test.run_id)) {
                    // Get chain_id from network configuration
                    const network = this.networks.get(test.network_name.toLowerCase()) ||
                                   Array.from(this.networks.values()).find(n =>
                                       n.name.toLowerCase() === test.network_name.toLowerCase()
                                   );

                    runMap.set(test.run_id, {
                        runId: test.run_id,
                        network: test.network_name,
                        chainId: network ? network.chainId : null,
                        timestamp: new Date(test.start_time).getTime(),
                        tests: [],
                        totalGasUsed: 0,
                        successCount: 0,
                        failureCount: 0
                    });
                }

                const run = runMap.get(test.run_id);
                run.tests.push(test);
                run.totalGasUsed += test.gas_used || 0;

                if (test.success) {
                    run.successCount++;
                } else {
                    run.failureCount++;
                }
            }

            // Calculate costs for each run
            const runsWithCosts = [];
            for (const run of runMap.values()) {
                const network = this.networks.get(run.network.toLowerCase()) ||
                               Array.from(this.networks.values()).find(n =>
                                   n.name.toLowerCase() === run.network.toLowerCase() ||
                                   n.chainId === run.chainId
                               );

                // Get average gas price from tests
                const avgGasPrice = run.tests.reduce((sum, test) =>
                    sum + (test.gas_price || 0), 0) / run.tests.length || 0;

                // Calculate testnet cost
                const testnetCost = network ?
                    (run.totalGasUsed * avgGasPrice) / 1e18 : 0;

                // Get mainnet price estimates
                const mainnetEquivalent = await this.calculateMainnetCost(
                    run.totalGasUsed,
                    network ? network.symbol : 'ETH'
                );

                runsWithCosts.push({
                    ...run,
                    testCount: run.tests.length,
                    successRate: run.tests.length > 0 ?
                        (run.successCount / run.tests.length * 100).toFixed(2) : 0,
                    avgGasPrice: avgGasPrice,
                    testnetCost: testnetCost,
                    mainnetEstimate: mainnetEquivalent.usdCost,
                    tokenPrice: mainnetEquivalent.tokenPrice
                });
            }

            res.json({
                success: true,
                runs: runsWithCosts,
                total: runsWithCosts.length
            });

        } catch (error) {
            console.error(chalk.red('Error fetching runs:'), error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // API endpoint for run-specific comparison
    async getRunComparison(req, res) {
        try {
            const { runId } = req.params;

            // Get the actual gas used for this run
            const runData = this.database.db.prepare(`
                SELECT SUM(gas_used) as totalGas, network_name
                FROM test_results
                WHERE run_id = ?
                GROUP BY run_id
            `).get(runId);

            if (!runData) {
                return res.status(404).json({
                    success: false,
                    error: 'Run not found'
                });
            }

            const gasAmount = runData.totalGas || 1000000;
            const comparisons = [];

            for (const [networkId, network] of this.networks) {
                // Get current prices
                const tokenSymbol = network.symbol || 'ETH';
                const tokenPrice = await this.priceFetcher.fetchPrice(tokenSymbol);

                // Get gas price for network
                let gasPrice = 30; // Default gas price in gwei
                if (network.gasConfig) {
                    if (network.gasConfig.fixed) {
                        gasPrice = parseFloat(network.gasConfig.fixed);
                    } else if (network.gasConfig.fallback) {
                        gasPrice = parseFloat(network.gasConfig.fallback);
                    } else if (network.gasConfig.strategy === 'percentage') {
                        gasPrice = 30 * (1 + (network.gasConfig.percentage || 10) / 100);
                    }
                }

                // Special handling for Kasplex and Igra - use 50 gwei for comparison
                if (network.id === 'kasplex' || network.id === 'igra') {
                    gasPrice = 50;
                }

                // Get mainnet gas price from config or use testnet price for networks already on mainnet
                let mainnetGasPrice = gasPrice; // Default to testnet gas price
                if (network.gasConfig && network.gasConfig.mainnetGasPrice) {
                    mainnetGasPrice = parseFloat(network.gasConfig.mainnetGasPrice);
                }

                // Calculate testnet costs
                const tokenCost = (gasAmount * gasPrice) / 1e9;
                const usdCost = tokenCost * tokenPrice;

                // Calculate mainnet costs
                const mainnetTokenCost = (gasAmount * mainnetGasPrice) / 1e9;
                const mainnetUsdCost = mainnetTokenCost * tokenPrice;

                // Calculate percentage vs ETH mainnet
                const ethPrice = await this.priceFetcher.fetchPrice('ETH');
                const ethMainnetGasPrice = 20; // Standard ETH mainnet gas price
                const ethCost = (gasAmount * ethMainnetGasPrice) / 1e9 * ethPrice;
                const percentVsEth = ethCost > 0 ? ((usdCost / ethCost) * 100).toFixed(2) : 0;

                // Mark if this is the actual network the run was executed on
                const isActualNetwork = network.name.toLowerCase() === runData.network_name.toLowerCase();

                comparisons.push({
                    network: network.name,
                    networkId: network.id,
                    chainId: network.chainId,
                    token: tokenSymbol,
                    tokenPrice: tokenPrice,
                    gasPrice: gasPrice,
                    mainnetGasPrice: mainnetGasPrice,
                    tokenCost: tokenCost.toFixed(6),
                    usdCost: usdCost.toFixed(4),
                    mainnetTokenCost: mainnetTokenCost.toFixed(6),
                    mainnetUsdCost: mainnetUsdCost.toFixed(4),
                    percentVsEth: percentVsEth,
                    type: network.type || 'testnet',
                    isActualNetwork: isActualNetwork
                });
            }

            // Sort by USD cost ascending
            comparisons.sort((a, b) => parseFloat(a.usdCost) - parseFloat(b.usdCost));

            res.json({
                success: true,
                runId: runId,
                actualNetwork: runData.network_name,
                gasAmount: gasAmount,
                comparisons: comparisons
            });

        } catch (error) {
            console.error(chalk.red('Error generating run comparison:'), error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // API endpoint for cross-network cost comparison
    async getComparison(req, res) {
        try {
            const { gasAmount = 1000000 } = req.query;
            const comparisons = [];

            for (const [networkId, network] of this.networks) {
                // Get current prices
                const tokenSymbol = network.symbol || 'ETH';
                const tokenPrice = await this.priceFetcher.fetchPrice(tokenSymbol);

                // Get gas price for network
                let gasPrice = 30; // Default gas price in gwei
                if (network.gasConfig) {
                    if (network.gasConfig.fixed) {
                        gasPrice = parseFloat(network.gasConfig.fixed);
                    } else if (network.gasConfig.fallback) {
                        gasPrice = parseFloat(network.gasConfig.fallback);
                    } else if (network.gasConfig.strategy === 'percentage') {
                        // Use a default base price for estimation
                        gasPrice = 30 * (1 + (network.gasConfig.percentage || 10) / 100);
                    }
                }

                // Special handling for Kasplex and Igra as per PRD
                if (network.id === 'kasplex' || network.id === 'igra') {
                    gasPrice = 50; // 50 GWEI as specified
                }

                // Get mainnet gas price from config or use testnet price for networks already on mainnet
                let mainnetGasPrice = gasPrice; // Default to testnet gas price
                if (network.gasConfig && network.gasConfig.mainnetGasPrice) {
                    mainnetGasPrice = parseFloat(network.gasConfig.mainnetGasPrice);
                }

                // Calculate testnet costs
                const tokenCost = (gasAmount * gasPrice) / 1e9; // Convert from gwei
                const usdCost = tokenCost * tokenPrice;

                // Calculate mainnet costs
                const mainnetTokenCost = (gasAmount * mainnetGasPrice) / 1e9;
                const mainnetUsdCost = mainnetTokenCost * tokenPrice;

                // Calculate percentage vs ETH mainnet
                const ethPrice = await this.priceFetcher.fetchPrice('ETH');
                const ethMainnetGasPrice = 20; // Standard ETH mainnet gas price in gwei
                const ethCost = (gasAmount * ethMainnetGasPrice) / 1e9 * ethPrice;
                const percentVsEth = ethCost > 0 ? ((usdCost / ethCost) * 100).toFixed(2) : 0;

                comparisons.push({
                    network: network.name,
                    networkId: network.id,
                    chainId: network.chainId,
                    token: tokenSymbol,
                    tokenPrice: tokenPrice,
                    gasPrice: gasPrice,
                    mainnetGasPrice: mainnetGasPrice,
                    tokenCost: tokenCost.toFixed(6),
                    usdCost: usdCost.toFixed(4),
                    mainnetTokenCost: mainnetTokenCost.toFixed(6),
                    mainnetUsdCost: mainnetUsdCost.toFixed(4),
                    percentVsEth: percentVsEth,
                    type: network.type || 'testnet'
                });
            }

            // Sort by USD cost ascending (cheapest first)
            comparisons.sort((a, b) => parseFloat(a.usdCost) - parseFloat(b.usdCost));

            res.json({
                success: true,
                comparisons: comparisons,
                gasAmount: gasAmount
            });

        } catch (error) {
            console.error(chalk.red('Error generating comparison:'), error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // API endpoint to get current prices
    async getPrices(req, res) {
        try {
            const prices = {};
            const symbols = new Set();

            // Collect all unique symbols from networks
            for (const network of this.networks.values()) {
                if (network.symbol) {
                    symbols.add(network.symbol);
                }
            }

            // Add common mainnet tokens
            symbols.add('ETH');
            symbols.add('BNB');
            symbols.add('MATIC');

            // Fetch prices for all symbols
            for (const symbol of symbols) {
                try {
                    prices[symbol] = await this.priceFetcher.fetchPrice(symbol);
                } catch (error) {
                    console.warn(chalk.yellow(`Failed to fetch price for ${symbol}:`, error.message));
                    prices[symbol] = 0;
                }
            }

            res.json({
                success: true,
                prices: prices,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error(chalk.red('Error fetching prices:'), error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Export runs as CSV
    async exportCSV(req, res) {
        try {
            const runsResponse = await this.getRuns(req, {
                json: (data) => data,
                status: () => ({ json: () => {} })
            });

            if (!runsResponse.success) {
                throw new Error('Failed to fetch runs');
            }

            const runs = runsResponse.runs;

            // Create CSV content
            const headers = [
                'Run ID', 'Network', 'Chain ID', 'Timestamp', 'Test Count',
                'Success Rate (%)', 'Total Gas Used', 'Avg Gas Price (Gwei)',
                'Testnet Cost', 'Mainnet Estimate (USD)'
            ];

            const rows = runs.map(run => [
                run.runId,
                run.network,
                run.chainId,
                new Date(run.timestamp).toISOString(),
                run.testCount,
                run.successRate,
                run.totalGasUsed,
                run.avgGasPrice,
                run.testnetCost.toFixed(6),
                run.mainnetEstimate.toFixed(2)
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition',
                `attachment; filename="test-runs-${Date.now()}.csv"`);
            res.send(csvContent);

        } catch (error) {
            console.error(chalk.red('Error exporting CSV:'), error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Export runs as PDF (returns HTML for now, can be enhanced with puppeteer)
    async exportPDF(req, res) {
        try {
            const runsResponse = await this.getRuns(req, {
                json: (data) => data,
                status: () => ({ json: () => {} })
            });

            if (!runsResponse.success) {
                throw new Error('Failed to fetch runs');
            }

            const runs = runsResponse.runs;

            // Generate HTML report
            const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Cost Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .summary { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Test Cost Report</h1>
    <div class="summary">
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        <p><strong>Total Runs:</strong> ${runs.length}</p>
    </div>
    <table>
        <thead>
            <tr>
                <th>Run ID</th>
                <th>Network</th>
                <th>Tests</th>
                <th>Success Rate</th>
                <th>Gas Used</th>
                <th>Testnet Cost</th>
                <th>Mainnet Est. (USD)</th>
            </tr>
        </thead>
        <tbody>
            ${runs.map(run => `
            <tr>
                <td>${run.runId}</td>
                <td>${run.network}</td>
                <td>${run.testCount}</td>
                <td>${run.successRate}%</td>
                <td>${run.totalGasUsed.toLocaleString()}</td>
                <td>${run.testnetCost.toFixed(6)}</td>
                <td>$${run.mainnetEstimate.toFixed(2)}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Content-Disposition',
                `attachment; filename="test-report-${Date.now()}.html"`);
            res.send(html);

        } catch (error) {
            console.error(chalk.red('Error exporting PDF:'), error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Helper function to calculate mainnet equivalent cost
    async calculateMainnetCost(gasUsed, tokenSymbol) {
        try {
            const tokenPrice = await this.priceFetcher.fetchPrice(tokenSymbol);
            const mainnetGasPrice = 30; // Typical mainnet gas price in gwei

            const tokenCost = (gasUsed * mainnetGasPrice) / 1e9;
            const usdCost = tokenCost * tokenPrice;

            return {
                tokenPrice: tokenPrice,
                tokenCost: tokenCost,
                usdCost: usdCost
            };
        } catch (error) {
            console.warn(chalk.yellow(`Failed to calculate mainnet cost:`, error.message));
            return {
                tokenPrice: 0,
                tokenCost: 0,
                usdCost: 0
            };
        }
    }

    async start() {
        try {
            await this.initialize();

            this.server = this.app.listen(this.port, () => {
                console.log(chalk.cyan('╔════════════════════════════════════════════════╗'));
                console.log(chalk.cyan('║         Test Cost Dashboard Started           ║'));
                console.log(chalk.cyan('╚════════════════════════════════════════════════╝'));
                console.log(chalk.green(`✓ Dashboard running at: http://localhost:${this.port}`));
                console.log(chalk.green(`✓ API endpoints available at: http://localhost:${this.port}/api`));
                console.log(chalk.yellow('\nPress Ctrl+C to stop the server\n'));
            });

        } catch (error) {
            console.error(chalk.red('Failed to start dashboard:'), error);
            process.exit(1);
        }
    }

    async stop() {
        if (this.server) {
            this.server.close();
            await this.database.close();
            console.log(chalk.yellow('Dashboard server stopped'));
        }
    }
}

// Start the server if run directly
if (require.main === module) {
    const port = process.env.PORT || 3000;
    const dashboard = new CostDashboardServer(port);

    dashboard.start().catch(error => {
        console.error(chalk.red('Fatal error:'), error);
        process.exit(1);
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log(chalk.yellow('\nShutting down dashboard...'));
        await dashboard.stop();
        process.exit(0);
    });
}

module.exports = CostDashboardServer;