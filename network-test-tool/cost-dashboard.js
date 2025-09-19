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
        this.app.get('/api/run/:runId/transactions', this.getRunTransactions.bind(this));
        this.app.get('/api/run/:runId/contracts', this.getRunContracts.bind(this));
        this.app.get('/api/yaml-script/:filename', this.getYamlScript.bind(this));
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

        // Serve transactions page
        this.app.get('/transactions', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'transactions.html'));
        });

        // Serve YAML script viewer page
        this.app.get('/yaml-viewer', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'yaml-viewer.html'));
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

    // Helper function to get test operation descriptions
    getTestOperationDescription(testType, testName) {
        const descriptions = {
            'deployment': {
                'MockERC20': 'Deploy ERC20 token contract',
                'MockERC20_TokenA': 'Deploy Token A for DEX trading',
                'MockERC20_TokenB': 'Deploy Token B for DEX trading',
                'MockERC20_Reward': 'Deploy reward token for yield farming',
                'MockDEX': 'Deploy decentralized exchange contract',
                'MockLendingProtocol': 'Deploy lending protocol contract',
                'MockYieldFarm': 'Deploy yield farming contract',
                'MockERC721Collection': 'Deploy NFT collection contract',
                'MockMultiSigWallet': 'Deploy multi-signature wallet',
                'SimpleStorage': 'Deploy simple storage contract',
                'PrecompileTest': 'Deploy precompile test contract',
                'AssemblyTest': 'Deploy assembly test contract',
                'CREATE2Factory': 'Deploy CREATE2 factory contract'
            },
            'defi': {
                'ERC20 Token Operations - Token Transfer': 'Transfer ERC20 tokens between accounts',
                'ERC20 Token Operations - Token Approval': 'Approve token spending allowance',
                'ERC20 Token Operations - Transfer From': 'Transfer tokens on behalf of another account',
                'DEX Trading - Add Liquidity': 'Add liquidity to trading pool',
                'DEX Trading - Token Swap': 'Swap between different tokens',
                'DEX Trading - Remove Liquidity': 'Remove liquidity from trading pool',
                'Lending Protocol - Deposit Collateral': 'Deposit assets as collateral',
                'Lending Protocol - Borrow Assets': 'Borrow assets against collateral',
                'Lending Protocol - Repay Loan': 'Repay borrowed assets'
            },
            'EVM-Compatibility': {
                'ecrecover': 'Test ECDSA signature recovery precompile',
                'sha256': 'Test SHA256 hash precompile',
                'ripemd160': 'Test RIPEMD-160 hash precompile',
                'modexp': 'Test modular exponentiation precompile',
                'identity': 'Test identity precompile (data copy)',
                'basic-ops': 'Test basic EVM operations',
                'memory-ops': 'Test memory operations',
                'storage-ops': 'Test storage operations',
                'call-ops': 'Test contract call operations',
                'create2-deploy': 'Test CREATE2 deployment'
            }
        };

        // Get description from mapping or generate default
        const categoryDescriptions = descriptions[testType] || {};
        const description = categoryDescriptions[testName];

        if (description) {
            return description;
        }

        // Default descriptions for common operations
        if (testName === 'transfer') {
            return 'Simple ETH/native token transfer';
        }

        // Return the test name if no description found
        return testName;
    }

    // Get transactions for a specific run
    async getRunTransactions(req, res) {
        try {
            const runId = req.params.runId;

            // Get transactions from test_results table including YAML tracking fields
            const transactions = this.database.db.prepare(`
                SELECT
                    test_type,
                    test_name,
                    success,
                    gas_used,
                    gas_price,
                    transaction_hash,
                    block_number,
                    duration as execution_time,
                    error_message,
                    created_at as timestamp,
                    yaml_script_path,
                    yaml_instruction_line,
                    yaml_instruction_text,
                    yaml_step_index
                FROM test_results
                WHERE run_id = ?
                AND transaction_hash IS NOT NULL
                ORDER BY created_at ASC
            `).all(runId);

            // Get network info for the run
            const runInfo = this.database.db.prepare(`
                SELECT DISTINCT tr.network_name, nr.network_chain_id as chain_id
                FROM test_results tr
                LEFT JOIN network_results nr ON tr.run_id = nr.run_id
                WHERE tr.run_id = ?
                LIMIT 1
            `).get(runId);

            // Get network config for explorer URL
            const networkConfig = this.networks.get(runInfo?.network_name?.toLowerCase()) ||
                                   Array.from(this.networks.values()).find(n =>
                                       n.name === runInfo?.network_name || n.id === runInfo?.network_name?.toLowerCase());
            const explorerUrl = networkConfig?.explorer?.url;

            // Get token symbol and price for USD calculation
            const tokenSymbol = networkConfig?.symbol || 'ETH';
            let tokenPrice = 0;
            try {
                tokenPrice = await this.priceFetcher.fetchPrice(tokenSymbol);
            } catch (error) {
                console.warn(`Failed to fetch ${tokenSymbol} price:`, error.message);
                // For testnets with custom tokens, try to use a fallback or set to 0
                if (tokenSymbol === 'IKAS' || tokenSymbol === 'KAS') {
                    // These are test tokens, we'll use KAS mainnet price as approximation
                    try {
                        tokenPrice = await this.priceFetcher.fetchPrice('KAS');
                    } catch (e) {
                        console.warn('Failed to fetch KAS price as fallback');
                    }
                }
            }

            // Calculate costs for each transaction
            const enhancedTransactions = transactions.map(tx => {
                // Calculate cost in native token (ETH/KAS/IGRA etc)
                const costInNative = tx.gas_used && tx.gas_price ?
                    (tx.gas_used * tx.gas_price / 1e18) : 0;

                // Calculate USD cost
                const costInUSD = tokenPrice > 0 ? (costInNative * tokenPrice) : 0;

                return {
                    test_type: tx.test_type,
                    ...tx,
                    operation_description: this.getTestOperationDescription(tx.test_type, tx.test_name),
                    status: tx.success ? 'success' : 'failure',
                    explorerLink: explorerUrl && tx.transaction_hash ?
                        `${explorerUrl}/tx/${tx.transaction_hash}` : null,
                    gasUsed: tx.gas_used || 0,
                    gasPrice: tx.gas_price || 0,
                    totalCost: `${costInNative.toFixed(6)} ${tokenSymbol}`,
                    totalCostNative: costInNative.toFixed(6),
                    totalCostUSD: costInUSD.toFixed(4),
                    tokenSymbol: tokenSymbol,
                    tokenPrice: tokenPrice,
                    executionTimeMs: tx.execution_time || 0,
                    // YAML script tracking fields
                    yamlScript: tx.yaml_script_path || null,
                    yamlInstructionLine: tx.yaml_instruction_line || null,
                    yamlInstructionText: tx.yaml_instruction_text || null,
                    yamlStepIndex: tx.yaml_step_index || null
                };
            });

            res.json({
                success: true,
                runId: runId,
                network: runInfo?.network_name,
                chainId: runInfo?.chain_id,
                explorerUrl: explorerUrl,
                transactions: enhancedTransactions,
                summary: {
                    total: transactions.length,
                    successful: transactions.filter(t => t.success).length,
                    failed: transactions.filter(t => !t.success).length,
                    totalGasUsed: transactions.reduce((sum, t) => sum + (t.gas_used || 0), 0),
                    avgExecutionTime: transactions.reduce((sum, t) => sum + (t.execution_time || 0), 0) / transactions.length
                }
            });

        } catch (error) {
            console.error(chalk.red('Error fetching run transactions:'), error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Get deployed contracts for a specific run
    async getRunContracts(req, res) {
        try {
            const runId = req.params.runId;

            // Note: contract_deployments table doesn't have run_id column
            // We need to match by network and timestamp
            // First get the run info
            const runInfo = this.database.db.prepare(`
                SELECT DISTINCT tr.network_name, nr.network_chain_id as chain_id,
                       MIN(tr.created_at) as start_time, MAX(tr.created_at) as end_time
                FROM test_results tr
                LEFT JOIN network_results nr ON tr.run_id = nr.run_id
                WHERE tr.run_id = ?
                GROUP BY tr.network_name, nr.network_chain_id
                LIMIT 1
            `).get(runId);

            if (!runInfo) {
                return res.json({
                    success: true,
                    runId: runId,
                    network: null,
                    chainId: null,
                    contracts: [],
                    summary: {
                        total: 0,
                        successful: 0,
                        failed: 0,
                        totalGasUsed: 0,
                        totalDeploymentCost: '0'
                    }
                });
            }

            // Get contracts deployed around the same time for this network
            const contracts = this.database.db.prepare(`
                SELECT
                    contract_name,
                    contract_address,
                    transaction_hash as deployment_tx,
                    deployed_at,
                    gas_used,
                    gas_price,
                    health_status as status
                FROM contract_deployments
                WHERE chain_id = ?
                AND datetime(deployed_at) BETWEEN datetime(?, '-5 minutes') AND datetime(?, '+5 minutes')
                ORDER BY deployed_at ASC
            `).all(runInfo.chain_id, runInfo.start_time, runInfo.end_time);

            // Get network config for explorer URL
            const networkConfig = this.networks.get(runInfo?.network_name?.toLowerCase()) ||
                                   Array.from(this.networks.values()).find(n =>
                                       n.name === runInfo?.network_name || n.id === runInfo?.network_name?.toLowerCase());
            const explorerUrl = networkConfig?.explorer?.url;

            // Enhance contracts with explorer links
            const enhancedContracts = contracts.map(contract => ({
                ...contract,
                addressLink: explorerUrl && contract.contract_address ?
                    `${explorerUrl}/address/${contract.contract_address}` : null,
                txLink: explorerUrl && contract.deployment_tx ?
                    `${explorerUrl}/tx/${contract.deployment_tx}` : null,
                gasUsed: contract.gas_used || 0,
                deploymentCost: contract.gas_used && contract.gas_price ?
                    (contract.gas_used * parseInt(contract.gas_price) / 1e9).toFixed(6) : '0'
            }));

            res.json({
                success: true,
                runId: runId,
                network: runInfo?.network_name,
                chainId: runInfo?.chain_id,
                explorerUrl: explorerUrl,
                contracts: enhancedContracts,
                summary: {
                    total: contracts.length,
                    successful: contracts.filter(c => c.status === 'healthy').length,
                    failed: contracts.filter(c => c.status !== 'healthy').length,
                    totalGasUsed: contracts.reduce((sum, c) => sum + (c.gas_used || 0), 0),
                    totalDeploymentCost: enhancedContracts.reduce((sum, c) =>
                        sum + parseFloat(c.deploymentCost || 0), 0).toFixed(6)
                }
            });

        } catch (error) {
            console.error(chalk.red('Error fetching run contracts:'), error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Get YAML script content by filename
    async getYamlScript(req, res) {
        try {
            const { filename } = req.params;
            const fs = require('fs');
            const path = require('path');

            // Security check: ensure filename doesn't contain path traversal attempts
            if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid filename'
                });
            }

            // Look for the YAML file in the tests/yaml directory
            const yamlPath = path.join(__dirname, 'tests', 'yaml', filename);

            // Check if file exists
            if (!fs.existsSync(yamlPath)) {
                return res.status(404).json({
                    success: false,
                    error: 'Script not found'
                });
            }

            // Read the YAML file
            const content = fs.readFileSync(yamlPath, 'utf8');

            res.json({
                success: true,
                filename: filename,
                content: content,
                path: `tests/yaml/${filename}`
            });

        } catch (error) {
            console.error(chalk.red('Error fetching YAML script:'), error);
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