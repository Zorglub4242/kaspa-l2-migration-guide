const { ethers } = require('ethers');
const crypto = require('crypto');

/**
 * SignerFactory - Creates various types of signers/wallets
 */
class SignerFactory {
  constructor() {
    this.hdPath = "m/44'/60'/0'/0/"; // Default Ethereum HD path
  }

  /**
   * Create wallet from private key
   */
  fromPrivateKey(privateKey, provider) {
    // Add 0x prefix if not present
    if (!privateKey.startsWith('0x')) {
      privateKey = `0x${privateKey}`;
    }

    // Validate private key length
    if (privateKey.length !== 66) {
      throw new Error('Invalid private key length');
    }

    return new ethers.Wallet(privateKey, provider);
  }

  /**
   * Create wallet from mnemonic
   */
  fromMnemonic(mnemonic, path = this.hdPath + '0', provider) {
    // Validate mnemonic
    if (!ethers.utils.isValidMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    return ethers.Wallet.fromMnemonic(mnemonic, path).connect(provider);
  }

  /**
   * Create random wallet
   */
  createRandom(provider) {
    return ethers.Wallet.createRandom().connect(provider);
  }

  /**
   * Create deterministic wallet from seed
   */
  fromSeed(seed, provider) {
    // Create deterministic private key from seed
    const hash = crypto.createHash('sha256').update(seed).digest();
    const privateKey = `0x${hash.toString('hex')}`;
    return new ethers.Wallet(privateKey, provider);
  }

  /**
   * Create multiple HD wallets from mnemonic
   */
  createHDWallets(mnemonic, count = 10, provider) {
    const wallets = [];

    for (let i = 0; i < count; i++) {
      const path = `${this.hdPath}${i}`;
      const wallet = ethers.Wallet.fromMnemonic(mnemonic, path).connect(provider);
      wallets.push({
        index: i,
        path,
        address: wallet.address,
        wallet
      });
    }

    return wallets;
  }

  /**
   * Create wallet from extended key (xpub/xprv)
   */
  fromExtendedKey(extendedKey, provider) {
    // Note: ethers.js doesn't directly support xpub/xprv
    // This would need additional implementation
    throw new Error('Extended key support not yet implemented');
  }

  /**
   * Create burner wallet (temporary wallet)
   */
  createBurner(provider) {
    const wallet = ethers.Wallet.createRandom().connect(provider);
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase,
      wallet,
      destroy: () => {
        // Clear sensitive data
        wallet.privateKey = null;
        wallet.mnemonic = null;
      }
    };
  }

  /**
   * Create wallet with custom entropy
   */
  fromEntropy(entropy, provider) {
    if (typeof entropy === 'string') {
      entropy = Buffer.from(entropy, 'hex');
    }

    if (entropy.length < 16) {
      throw new Error('Entropy must be at least 16 bytes');
    }

    const mnemonic = ethers.utils.entropyToMnemonic(entropy);
    return ethers.Wallet.fromMnemonic(mnemonic).connect(provider);
  }

  /**
   * Create vanity address wallet (address with specific pattern)
   */
  async createVanityWallet(pattern, provider, maxAttempts = 10000) {
    const regex = new RegExp(pattern, 'i');
    let attempts = 0;

    while (attempts < maxAttempts) {
      const wallet = ethers.Wallet.createRandom();

      if (regex.test(wallet.address)) {
        console.log(`Vanity address found after ${attempts} attempts: ${wallet.address}`);
        return wallet.connect(provider);
      }

      attempts++;

      if (attempts % 1000 === 0) {
        console.log(`Vanity search: ${attempts} attempts...`);
      }
    }

    throw new Error(`Could not find vanity address matching ${pattern} after ${maxAttempts} attempts`);
  }

  /**
   * Create multi-sig wallet configuration
   */
  createMultiSigConfig(signers, threshold) {
    if (threshold > signers.length) {
      throw new Error('Threshold cannot exceed number of signers');
    }

    return {
      signers: signers.map(s => s.address || s),
      threshold,
      type: 'multisig',
      requiredSignatures: threshold,
      totalSigners: signers.length
    };
  }

  /**
   * Recover wallet from signature
   */
  recoverFromSignature(message, signature, provider) {
    const signerAddress = ethers.utils.verifyMessage(message, signature);

    // Note: We can't recover the private key from a signature
    // This returns a pseudo-wallet that can only verify signatures
    return {
      address: signerAddress,
      verifyMessage: (msg, sig) => {
        const recovered = ethers.utils.verifyMessage(msg, sig);
        return recovered === signerAddress;
      },
      provider
    };
  }

  /**
   * Create wallet from keystore (JSON)
   */
  async fromKeystore(json, password, provider) {
    const wallet = await ethers.Wallet.fromEncryptedJson(json, password);
    return wallet.connect(provider);
  }

  /**
   * Export wallet to keystore (JSON)
   */
  async toKeystore(wallet, password) {
    return await wallet.encrypt(password);
  }

  /**
   * Validate private key
   */
  isValidPrivateKey(privateKey) {
    if (!privateKey.startsWith('0x')) {
      privateKey = `0x${privateKey}`;
    }

    try {
      new ethers.Wallet(privateKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate mnemonic
   */
  isValidMnemonic(mnemonic) {
    return ethers.utils.isValidMnemonic(mnemonic);
  }

  /**
   * Derive child wallet from parent
   */
  deriveChild(parentWallet, index) {
    if (!parentWallet.mnemonic) {
      throw new Error('Parent wallet must have mnemonic for derivation');
    }

    const path = `${this.hdPath}${index}`;
    return ethers.Wallet.fromMnemonic(parentWallet.mnemonic.phrase, path)
      .connect(parentWallet.provider);
  }

  /**
   * Create read-only signer (for viewing, not signing)
   */
  createReadOnly(address, provider) {
    return new ethers.VoidSigner(address, provider);
  }
}

module.exports = { SignerFactory };