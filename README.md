# 🎯 Your Ethereum Code Works on Kasplex

**Zero code changes needed. Just switch the network.**

Kasplex is a fully EVM-compatible Layer 2 built on Kaspa. Your existing Ethereum contracts, tools, and knowledge work exactly the same - but with ultra-low gas fees and 10-second finality.

## ⚡ Quick Start (2 minutes)

1. **Clone and setup**:
   ```bash
   git clone https://github.com/Zorglub4242/ethereum-to-kasplex-guide.git
   cd ethereum-to-kasplex-guide/examples/01-hello-world
   npm install
   ```

2. **Setup test wallet** (SECURITY CRITICAL):
   ```bash
   # Copy the example file
   cp .env.example .env
   ```
   
   ⚠️ **SECURITY WARNING**: Only use a TEST wallet with NO real funds!
   
   **Option A: Create New Test Wallet (Recommended)**
   - Create new MetaMask account: Settings → Add Account → Create Account
   - Name it "Kasplex Test" or similar
   - Export private key: Account Details → Export Private Key
   - Add to .env: `PRIVATE_KEY=your_test_key_here`
   
   **Option B: Use Existing Test Wallet**
   - Switch to existing test-only wallet
   - Ensure it has ZERO real funds
   - Export private key and add to .env

3. **Get free testnet KAS** (choose either faucet):
   - **Zealous Swap**: https://faucet.zealousswap.com/
   - **Kaspa Finance**: https://app.kaspafinance.io/faucets
   - Paste your wallet address and claim daily KAS

4. **Deploy** (works immediately!):
   ```bash
   npm run deploy:kasplex
   ```

5. **Done!** 🎉 Your contract is live on Kasplex with 99% cost savings!

## 📊 Network Comparison

| Aspect | Ethereum Mainnet | Polygon | Arbitrum | **Kasplex L2** |
|--------|------------------|---------|-----------|----------------|
| **Solidity Version** | ✅ 0.8.26 | ✅ 0.8.26 | ✅ 0.8.26 | ✅ **0.8.26** |
| **OpenZeppelin** | ✅ Works | ✅ Works | ✅ Works | ✅ **Works** |
| **Hardhat/Foundry** | ✅ Works | ✅ Works | ✅ Works | ✅ **Works** |
| **MetaMask** | ✅ Works | ✅ Works | ✅ Works | ✅ **Works** |
| **Gas Cost** | 💰 $20-100 | 💰 $0.10-1 | 💰 $0.50-5 | 💰 **$0.01-0.10** |
| **Finality** | ⏰ 12 minutes | ⏰ Instant* | ⏰ 7 days | ⏰ **10 seconds** |
| **DAG Native** | ❌ No | ❌ No | ❌ No | ✅ **Yes** |
| **Code Changes** | - | - | - | 🎯 **ZERO** |

*Polygon finality is instant but has occasional reorgs

## 🏗️ Examples

### Beginner Examples
- **[Hello World](examples/01-hello-world/)** - Simple storage contract
- **[ERC20 Token](examples/02-erc20-standard/)** - Standard OpenZeppelin token
- **[NFT Collection](examples/03-erc721-nft/)** - Standard ERC721 with metadata

### Advanced Examples  
- **[MultiSig Wallet](examples/04-multisig-wallet/)** - Gnosis Safe style wallet
- **[Uniswap V2 Fork](examples/05-uniswap-v2-fork/)** - Complete AMM protocol
- **[Lending Protocol](examples/06-compound-fork/)** - Compound-style lending
- **[DAO Governance](examples/07-governance-dao/)** - OpenZeppelin Governor

## 🛠️ Framework Support

### Hardhat
- **[Ethereum Setup](frameworks/hardhat-ethereum/)** - Standard configuration
- **[Kasplex Setup](frameworks/hardhat-kasplex/)** - Same config, different network

### Foundry
- **[Ethereum Setup](frameworks/foundry-ethereum/)** - Standard configuration  
- **[Kasplex Setup](frameworks/foundry-kasplex/)** - Same config, different network

## 🔄 Migration Guides

- **[From Ethereum](migration-guides/ethereum-mainnet-to-kasplex.md)** - Switch networks
- **[From Polygon](migration-guides/polygon-to-kasplex.md)** - Lower gas costs
- **[Zero Code Changes](migration-guides/zero-code-changes.md)** - What works immediately

## 🌐 Network Details

### Kasplex L2 Testnet
```javascript
{
  name: "Kasplex Network Testnet",
  rpc: "https://rpc.kasplextest.xyz", 
  chainId: 167012,
  explorer: "https://frontend.kasplextest.xyz",
  faucet: "https://faucet.zealousswap.com/"
}
```

### Add to MetaMask (One Click)
[Add Kasplex Network](https://chainlist.org/?search=kasplex) - Or add manually with details above

## 💡 Why Kasplex?

### ✅ **Full EVM Compatibility**
- Same Solidity compiler
- Same tools (Hardhat, Foundry, Remix)
- Same libraries (OpenZeppelin, Chainlink)
- Same wallet support (MetaMask, WalletConnect)

### ⚡ **Better Performance**
- **Ultra-low gas fees**: 100x cheaper than Ethereum
- **Fast finality**: 10 seconds vs 12 minutes
- **High throughput**: 1000+ TPS
- **DAG-based**: Built on Kaspa's innovative architecture

### 🔒 **Security & Decentralization**
- **Based Rollup**: Inherits Kaspa L1 security
- **Decentralized sequencing**: No central point of failure  
- **Open source**: Fully auditable and transparent

## 🚀 Getting Started Checklist

- [ ] **Clone repository**: `git clone https://github.com/Zorglub4242/ethereum-to-kasplex-guide.git`
- [ ] **Create test wallet**: New MetaMask account with NO real funds (security critical!)
- [ ] **Add test private key**: Copy `.env.example` to `.env` and add your TEST wallet key
- [ ] **Get testnet KAS**: [Zealous Swap](https://faucet.zealousswap.com/) or [Kaspa Finance](https://app.kaspafinance.io/faucets)
- [ ] **Deploy first contract**: `npm run deploy:kasplex` (works immediately!)
- [ ] **Add Kasplex network** to MetaMask (network details below)
- [ ] **View on explorer**: [frontend.kasplextest.xyz](https://frontend.kasplextest.xyz)

### 📋 Detailed Setup
Need help? Check our **[Setup Guide](SETUP.md)** for step-by-step instructions!

## 🤝 Community & Support

- **Documentation**: [docs-kasplex.gitbook.io](https://docs-kasplex.gitbook.io/l2-network)
- **Discord**: [Kasplex Community](https://discord.gg/kasplex)
- **Twitter**: [@kasplex](https://twitter.com/kasplex)
- **GitHub**: Issues and contributions welcome

## 🧠 Technical Compatibility Guide

### ✅ What Works (Zero Changes Needed)
- **Solidity Versions**: 0.8.0 - 0.8.26 (latest)
- **Development Tools**: Hardhat, Foundry, Remix IDE
- **Libraries**: OpenZeppelin (all versions), Chainlink, Uniswap
- **Frontend**: ethers.js, wagmi, viem, web3.js
- **Wallets**: MetaMask, WalletConnect, Coinbase Wallet
- **Contract Patterns**: Proxy upgrades, factory patterns, governance
- **Standards**: ERC20, ERC721, ERC1155, EIP-2612 (Permit)

### ⚙️ Version Requirements
- **ethers.js**: v5.x recommended (v6.x works but may have RPC quirks)
- **Hardhat**: Latest version (2.19+)
- **OpenZeppelin**: v5.x recommended for latest features
- **Node.js**: 18+ recommended

### 🔧 Configuration Requirements
```javascript
// hardhat.config.js - Only network config needed
networks: {
  kasplex: {
    url: "https://rpc.kasplextest.xyz",
    chainId: 167012,
    gasPrice: 20000000000, // 20 Gwei
  }
}
```

### ⚠️ Known Limitations
- **EIP-4844 (Blob transactions)**: Not yet supported
- **Some precompiles**: Limited to basic set (ecrecover, sha256, etc.)
- **Gas reporting**: Some tools may not recognize Kasplex gas costs
- **Block times**: ~10 seconds vs Ethereum's ~12 seconds

### 🚀 Performance Differences
- **Gas costs**: 100x lower than Ethereum mainnet
- **Finality**: 10 seconds vs 12+ minutes on Ethereum
- **Throughput**: 1000+ TPS vs Ethereum's 15 TPS
- **State growth**: More sustainable due to DAG architecture

---

**Ready to build?** Pick an example and deploy in 2 minutes! 🚀

**Questions?** Check our [FAQ](migration-guides/zero-code-changes.md) or join the Discord.

**Want to contribute?** PRs welcome! Help make Kasplex the best EVM experience.
