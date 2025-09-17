const axios = require('axios');
const { ethers } = require('ethers');

class GasPriceService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
    this.historicalData = new Map();

    // API configurations
    this.apis = {
      etherscan: {
        mainnet: 'https://api.etherscan.io/api',
        sepolia: 'https://api-sepolia.etherscan.io/api',
        apiKey: process.env.ETHERSCAN_API_KEY
      },
      ethGasStation: {
        url: 'https://ethgasstation.info/json/ethgasAPI.json'
      },
      blocknative: {
        url: 'https://api.blocknative.com/gasprices/blockprices',
        apiKey: process.env.BLOCKNATIVE_API_KEY
      },
      avalanche: {
        url: 'https://api.avax.network/ext/bc/C/rpc'
      },
      fantom: {
        url: 'https://api.ftmscan.com/api',
        apiKey: process.env.FTMSCAN_API_KEY
      }
    };

    // Historical averages (in gwei)
    this.historicalAverages = {
      'ethereum': { min: 10, avg: 25, max: 200 },
      'avalanche': { min: 20, avg: 25, max: 50 },
      'fantom': { min: 1, avg: 3, max: 10 },
      'gnosis': { min: 1, avg: 2, max: 5 },
      'sepolia': { min: 5, avg: 20, max: 50 },
      'kasplex': { min: 2000, avg: 2000, max: 2001 },
      'igra': { min: 2000, avg: 2000, max: 2000 }
    };
  }

  // Get current gas price from Etherscan
  async getEtherscanGasPrice(network = 'mainnet') {
    const cacheKey = `etherscan-${network}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const baseUrl = this.apis.etherscan[network] || this.apis.etherscan.mainnet;
      const response = await axios.get(baseUrl, {
        params: {
          module: 'gastracker',
          action: 'gasoracle',
          apikey: this.apis.etherscan.apiKey
        },
        timeout: 5000
      });

      if (response.data.status === '1') {
        const result = {
          low: parseFloat(response.data.result.SafeGasPrice),
          medium: parseFloat(response.data.result.ProposeGasPrice),
          high: parseFloat(response.data.result.FastGasPrice),
          source: 'etherscan',
          timestamp: Date.now()
        };

        this.setCache(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.warn(`Failed to get Etherscan gas price: ${error.message}`);
    }

    return null;
  }

  // Get gas price from ETH Gas Station
  async getETHGasStationPrice() {
    const cacheKey = 'eth-gas-station';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(this.apis.ethGasStation.url, {
        timeout: 5000
      });

      const result = {
        low: response.data.safeLow / 10, // Convert to gwei
        medium: response.data.average / 10,
        high: response.data.fast / 10,
        fastest: response.data.fastest / 10,
        source: 'ethGasStation',
        timestamp: Date.now()
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.warn(`Failed to get ETH Gas Station price: ${error.message}`);
    }

    return null;
  }

  // Get gas price from Blocknative
  async getBlocknativeGasPrice() {
    if (!this.apis.blocknative.apiKey) {
      return null;
    }

    const cacheKey = 'blocknative';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(this.apis.blocknative.url, {
        headers: {
          'Authorization': this.apis.blocknative.apiKey
        },
        timeout: 5000
      });

      if (response.data.blockPrices && response.data.blockPrices.length > 0) {
        const prices = response.data.blockPrices[0].estimatedPrices;
        const result = {
          low: prices.find(p => p.confidence === 70)?.price || 0,
          medium: prices.find(p => p.confidence === 95)?.price || 0,
          high: prices.find(p => p.confidence === 99)?.price || 0,
          source: 'blocknative',
          timestamp: Date.now()
        };

        this.setCache(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.warn(`Failed to get Blocknative gas price: ${error.message}`);
    }

    return null;
  }

  // Get aggregated gas price from multiple sources
  async getAggregatedGasPrice(network = 'ethereum') {
    const sources = [];

    // Try different sources based on network
    if (network === 'ethereum' || network === 'sepolia') {
      const etherscan = await this.getEtherscanGasPrice(network);
      if (etherscan) sources.push(etherscan);

      if (network === 'ethereum') {
        const ethGasStation = await this.getETHGasStationPrice();
        if (ethGasStation) sources.push(ethGasStation);

        const blocknative = await this.getBlocknativeGasPrice();
        if (blocknative) sources.push(blocknative);
      }
    }

    // If we have data from multiple sources, average them
    if (sources.length > 0) {
      const avgLow = sources.reduce((sum, s) => sum + s.low, 0) / sources.length;
      const avgMedium = sources.reduce((sum, s) => sum + s.medium, 0) / sources.length;
      const avgHigh = sources.reduce((sum, s) => sum + s.high, 0) / sources.length;

      return {
        low: Math.round(avgLow),
        medium: Math.round(avgMedium),
        high: Math.round(avgHigh),
        sources: sources.map(s => s.source),
        timestamp: Date.now()
      };
    }

    // Fallback to historical averages
    const historical = this.historicalAverages[network] || this.historicalAverages.ethereum;
    return {
      low: historical.min,
      medium: historical.avg,
      high: historical.max,
      sources: ['historical'],
      timestamp: Date.now()
    };
  }

  // Get historical gas price data
  async getHistoricalGasPrice(network, days = 7) {
    const cacheKey = `historical-${network}-${days}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    // For demonstration, return simulated historical data
    // In production, this would query actual historical APIs
    const historical = this.historicalAverages[network] || this.historicalAverages.ethereum;
    const data = [];
    const now = Date.now();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - (i * 24 * 60 * 60 * 1000));
      const variation = Math.random() * 0.4 + 0.8; // 80% to 120% of average

      data.push({
        date: date.toISOString().split('T')[0],
        low: Math.round(historical.min * variation),
        avg: Math.round(historical.avg * variation),
        high: Math.round(historical.max * variation)
      });
    }

    this.setCache(cacheKey, data);
    return data;
  }

  // Calculate transaction cost in USD
  async calculateTransactionCost(network, gasUsed, tokenPriceUSD) {
    const gasPrice = await this.getAggregatedGasPrice(network);

    const costs = {
      low: {
        gwei: gasPrice.low,
        eth: ethers.utils.formatEther(
          ethers.utils.parseUnits(gasPrice.low.toString(), 'gwei').mul(gasUsed)
        ),
        usd: 0
      },
      medium: {
        gwei: gasPrice.medium,
        eth: ethers.utils.formatEther(
          ethers.utils.parseUnits(gasPrice.medium.toString(), 'gwei').mul(gasUsed)
        ),
        usd: 0
      },
      high: {
        gwei: gasPrice.high,
        eth: ethers.utils.formatEther(
          ethers.utils.parseUnits(gasPrice.high.toString(), 'gwei').mul(gasUsed)
        ),
        usd: 0
      }
    };

    // Calculate USD costs
    if (tokenPriceUSD) {
      costs.low.usd = parseFloat(costs.low.eth) * tokenPriceUSD;
      costs.medium.usd = parseFloat(costs.medium.eth) * tokenPriceUSD;
      costs.high.usd = parseFloat(costs.high.eth) * tokenPriceUSD;
    }

    return costs;
  }

  // Compare mainnet vs testnet costs
  async compareMainnetTestnetCosts(gasUsed, tokenPriceUSD) {
    const networks = [
      { id: 'ethereum', name: 'Ethereum Mainnet', isTestnet: false },
      { id: 'sepolia', name: 'Ethereum Sepolia', isTestnet: true },
      { id: 'avalanche', name: 'Avalanche C-Chain', isTestnet: false },
      { id: 'fantom', name: 'Fantom Opera', isTestnet: false },
      { id: 'gnosis', name: 'Gnosis Chain', isTestnet: false }
    ];

    const comparison = [];

    for (const network of networks) {
      const costs = await this.calculateTransactionCost(network.id, gasUsed, tokenPriceUSD);
      comparison.push({
        network: network.name,
        isTestnet: network.isTestnet,
        gasPrice: costs.medium.gwei,
        costETH: costs.medium.eth,
        costUSD: costs.medium.usd
      });
    }

    return comparison;
  }

  // Cache management
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Get formatted gas price report
  async getGasPriceReport(network) {
    const current = await this.getAggregatedGasPrice(network);
    const historical = await this.getHistoricalGasPrice(network, 7);

    return {
      network,
      current: {
        low: `${current.low} gwei`,
        medium: `${current.medium} gwei`,
        high: `${current.high} gwei`,
        sources: current.sources
      },
      historical: {
        last7Days: historical,
        average: `${this.historicalAverages[network]?.avg || 'N/A'} gwei`
      },
      recommendations: this.getGasRecommendations(current.medium),
      lastUpdated: new Date(current.timestamp).toISOString()
    };
  }

  // Get gas recommendations
  getGasRecommendations(currentGasPrice) {
    if (currentGasPrice < 10) {
      return 'Very low gas prices - ideal for all transactions';
    } else if (currentGasPrice < 30) {
      return 'Low gas prices - good for most transactions';
    } else if (currentGasPrice < 50) {
      return 'Moderate gas prices - consider waiting for lower prices for non-urgent transactions';
    } else if (currentGasPrice < 100) {
      return 'High gas prices - only execute urgent transactions';
    } else {
      return 'Very high gas prices - consider delaying non-critical transactions';
    }
  }
}

// Export singleton instance
const gasPriceService = new GasPriceService();
module.exports = { gasPriceService, GasPriceService };