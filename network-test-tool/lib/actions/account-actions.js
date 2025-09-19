const { ethers } = require('ethers');
const chalk = require('chalk');

class AccountActions {
  constructor(executor) {
    this.executor = executor;
    this.context = executor.context;
    this.resourcePool = executor.resourcePool;
  }

  /**
   * Create an account with initial balance
   * @param {string} name - Account name
   * @param {string|Object} config - Account configuration
   * @param {Object} network - Network configuration
   */
  async createAccount(name, config, network) {
    console.log(chalk.gray(`  👤 Creating account: ${name}`));

    let account;
    let balance;

    if (typeof config === 'string') {
      // Simple format: just the balance
      balance = config;
      account = ethers.Wallet.createRandom();
    } else if (typeof config === 'object') {
      // Complex format with options
      balance = config.balance;

      if (config.privateKey) {
        // Resolve privateKey in case it's an env: reference
        const privateKey = await this.context.resolveReference(config.privateKey);
        if (privateKey) {
          account = new ethers.Wallet(privateKey);
        } else {
          throw new Error(`Private key not found for account ${name}`);
        }
      } else if (config.mnemonic) {
        account = ethers.Wallet.fromMnemonic(config.mnemonic);
      } else {
        account = ethers.Wallet.createRandom();
      }
    }

    // Connect to provider
    const provider = await this.resourcePool.getProvider(network);
    account = account.connect(provider);

    // Store account in context
    this.context.setAccount(name, account);

    // Fund account if balance specified
    if (balance) {
      await this.fundAccount(account, balance, network);
    }

    console.log(chalk.green(`    ✓ Account ${name}: ${account.address}`));

    // Store address as variable too for easy reference
    this.context.setVariable(`${name}_address`, account.address);

    return account;
  }

  /**
   * Fund an account with test ETH
   * @param {Object} account - Account to fund
   * @param {string} amountStr - Amount to fund
   * @param {Object} network - Network configuration
   */
  async fundAccount(account, amountStr, network) {
    const { amount } = this.context.parseAmount(amountStr);

    // For test networks, try to use a faucet or pre-funded account
    // This is simplified - real implementation would use actual faucets
    if (network.name === 'localhost' || network.name === 'hardhat') {
      // Use hardhat's pre-funded accounts
      try {
        const provider = account.provider;
        const signers = await provider.listAccounts();

        if (signers.length > 0) {
          const faucetSigner = provider.getSigner(signers[0]);
          const tx = await faucetSigner.sendTransaction({
            to: account.address,
            value: amount
          });
          await tx.wait();

          console.log(chalk.gray(`    💰 Funded with ${amountStr}`));
        }
      } catch (error) {
        console.warn(chalk.yellow(`    ⚠️ Could not fund account: ${error.message}`));
      }
    } else {
      console.log(chalk.yellow(`    ⚠️ Manual funding required for ${network.name}`));
      console.log(chalk.gray(`    Send ${amountStr} to ${account.address}`));
    }
  }

  /**
   * Execute a transfer action
   * @param {string} transferStr - Transfer string (e.g., "alice -> bob, 1 ETH")
   */
  async executeTransfer(transferStr) {
    const startTime = Date.now(); // Track start time for duration

    if (!transferStr) {
      throw new Error(`Transfer string is undefined or null`);
    }

    const match = transferStr.match(/^(.+?)\s*->\s*(.+?),\s*(.+)$/);

    if (!match) {
      throw new Error(`Invalid transfer format: ${transferStr}`);
    }

    const [, fromRef, toRef, amountStr] = match;

    // Resolve references
    const from = await this.context.resolveReference(fromRef);
    const to = await this.context.resolveReference(toRef);
    const resolvedAmount = await this.context.resolveReference(amountStr);
    const { amount, unit } = this.context.parseAmount(resolvedAmount || amountStr);

    // Get signer (account with private key)
    let signer;
    if (typeof from === 'object' && from.sendTransaction) {
      signer = from;
    } else if (typeof from === 'string') {
      // Try to get account from context
      signer = this.context.getAccount(from);
      if (!signer) {
        throw new Error(`No signer found for: ${from}`);
      }
    }

    // Get recipient address
    let toAddress;
    if (typeof to === 'object' && to.address) {
      toAddress = to.address;
    } else if (typeof to === 'string') {
      // Check if it's an account name or address
      const account = this.context.getAccount(to);
      if (account) {
        toAddress = account.address;
      } else if (ethers.utils.isAddress(to)) {
        toAddress = to;
      } else {
        toAddress = await this.context.resolveReference(`${to}_address`);
      }
    }

    console.log(chalk.gray(`  💸 Transfer: ${fromRef} -> ${toRef}, ${amountStr}`));
    console.log(chalk.gray(`     From: ${signer.address}`));
    console.log(chalk.gray(`     To: ${toAddress}`));

    try {
      // Get gas price from network configuration
      let gasPrice;
      const networkConfig = this.context.provider.network;
      if (networkConfig) {
        const { GasManager } = require('../gas-manager');
        const gasManager = new GasManager(networkConfig, signer.provider);
        gasPrice = await gasManager.getGasPrice();
      }

      // Execute transfer
      const txParams = {
        to: toAddress,
        value: amount
      };

      // Add gas price if determined
      if (gasPrice) {
        txParams.gasPrice = gasPrice;
      }

      const tx = await signer.sendTransaction(txParams);

      console.log(chalk.gray(`     Tx: ${tx.hash}`));

      // Wait for confirmation
      const receipt = await tx.wait();

      // Record gas used
      this.context.setVariable('_lastGasUsed', receipt.gasUsed.toString());
      this.context.setVariable('_lastTxHash', receipt.transactionHash);

      // Update test result
      if (this.executor.testResult) {
        this.executor.testResult.addGasUsed(receipt.gasUsed);
      }

      console.log(chalk.green(`     ✓ Confirmed in block ${receipt.blockNumber}`));

      // Add a small delay for Igra network to prevent orphan transactions
      const networkName = this.context.provider.network?.name;
      if (networkName && networkName.toLowerCase().includes('igra')) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay for Igra
      }

      // Record result
      this.context.addResult({
        action: 'transfer',
        from: signer.address,
        to: toAddress,
        amount: amount.toString(),
        unit,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        success: true
      });

      // Also store in TestResult for database persistence
      if (this.executor.testResult) {
        await this.executor.testResult.addResult('transfer', true, {
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          gasPrice: receipt.effectiveGasPrice || receipt.gasPrice,
          from: signer.address,
          to: toAddress,
          amount: amount.toString(),
          duration: Date.now() - startTime
        });
      }

      return receipt;

    } catch (error) {
      console.error(chalk.red(`     ✗ Transfer failed: ${error.message}`));

      this.context.addResult({
        action: 'transfer',
        from: signer.address,
        to: toAddress,
        amount: amount.toString(),
        unit,
        error: error.message,
        success: false
      });

      // Also store failed transfer in TestResult for database persistence
      if (this.executor.testResult) {
        await this.executor.testResult.addResult('transfer', false, {
          error: error.message,
          from: signer.address,
          to: toAddress,
          amount: amount.toString(),
          duration: Date.now() - startTime
        });
      }

      throw error;
    }
  }

  /**
   * Get account balance
   * @param {string} accountRef - Account reference
   * @returns {Object} Balance in wei and formatted
   */
  async getBalance(accountRef) {
    const account = await this.context.resolveReference(accountRef);

    let address;
    if (typeof account === 'object' && account.address) {
      address = account.address;
    } else if (typeof account === 'string' && ethers.utils.isAddress(account)) {
      address = account;
    } else {
      const acc = this.context.getAccount(accountRef);
      if (acc) {
        address = acc.address;
      } else {
        throw new Error(`Cannot resolve account: ${accountRef}`);
      }
    }

    const provider = this.context.provider;
    const balance = await provider.getBalance(address);

    const formatted = ethers.utils.formatEther(balance);
    console.log(chalk.gray(`  💰 Balance of ${accountRef}: ${formatted} ETH`));

    return {
      wei: balance,
      eth: formatted,
      address
    };
  }

  /**
   * Import an existing account
   * @param {string} name - Account name
   * @param {string} addressOrKey - Address or private key
   */
  async importAccount(name, addressOrKey) {
    let account;

    if (addressOrKey.startsWith('0x') && addressOrKey.length === 66) {
      // It's a private key
      const provider = this.context.provider;
      account = new ethers.Wallet(addressOrKey, provider);
    } else if (ethers.utils.isAddress(addressOrKey)) {
      // It's just an address (read-only)
      account = {
        address: addressOrKey,
        provider: this.context.provider
      };
    } else {
      throw new Error(`Invalid account format: ${addressOrKey}`);
    }

    this.context.setAccount(name, account);
    this.context.setVariable(`${name}_address`, account.address);

    console.log(chalk.green(`  ✓ Imported account ${name}: ${account.address}`));
    return account;
  }

  /**
   * Generate multiple accounts
   * @param {number} count - Number of accounts to generate
   * @param {string} prefix - Name prefix for accounts
   * @param {string} balance - Initial balance for each account
   */
  async generateAccounts(count, prefix = 'account', balance = '0') {
    const accounts = [];

    for (let i = 0; i < count; i++) {
      const name = `${prefix}${i}`;
      const account = await this.createAccount(name, balance, {
        provider: this.context.provider
      });
      accounts.push(account);
    }

    console.log(chalk.green(`  ✓ Generated ${count} accounts`));
    return accounts;
  }

  /**
   * Sign a message with an account
   * @param {string} accountRef - Account reference
   * @param {string} message - Message to sign
   * @returns {string} Signature
   */
  async signMessage(accountRef, message) {
    const account = await this.context.resolveReference(accountRef);

    if (!account.signMessage) {
      throw new Error(`Account ${accountRef} cannot sign messages`);
    }

    const signature = await account.signMessage(message);
    console.log(chalk.gray(`  ✍️ Signed message with ${accountRef}`));

    return signature;
  }
}

module.exports = { AccountActions };