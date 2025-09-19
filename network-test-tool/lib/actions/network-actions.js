const chalk = require('chalk');
const ora = require('ora');

class NetworkActions {
  constructor(executor) {
    this.executor = executor;
    this.context = executor.context;
    this.resourcePool = executor.resourcePool;
  }

  /**
   * Execute wait action
   * @param {string|Object} waitConfig - Wait configuration
   */
  async executeWait(waitConfig) {
    if (typeof waitConfig === 'string') {
      // Simple time-based wait
      await this.waitTime(waitConfig);
    } else if (typeof waitConfig === 'object') {
      if (waitConfig.blocks) {
        await this.waitBlocks(waitConfig.blocks);
      } else if (waitConfig.confirmations) {
        await this.waitConfirmations(waitConfig.confirmations);
      } else if (waitConfig.condition) {
        await this.waitCondition(waitConfig.condition, waitConfig.timeout);
      }
    }
  }

  /**
   * Wait for a specific duration
   * @param {string} duration - Duration string (e.g., '5s', '1000ms')
   */
  async waitTime(duration) {
    const ms = this.parseDuration(duration);
    console.log(chalk.gray(`  ⏳ Waiting ${duration}...`));

    await new Promise(resolve => setTimeout(resolve, ms));
    console.log(chalk.green(`    ✓ Waited ${duration}`));
  }

  /**
   * Wait for a number of blocks
   * @param {number} blocks - Number of blocks to wait
   */
  async waitBlocks(blocks) {
    console.log(chalk.gray(`  ⏳ Waiting for ${blocks} blocks...`));

    const provider = this.context.provider;
    const startBlock = await provider.getBlockNumber();
    const targetBlock = startBlock + blocks;

    const spinner = ora(`Waiting for block ${targetBlock}`).start();

    while (true) {
      const currentBlock = await provider.getBlockNumber();
      spinner.text = `Current block: ${currentBlock}, target: ${targetBlock}`;

      if (currentBlock >= targetBlock) {
        spinner.succeed(`Reached block ${currentBlock}`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(chalk.green(`    ✓ Waited ${blocks} blocks`));
  }

  /**
   * Wait for transaction confirmations
   * @param {number} confirmations - Number of confirmations
   */
  async waitConfirmations(confirmations) {
    const txHash = this.context.getVariable('_lastTxHash');

    if (!txHash) {
      throw new Error('No transaction to wait for confirmations');
    }

    console.log(chalk.gray(`  ⏳ Waiting for ${confirmations} confirmations...`));

    const provider = this.context.provider;
    const spinner = ora(`Waiting for confirmations`).start();

    let receipt = await provider.getTransactionReceipt(txHash);
    const txBlock = receipt.blockNumber;

    while (true) {
      const currentBlock = await provider.getBlockNumber();
      const confirms = currentBlock - txBlock + 1;

      spinner.text = `Confirmations: ${confirms}/${confirmations}`;

      if (confirms >= confirmations) {
        spinner.succeed(`Transaction confirmed with ${confirms} confirmations`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(chalk.green(`    ✓ ${confirmations} confirmations reached`));
  }

  /**
   * Wait for a condition to become true
   * @param {string} condition - Condition expression
   * @param {number} timeout - Maximum wait time in ms
   */
  async waitCondition(condition, timeout = 60000) {
    console.log(chalk.gray(`  ⏳ Waiting for: ${condition}`));

    const spinner = ora('Checking condition...').start();
    const startTime = Date.now();

    while (true) {
      const result = await this.context.evaluateExpression(condition);

      if (result) {
        spinner.succeed('Condition met');
        break;
      }

      if (Date.now() - startTime > timeout) {
        spinner.fail('Timeout waiting for condition');
        throw new Error(`Timeout waiting for: ${condition}`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(chalk.green(`    ✓ Condition met: ${condition}`));
  }

  /**
   * Setup network fork
   * @param {Object} forkConfig - Fork configuration
   */
  async setupFork(forkConfig) {
    console.log(chalk.cyan(`  🔱 Setting up network fork`));

    const { network, block, impersonate } = forkConfig;

    // This would integrate with Hardhat or Ganache forking
    // For now, log the configuration
    console.log(chalk.gray(`    Forking ${network} at block ${block || 'latest'}`));

    if (impersonate && impersonate.length > 0) {
      for (const address of impersonate) {
        await this.impersonateAccount(address);
      }
    }
  }

  /**
   * Impersonate an account (for forked networks)
   * @param {string} address - Address to impersonate
   */
  async impersonateAccount(address) {
    console.log(chalk.gray(`    👤 Impersonating ${address}`));

    const provider = this.context.provider;

    try {
      // Hardhat/Ganache specific
      await provider.send('hardhat_impersonateAccount', [address]);
      console.log(chalk.green(`      ✓ Impersonating ${address}`));
    } catch (error) {
      console.warn(chalk.yellow(`      ⚠️ Could not impersonate (not supported on this network)`));
    }
  }

  /**
   * Mine blocks (for test networks)
   * @param {number} blocks - Number of blocks to mine
   */
  async mineBlocks(blocks) {
    console.log(chalk.gray(`  ⛏️ Mining ${blocks} blocks...`));

    const provider = this.context.provider;

    try {
      for (let i = 0; i < blocks; i++) {
        await provider.send('evm_mine', []);
      }
      console.log(chalk.green(`    ✓ Mined ${blocks} blocks`));
    } catch (error) {
      console.warn(chalk.yellow(`    ⚠️ Mining not supported on this network`));
    }
  }

  /**
   * Increase time (for test networks)
   * @param {number} seconds - Seconds to increase
   */
  async increaseTime(seconds) {
    console.log(chalk.gray(`  ⏰ Increasing time by ${seconds} seconds...`));

    const provider = this.context.provider;

    try {
      await provider.send('evm_increaseTime', [seconds]);
      await provider.send('evm_mine', []); // Mine a block to apply the time change
      console.log(chalk.green(`    ✓ Time increased by ${seconds} seconds`));
    } catch (error) {
      console.warn(chalk.yellow(`    ⚠️ Time manipulation not supported on this network`));
    }
  }

  /**
   * Take a snapshot of the network state
   * @returns {string} Snapshot ID
   */
  async takeSnapshot() {
    console.log(chalk.gray(`  📸 Taking network snapshot...`));

    const provider = this.context.provider;

    try {
      const snapshotId = await provider.send('evm_snapshot', []);
      console.log(chalk.green(`    ✓ Snapshot taken: ${snapshotId}`));
      return snapshotId;
    } catch (error) {
      console.warn(chalk.yellow(`    ⚠️ Snapshots not supported on this network`));
      return null;
    }
  }

  /**
   * Revert to a snapshot
   * @param {string} snapshotId - Snapshot ID
   */
  async revertToSnapshot(snapshotId) {
    console.log(chalk.gray(`  ⏪ Reverting to snapshot ${snapshotId}...`));

    const provider = this.context.provider;

    try {
      const success = await provider.send('evm_revert', [snapshotId]);
      if (success) {
        console.log(chalk.green(`    ✓ Reverted to snapshot ${snapshotId}`));
      } else {
        throw new Error('Failed to revert snapshot');
      }
    } catch (error) {
      console.warn(chalk.yellow(`    ⚠️ Could not revert snapshot`));
    }
  }

  /**
   * Get current network information
   */
  async getNetworkInfo() {
    const provider = this.context.provider;

    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const gasPrice = await provider.getGasPrice();
    const block = await provider.getBlock(blockNumber);

    return {
      chainId: network.chainId,
      name: network.name,
      blockNumber,
      gasPrice: gasPrice.toString(),
      blockTime: block.timestamp,
      blockGasLimit: block.gasLimit.toString()
    };
  }

  /**
   * Set gas price for transactions
   * @param {string} gasPrice - Gas price
   */
  async setGasPrice(gasPrice) {
    const { amount } = this.context.parseAmount(gasPrice);
    this.context.setVariable('_gasPrice', amount);
    console.log(chalk.gray(`  ⛽ Gas price set to ${gasPrice}`));
  }

  /**
   * Parse duration string to milliseconds
   * @param {string} duration - Duration string
   * @returns {number} Milliseconds
   */
  parseDuration(duration) {
    const match = duration.match(/^(\d+(?:\.\d+)?)\s*(\w+)?$/);

    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const [, value, unit = 'ms'] = match;
    const num = parseFloat(value);

    switch (unit.toLowerCase()) {
      case 'ms':
      case 'millisecond':
      case 'milliseconds':
        return num;

      case 's':
      case 'sec':
      case 'second':
      case 'seconds':
        return num * 1000;

      case 'm':
      case 'min':
      case 'minute':
      case 'minutes':
        return num * 60 * 1000;

      case 'h':
      case 'hour':
      case 'hours':
        return num * 60 * 60 * 1000;

      default:
        throw new Error(`Unknown duration unit: ${unit}`);
    }
  }
}

module.exports = { NetworkActions };