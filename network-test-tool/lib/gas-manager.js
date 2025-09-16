const ethers = require('ethers');
const chalk = require('chalk');
const { getNetworkConfig } = require('./networks');

class GasManager {
  constructor(network, provider) {
    this.network = network;
    this.provider = provider;
    this.config = getNetworkConfig(network.chainId);
    this.hasWarnedHighGas = false; // Track if we've already warned about high gas

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

    // Fixed strategy uses the configured required price
    if (gasConfig.required) {
      console.log(`💰 Using fixed gas price for ${this.config.name}: ${ethers.utils.formatUnits(gasConfig.required, 'gwei')} gwei`);
      return gasConfig.required;
    }

    // Fallback to base price if no required price is set
    console.warn(`⚠️ No required price set for fixed strategy, using base: ${ethers.utils.formatUnits(gasConfig.base || gasConfig.fallback, 'gwei')} gwei`);
    return gasConfig.base || gasConfig.fallback;
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
      const gasPriceGwei = parseFloat(ethers.utils.formatUnits(networkGasPrice, 'gwei'));

      // Warn if gas price is unusually high for a testnet (only once)
      if (gasPriceGwei > 100 && !this.hasWarnedHighGas) {
        console.warn(chalk.yellow(`⚠️ High gas price detected: ${gasPriceGwei} gwei`));
        console.warn(chalk.yellow(`   This is unusual for a testnet. Normal range: 1-50 gwei`));

        // Estimate cost for a typical contract deployment
        const deploymentGas = 1000000; // 1M gas for deployment
        const costInTokens = ethers.utils.formatEther(networkGasPrice.mul(deploymentGas));
        console.warn(chalk.yellow(`   Estimated deployment cost: ${costInTokens} ${this.config.symbol || 'tokens'}`));

        this.hasWarnedHighGas = true; // Mark that we've shown the warning
      }

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