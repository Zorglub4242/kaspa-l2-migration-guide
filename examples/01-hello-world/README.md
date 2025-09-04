# 👋 Hello World - Your First Kasplex Contract

The simplest possible smart contract to get started with Kasplex. **Same Solidity code works on Ethereum and Kasplex!**

## 🎯 What You'll Learn

- Deploy a basic smart contract to Kasplex
- Interact with your contract using Hardhat
- Verify contracts on Kasplex Explorer
- Compare gas costs vs Ethereum

## 📁 Project Structure

```
01-hello-world/
├── contracts/
│   └── HelloWorld.sol          # Simple storage contract
├── scripts/
│   ├── deploy-ethereum.js      # Deploy to Ethereum
│   └── deploy-kasplex.js       # Deploy to Kasplex
├── test/
│   └── HelloWorld.test.js      # Same tests work everywhere
├── hardhat.config.js           # Network configurations
└── package.json                # Dependencies
```

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Add Kasplex network to MetaMask** (one-time setup):
   - Network Name: `Kasplex Network Testnet`
   - RPC URL: `https://rpc.kasplextest.xyz`
   - Chain ID: `167012`
   - Currency: `KAS`
   - Explorer: `https://explorer.testnet.kasplextest.xyz`

3. **Get testnet KAS**:
   - Visit: https://faucet.zealousswap.com/
   - Enter your wallet address
   - Claim 50 KAS (free, daily)

4. **Deploy to Kasplex**:
   ```bash
   npx hardhat run scripts/deploy-kasplex.js --network kasplex
   ```

5. **Interact with your contract**:
   ```bash
   npx hardhat console --network kasplex
   ```

## 💰 Cost Comparison

| Action | Ethereum Mainnet | Kasplex L2 |
|--------|-----------------|------------|
| **Deploy Contract** | ~$50-200 | **~$0.01** |
| **Set Message** | ~$10-30 | **~$0.001** |
| **Read Message** | Free | **Free** |
| **Total Example** | ~$60-230 | **~$0.011** |

**Savings: 99.98%** 🎉

## 🔍 Step-by-Step Walkthrough

### 1. The Contract (Same for Both Networks)

```solidity
// contracts/HelloWorld.sol
pragma solidity ^0.8.0;

contract HelloWorld {
    string public message;
    address public owner;
    uint256 public messageCount;

    event MessageChanged(string newMessage, address changedBy);

    constructor() {
        message = "Hello Kasplex!";
        owner = msg.sender;
        messageCount = 0;
    }

    function setMessage(string memory newMessage) public {
        message = newMessage;
        messageCount++;
        emit MessageChanged(newMessage, msg.sender);
    }

    function getMessage() public view returns (string memory) {
        return message;
    }
}
```

### 2. Network Configuration

```javascript
// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.26",
  networks: {
    // Ethereum Mainnet (expensive)
    ethereum: {
      url: "https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY",
      chainId: 1,
      gasPrice: 20000000000, // 20 Gwei
    },
    
    // Kasplex L2 (cheap!)
    kasplex: {
      url: "https://rpc.kasplextest.xyz",
      chainId: 167012,
      gasPrice: 20000000000, // Same 20 Gwei, but KAS is much cheaper
    }
  }
};
```

### 3. Deployment Scripts (99% Identical)

```javascript
// scripts/deploy-kasplex.js
async function main() {
  console.log("🚀 Deploying HelloWorld to Kasplex L2...");
  
  const HelloWorld = await ethers.getContractFactory("HelloWorld");
  const hello = await HelloWorld.deploy();
  
  await hello.waitForDeployment();
  const address = await hello.getAddress();
  
  console.log("✅ HelloWorld deployed to:", address);
  console.log("🔍 View on Explorer:", `https://explorer.testnet.kasplextest.xyz/address/${address}`);
  console.log("💬 Initial message:", await hello.getMessage());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### 4. Testing (Same Tests Work Everywhere)

```javascript
// test/HelloWorld.test.js
const { expect } = require("chai");

describe("HelloWorld", function () {
  let helloWorld;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const HelloWorld = await ethers.getContractFactory("HelloWorld");
    helloWorld = await HelloWorld.deploy();
  });

  it("Should deploy with correct initial message", async function () {
    expect(await helloWorld.getMessage()).to.equal("Hello Kasplex!");
    expect(await helloWorld.owner()).to.equal(owner.address);
  });

  it("Should allow changing the message", async function () {
    await helloWorld.setMessage("Hello Ethereum!");
    expect(await helloWorld.getMessage()).to.equal("Hello Ethereum!");
    expect(await helloWorld.messageCount()).to.equal(1);
  });

  it("Should emit event when message changes", async function () {
    await expect(helloWorld.setMessage("Test message"))
      .to.emit(helloWorld, "MessageChanged")
      .withArgs("Test message", owner.address);
  });
});
```

## 🧪 Try It Out

1. **Run tests**:
   ```bash
   npx hardhat test
   ```

2. **Deploy locally first** (optional):
   ```bash
   npx hardhat node                                    # Terminal 1
   npx hardhat run scripts/deploy-kasplex.js --network localhost  # Terminal 2
   ```

3. **Deploy to Kasplex testnet**:
   ```bash
   npx hardhat run scripts/deploy-kasplex.js --network kasplex
   ```

4. **Interact with your contract**:
   ```bash
   npx hardhat console --network kasplex
   ```
   
   Then in the console:
   ```javascript
   const HelloWorld = await ethers.getContractFactory("HelloWorld");
   const hello = HelloWorld.attach("YOUR_CONTRACT_ADDRESS");
   
   await hello.getMessage();           // Read current message
   await hello.setMessage("Hello!");  // Change message
   await hello.messageCount();        // Check how many times changed
   ```

## 🔗 Next Steps

- **[ERC20 Token](../02-erc20-standard/)** - Create your own token
- **[NFT Collection](../03-erc721-nft/)** - Mint NFTs on Kasplex
- **[MultiSig Wallet](../04-multisig-wallet/)** - Advanced contract patterns

## ❓ Common Questions

**Q: Do I need to change my Solidity code?**  
A: **No!** The exact same contract works on both networks.

**Q: What about gas optimization?**  
A: Same optimizations work. But with ultra-low fees, you might care less about micro-optimizations.

**Q: Can I use the same tools?**  
A: **Yes!** Hardhat, Foundry, Remix, MetaMask - everything works exactly the same.

**Q: What if something breaks?**  
A: Check our [troubleshooting guide](../../migration-guides/zero-code-changes.md) or ask in Discord.

---

**🎉 Congratulations!** You've deployed your first contract on Kasplex. Same code, same tools, 99% lower costs!