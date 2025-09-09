const { ethers } = require('ethers');
const { logger } = require('./logger');

/**
 * RPC Manager with fallback support and connection pooling
 * Dramatically improves connection reliability and speed
 */
class RpcManager {
  constructor(networkConfig) {
    this.networkName = networkConfig.name;
    this.rpcEndpoints = this.getRpcEndpoints(networkConfig);
    this.providers = new Map();
    this.currentProviderIndex = 0;
    this.connectionStats = {
      attempts: 0,
      failures: 0,
      avgResponseTime: 0
    };
  }

  getRpcEndpoints(config) {
    // Multiple RPC endpoints for redundancy and load balancing
    const endpoints = {
      sepolia: [
        'https://ethereum-sepolia-rpc.publicnode.com',
        'https://sepolia.drpc.org',
        'https://rpc.sepolia.org',
        'https://ethereum-sepolia.blockpi.network/v1/rpc/public'
      ],
      kasplex: [
        'https://rpc.kasplextest.xyz',
        'https://kasplex-rpc-backup.herokuapp.com', // Example backup
      ],
      igra: [
        'https://rpc.caravel.igralabs.com',
        'https://igra-backup-rpc.herokuapp.com', // Example backup
      ]
    };

    return endpoints[config.name] || [config.rpcUrl];
  }

  async getProvider() {
    // Return cached provider if available and healthy
    if (this.providers.has(this.currentProviderIndex)) {
      const provider = this.providers.get(this.currentProviderIndex);
      if (await this.isProviderHealthy(provider)) {
        return provider;
      }
    }

    // Try each RPC endpoint until one works
    for (let i = 0; i < this.rpcEndpoints.length; i++) {
      const rpcUrl = this.rpcEndpoints[i];
      
      try {
        const startTime = Date.now();
        
        // Create provider with optimized settings
        const provider = new ethers.providers.JsonRpcProvider({
          url: rpcUrl,
          timeout: 8000, // 8 second timeout
          throttleLimit: 10 // Allow burst requests
        });

        // Quick health check
        await Promise.race([
          provider.getNetwork(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 5000))
        ]);

        const responseTime = Date.now() - startTime;
        this.updateStats(responseTime, true);

        this.providers.set(i, provider);
        this.currentProviderIndex = i;
        
        logger.success(`🔗 Connected to ${this.networkName} via ${rpcUrl} (${responseTime}ms)`);
        return provider;

      } catch (error) {
        this.updateStats(0, false);
        logger.warn(`⚠️ ${this.networkName} RPC ${rpcUrl} failed: ${error.message}`);
        continue;
      }
    }

    throw new Error(`All RPC endpoints failed for ${this.networkName}`);
  }

  async isProviderHealthy(provider) {
    try {
      await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 3000))
      ]);
      return true;
    } catch {
      return false;
    }
  }

  updateStats(responseTime, success) {
    this.connectionStats.attempts++;
    if (!success) {
      this.connectionStats.failures++;
    } else {
      // Rolling average of response times
      this.connectionStats.avgResponseTime = 
        (this.connectionStats.avgResponseTime * (this.connectionStats.attempts - 1) + responseTime) 
        / this.connectionStats.attempts;
    }
  }

  getStats() {
    const successRate = ((this.connectionStats.attempts - this.connectionStats.failures) / this.connectionStats.attempts) * 100;
    return {
      ...this.connectionStats,
      successRate: successRate.toFixed(1),
      currentRpc: this.rpcEndpoints[this.currentProviderIndex]
    };
  }

  async switchToNextProvider() {
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.rpcEndpoints.length;
    this.providers.delete(this.currentProviderIndex); // Force reconnection
    return await this.getProvider();
  }
}

module.exports = { RpcManager };