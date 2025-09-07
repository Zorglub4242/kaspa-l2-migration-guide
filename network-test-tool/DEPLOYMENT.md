# 🚀 Network Test Tool - Deployment Guide

## 📋 Quick Overview

This tool provides comprehensive blockchain testing capabilities with multiple deployment options:

- **Basic Load Testing**: Simple contract deployment for performance testing
- **EVM Compatibility Testing**: Full EVM feature compatibility validation  
- **DeFi Protocol Testing**: Complete DeFi ecosystem testing suite

## 🎯 Deployment Options

### 1. Basic Load Testing Contract
**Use Case**: Simple performance testing and load analysis
```bash
# Deploy basic LoadTestContract
npm run deploy:kasplex

# Available test commands
npm run load-test:simple kasplex
npm run load-test:stress kasplex
```

### 2. EVM Compatibility Testing Suite
**Use Case**: Full EVM compatibility validation (100% success rate proven)
```bash
# Deploy EVM compatibility contracts
npm run deploy:evm-compatibility kasplex

# Run comprehensive EVM tests
npm run test:evm-compatibility kasplex
```

### 3. Complete DeFi Protocol Suite
**Use Case**: Full DeFi ecosystem testing (tokens, DEX, lending, NFTs)
```bash
# Deploy complete DeFi suite
npm run load-test:complete-defi kasplex
```

## 🔧 Setup Instructions

### 1. Environment Setup
```bash
# Clone and navigate
cd network-test-tool

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Add your PRIVATE_KEY to .env (no 0x prefix)
```

### 2. Network Configuration
The tool supports multiple networks with optimized settings:

**Kasplex L2** (Recommended):
- Gas Price: 2500 Gwei (critical for success)
- Chain ID: 167012
- RPC: https://rpc.kasplextest.xyz

**Ethereum Testnets**:
- Sepolia, Holesky, Goerli supported
- Standard gas pricing

### 3. Get Test Funds
**For Kasplex**:
- [Zealous Swap Faucet](https://faucet.zealousswap.com/)
- [Kaspa Finance Faucet](https://app.kaspafinance.io/faucets)

**For Ethereum**:
- Standard testnet faucets for each network

## 📊 Deployment Commands Reference

### Basic Commands
```bash
# Deploy to different networks
npm run deploy:kasplex        # Kasplex L2
npm run deploy:sepolia        # Ethereum Sepolia  
npm run deploy:holesky        # Ethereum Holesky
npm run deploy:goerli         # Ethereum Goerli (deprecated)

# Development
npm run compile               # Compile contracts
npm run clean                # Clean artifacts
npm run console:kasplex       # Interactive console
```

### Advanced Testing Commands
```bash
# EVM Compatibility Testing
npm run deploy:evm-compatibility kasplex
npm run test:evm-compatibility kasplex

# DeFi Protocol Testing  
npm run load-test:complete-defi kasplex
npm run load-test:defi-tokens kasplex
npm run load-test:defi-dex kasplex

# Performance Testing
npm run load-test:simple kasplex
npm run load-test:stress kasplex  
npm run load-test:diagnostic kasplex
npm run load-test:reliable kasplex
```

## 💾 Contract Address Management

### Automatic Saving
All deployment scripts automatically save contract addresses to:
- `deployment-{network}.json` - Individual network deployments
- `deployments/` directory structure for complex suites

### Manual Contract Address Setting
If you need to set a specific contract address:
```bash
# Windows
set CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890

# Linux/Mac  
export CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
```

### Finding Deployed Contracts
Check these files after deployment:
```bash
# Basic deployments
deployment-kasplex.json
deployment-sepolia.json

# EVM compatibility suite
deployments/kasplex/contracts.json

# DeFi suite deployments  
deployments/kasplex/defi-suite.json
```

## 🎯 Deployment Types Explained

### 1. Basic LoadTestContract (`deploy:kasplex`)
**What it deploys**:
- Single `LoadTestContract` with basic functions
- Saves to `deployment-{network}.json`

**Functions available**:
- `increment()` - Basic counter increment
- `batchIncrement(uint256)` - Batch processing
- `stressTest(uint256, string)` - Variable gas usage
- `simulateParallelLoad(uint256)` - Parallel testing

### 2. EVM Compatibility Suite (`deploy:evm-compatibility`)
**What it deploys**:
- `PrecompileTest` - Tests all EVM precompile functions
- `AssemblyTest` - Tests Solidity assembly operations
- `CREATE2Factory` - Tests deterministic deployments
- `MockERC20` - Standard token for testing

**Verification**: Achieves 100% success rate on Kasplex with proper configuration

### 3. Complete DeFi Suite (`load-test:complete-defi`)
**What it deploys**:
- ERC20 tokens (USDC, USDT, WETH mock)
- DEX contracts (AMM, Router, Pair Factory)
- Lending protocol (Compound-style)
- Yield farming contracts
- NFT collections (ERC721)
- Multi-signature wallets
- Governance contracts

## 🚨 Common Issues & Solutions

### Issue: "Only basic test deployed"
**Problem**: Using `deploy:kasplex` only deploys LoadTestContract
**Solution**: Use specific deployment commands for advanced features:
- EVM testing: `npm run deploy:evm-compatibility kasplex`
- DeFi suite: `npm run load-test:complete-defi kasplex`

### Issue: "Contract address not saved"
**Problem**: Deployment files not generated
**Solution**: Check these locations:
1. Root directory: `deployment-{network}.json`
2. Deployments folder: `deployments/{network}/`
3. Console output: Contract addresses are displayed

### Issue: "Deployment hangs indefinitely"
**Problem**: Gas price too low for Kasplex network
**Solution**: Ensure using 2500+ Gwei gas price (automatically handled in scripts)

### Issue: "Orphan transaction error"
**Problem**: Network timing issues
**Solution**: Scripts include automatic retry logic with exponential backoff

## 📈 Success Metrics

### Proven Results on Kasplex:
- **EVM Compatibility**: 100% success rate (10/10 tests)
- **DeFi Protocol**: 100% success rate (66/66 tests)
- **Gas Efficiency**: 100x cheaper than Ethereum
- **Finality**: 10 seconds vs Ethereum's 12+ minutes

## 🔍 Network Monitoring

### Explorer URLs:
- **Kasplex**: https://explorer.testnet.kasplextest.xyz
- **Sepolia**: https://sepolia.etherscan.io
- **Holesky**: https://holesky.etherscan.io

### RPC Health Check:
```bash
curl -X POST https://rpc.kasplextest.xyz \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## 🎉 Next Steps After Deployment

1. **View Contracts**: Check explorer URLs from deployment output
2. **Run Tests**: Use appropriate test commands for your deployment type
3. **Analyze Results**: Check generated test result files
4. **Compare Networks**: Use multi-network comparison tools

## 🤝 Support

- **Issues**: GitHub repository issues
- **Documentation**: README.md files in each deployment type
- **Examples**: Complete working examples in repository

---

**Ready to deploy?** Choose your deployment type and follow the commands above! 🚀