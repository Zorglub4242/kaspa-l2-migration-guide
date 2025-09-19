const ethers = require('ethers');
const { NetworkConfigLoader } = require('./network-config-loader');
const path = require('path');
const fs = require('fs');

// Initialize network config loader
const networkLoader = new NetworkConfigLoader();
let externalNetworks = {};
let networksLoaded = false;

// Function to load networks synchronously on first use
function loadNetworksSync() {
  if (networksLoaded) return;

  try {
    const configDir = path.join(__dirname, '..', 'config', 'networks');

    // Load all JSON files in the config/networks directory synchronously
    if (fs.existsSync(configDir)) {
      const files = fs.readdirSync(configDir);

      for (const file of files) {
        if (file.endsWith('.json') && file !== 'schema.json') {
          try {
            const filePath = path.join(configDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const config = JSON.parse(content);

            // Convert to internal format
            externalNetworks[config.id] = {
              name: config.name,
              chainId: config.chainId,
              symbol: config.symbol,
              rpc: config.rpc.public[0],
              wsRpc: config.rpc.websocket ? config.rpc.websocket[0] : null,
              explorer: {
                base: config.explorer.url,
                tx: (hash) => `${config.explorer.url}/tx/${hash}`,
                address: (address) => `${config.explorer.url}/address/${address}`
              },
              faucet: config.faucet ? config.faucet.url : null,
              gasConfig: {
                strategy: config.gasConfig.strategy,
                base: ethers.utils.parseUnits(config.gasConfig.fallback || '20', 'gwei'),
                fallback: ethers.utils.parseUnits(config.gasConfig.fallback || '20', 'gwei'),
                fixed: config.gasConfig.fixed ? ethers.utils.parseUnits(config.gasConfig.fixed, 'gwei') : null,
                maxGasPrice: ethers.utils.parseUnits(config.gasConfig.maxFeePerGas || '100', 'gwei'),
                tolerance: 0.1
              },
              timeouts: {
                transaction: 60000,
                deployment: 120000,
                finality: config.performance ? config.performance.blockTime : 2000,
                confirmation: 30000
              }
            };
          } catch (err) {
            console.warn(`Warning: Could not load network config from ${file}:`, err.message);
          }
        }
      }
    }

    networksLoaded = true;
  } catch (error) {
    console.warn('Warning: Could not load external network configs:', error.message);
    networksLoaded = true; // Prevent repeated attempts
  }
}

// Load networks synchronously on module import
loadNetworksSync();

// No more hardcoded NETWORKS - all networks come from external configs
const NETWORKS = {};

function getAllNetworks() {
  loadNetworksSync(); // Ensure networks are loaded
  // Only return external networks
  return Object.keys(externalNetworks);
}

function getNetworkByChainId(chainId) {
  loadNetworksSync(); // Ensure networks are loaded
  // Check external networks
  return Object.values(externalNetworks).find(network => network.chainId === chainId);
}

function getNetworkByName(name) {
  loadNetworksSync(); // Ensure networks are loaded
  // Check external networks (external configs are the only source)
  return externalNetworks[name.toLowerCase()];
}

function getNetworkConfig(networkOrChainId) {
  loadNetworksSync(); // Ensure networks are loaded
  if (typeof networkOrChainId === 'number') {
    return getNetworkByChainId(networkOrChainId);
  }
  return getNetworkByName(networkOrChainId);
}

// Function to get merged networks (now only external)
function getMergedNetworks() {
  loadNetworksSync(); // Ensure networks are loaded
  return { ...externalNetworks };
}

// Function to refresh external networks (async version for backward compatibility)
async function refreshNetworks() {
  try {
    // Reset to force reload
    networksLoaded = false;
    externalNetworks = {};

    // Load synchronously
    loadNetworksSync();

    return true;
  } catch (error) {
    console.warn('Failed to refresh networks:', error.message);
    return false;
  }
}

module.exports = {
  networks: externalNetworks, // Backward compatibility - but now only external networks
  NETWORKS, // Empty for backward compatibility
  externalNetworks,
  getMergedNetworks,
  getNetworkByChainId,
  getNetworkByName,
  getAllNetworks,
  getNetworkConfig,
  refreshNetworks,
  networkLoader
};