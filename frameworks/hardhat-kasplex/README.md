# 🔨 Hardhat - Kasplex Setup

**Same configuration as Ethereum, just different network!** Your existing Hardhat projects work on Kasplex with zero code changes.

## 🎯 Key Benefits

- ✅ **Same Hardhat commands** and workflow
- ✅ **Same Solidity contracts** (no modifications needed)  
- ✅ **Same tooling** (tests, scripts, verification)
- ✅ **99% lower gas costs** than Ethereum
- ✅ **10-second finality** vs 12+ minutes on Ethereum

## 🚀 Quick Setup

1. **Use existing Hardhat project** or create new one:
   ```bash
   mkdir my-kasplex-project
   cd my-kasplex-project
   npm init -y
   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
   npm install ethers@5.7.2 dotenv
   ```

2. **Initialize Hardhat**:
   ```bash
   npx hardhat
   # Select: Create a JavaScript/TypeScript project
   ```

## ⚙️ Configuration (Only Network Added!)

### hardhat.config.js
```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  
  networks: {
    // Local development
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },
    
    // 🌟 KASPLEX L2 TESTNET - Ultra-low cost!
    kasplex: {
      url: "https://rpc.kasplextest.xyz",
      chainId: 167012,
      gasPrice: 2000000000000, // 2000 Gwei - CRITICAL for transaction inclusion
      gas: 10000000, // 10M gas limit
      timeout: 600000, // 10 minutes
      pollingInterval: 5000, // 5 second polling
      allowUnlimitedContractSize: true,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    
    // Ethereum networks (for comparison)
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      chainId: 1,
      gasPrice: 20000000000, // 20 Gwei
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    
    sepolia: {
      url: `https://eth-sepolia.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      chainId: 11155111,
      gasPrice: 20000000000, // 20 Gwei
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    }
  },
  
  // Note: Kasplex explorer API coming soon
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
      // kasplex: "not-needed-yet"
    }
  }
};
```

### .env Template
```env
# Private key (without 0x prefix) - USE TEST ACCOUNT ONLY!
PRIVATE_KEY=your_private_key_here

# Optional: Ethereum API keys (for comparison deployments)
ALCHEMY_API_KEY=your_alchemy_api_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

## 🎯 Critical: Gas Price Configuration

**IMPORTANT**: Kasplex requires higher gas prices for transaction inclusion:

- ✅ **2000 Gwei**: Reliable transaction inclusion
- ❌ **20-100 Gwei**: Transactions hang indefinitely

Even at 2000 Gwei, costs are still 99% cheaper than Ethereum!

## 📜 Package.json Scripts

```json
{
  "scripts": {
    "compile": "npx hardhat compile",
    "test": "npx hardhat test",
    "test:kasplex": "npx hardhat test --network kasplex",
    "deploy:local": "npx hardhat run scripts/deploy.js --network localhost",
    "deploy:kasplex": "npx hardhat run scripts/deploy.js --network kasplex",
    "deploy:ethereum": "npx hardhat run scripts/deploy.js --network mainnet",
    "deploy:sepolia": "npx hardhat run scripts/deploy.js --network sepolia",
    "console:kasplex": "npx hardhat console --network kasplex",
    "console:ethereum": "npx hardhat console --network mainnet",
    "node": "npx hardhat node",
    "clean": "npx hardhat clean"
  }
}
```

## 📝 Sample Deployment Script (Identical!)

### scripts/deploy.js
```javascript
const { ethers } = require("hardhat");

async function main() {
  // Get network info
  const network = await ethers.provider.getNetwork();
  const isKasplex = network.chainId === 167012;
  
  console.log(`🚀 Deploying to ${isKasplex ? 'Kasplex L2' : 'Ethereum'}...`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deploying from:", deployer.address);
  
  // Get balance
  const balance = await deployer.getBalance();
  const currency = isKasplex ? 'KAS' : 'ETH';
  console.log("💰 Balance:", ethers.utils.formatEther(balance), currency);
  
  // Deploy contract (same code for both networks!)
  const MyContract = await ethers.getContractFactory("MyContract");
  const contract = await MyContract.deploy();
  await contract.deployed();
  
  console.log("✅ Contract deployed to:", contract.address);
  console.log("📝 Transaction hash:", contract.deployTransaction.hash);
  console.log("🌐 Network:", network.name, "(" + network.chainId + ")");
  
  // Calculate deployment cost
  const tx = await ethers.provider.getTransaction(contract.deployTransaction.hash);
  const receipt = await ethers.provider.getTransactionReceipt(contract.deployTransaction.hash);
  const cost = tx.gasPrice.mul(receipt.gasUsed);
  
  if (isKasplex) {
    console.log("💸 Deployment cost:", ethers.utils.formatEther(cost), "KAS (~$" + (parseFloat(ethers.utils.formatEther(cost)) * 0.01).toFixed(4) + ")");
    console.log("🔍 Explorer:", `https://explorer.testnet.kasplextest.xyz/address/${contract.address}`);
  } else {
    console.log("💸 Deployment cost:", ethers.utils.formatEther(cost), "ETH (~$" + (parseFloat(ethers.utils.formatEther(cost)) * 2000).toFixed(2) + ")");
  }
  
  // Show savings comparison
  if (isKasplex) {
    const ethereumCost = parseFloat(ethers.utils.formatEther(cost)) * 2000; // Rough ETH price
    const kasplexCost = parseFloat(ethers.utils.formatEther(cost)) * 0.01; // Rough KAS price
    const savings = ((ethereumCost - kasplexCost) / ethereumCost * 100).toFixed(2);
    console.log("💰 Savings vs Ethereum:", savings + "% 🎉");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
```

## 🧪 Testing (Works Identically!)

Your existing tests work on Kasplex without any modifications:

```bash
# Test locally (fast, free)
npx hardhat test

# Test on Kasplex (real network, still fast and cheap)
npx hardhat test --network kasplex

# Test on Ethereum (slow, expensive)
npx hardhat test --network sepolia
```

## 💰 Cost Comparison

| Action | Ethereum Mainnet | Kasplex L2 | Savings |
|--------|------------------|------------|---------|
| **Contract Deploy** | $50-500 | **$0.05** | **99.99%** |
| **Function Call** | $10-50 | **$0.01** | **99.98%** |
| **Token Transfer** | $5-25 | **$0.005** | **99.98%** |
| **NFT Mint** | $20-100 | **$0.02** | **99.98%** |

## 🚀 Migration from Ethereum

### Option 1: Add Kasplex to existing project
```bash
# Add Kasplex network to hardhat.config.js (see config above)
npm run deploy:kasplex
```

### Option 2: Test both networks side by side
```bash
# Deploy to Sepolia testnet first
npm run deploy:sepolia

# Then deploy to Kasplex (same contract!)
npm run deploy:kasplex

# Compare costs and speed!
```

## 🛠️ Development Workflow

1. **Develop locally** with `npx hardhat node`
2. **Test thoroughly** with `npx hardhat test`
3. **Deploy to Kasplex** with `npm run deploy:kasplex`
4. **Interact via console** with `npm run console:kasplex`
5. **View on explorer** at https://explorer.testnet.kasplextest.xyz

## ⚡ Performance Benefits

### Kasplex L2 Advantages:
- **10-second finality** (vs 12+ minutes on Ethereum)
- **1000+ TPS** (vs 15 TPS on Ethereum)
- **Predictable costs** (no gas wars or spikes)
- **Same security** (inherits from Kaspa L1)

## 📚 Useful Commands

```bash
# Deploy to Kasplex
npx hardhat run scripts/deploy.js --network kasplex

# Interact with deployed contract
npx hardhat console --network kasplex

# Run tests on Kasplex
npx hardhat test --network kasplex

# Check account balance
npx hardhat run scripts/check-balance.js --network kasplex
```

### Interactive Console Example
```bash
npx hardhat console --network kasplex
```

```javascript
// In Hardhat console
const MyContract = await ethers.getContractFactory("MyContract");
const contract = MyContract.attach("0xYourContractAddress");

// Call functions (ultra-cheap on Kasplex!)
await contract.myFunction();
await contract.balanceOf("0xYourAddress");
```

## 🎯 Best Practices for Kasplex

1. **Use 2000 Gwei gas price** for reliable inclusion
2. **Test locally first** with Hardhat node
3. **Get KAS from faucet**: [Zealous Swap](https://faucet.zealousswap.com/) or [Kaspa Finance](https://app.kaspafinance.io/faucets)
4. **Use ethers v5.x** for best compatibility
5. **Check explorer** at https://explorer.testnet.kasplextest.xyz

## 🆚 Side-by-Side Comparison

### Ethereum Deployment
```bash
npm run deploy:sepolia
# ⏰ Waiting 2+ minutes for confirmation...
# 💸 Cost: 0.02 ETH (~$40)
```

### Kasplex Deployment  
```bash
npm run deploy:kasplex
# ⏰ Confirmed in 10 seconds!
# 💸 Cost: 0.02 KAS (~$0.02)
```

**Same contract. Same functionality. 99% cost savings. 1200x faster.**

## 🚨 Troubleshooting

**Deployment hanging?**
- ✅ Ensure gas price is 2000 Gwei
- ✅ Check you have sufficient KAS balance
- ✅ Verify network RPC: https://rpc.kasplextest.xyz

**Transaction failed?**
- ✅ Use ethers v5.x (better compatibility)
- ✅ Let ethers handle nonce automatically
- ✅ Check Kasplex explorer for transaction status

## 🔗 What's Next?

- **Deploy your existing Ethereum project** to Kasplex
- **Compare costs and speed** side by side
- **Migrate users gradually** for ultra-low transaction costs
- **Explore examples**: [Hello World](../../examples/01-hello-world/), [ERC20 Token](../../examples/02-erc20-standard/), [NFT Collection](../../examples/03-erc721-nft/)

---

**Ready to save 99% on gas costs?** Your Ethereum code already works on Kasplex!