const ethers = require('ethers');
const { getNetworkConfig } = require('./networks');

class GasManager {
  constructor(network, provider) {
    this.network = network;
    this.provider = provider;
    this.config = getNetworkConfig(network.chainId);
    
    if (!this.config) {
      throw new Error(`Unknown network chainId: ${network.chainId}`);
    }
  }

  async getGasPrice() {
    const { gasConfig } = this.config;
    
    switch (gasConfig.strategy) {
      case 'fixed':
        return this._getFixedGasPrice();
      
      case 'adaptive':
        return this._getAdaptiveGasPrice();
      
      case 'dynamic':
      default:
        return this._getDynamicGasPrice();
    }
  }

  async _getFixedGasPrice() {
    const { gasConfig } = this.config;

    // For Igra, always use the fixed price directly without checking network
    if (this.network.chainId === 19416) {
      console.log(`💰 Using fixed gas price for ${this.config.name}: ${ethers.utils.formatUnits(gasConfig.required, 'gwei')} gwei`);
      return gasConfig.required;
    }

    try {
      const networkGasPrice = await this.provider.getGasPrice();
      const networkGasPriceGwei = parseFloat(ethers.utils.formatUnits(networkGasPrice, 'gwei'));
      const requiredGwei = parseFloat(ethers.utils.formatUnits(gasConfig.required, 'gwei'));

      if (Math.abs(networkGasPriceGwei - requiredGwei) < gasConfig.tolerance) {
        return networkGasPrice;
      }

      throw new Error(`Network gas price ${networkGasPriceGwei} gwei doesn't match required ${requiredGwei} gwei for ${this.config.name}`);
    } catch (error) {
      console.warn(`⚠️ Using fixed gas price for ${this.config.name}: ${ethers.utils.formatUnits(gasConfig.required, 'gwei')} gwei`);
      return gasConfig.required;
    }
  }

  async _getAdaptiveGasPrice() {
    const { gasConfig } = this.config;
    
    try {
      const networkGasPrice = await this.provider.getGasPrice();
      const networkGasPriceGwei = parseFloat(ethers.utils.formatUnits(networkGasPrice, 'gwei'));
      const baseGwei = parseFloat(ethers.utils.formatUnits(gasConfig.base, 'gwei'));
      
      if (networkGasPriceGwei >= baseGwei - gasConfig.tolerance) {
        return networkGasPrice;
      }
      
      console.warn(`⚠️ Network gas price ${networkGasPriceGwei} gwei below minimum, using ${baseGwei} gwei`);
      return gasConfig.base;
    } catch (error) {
      console.warn(`⚠️ Using fallback gas price for ${this.config.name}: ${ethers.utils.formatUnits(gasConfig.fallback, 'gwei')} gwei`);
      return gasConfig.fallback;
    }
  }

  async _getDynamicGasPrice() {
    const { gasConfig } = this.config;
    
    try {
      const networkGasPrice = await this.provider.getGasPrice();
      
      if (gasConfig.maxGasPrice && networkGasPrice.gt(gasConfig.maxGasPrice)) {
        console.warn(`⚠️ Network gas price too high, capping at ${ethers.utils.formatUnits(gasConfig.maxGasPrice, 'gwei')} gwei`);
        return gasConfig.maxGasPrice;
      }
      
      return networkGasPrice;
    } catch (error) {
      console.warn(`⚠️ Using fallback gas price for ${this.config.name}: ${ethers.utils.formatUnits(gasConfig.fallback, 'gwei')} gwei`);
      return gasConfig.fallback;
    }
  }

  async estimateGasWithRetry(contract, method, params = [], retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const gasEstimate = await contract.estimateGas[method](...params);
        return gasEstimate.mul(120).div(100); // 20% buffer
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  createTransactionOverrides(gasLimit) {
    return {
      gasLimit,
      gasPrice: this.getGasPrice(),
      timeout: this.config.timeouts.transaction
    };
  }

  async waitForTransaction(tx, confirmations = 1) {
    try {
      return await tx.wait(confirmations);
    } catch (error) {
      if (error.code === 'TIMEOUT') {
        console.warn(`⚠️ Transaction timeout on ${this.config.name}, but may still be pending`);
      }
      throw error;
    }
  }
}

module.exports = { GasManager };