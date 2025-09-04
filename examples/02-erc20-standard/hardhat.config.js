require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
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

    // Ethereum Mainnet (expensive, but reference point)
    ethereum: {
      url: "https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY",
      chainId: 1,
      gasPrice: 20000000000, // 20 Gwei
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },

    // Ethereum Sepolia Testnet (free ETH but still expensive gas)
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY", 
      chainId: 11155111,
      gasPrice: 20000000000, // 20 Gwei
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },

    // 🎯 KASPLEX L2 TESTNET - ADD THIS NETWORK!
    kasplex: {
      url: "https://rpc.kasplextest.xyz",
      chainId: 167012,
      gasPrice: 20000000000, // 20 Gwei - same as Ethereum, but KAS is much cheaper!
      gas: 4000000, // Gas limit
      timeout: 60000, // 60 second timeout to prevent hanging
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },

    // Polygon Mainnet (for comparison)
    polygon: {
      url: "https://polygon-rpc.com/",
      chainId: 137,
      gasPrice: 30000000000, // 30 Gwei
      // accounts: ["0x" + "your-private-key"],
    },

    // Arbitrum One (for comparison)
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      gasPrice: 1000000000, // 1 Gwei
      // accounts: ["0x" + "your-private-key"],
    }
  },

  // Gas reporting for cost analysis
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },

  // Contract verification settings
  etherscan: {
    apiKey: {
      mainnet: "YOUR-ETHERSCAN-API-KEY",
      sepolia: "YOUR-ETHERSCAN-API-KEY",
      polygon: "YOUR-POLYGONSCAN-API-KEY",
      arbitrumOne: "YOUR-ARBISCAN-API-KEY",
      // Kasplex uses its own explorer - no API key needed for now
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
  }
};

/*
🔧 SETUP INSTRUCTIONS:

1. Install dependencies:
   npm install

2. Add your private key:
   - Copy your MetaMask private key (Account Details > Export Private Key)
   - Uncomment the accounts line for the network you want to use
   - Replace "your-private-key" with your actual key (without 0x prefix)

3. For Ethereum/Polygon networks, get API keys:
   - Alchemy: https://www.alchemy.com/
   - Etherscan: https://etherscan.io/apis
   - PolygonScan: https://polygonscan.com/apis

4. Get testnet funds:
   - Kasplex: https://kasplextest.xyz/faucet (50 KAS daily - FREE!)
   - Sepolia: https://sepoliafaucet.com/
   - Polygon Mumbai: https://faucet.polygon.technology/

5. Deploy commands:
   npx hardhat run scripts/deploy-kasplex.js --network kasplex
   npx hardhat run scripts/deploy-ethereum.js --network sepolia

⚠️  SECURITY NOTE:
Never commit your private key to git! Use environment variables in production:
accounts: [process.env.PRIVATE_KEY]

🎯 KASPLEX ADVANTAGE:
Same exact configuration as Ethereum, just:
- Different RPC URL
- Different Chain ID  
- 99% lower costs!
*/