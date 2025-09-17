const { ethers } = require('ethers');
const { gasPriceService } = require('./gas-price-service');
const { priceFetcher } = require('../utils/price-fetcher');
const { networkConfigLoader } = require('./network-config-loader');

class CostCalculator {
  constructor() {
    // Common transaction gas estimates
    this.gasEstimates = {
      transfer: 21000,
      erc20Transfer: 65000,
      swap: 150000,
      addLiquidity: 175000,
      removeLiquidity: 150000,
      nftMint: 85000,
      nftTransfer: 65000,
      deployERC20: 1500000,
      deployDEX: 3000000,
      deployNFT: 2500000,
      complexContract: 5000000
    };

    // Test suite gas estimates (from actual test data)
    this.testSuiteEstimates = {
      evmCompatibility: {
        tests: 18,
        totalGas: 2500000,
        breakdown: {
          precompiles: 500000,
          assembly: 800000,
          create2: 1200000
        }
      },
      defiProtocols: {
        tests: 35,
        totalGas: 17750000,
        breakdown: {
          erc20: 2000000,
          dex: 5000000,
          lending: 4000000,
          yield: 3000000,
          nft: 2500000,
          multisig: 1250000
        }
      },
      loadTest: {
        transactionsPerTest: 100,
        gasPerTransaction: 21000,
        totalGas: 2100000
      }
    };
  }

  // Initialize with network configs
  async initialize() {
    await networkConfigLoader.loadAll();
  }

  // Calculate cost for a single transaction
  async calculateTransactionCost(networkId, gasUsed, options = {}) {
    const network = networkConfigLoader.getNetwork(networkId);
    if (!network) {
      throw new Error(`Network ${networkId} not found`);
    }

    // Get current gas price
    const gasPrice = await this.getGasPrice(network, options.priority || 'medium');

    // Get token price in USD
    const tokenPrice = await this.getTokenPrice(network);

    // Calculate costs
    const gasCostWei = ethers.BigNumber.from(gasUsed).mul(gasPrice);
    const gasCostEther = ethers.utils.formatEther(gasCostWei);
    const gasCostUSD = parseFloat(gasCostEther) * tokenPrice;

    return {
      network: network.name,
      networkId: network.id,
      type: network.type,
      gasUsed,
      gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei') + ' gwei',
      costInNative: parseFloat(gasCostEther).toFixed(6) + ' ' + network.symbol,
      costInUSD: gasCostUSD.toFixed(4),
      tokenPrice,
      timestamp: new Date().toISOString()
    };
  }

  // Calculate cost for test suite
  async calculateTestSuiteCost(networkId, suite = 'all') {
    const network = networkConfigLoader.getNetwork(networkId);
    if (!network) {
      throw new Error(`Network ${networkId} not found`);
    }

    let totalGas = 0;
    let breakdown = {};

    if (suite === 'all' || suite === 'evm') {
      totalGas += this.testSuiteEstimates.evmCompatibility.totalGas;
      breakdown.evmCompatibility = this.testSuiteEstimates.evmCompatibility.totalGas;
    }

    if (suite === 'all' || suite === 'defi') {
      totalGas += this.testSuiteEstimates.defiProtocols.totalGas;
      breakdown.defiProtocols = this.testSuiteEstimates.defiProtocols.totalGas;
    }

    if (suite === 'all' || suite === 'load') {
      totalGas += this.testSuiteEstimates.loadTest.totalGas;
      breakdown.loadTest = this.testSuiteEstimates.loadTest.totalGas;
    }

    const cost = await this.calculateTransactionCost(networkId, totalGas);

    return {
      ...cost,
      suite,
      totalGas,
      breakdown,
      testsCount: suite === 'all' ? 153 :
                  suite === 'evm' ? 18 :
                  suite === 'defi' ? 35 : 100
    };
  }

  // Compare costs across multiple networks
  async compareNetworkCosts(gasUsed, networkIds = null) {
    // Use provided networks or all available
    const networks = networkIds
      ? networkIds.map(id => networkConfigLoader.getNetwork(id)).filter(n => n)
      : networkConfigLoader.getAllNetworks();

    const comparisons = [];

    for (const network of networks) {
      try {
        const cost = await this.calculateTransactionCost(network.id, gasUsed);
        comparisons.push(cost);
      } catch (error) {
        console.warn(`Failed to calculate cost for ${network.id}: ${error.message}`);
      }
    }

    // Sort by USD cost
    comparisons.sort((a, b) => parseFloat(a.costInUSD) - parseFloat(b.costInUSD));

    return {
      gasUsed,
      networks: comparisons,
      cheapest: comparisons[0],
      mostExpensive: comparisons[comparisons.length - 1],
      averageCostUSD: (comparisons.reduce((sum, c) => sum + parseFloat(c.costInUSD), 0) / comparisons.length).toFixed(4)
    };
  }

  // Compare mainnet vs testnet costs
  async compareMainnetTestnet(gasUsed) {
    const networks = networkConfigLoader.getAllNetworks();

    const mainnets = [];
    const testnets = [];

    for (const network of networks) {
      try {
        const cost = await this.calculateTransactionCost(network.id, gasUsed);

        if (network.type === 'mainnet') {
          mainnets.push(cost);
        } else if (network.type === 'testnet') {
          testnets.push(cost);
        }
      } catch (error) {
        console.warn(`Failed to calculate cost for ${network.id}: ${error.message}`);
      }
    }

    const avgMainnetCost = mainnets.length > 0
      ? (mainnets.reduce((sum, c) => sum + parseFloat(c.costInUSD), 0) / mainnets.length).toFixed(4)
      : 0;

    const avgTestnetCost = testnets.length > 0
      ? (testnets.reduce((sum, c) => sum + parseFloat(c.costInUSD), 0) / testnets.length).toFixed(4)
      : 0;

    return {
      gasUsed,
      mainnet: {
        networks: mainnets,
        averageCostUSD: avgMainnetCost,
        count: mainnets.length
      },
      testnet: {
        networks: testnets,
        averageCostUSD: avgTestnetCost,
        count: testnets.length
      },
      costRatio: avgTestnetCost > 0 ? (avgMainnetCost / avgTestnetCost).toFixed(2) : 'N/A',
      savings: `${((1 - avgTestnetCost / avgMainnetCost) * 100).toFixed(1)}%`
    };
  }

  // Generate cost report
  async generateCostReport(networkId, options = {}) {
    const network = networkConfigLoader.getNetwork(networkId);
    if (!network) {
      throw new Error(`Network ${networkId} not found`);
    }

    const report = {
      network: network.name,
      networkId: network.id,
      type: network.type,
      symbol: network.symbol,
      timestamp: new Date().toISOString()
    };

    // Get current gas prices
    const gasPrice = await gasPriceService.getAggregatedGasPrice(networkId);
    report.currentGasPrices = gasPrice;

    // Get token price
    const tokenPrice = await this.getTokenPrice(network);
    report.tokenPrice = {
      symbol: network.symbol,
      usd: tokenPrice
    };

    // Calculate costs for common operations
    report.operationCosts = {};
    for (const [operation, gasEstimate] of Object.entries(this.gasEstimates)) {
      const cost = await this.calculateTransactionCost(networkId, gasEstimate);
      report.operationCosts[operation] = {
        gas: gasEstimate,
        costNative: cost.costInNative,
        costUSD: cost.costInUSD
      };
    }

    // Calculate test suite costs
    report.testSuiteCosts = {
      evmCompatibility: await this.calculateTestSuiteCost(networkId, 'evm'),
      defiProtocols: await this.calculateTestSuiteCost(networkId, 'defi'),
      loadTest: await this.calculateTestSuiteCost(networkId, 'load'),
      fullSuite: await this.calculateTestSuiteCost(networkId, 'all')
    };

    // Add historical data if requested
    if (options.includeHistorical) {
      report.historical = await gasPriceService.getHistoricalGasPrice(networkId, 7);
    }

    // Add recommendations
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  // Generate budget estimate
  async generateBudgetEstimate(networkIds, operations, options = {}) {
    const budget = {
      networks: {},
      totalUSD: 0,
      operations: operations,
      frequency: options.frequency || 'daily',
      period: options.period || 30 // days
    };

    for (const networkId of networkIds) {
      const network = networkConfigLoader.getNetwork(networkId);
      if (!network) continue;

      let totalGas = 0;
      const operationDetails = {};

      for (const [operation, count] of Object.entries(operations)) {
        const gasPerOp = this.gasEstimates[operation] || 21000;
        const totalOpGas = gasPerOp * count * (options.period || 30);
        totalGas += totalOpGas;

        const cost = await this.calculateTransactionCost(networkId, totalOpGas);
        operationDetails[operation] = {
          count: count * (options.period || 30),
          gasPerOperation: gasPerOp,
          totalGas: totalOpGas,
          costUSD: cost.costInUSD
        };
      }

      const totalCost = await this.calculateTransactionCost(networkId, totalGas);

      budget.networks[networkId] = {
        name: network.name,
        type: network.type,
        operations: operationDetails,
        totalGas,
        totalCostNative: totalCost.costInNative,
        totalCostUSD: totalCost.costInUSD
      };

      budget.totalUSD += parseFloat(totalCost.costInUSD);
    }

    // Add recommendations
    budget.recommendations = this.generateBudgetRecommendations(budget);

    return budget;
  }

  // Helper: Get gas price for network
  async getGasPrice(network, priority = 'medium') {
    if (network.gasConfig.strategy === 'fixed') {
      return ethers.utils.parseUnits(network.gasConfig.fixed, 'gwei');
    }

    const prices = await gasPriceService.getAggregatedGasPrice(network.id);
    const gweiPrice = prices[priority] || prices.medium || 20;
    return ethers.utils.parseUnits(gweiPrice.toString(), 'gwei');
  }

  // Helper: Get token price
  async getTokenPrice(network) {
    try {
      const coinGeckoId = priceFetcher.getCoinGeckoId(network.id);
      return await priceFetcher.fetchPrice(coinGeckoId);
    } catch (error) {
      // Use fallback prices
      const fallbacks = {
        'ethereum': 2500,
        'avalanche': 35,
        'fantom': 0.4,
        'gnosis': 1,
        'kaspa': 0.15
      };

      const coinGeckoId = priceFetcher.getCoinGeckoId(network.id);
      return fallbacks[coinGeckoId] || 1;
    }
  }

  // Generate recommendations
  generateRecommendations(report) {
    const recommendations = [];

    // Check if network is testnet
    if (report.type === 'testnet') {
      recommendations.push('This is a testnet - perfect for development and testing without real costs');
    }

    // Check gas prices
    const gasPrice = report.currentGasPrices.medium;
    if (gasPrice > 100) {
      recommendations.push('High gas prices detected - consider batching transactions or waiting for lower prices');
    } else if (gasPrice < 10) {
      recommendations.push('Low gas prices - excellent time for deployments and complex operations');
    }

    // Check operation costs
    const deploymentCost = parseFloat(report.operationCosts.deployERC20.costUSD);
    if (deploymentCost > 100) {
      recommendations.push('High deployment costs - consider using a more cost-effective network');
    }

    return recommendations;
  }

  // Generate budget recommendations
  generateBudgetRecommendations(budget) {
    const recommendations = [];

    // Find most cost-effective network
    let cheapestNetwork = null;
    let cheapestCost = Infinity;

    for (const [networkId, data] of Object.entries(budget.networks)) {
      const cost = parseFloat(data.totalCostUSD);
      if (cost < cheapestCost) {
        cheapestCost = cost;
        cheapestNetwork = data.name;
      }
    }

    if (cheapestNetwork) {
      recommendations.push(`${cheapestNetwork} is the most cost-effective option at $${cheapestCost.toFixed(2)}`);
    }

    // Check total budget
    if (budget.totalUSD > 1000) {
      recommendations.push('Consider using testnets for development to reduce costs');
      recommendations.push('Implement transaction batching to optimize gas usage');
    }

    return recommendations;
  }
}

// Export singleton instance
const costCalculator = new CostCalculator();
module.exports = { costCalculator, CostCalculator };