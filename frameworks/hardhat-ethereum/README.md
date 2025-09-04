# 🔨 Hardhat - Ethereum Setup

Standard Hardhat configuration for Ethereum mainnet and testnets. This setup works with all Ethereum-compatible networks.

## 🚀 Quick Setup

1. **Initialize project**:
   ```bash
   mkdir my-ethereum-project
   cd my-ethereum-project
   npm init -y
   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
   npm install ethers@5.7.2 dotenv
   ```

2. **Initialize Hardhat**:
   ```bash
   npx hardhat
   # Select: Create a JavaScript/TypeScript project
   ```

## 📁 Project Structure

```
my-ethereum-project/
├── contracts/
│   └── MyContract.sol
├── scripts/
│   └── deploy.js
├── test/
│   └── MyContract.test.js
├── hardhat.config.js
├── package.json
└── .env
```

## ⚙️ Configuration

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
    
    // Ethereum Mainnet (EXPENSIVE!)
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      chainId: 1,
      gasPrice: 20000000000, // 20 Gwei
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    
    // Ethereum Sepolia Testnet (Free but expensive gas)
    sepolia: {
      url: `https://eth-sepolia.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      chainId: 11155111,
      gasPrice: 20000000000, // 20 Gwei
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    
    // Polygon (Cheaper than Ethereum)
    polygon: {
      url: "https://polygon-rpc.com/",
      chainId: 137,
      gasPrice: 30000000000, // 30 Gwei
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    
    // Polygon Mumbai Testnet
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com/",
      chainId: 80001,
      gasPrice: 1000000000, // 1 Gwei
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    }
  },
  
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
    }
  },
  
  gasReporter: {
    enabled: true,
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  }
};
```

### .env Template
```env
# Private key (without 0x prefix) - USE TEST ACCOUNT ONLY!
PRIVATE_KEY=your_private_key_here

# API Keys
ALCHEMY_API_KEY=your_alchemy_api_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key_here
```

## 📜 Package.json Scripts

```json
{
  "scripts": {
    "compile": "npx hardhat compile",
    "test": "npx hardhat test",
    "deploy:local": "npx hardhat run scripts/deploy.js --network localhost",
    "deploy:sepolia": "npx hardhat run scripts/deploy.js --network sepolia",
    "deploy:mainnet": "npx hardhat run scripts/deploy.js --network mainnet",
    "deploy:polygon": "npx hardhat run scripts/deploy.js --network polygon",
    "deploy:mumbai": "npx hardhat run scripts/deploy.js --network mumbai",
    "console:mainnet": "npx hardhat console --network mainnet",
    "console:sepolia": "npx hardhat console --network sepolia",
    "verify": "npx hardhat verify --network mainnet",
    "node": "npx hardhat node",
    "clean": "npx hardhat clean"
  }
}
```

## 📝 Sample Deployment Script

### scripts/deploy.js
```javascript
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying to Ethereum...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deploying from:", deployer.address);
  
  // Get balance
  const balance = await deployer.getBalance();
  console.log("💰 Balance:", ethers.utils.formatEther(balance), "ETH");
  
  // Deploy contract
  const MyContract = await ethers.getContractFactory("MyContract");
  const contract = await MyContract.deploy();
  await contract.deployed();
  
  console.log("✅ Contract deployed to:", contract.address);
  console.log("📝 Transaction hash:", contract.deployTransaction.hash);
  
  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("🌐 Network:", network.name, "(" + network.chainId + ")");
  
  // Calculate deployment cost
  const tx = await ethers.provider.getTransaction(contract.deployTransaction.hash);
  const receipt = await ethers.provider.getTransactionReceipt(contract.deployTransaction.hash);
  const cost = tx.gasPrice.mul(receipt.gasUsed);
  console.log("💸 Deployment cost:", ethers.utils.formatEther(cost), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
```

## 🧪 Testing Configuration

### test/MyContract.test.js
```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyContract", function () {
  let contract;
  let owner;
  let otherAccount;

  beforeEach(async function () {
    [owner, otherAccount] = await ethers.getSigners();
    
    const MyContract = await ethers.getContractFactory("MyContract");
    contract = await MyContract.deploy();
    await contract.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });
  });
});
```

## 💰 Gas Costs (Ethereum)

| Network | Gas Price | Deploy Cost | Transfer Cost |
|---------|-----------|-------------|---------------|
| **Mainnet** | 20-100 Gwei | $50-500 | $10-50 |
| **Sepolia** | 20-50 Gwei | Free (faucet) | Free (faucet) |
| **Polygon** | 30-200 Gwei | $0.10-5 | $0.01-0.10 |

## 🔍 Verification

After deployment, verify your contract:

```bash
# Verify on Etherscan
npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS "Constructor" "Arguments"

# Verify on Polygonscan
npx hardhat verify --network polygon DEPLOYED_CONTRACT_ADDRESS
```

## 🚨 Security Best Practices

1. **Environment Variables**: Never commit private keys to git
2. **Gas Estimation**: Always estimate gas before mainnet deployment
3. **Testnet First**: Deploy to testnet before mainnet
4. **Slippage Protection**: Set reasonable gas price limits
5. **Contract Verification**: Always verify source code on explorers

## 📚 Useful Commands

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Start local node
npx hardhat node

# Check account balances
npx hardhat run scripts/check-balance.js --network mainnet

# Interact with deployed contract
npx hardhat console --network mainnet
```

## 🔗 Next Steps

- **Deploy to Ethereum**: Expensive but battle-tested
- **Consider Layer 2**: Polygon, Arbitrum, Optimism for lower costs
- **Try Kasplex**: Same code, 99% lower costs! → [Kasplex Setup](../hardhat-kasplex/README.md)

## ❓ Troubleshooting

**High gas costs?**
- Use Layer 2 solutions (Polygon, Arbitrum)
- Deploy during low network congestion
- Consider Kasplex for ultra-low costs

**Transaction failed?**
- Check gas price and gas limit
- Ensure sufficient ETH balance
- Verify network configuration

**Contract verification failed?**
- Check constructor arguments
- Verify Solidity version matches
- Ensure all dependencies are available