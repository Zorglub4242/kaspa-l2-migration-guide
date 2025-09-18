const axios = require('axios');
const { logger } = require('./logger');

// CoinGecko API for real-time cryptocurrency prices
class PriceFetcher {
  constructor() {
    this.baseURL = 'https://api.coingecko.com/api/v3';
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
  }

  // Map network names to CoinGecko IDs
  getCoinGeckoId(network) {
    const mapping = {
      // Config keys
      'kasplex': 'kaspa',        // KAS token
      'sepolia': 'ethereum',     // ETH on Sepolia
      'holesky': 'ethereum',     // ETH on Holesky
      'goerli': 'ethereum',      // ETH on Goerli
      'ethereum': 'ethereum',    // ETH mainnet
      'mainnet': 'ethereum',     // ETH mainnet
      'igra': 'kaspa',           // IKAS token (using KAS price as proxy)
      'gnosis-chiado': 'xdai',   // xDAI token
      'neon-devnet': 'neon',     // NEON token

      // Display names
      'kasplex l2': 'kaspa',
      'ethereum sepolia': 'ethereum',
      'igra l2': 'kaspa',
      'ethereum holesky': 'ethereum',
      'ethereum goerli': 'ethereum',
      'gnosis chiado testnet': 'xdai',
      'neon evm devnet (solana)': 'neon'
    };

    return mapping[network.toLowerCase()] || 'ethereum';
  }

  // Get token symbol for display
  getTokenSymbol(network) {
    const mapping = {
      // Config keys
      'kasplex': 'KAS',
      'sepolia': 'ETH',
      'holesky': 'ETH',
      'goerli': 'ETH',
      'ethereum': 'ETH',
      'mainnet': 'ETH',
      'igra': 'IKAS',

      // Display names
      'kasplex l2': 'KAS',
      'ethereum sepolia': 'ETH',
      'igra l2': 'IKAS',
      'ethereum holesky': 'ETH',
      'ethereum goerli': 'ETH'
    };

    return mapping[network.toLowerCase()] || 'ETH';
  }

  // Fetch current price from CoinGecko
  async fetchPrice(tokenSymbolOrId) {
    // Convert token symbol to CoinGecko ID if needed
    const symbolToId = {
      'ETH': 'ethereum',
      'KAS': 'kaspa',
      'IKAS': 'kaspa',  // Use KAS price for IKAS
      'BNB': 'binancecoin',
      'MATIC': 'matic-network',
      'AVAX': 'avalanche-2',
      'FTM': 'fantom',
      'xDAI': 'xdai',
      'XDAI': 'xdai',
      'NEON': 'neon'
    };

    const coinGeckoId = symbolToId[tokenSymbolOrId.toUpperCase()] || this.getCoinGeckoId(tokenSymbolOrId);
    const cacheKey = coinGeckoId;
    const cachedData = this.cache.get(cacheKey);

    // Return cached data if still valid
    if (cachedData && Date.now() - cachedData.timestamp < this.cacheTimeout) {
      return cachedData.price;
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/simple/price`,
        {
          params: {
            ids: coinGeckoId,
            vs_currencies: 'usd'
          },
          timeout: 5000 // 5 second timeout
        }
      );

      const price = response.data[coinGeckoId]?.usd;

      if (!price) {
        throw new Error(`Price not found for ${tokenSymbolOrId}`);
      }

      // Cache the result
      this.cache.set(cacheKey, {
        price: price,
        timestamp: Date.now()
      });

      return price;
    } catch (error) {
      logger.warning(`⚠️ Failed to fetch price for ${tokenSymbolOrId}: ${error.message}`);

      // Return cached data if available, otherwise fallback prices
      if (cachedData) {
        logger.info(`📊 Using cached price for ${tokenSymbolOrId}`);
        return cachedData.price;
      }

      // Fallback prices (approximate - more realistic values)
      const fallbackPrices = {
        'kaspa': 0.15,           // Approximate KAS price
        'ethereum': 2500,        // Approximate ETH price
        'binancecoin': 300,      // Approximate BNB price
        'matic-network': 0.80,   // Approximate MATIC price
        'avalanche-2': 35,       // Approximate AVAX price
        'fantom': 0.40,          // Approximate FTM price
        'xdai': 1.00,            // xDAI is a stablecoin pegged to $1
        'neon': 0.1429           // Current NEON price
      };

      const fallbackPrice = fallbackPrices[coinGeckoId] || 2500;
      logger.warning(`📊 Using fallback price for ${tokenSymbolOrId}: $${fallbackPrice}`);
      return fallbackPrice;
    }
  }

  // Get USD value for a given amount and network
  async getUSDValue(network, tokenAmount) {
    try {
      const coinGeckoId = this.getCoinGeckoId(network);
      const price = await this.fetchPrice(coinGeckoId);
      const usdValue = parseFloat(tokenAmount) * price;
      
      return {
        tokenAmount: parseFloat(tokenAmount),
        tokenSymbol: this.getTokenSymbol(network),
        usdPrice: price,
        usdValue: usdValue,
        success: true
      };
    } catch (error) {
      logger.error(`❌ Failed to get USD value: ${error.message}`);
      return {
        tokenAmount: parseFloat(tokenAmount),
        tokenSymbol: this.getTokenSymbol(network),
        usdPrice: 0,
        usdValue: 0,
        success: false,
        error: error.message
      };
    }
  }

  // Format cost comparison for display
  formatCostComparison(costData) {
    if (!costData.success) {
      return `${costData.tokenAmount.toFixed(6)} ${costData.tokenSymbol} (price unavailable)`;
    }
    
    return `${costData.tokenAmount.toFixed(6)} ${costData.tokenSymbol} (~$${costData.usdValue.toFixed(4)} USD)`;
  }

  // Get multiple network costs for comparison
  async getNetworkCostComparison(networksData) {
    const results = {};
    
    for (const [network, data] of Object.entries(networksData)) {
      if (data.totalCost) {
        results[network] = await this.getUSDValue(network, data.totalCost);
      }
    }
    
    return results;
  }
}

// Export singleton instance
const priceFetcher = new PriceFetcher();
module.exports = { priceFetcher, PriceFetcher };