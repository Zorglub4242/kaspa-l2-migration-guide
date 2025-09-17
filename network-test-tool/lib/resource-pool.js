const { ethers } = require('ethers');
const chalk = require('chalk');

class ResourcePool {
  constructor(options = {}) {
    this.options = {
      maxProviders: options.maxProviders || 5,
      maxContracts: options.maxContracts || 20,
      maxSigners: options.maxSigners || 3,
      connectionTimeout: options.connectionTimeout || 30000,
      idleTimeout: options.idleTimeout || 300000, // 5 minutes
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
      ...options
    };
    
    this.providers = new Map(); // networkId -> provider[]
    this.contracts = new Map(); // contractKey -> contract
    this.signers = new Map(); // networkId -> signer[]
    this.connections = new Map(); // networkId -> connection stats
    
    this.healthCheckTimer = null;
    this.isActive = true;
    
    this.startHealthChecks();
  }

  async getProvider(networkConfig, options = {}) {
    const networkId = networkConfig.chainId;
    const providerId = `${networkId}-${options.preferredProvider || 'default'}`;
    
    // Check if we have a cached provider
    if (this.providers.has(providerId)) {
      const provider = this.providers.get(providerId);
      
      // Verify provider is still healthy
      if (await this.isProviderHealthy(provider)) {
        this.updateConnectionStats(networkId, 'hit');
        return provider;
      } else {
        // Remove unhealthy provider
        this.providers.delete(providerId);
        console.log(chalk.yellow(`⚠️ Removed unhealthy provider for ${networkConfig.name}`));
      }
    }
    
    // Create new provider
    const provider = await this.createProvider(networkConfig, options);
    
    // Store in pool
    this.providers.set(providerId, provider);
    this.updateConnectionStats(networkId, 'miss');
    
    console.log(chalk.green(`✅ Created new provider for ${networkConfig.name}`));
    return provider;
  }

  async createProvider(networkConfig, options = {}) {
    console.log(chalk.gray(`🔍 createProvider called for: ${networkConfig.name} (${networkConfig.chainId})`));
    const providerOptions = {
      timeout: options.timeout || this.options.connectionTimeout,
      pollingInterval: networkConfig.timeouts?.finality || 4000,
      ...options.providerOptions
    };
    
    try {
      let provider;
      
      // Create explicit network object to avoid auto-detection issues
      const network = {
        chainId: networkConfig.chainId,
        name: networkConfig.name
      };

      // Support different provider types
      if (options.providerType === 'websocket' && networkConfig.wsRpc) {
        provider = new ethers.providers.WebSocketProvider(networkConfig.wsRpc, network);
      } else {
        provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc, network);
      }

      // Set the polling interval on the provider (critical for fast confirmations!)
      provider.pollingInterval = providerOptions.pollingInterval;
      console.log(chalk.gray(`🔍 Provider configured: timeout=${providerOptions.timeout}ms, polling=${provider.pollingInterval}ms`));

      // Override detectNetwork to return our known network immediately
      provider.detectNetwork = () => Promise.resolve(network);
      
      // Test basic connectivity instead of network detection
      await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Provider connection timeout')), providerOptions.timeout)
        )
      ]);
      
      // Add connection tracking
      this.trackProviderEvents(provider, networkConfig);
      
      return provider;
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create provider for ${networkConfig.name}:`), error.message);
      throw error;
    }
  }

  trackProviderEvents(provider, networkConfig) {
    provider.on('debug', (info) => {
      if (this.options.verbose) {
        console.log(chalk.gray(`🔍 ${networkConfig.name}: ${JSON.stringify(info)}`));
      }
    });
    
    provider.on('error', (error) => {
      console.error(chalk.red(`❌ Provider error for ${networkConfig.name}:`), error.message);
      this.updateConnectionStats(networkConfig.chainId, 'error');
    });
    
    provider.on('network', (newNetwork, oldNetwork) => {
      if (oldNetwork) {
        console.log(chalk.blue(`🔄 Network change for ${networkConfig.name}: ${oldNetwork.chainId} -> ${newNetwork.chainId}`));
      }
    });
  }

  async getSigner(networkConfig, signerIndex = 0, options = {}) {
    const networkId = networkConfig.chainId;
    const signerId = `${networkId}-${signerIndex}`;
    
    // Check cache
    if (this.signers.has(signerId)) {
      return this.signers.get(signerId);
    }
    
    // Get provider first
    const provider = await this.getProvider(networkConfig, options);
    
    let signer;
    
    // Create signer based on options
    if (options.privateKey) {
      signer = new ethers.Wallet(options.privateKey, provider);
    } else if (options.mnemonic) {
      const wallet = ethers.Wallet.fromMnemonic(options.mnemonic, `m/44'/60'/0'/0/${signerIndex}`);
      signer = wallet.connect(provider);
    } else {
      // Use hardhat signers if available, otherwise create a random wallet for testing
      try {
        const signers = await ethers.getSigners();
        if (signers[signerIndex]) {
          signer = signers[signerIndex].connect(provider);
        } else {
          throw new Error(`Signer index ${signerIndex} not available`);
        }
      } catch (error) {
        // In CLI context, ethers.getSigners is not available
        // Create a random wallet for testing purposes
        console.log(chalk.yellow(`⚠️ Creating random wallet for testing (not for production use)`));
        const randomWallet = ethers.Wallet.createRandom();
        signer = randomWallet.connect(provider);
      }
    }
    
    // Cache signer
    this.signers.set(signerId, signer);
    
    console.log(chalk.green(`✅ Created signer ${signerIndex} for ${networkConfig.name}`));
    return signer;
  }

  async getContract(contractName, address, networkConfig, options = {}) {
    const contractKey = `${contractName}-${address}-${networkConfig.chainId}`;
    
    // Check cache
    if (this.contracts.has(contractKey)) {
      const cached = this.contracts.get(contractKey);
      
      // Verify contract is still accessible
      if (await this.isContractHealthy(cached.contract)) {
        return cached.contract;
      } else {
        this.contracts.delete(contractKey);
      }
    }
    
    // Create new contract instance
    const signer = await this.getSigner(networkConfig, options.signerIndex, options);
    const contract = await ethers.getContractAt(contractName, address, signer);
    
    // Add contract methods caching
    const cachedContract = this.addContractCaching(contract);
    
    // Store in cache
    this.contracts.set(contractKey, {
      contract: cachedContract,
      createdAt: Date.now(),
      accessCount: 0
    });
    
    console.log(chalk.green(`✅ Created contract ${contractName} at ${address} for ${networkConfig.name}`));
    return cachedContract;
  }

  addContractCaching(contract) {
    // Wrap contract methods with caching for view functions
    const originalFunctions = {};
    const cache = new Map();
    const cacheTimeout = 30000; // 30 seconds
    
    Object.getOwnPropertyNames(contract.functions).forEach(funcName => {
      const func = contract.functions[funcName];
      
      if (func.constant || func.stateMutability === 'view' || func.stateMutability === 'pure') {
        originalFunctions[funcName] = func.bind(contract);
        
        contract.functions[funcName] = async (...args) => {
          const cacheKey = `${funcName}-${JSON.stringify(args)}`;
          const cached = cache.get(cacheKey);
          
          if (cached && (Date.now() - cached.timestamp) < cacheTimeout) {
            return cached.result;
          }
          
          const result = await originalFunctions[funcName](...args);
          cache.set(cacheKey, { result, timestamp: Date.now() });
          
          // Clean old cache entries
          if (cache.size > 100) {
            const now = Date.now();
            for (const [key, value] of cache.entries()) {
              if (now - value.timestamp > cacheTimeout) {
                cache.delete(key);
              }
            }
          }
          
          return result;
        };
        
        // Also wrap the direct property access
        if (contract[funcName]) {
          contract[funcName] = contract.functions[funcName];
        }
      }
    });
    
    return contract;
  }

  async isProviderHealthy(provider) {
    try {
      await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        )
      ]);
      return true;
    } catch (error) {
      return false;
    }
  }

  async isContractHealthy(contract) {
    try {
      // Try to get the contract code
      const code = await contract.provider.getCode(contract.address);
      return code !== '0x';
    } catch (error) {
      return false;
    }
  }

  updateConnectionStats(networkId, type) {
    if (!this.connections.has(networkId)) {
      this.connections.set(networkId, {
        hits: 0,
        misses: 0,
        errors: 0,
        created: Date.now()
      });
    }
    
    const stats = this.connections.get(networkId);
    stats[type === 'hit' ? 'hits' : type === 'miss' ? 'misses' : 'errors']++;
    stats.lastAccess = Date.now();
  }

  getConnectionStats(networkId = null) {
    if (networkId) {
      return this.connections.get(networkId) || null;
    }
    
    const allStats = {};
    for (const [id, stats] of this.connections) {
      allStats[id] = {
        ...stats,
        hitRate: stats.hits + stats.misses > 0 ? stats.hits / (stats.hits + stats.misses) : 0
      };
    }
    return allStats;
  }

  startHealthChecks() {
    if (this.healthCheckTimer) return;
    
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.options.healthCheckInterval);
  }

  async performHealthChecks() {
    if (!this.isActive) return;
    
    const now = Date.now();
    let removedCount = 0;
    
    // Check providers
    for (const [providerId, provider] of this.providers) {
      if (!(await this.isProviderHealthy(provider))) {
        this.providers.delete(providerId);
        removedCount++;
      }
    }
    
    // Check contracts and remove old ones
    for (const [contractKey, cached] of this.contracts) {
      const age = now - cached.createdAt;
      
      if (age > this.options.idleTimeout) {
        this.contracts.delete(contractKey);
        removedCount++;
      }
    }
    
    // Clean up old connection stats
    for (const [networkId, stats] of this.connections) {
      if (now - stats.lastAccess > this.options.idleTimeout) {
        this.connections.delete(networkId);
      }
    }
    
    if (removedCount > 0 && this.options.verbose) {
      console.log(chalk.gray(`🧹 Cleaned up ${removedCount} stale resources`));
    }
  }

  printPoolStats() {
    console.log(''); // New line
    console.log(chalk.cyan('📊 Resource Pool Statistics:'));
    console.log(chalk.gray('='.repeat(40)));
    
    console.log(`Providers: ${this.providers.size}/${this.options.maxProviders}`);
    console.log(`Contracts: ${this.contracts.size}/${this.options.maxContracts}`);
    console.log(`Signers: ${this.signers.size}/${this.options.maxSigners}`);
    
    console.log('');
    console.log('Connection Stats by Network:');
    const stats = this.getConnectionStats();
    for (const [networkId, stat] of Object.entries(stats)) {
      console.log(`  ${networkId}: ${stat.hits} hits, ${stat.misses} misses (${(stat.hitRate * 100).toFixed(1)}% hit rate)`);
    }
    
    // Memory usage
    const memUsage = process.memoryUsage();
    console.log('');
    console.log(`Memory Usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap`);
  }

  async cleanup() {
    this.isActive = false;
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // Close WebSocket providers
    for (const [providerId, provider] of this.providers) {
      if (provider._websocket) {
        try {
          provider._websocket.close();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
    
    this.providers.clear();
    this.contracts.clear();
    this.signers.clear();
    this.connections.clear();
    
    console.log(chalk.gray('🧹 Resource pool cleaned up'));
  }

  // Utility methods for resource management
  async warmupNetwork(networkConfig, options = {}) {
    console.log(chalk.blue(`🔥 Warming up ${networkConfig.name}...`));
    
    try {
      // Pre-create provider and signer
      const provider = await this.getProvider(networkConfig, options);
      const signer = await this.getSigner(networkConfig, 0, options);
      
      // Test basic operations
      await provider.getBlockNumber();
      await signer.getAddress();
      
      console.log(chalk.green(`✅ ${networkConfig.name} warmed up successfully`));
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to warm up ${networkConfig.name}:`), error.message);
      return false;
    }
  }

  async preloadContracts(contractConfigs, networkConfig) {
    console.log(chalk.blue(`📦 Preloading contracts for ${networkConfig.name}...`));
    
    const loadedContracts = [];
    
    for (const config of contractConfigs) {
      try {
        const contract = await this.getContract(
          config.name, 
          config.address, 
          networkConfig, 
          config.options
        );
        loadedContracts.push(contract);
      } catch (error) {
        console.error(chalk.red(`❌ Failed to preload ${config.name}:`), error.message);
      }
    }
    
    console.log(chalk.green(`✅ Preloaded ${loadedContracts.length}/${contractConfigs.length} contracts`));
    return loadedContracts;
  }
}

module.exports = { ResourcePool };