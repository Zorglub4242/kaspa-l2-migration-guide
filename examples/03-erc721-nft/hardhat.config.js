require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
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
      gasPrice: 20000000000, // 20 Gwei
      gas: 10000000, // 10M gas limit
      timeout: 600000, // 10 minutes
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    
    // Kasplex L2 Testnet - CRITICAL: Use 2000 Gwei gas price for transaction inclusion
    kasplex: {
      url: "https://rpc.kasplextest.xyz",
      chainId: 167012,
      gasPrice: 2000000000000, // 2000 Gwei - CRITICAL for Kasplex transaction inclusion
      gas: 10000000, // 10M gas limit
      timeout: 600000, // 10 minutes
      pollingInterval: 5000, // 5 second polling
      allowUnlimitedContractSize: true,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    }
  },
  
  // Paths configuration
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};