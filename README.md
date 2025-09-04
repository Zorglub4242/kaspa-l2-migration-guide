# 🎯 Your Ethereum Code Works on Kasplex

**Zero code changes needed. Just switch the network.**

Kasplex is a fully EVM-compatible Layer 2 built on Kaspa. Your existing Ethereum contracts, tools, and knowledge work exactly the same - but with ultra-low gas fees and 10-second finality.

## ⚡ Quick Start (2 minutes)

1. **Clone any example**:
   ```bash
   cd examples/02-erc20-standard
   npm install
   ```

2. **Add Kasplex network** to your `hardhat.config.js`:
   ```javascript
   kasplex: {
     url: "https://rpc.kasplextest.xyz",
     chainId: 167012,
     gasPrice: 20000000000, // 20 Gwei - same as Ethereum!
   }
   ```

3. **Deploy** (same command, different network):
   ```bash
   npx hardhat run scripts/deploy.js --network kasplex
   ```

4. **Done!** 🎉 Your contract is live on Kasplex.

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
  faucet: "https://kasplextest.xyz/faucet"
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

- [ ] **Add Kasplex network** to MetaMask
- [ ] **Get testnet KAS** from [faucet](https://kasplextest.xyz/faucet)
- [ ] **Clone an example** project
- [ ] **Deploy your first contract** (`npx hardhat run scripts/deploy.js --network kasplex`)
- [ ] **Verify on explorer** at [frontend.kasplextest.xyz](https://frontend.kasplextest.xyz)

## 🤝 Community & Support

- **Documentation**: [docs-kasplex.gitbook.io](https://docs-kasplex.gitbook.io/l2-network)
- **Discord**: [Kasplex Community](https://discord.gg/kasplex)
- **Twitter**: [@kasplex](https://twitter.com/kasplex)
- **GitHub**: Issues and contributions welcome

## 📈 Success Stories

> "Deployed my entire DeFi protocol to Kasplex in 15 minutes. Zero code changes needed!" - DeFi Builder

> "Gas costs dropped from $50 per transaction to $0.05. Same functionality, better UX." - dApp Developer

> "Kasplex feels exactly like Ethereum, but actually usable for small transactions." - NFT Creator

---

**Ready to build?** Pick an example and deploy in 2 minutes! 🚀

**Questions?** Check our [FAQ](migration-guides/zero-code-changes.md) or join the Discord.

**Want to contribute?** PRs welcome! Help make Kasplex the best EVM experience.
