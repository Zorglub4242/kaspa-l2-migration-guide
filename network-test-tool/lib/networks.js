const ethers = require('ethers');

const NETWORKS = {
  sepolia: {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    symbol: 'ETH',
    rpc: process.env.ALCHEMY_API_KEY ? 
      `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` :
      'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    explorer: {
      base: 'https://sepolia.etherscan.io',
      tx: (hash) => `https://sepolia.etherscan.io/tx/${hash}`,
      address: (address) => `https://sepolia.etherscan.io/address/${address}`
    },
    faucet: 'https://sepoliafaucet.com',
    gasConfig: {
      strategy: 'dynamic',
      fallback: ethers.utils.parseUnits('20', 'gwei'),
      maxGasPrice: ethers.utils.parseUnits('50', 'gwei')
    },
    timeouts: {
      transaction: 60000,
      deployment: 120000,
      finality: 30000,
      confirmation: 30000  // Standard confirmation timeout for Ethereum testnets
    }
  },
  
  kasplex: {
    name: 'Kasplex L2',
    chainId: 167012,
    symbol: 'KAS',
    rpc: 'https://rpc.kasplextest.xyz',
    explorer: {
      base: 'https://explorer.testnet.kasplextest.xyz',
      tx: (hash) => `https://explorer.testnet.kasplextest.xyz/tx/${hash}`,
      address: (address) => `https://explorer.testnet.kasplextest.xyz/address/${address}`
    },
    faucet: 'https://faucet.kasplextest.xyz',
    gasConfig: {
      strategy: 'dynamic', // Changed from 'adaptive' to use network suggested prices
      base: ethers.utils.parseUnits('10', 'gwei'), // Reduced from 2001 to reasonable testnet price
      fallback: ethers.utils.parseUnits('50', 'gwei'), // Fallback if network query fails
      maxGasPrice: ethers.utils.parseUnits('2001', 'gwei'), // Cap at network's typical price
      tolerance: 0.1
    },
    timeouts: {
      transaction: 120000,
      deployment: 300000,
      finality: 1000,  // Reduced from 15000ms to 1000ms for faster polling
      confirmation: 20000  // Transaction confirmation timeout (some txs need 15-20s)
    }
  },
  
  igra: {
    name: 'Igra L2',
    chainId: 19416,
    symbol: 'IKAS',
    rpc: 'https://caravel.igralabs.com:8545',
    explorer: {
      base: 'https://explorer.caravel.igralabs.com',
      tx: (hash) => `https://explorer.caravel.igralabs.com/tx/${hash}`,
      address: (address) => `https://explorer.caravel.igralabs.com/address/${address}`
    },
    faucet: 'https://faucet.caravel.igralabs.com/',
    gasConfig: {
      strategy: 'dynamic', // Changed from 'fixed' to allow dynamic pricing
      base: ethers.utils.parseUnits('10', 'gwei'), // Start with reasonable testnet price
      fallback: ethers.utils.parseUnits('2000', 'gwei'), // Use 2000 gwei if network suggests it
      maxGasPrice: ethers.utils.parseUnits('2000', 'gwei'), // Cap at previously required price
      tolerance: 0.1
    },
    timeouts: {
      transaction: 60000,
      deployment: 180000,
      finality: 1000,  // Reduced from 2000ms to 1000ms for faster polling
      confirmation: 20000  // Transaction confirmation timeout for Igra
    }
  }
};

function getNetworkByChainId(chainId) {
  return Object.values(NETWORKS).find(network => network.chainId === chainId);
}

function getNetworkByName(name) {
  return NETWORKS[name.toLowerCase()];
}

function getAllNetworks() {
  return Object.keys(NETWORKS);
}

function getNetworkConfig(networkOrChainId) {
  if (typeof networkOrChainId === 'number') {
    return getNetworkByChainId(networkOrChainId);
  }
  return getNetworkByName(networkOrChainId);
}

module.exports = {
  networks: NETWORKS,
  NETWORKS,
  getNetworkByChainId,
  getNetworkByName,
  getAllNetworks,
  getNetworkConfig
};