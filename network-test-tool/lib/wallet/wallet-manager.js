const { ethers } = require('ethers');
const { SignerFactory } = require('./signer-factory');

/**
 * WalletManager - Programmatic wallet management for YAML tests
 *
 * Handles wallet creation, signing, and management without browser automation
 */
class WalletManager {
  constructor(provider) {
    this.provider = provider;
    this.wallets = new Map();
    this.signerFactory = new SignerFactory();
    this.defaultGasLimit = 3000000;
  }

  /**
   * Initialize wallets from configuration
   */
  async initialize(walletConfig) {
    if (!walletConfig) return;

    // Handle different wallet configuration formats
    if (typeof walletConfig === 'object') {
      for (const [name, config] of Object.entries(walletConfig)) {
        await this.createWallet(name, config);
      }
    } else if (Array.isArray(walletConfig)) {
      for (const config of walletConfig) {
        await this.createWallet(config.name || `wallet${walletConfig.indexOf(config)}`, config);
      }
    }
  }

  /**
   * Create a wallet based on configuration
   */
  async createWallet(name, config) {
    let wallet;

    if (typeof config === 'string') {
      // Simple private key or mnemonic
      if (config.startsWith('0x')) {
        // Private key
        wallet = new ethers.Wallet(config, this.provider);
      } else if (config.startsWith('mnemonic:')) {
        // Mnemonic phrase
        const mnemonic = config.replace('mnemonic:', '').trim();
        wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(this.provider);
      } else if (config === 'generate') {
        // Generate new wallet
        wallet = ethers.Wallet.createRandom().connect(this.provider);
      } else if (config.startsWith('$')) {
        // Environment variable
        const envVar = config.substring(1);
        const value = process.env[envVar];
        if (!value) {
          throw new Error(`Environment variable ${envVar} not found`);
        }
        wallet = new ethers.Wallet(value, this.provider);
      } else {
        // Assume it's a private key without 0x prefix
        wallet = new ethers.Wallet(`0x${config}`, this.provider);
      }
    } else if (typeof config === 'object') {
      // Complex configuration object
      wallet = await this.createWalletFromObject(config);
    }

    if (wallet) {
      this.wallets.set(name, wallet);
      console.log(`Wallet '${name}' created: ${wallet.address}`);
      return wallet;
    }

    throw new Error(`Invalid wallet configuration for ${name}`);
  }

  /**
   * Create wallet from configuration object
   */
  async createWalletFromObject(config) {
    const {
      privateKey,
      mnemonic,
      path,
      generate,
      index = 0
    } = config;

    if (privateKey) {
      return new ethers.Wallet(privateKey, this.provider);
    }

    if (mnemonic) {
      const hdPath = path || `m/44'/60'/0'/0/${index}`;
      return ethers.Wallet.fromMnemonic(mnemonic, hdPath).connect(this.provider);
    }

    if (generate) {
      return ethers.Wallet.createRandom().connect(this.provider);
    }

    throw new Error('Invalid wallet configuration object');
  }

  /**
   * Get a wallet by name
   */
  getWallet(name) {
    const wallet = this.wallets.get(name);
    if (!wallet) {
      throw new Error(`Wallet '${name}' not found`);
    }
    return wallet;
  }

  /**
   * Sign a message with a wallet
   */
  async signMessage(walletName, message) {
    const wallet = this.getWallet(walletName);
    const signature = await wallet.signMessage(message);

    console.log(`Message signed by ${walletName} (${wallet.address})`);
    return {
      message,
      signature,
      signer: wallet.address
    };
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(walletName, domain, types, value) {
    const wallet = this.getWallet(walletName);
    const signature = await wallet._signTypedData(domain, types, value);

    return {
      domain,
      types,
      value,
      signature,
      signer: wallet.address
    };
  }

  /**
   * Sign a transaction
   */
  async signTransaction(walletName, transaction) {
    const wallet = this.getWallet(walletName);

    // Prepare transaction
    const tx = {
      to: transaction.to,
      value: transaction.value || 0,
      data: transaction.data || '0x',
      gasLimit: transaction.gasLimit || this.defaultGasLimit,
      gasPrice: transaction.gasPrice,
      nonce: transaction.nonce
    };

    // Get nonce if not provided
    if (tx.nonce === undefined) {
      tx.nonce = await wallet.getTransactionCount();
    }

    // Get gas price if not provided
    if (!tx.gasPrice) {
      tx.gasPrice = await this.provider.getGasPrice();
    }

    // Sign transaction
    const signedTx = await wallet.signTransaction(tx);

    console.log(`Transaction signed by ${walletName} (${wallet.address})`);
    return {
      signed: signedTx,
      hash: ethers.utils.keccak256(signedTx),
      from: wallet.address
    };
  }

  /**
   * Send a signed transaction
   */
  async sendTransaction(walletName, transaction) {
    const wallet = this.getWallet(walletName);

    const tx = {
      to: transaction.to,
      value: transaction.value ? ethers.utils.parseEther(transaction.value.toString()) : 0,
      data: transaction.data || '0x',
      gasLimit: transaction.gasLimit || this.defaultGasLimit
    };

    // Send transaction
    const txResponse = await wallet.sendTransaction(tx);
    console.log(`Transaction sent: ${txResponse.hash}`);

    // Wait for confirmation if requested
    if (transaction.wait) {
      const receipt = await txResponse.wait();
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
      return receipt;
    }

    return txResponse;
  }

  /**
   * Create multi-signature transaction
   */
  async createMultiSigTransaction(signers, threshold, transaction) {
    if (signers.length < threshold) {
      throw new Error(`Not enough signers (${signers.length}) for threshold (${threshold})`);
    }

    const signatures = [];

    // Get signatures from required number of signers
    for (let i = 0; i < threshold; i++) {
      const signerName = signers[i];
      const wallet = this.getWallet(signerName);

      // Create message hash from transaction
      const messageHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'bytes'],
          [transaction.to, transaction.value || 0, transaction.data || '0x']
        )
      );

      const signature = await wallet.signMessage(ethers.utils.arrayify(messageHash));
      signatures.push({
        signer: wallet.address,
        signature
      });
    }

    return {
      transaction,
      threshold,
      signatures,
      signers: signers.map(name => this.getWallet(name).address)
    };
  }

  /**
   * Generate HD wallets from a mnemonic
   */
  generateHDWallets(mnemonic, count = 10, basePath = "m/44'/60'/0'/0/") {
    const hdWallets = [];

    for (let i = 0; i < count; i++) {
      const path = `${basePath}${i}`;
      const wallet = ethers.Wallet.fromMnemonic(mnemonic, path).connect(this.provider);

      const name = `hd_wallet_${i}`;
      this.wallets.set(name, wallet);

      hdWallets.push({
        name,
        address: wallet.address,
        path,
        index: i
      });
    }

    console.log(`Generated ${count} HD wallets`);
    return hdWallets;
  }

  /**
   * Import wallet from encrypted JSON
   */
  async importFromJson(name, json, password) {
    const wallet = await ethers.Wallet.fromEncryptedJson(json, password);
    const connectedWallet = wallet.connect(this.provider);

    this.wallets.set(name, connectedWallet);
    console.log(`Imported wallet '${name}': ${connectedWallet.address}`);

    return connectedWallet;
  }

  /**
   * Export wallet as encrypted JSON
   */
  async exportToJson(walletName, password) {
    const wallet = this.getWallet(walletName);
    const json = await wallet.encrypt(password);
    return json;
  }

  /**
   * Get wallet balance
   */
  async getBalance(walletName) {
    const wallet = this.getWallet(walletName);
    const balance = await wallet.getBalance();
    return ethers.utils.formatEther(balance);
  }

  /**
   * Fund wallet from another wallet
   */
  async fundWallet(fromWallet, toWallet, amount) {
    const from = this.getWallet(fromWallet);
    const to = typeof toWallet === 'string' && this.wallets.has(toWallet)
      ? this.getWallet(toWallet).address
      : toWallet;

    const tx = await from.sendTransaction({
      to,
      value: ethers.utils.parseEther(amount.toString())
    });

    await tx.wait();
    console.log(`Funded ${to} with ${amount} ETH from ${fromWallet}`);
    return tx;
  }

  /**
   * Create deterministic wallet from seed
   */
  createDeterministicWallet(name, seed) {
    const wallet = this.signerFactory.fromSeed(seed, this.provider);
    this.wallets.set(name, wallet);
    console.log(`Deterministic wallet '${name}' created: ${wallet.address}`);
    return wallet;
  }

  /**
   * List all wallets
   */
  listWallets() {
    const walletList = [];
    for (const [name, wallet] of this.wallets) {
      walletList.push({
        name,
        address: wallet.address
      });
    }
    return walletList;
  }

  /**
   * Clear all wallets
   */
  clearWallets() {
    this.wallets.clear();
    console.log('All wallets cleared');
  }

  /**
   * Get wallet count
   */
  getWalletCount() {
    return this.wallets.size;
  }

  /**
   * Check if wallet exists
   */
  hasWallet(name) {
    return this.wallets.has(name);
  }

  /**
   * Remove a wallet
   */
  removeWallet(name) {
    if (this.wallets.delete(name)) {
      console.log(`Wallet '${name}' removed`);
      return true;
    }
    return false;
  }
}

module.exports = { WalletManager };