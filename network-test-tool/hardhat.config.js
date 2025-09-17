require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

// Load external network configurations with proper error handling
let externalNetworks = {};
let networkLoader;

try {
  const { NetworkConfigLoader } = require('./lib/network-config-loader');
  networkLoader = new NetworkConfigLoader();

  // Function to build Hardhat network configs from external configs
  async function buildNetworkConfigs() {
    try {
      await networkLoader.loadAll();
      const configs = {};

      // Convert external configs to Hardhat format
      for (const [id, config] of Object.entries(networkLoader.networks)) {
        try {
          configs[id] = networkLoader.getHardhatConfig(id);
        } catch (err) {
          console.warn(`Warning: Could not convert network config for ${id}:`, err.message);
        }
      }

      return configs;
    } catch (error) {
      console.warn('Warning: Could not load external network configs:', error.message);
      return {};
    }
  }

  // Load external configs (synchronously for module.exports)
  (async () => {
    externalNetworks = await buildNetworkConfigs();
  })();

} catch (error) {
  // Fallback if network-config-loader is not available
  console.warn('External network configuration system not available, using hardcoded networks only');
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // Local development network (keep this hardcoded for convenience)
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },
    // All other networks loaded from external configuration files
    ...externalNetworks
  },

  // Gas reporting for load testing analysis
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 21,
  },

  // Contract verification settings for Kasplex
  etherscan: {
    apiKey: {
      kasplex: "no-api-key-needed", // Kasplex explorer doesn't require API key yet
    },
    customChains: [
      {
        network: "kasplex",
        chainId: 167012,
        urls: {
          apiURL: "https://explorer.testnet.kasplextest.xyz/api",
          browserURL: "https://explorer.testnet.kasplextest.xyz"
        }
      }
    ]
  },

  // Mocha settings for longer test timeouts during load testing
  mocha: {
    timeout: 300000 // 5 minutes for load testing
  }
};

/*
🔧 BLOCKCHAIN LOAD TESTER SETUP:

1. Install dependencies:
   npm install

2. Set up your environment:
   Create a .env file with:
   PRIVATE_KEY=your-private-key-here
   CONTRACT_ADDRESS=deployed-contract-address-here

3. Get Kasplex testnet KAS:
   - Faucet 1: https://faucet.zealousswap.com/
   - Faucet 2: https://app.kaspafinance.io/faucets
   - Faucet 3: https://kasplextest.xyz/faucet

4. Deploy the LoadTestContract:
   npm run deploy:kasplex

5. Run load tests:
   npm run load-test:simple kasplex
   npm run load-test:stress kasplex

6. Set CONTRACT_ADDRESS after deployment:
   export CONTRACT_ADDRESS=0x...
   or add to .env file

📊 LOAD TESTING FEATURES:

✅ Sequential transaction execution (reliable for Kasplex)
✅ Concurrent transaction stress testing
✅ Gas cost analysis and optimization
✅ Throughput measurement (TPS)
✅ Transaction confirmation time tracking
✅ Nonce management for concurrent transactions
✅ Detailed console logging with emojis
✅ Error handling and retry logic

🎯 OPTIMIZATIONS FOR KASPLEX:

- Gas price set to 2000 Gwei (tested working value)
- Sequential execution by default (avoids nonce conflicts)
- Extended timeouts for network compatibility
- Proper nonce management using 'pending' count
- Small delays between transactions for reliability

⚠️  SECURITY NOTES:

- Never commit your private key to git
- Use environment variables for sensitive data
- Test with small amounts first
- Monitor your KAS balance during stress tests

🔗 USEFUL LINKS:

- Kasplex Explorer: https://explorer.testnet.kasplextest.xyz
- Kasplex RPC: https://rpc.kasplextest.xyz
- Kasplex Documentation: https://kaspa.org/
*/