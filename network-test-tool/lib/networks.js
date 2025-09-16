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
      finality: 30000
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
      strategy: 'adaptive',
      base: ethers.utils.parseUnits('2001', 'gwei'),
      fallback: ethers.utils.parseUnits('2001', 'gwei'),
      tolerance: 0.1
    },
    timeouts: {
      transaction: 120000,
      deployment: 300000,
      finality: 15000
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
      strategy: 'fixed',
      required: ethers.utils.parseUnits('2000', 'gwei'), // Igra requires exactly 2000 gwei
      tolerance: 0.1
    },
    timeouts: {
      transaction: 60000,
      deployment: 180000,
      finality: 10000
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