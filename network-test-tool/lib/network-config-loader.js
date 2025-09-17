const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const { ethers } = require('ethers');

class NetworkConfigLoader {
  constructor() {
    this.configDir = path.join(__dirname, '..', 'config', 'networks');
    this.schemaPath = path.join(this.configDir, 'schema.json');
    this.networks = new Map();
    this.ajv = new Ajv({ allErrors: true, useDefaults: true });
  }

  // Load and validate schema
  async loadSchema() {
    try {
      const schemaContent = fs.readFileSync(this.schemaPath, 'utf8');
      this.schema = JSON.parse(schemaContent);
      this.validator = this.ajv.compile(this.schema);
      return true;
    } catch (error) {
      console.error('Failed to load schema:', error);
      return false;
    }
  }

  // Load all network configurations
  async loadAll() {
    if (!await this.loadSchema()) {
      throw new Error('Failed to load schema');
    }

    const files = fs.readdirSync(this.configDir)
      .filter(file => file.endsWith('.json') && file !== 'schema.json');

    for (const file of files) {
      try {
        await this.loadNetwork(file);
      } catch (error) {
        console.warn(`Failed to load ${file}:`, error.message);
      }
    }

    return this.networks;
  }

  // Load a single network configuration
  async loadNetwork(filename) {
    const filepath = path.join(this.configDir, filename);
    const content = fs.readFileSync(filepath, 'utf8');
    let config = JSON.parse(content);

    // Replace environment variables in config
    config = this.processEnvironmentVars(config);

    // Validate against schema
    if (!this.validator(config)) {
      throw new Error(`Validation failed for ${filename}: ${JSON.stringify(this.validator.errors)}`);
    }

    // Process gas configuration
    config = this.processGasConfig(config);

    // Store the network
    this.networks.set(config.id, config);

    return config;
  }

  // Process environment variables in configuration
  processEnvironmentVars(obj) {
    if (typeof obj === 'string') {
      // Replace ${VAR_NAME} with environment variable
      return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        return process.env[varName] || match;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.processEnvironmentVars(item));
    }

    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.processEnvironmentVars(value);
      }
      return result;
    }

    return obj;
  }

  // Process gas configuration
  processGasConfig(config) {
    const gasConfig = config.gasConfig;

    if (gasConfig.fixed) {
      gasConfig.fixedWei = ethers.utils.parseUnits(gasConfig.fixed, 'gwei');
    }

    if (gasConfig.maxFeePerGas) {
      gasConfig.maxFeePerGasWei = ethers.utils.parseUnits(gasConfig.maxFeePerGas, 'gwei');
    }

    if (gasConfig.maxPriorityFeePerGas) {
      gasConfig.maxPriorityFeePerGasWei = ethers.utils.parseUnits(gasConfig.maxPriorityFeePerGas, 'gwei');
    }

    if (gasConfig.fallback) {
      gasConfig.fallbackWei = ethers.utils.parseUnits(gasConfig.fallback, 'gwei');
    }

    return config;
  }

  // Get network by ID
  getNetwork(networkId) {
    return this.networks.get(networkId);
  }

  // Get all networks
  getAllNetworks() {
    return Array.from(this.networks.values());
  }

  // Get networks by type (mainnet, testnet, local)
  getNetworksByType(type) {
    return this.getAllNetworks().filter(network => network.type === type);
  }

  // Get network for Hardhat config
  getHardhatConfig(networkId) {
    const network = this.getNetwork(networkId);
    if (!network) {
      throw new Error(`Network ${networkId} not found`);
    }

    const config = {
      chainId: network.chainId,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    };

    // Select the first available RPC endpoint
    const rpcUrls = network.rpc.public.filter(url => {
      // Check if URL contains environment variables that are not set
      const hasUnsetVars = url.includes('${') && url.includes('}');
      return !hasUnsetVars;
    });

    if (rpcUrls.length > 0) {
      config.url = rpcUrls[0];
    }

    // Add gas configuration
    if (network.gasConfig.strategy === 'fixed' && network.gasConfig.fixed) {
      config.gasPrice = network.gasConfig.fixedWei.toString();
    }

    return config;
  }

  // Add a new network configuration
  async addNetwork(config) {
    // Validate configuration
    if (!this.validator(config)) {
      throw new Error(`Validation failed: ${JSON.stringify(this.validator.errors)}`);
    }

    // Save to file
    const filename = `${config.id}.json`;
    const filepath = path.join(this.configDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(config, null, 2));

    // Load into memory
    await this.loadNetwork(filename);

    return config;
  }

  // Validate a network configuration
  validateConfig(config) {
    if (!this.validator) {
      this.loadSchema();
    }
    return this.validator(config);
  }

  // Get network statistics
  getStatistics() {
    const stats = {
      total: this.networks.size,
      byType: {
        mainnet: 0,
        testnet: 0,
        local: 0
      },
      features: {
        eip1559: 0,
        create2: 0
      }
    };

    for (const network of this.networks.values()) {
      stats.byType[network.type]++;

      if (network.features?.eip1559) stats.features.eip1559++;
      if (network.features?.create2) stats.features.create2++;
    }

    return stats;
  }

  // Export networks to different formats
  exportNetworks(format = 'json') {
    const networks = this.getAllNetworks();

    if (format === 'markdown') {
      return this.exportAsMarkdown(networks);
    } else if (format === 'hardhat') {
      return this.exportAsHardhatConfig(networks);
    } else {
      return networks;
    }
  }

  // Export as markdown table
  exportAsMarkdown(networks) {
    let md = '# Supported Networks\n\n';
    md += '| Network | Chain ID | Type | Symbol | RPC | Faucet |\n';
    md += '|---------|----------|------|--------|-----|--------|\n';

    for (const network of networks) {
      const rpc = network.rpc.public[0] || 'N/A';
      const faucet = network.faucet?.url || 'N/A';
      md += `| ${network.name} | ${network.chainId} | ${network.type} | ${network.symbol} | ${rpc} | ${faucet} |\n`;
    }

    return md;
  }

  // Export as Hardhat configuration
  exportAsHardhatConfig(networks) {
    const config = {};

    for (const network of networks) {
      try {
        config[network.id] = this.getHardhatConfig(network.id);
      } catch (error) {
        console.warn(`Skipping ${network.id}: ${error.message}`);
      }
    }

    return config;
  }
}

// Export singleton instance
const networkConfigLoader = new NetworkConfigLoader();
module.exports = { networkConfigLoader, NetworkConfigLoader };