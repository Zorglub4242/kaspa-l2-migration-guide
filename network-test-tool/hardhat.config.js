require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

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
    // Local development network
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },

    // Kasplex L2 Testnet (optimized for load testing)
    kasplex: {
      url: "https://rpc.kasplextest.xyz",
      chainId: 167012,
      gasPrice: 2000000000000, // 2000 Gwei - matches working hello world example
      gas: 10000000, // 10M gas limit
      timeout: 600000, // 10 minutes for load testing
      pollingInterval: 5000, // 5 second polling for more reliability
      allowUnlimitedContractSize: true,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },

    // Kasplex L2 via Relayer (if available)
    kasplex_relayer: {
      url: "http://localhost:8546",
      chainId: 167012,
      gasPrice: 2000000000000,
      gas: 10000000,
      timeout: 600000,
      allowUnlimitedContractSize: true,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },

    // Ethereum Sepolia for comparison (using Alchemy)
    sepolia: {
      url: process.env.ALCHEMY_API_KEY ? 
        `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` :
        "https://rpc.sepolia.org", // Fallback public RPC
      chainId: 11155111,
      gasPrice: 20000000000, // 20 Gwei
      gas: 10000000,
      timeout: 600000,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },

    // Ethereum Holesky testnet (alternative)
    holesky: {
      url: "https://ethereum-holesky-rpc.publicnode.com",
      chainId: 17000,
      gasPrice: 15000000000, // 15 Gwei
      gas: 10000000,
      timeout: 600000,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },

    // Ethereum Goerli (if still available)
    goerli: {
      url: process.env.ALCHEMY_API_KEY ? 
        `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` :
        "https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161", // Public Infura
      chainId: 5,
      gasPrice: 25000000000, // 25 Gwei
      gas: 10000000,
      timeout: 600000,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
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