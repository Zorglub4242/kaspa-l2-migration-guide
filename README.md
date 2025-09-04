# 🎯 Your Ethereum Code Works on Kasplex

**Zero code changes needed. Just switch the network.**

Kasplex is a fully EVM-compatible Layer 2 built on Kaspa. Your existing Ethereum contracts, tools, and knowledge work exactly the same - but with ultra-low gas fees and 10-second finality.

## ⚡ Quick Start (2 minutes)

1. **Clone and setup**:
   ```bash
   git clone https://github.com/Zorglub4242/ethereum-to-kasplex-guide.git
   cd ethereum-to-kasplex-guide
   
   # Option A: Setup all examples at once
   npm run setup
   
   # Option B: Setup specific example
   cd examples/01-hello-world && npm install
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
   # If you used Option A (npm run setup):
   npm run deploy:hello-world
   
   # If you used Option B (cd examples/01-hello-world):
   npm run deploy:kasplex          # Direct RPC (may timeout)
   npm run deploy:kasplex-relayer  # Via relayer (more reliable)
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

- **[Hello World](examples/01-hello-world/)** - Simple storage contract
- **[ERC20 Token](examples/02-erc20-standard/)** - Standard OpenZeppelin token
- **[NFT Collection](examples/03-erc721-nft/)** - Standard ERC721 with metadata

## 🛠️ Framework Support

### Hardhat
- **[Ethereum Setup](frameworks/hardhat-ethereum/)** - Standard Ethereum configuration with all networks
- **[Kasplex Setup](frameworks/hardhat-kasplex/)** - Same setup, just add Kasplex network (99% cost savings!)

### Foundry  
- **[Ethereum Setup](frameworks/foundry-ethereum/)** - Modern Rust-powered development for Ethereum
- **[Kasplex Setup](frameworks/foundry-kasplex/)** - Lightning-fast builds with ultra-low network costs

## 🔄 Migration Guides

- **[From Ethereum](migration-guides/ethereum-mainnet-to-kasplex.md)** - Save 99% on gas costs with zero code changes
- **[From Polygon](migration-guides/polygon-to-kasplex.md)** - Even better performance and 80-90% additional savings
- **[Zero Code Changes](migration-guides/zero-code-changes.md)** - What works immediately without modifications

## 🌐 Network Details

### Kasplex L2 Testnet
```javascript
{
  name: "Kasplex Network Testnet",
  rpc: "https://rpc.kasplextest.xyz", 
  chainId: 167012,
  explorer: "https://explorer.testnet.kasplextest.xyz",
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
- [ ] **View on explorer**: [explorer.testnet.kasplextest.xyz](https://explorer.testnet.kasplextest.xyz)

### 📋 Detailed Setup
Need help? Check our **[Setup Guide](SETUP.md)** for step-by-step instructions!

## 🤝 Community & Support

- **Documentation**: [docs-kasplex.gitbook.io](https://docs-kasplex.gitbook.io/l2-network)
- **Community**: Check official Kasplex channels
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
- **RPC Reliability**: Testnet RPC may occasionally timeout on transaction submission (retry after a few minutes)

### 🚀 Performance Differences
- **Gas costs**: 100x lower than Ethereum mainnet
- **Finality**: 10 seconds vs 12+ minutes on Ethereum
- **Throughput**: 1000+ TPS vs Ethereum's 15 TPS
- **State growth**: More sustainable due to DAG architecture

## 🛠️ Developer Tips & Troubleshooting

### 💡 Critical Success Factors

**Gas Price Requirements**
```javascript
// ✅ WORKS - Use 2000 Gwei for reliable transaction inclusion
gasPrice: ethers.utils.parseUnits("2000", "gwei")

// ❌ FAILS - Low gas prices (20-100 Gwei) cause timeouts
gasPrice: ethers.utils.parseUnits("20", "gwei")  // Hangs indefinitely
```

**Why 2000 Gwei Works:**
- Kasplex network requires higher gas prices for transaction inclusion
- Even at 2000 Gwei, costs are still 100x cheaper than Ethereum
- Proven configuration used by successful projects

**Nonce Management**
```javascript
// ✅ WORKS - Let ethers handle nonce automatically  
delete deployTx.nonce;
const txResponse = await deployer.sendTransaction(deployTx);

// ❌ FAILS - Manual nonce can cause "orphan transaction" errors
deployTx.nonce = await deployer.getTransactionCount("latest");
```

### 🚨 Common Issues & Solutions

**Problem: Deployment hangs indefinitely**
```
📤 Sending raw deployment transaction...
[hangs here forever]
```

**Root Cause:** Gas price too low (20-100 Gwei)  
**Solution:** Use 2000 Gwei gas price

**Problem: "Orphan transaction" error**
```
Error: transaction is an orphan where orphan is disallowed
```

**Root Cause:** Manual nonce management conflicts  
**Solution:** Let ethers calculate nonce automatically

**Problem: Variable scope errors**
```
ReferenceError: contractAddress is not defined
```

**Root Cause:** Variables declared inside try block  
**Solution:** Declare variables before try block
```javascript
let contractAddress;
let hello;
let txResponse;

try {
  // Use assignments, not const declarations
  contractAddress = receipt.contractAddress;
}
```

### 📋 Debugging Checklist

When deployments fail, check these in order:

1. **✅ Gas Price**: Must be 2000 Gwei
2. **✅ Balance**: At least 1 KAS for deployment
3. **✅ Private Key**: Correctly set in .env file (no 0x prefix)
4. **✅ Network**: Using `https://rpc.kasplextest.xyz`
5. **✅ Nonce**: Let ethers handle automatically
6. **✅ Ethers Version**: Use v5.x for best compatibility

### 🎯 Proven Working Configuration

```javascript
// hardhat.config.js
networks: {
  kasplex: {
    url: "https://rpc.kasplextest.xyz",
    chainId: 167012,
    gasPrice: 2000000000000, // 2000 Gwei - CRITICAL!
    gas: 10000000, // 10M gas limit
    timeout: 600000, // 10 minutes
    pollingInterval: 5000, // 5 second polling
    allowUnlimitedContractSize: true,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
  }
}
```

```javascript
// deploy script
const configuredGasPrice = ethers.utils.parseUnits("2000", "gwei");
const hello = await HelloWorld.deploy({
  gasPrice: configuredGasPrice,
  gasLimit: gasEstimate
});
```

### 🔍 Network Status Check

If you suspect network issues:
```bash
# Check if RPC is responding
curl -X POST https://rpc.kasplextest.xyz \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Should return current block number like {"jsonrpc":"2.0","id":1,"result":"0x465354"}
```

---

**Ready to build?** Pick an example and deploy in 2 minutes! 🚀

**Questions?** Check our [FAQ](migration-guides/zero-code-changes.md) or join the Discord.

**Want to contribute?** PRs welcome! Help make Kasplex the best EVM experience.
