# 🪙 Standard ERC20 Token - Ethereum vs Kasplex

Create and deploy a standard ERC20 token using OpenZeppelin. **The exact same contract code works on both Ethereum and Kasplex!**

## 🎯 What You'll Learn

- Deploy OpenZeppelin ERC20 tokens on multiple networks
- Compare gas costs between Ethereum and Kasplex  
- Use standard token functionality (mint, transfer, approve)
- Interact with your token through scripts and tests
- Add your token to MetaMask

## 💰 Cost Comparison Preview

| Action | Ethereum Mainnet | Kasplex L2 | Savings |
|--------|-----------------|------------|---------|
| **Deploy Token** | ~$100-300 | **~$0.02** | **99.99%** |
| **Mint Tokens** | ~$20-50 | **~$0.005** | **99.99%** |
| **Transfer** | ~$10-30 | **~$0.003** | **99.99%** |
| **Approve** | ~$8-25 | **~$0.003** | **99.99%** |

## 🏗️ Project Structure

```
02-erc20-standard/
├── contracts/
│   └── MyToken.sol               # Standard OpenZeppelin ERC20
├── scripts/
│   ├── deploy-ethereum.js        # Deploy to Ethereum (expensive)
│   ├── deploy-kasplex.js         # Deploy to Kasplex (cheap!)
│   ├── interact-token.js         # Token interaction examples
│   └── add-to-metamask.js        # Helper to add token to wallet
├── test/
│   └── MyToken.test.js           # Comprehensive ERC20 tests
├── hardhat.config.js             # Multi-network configuration
└── package.json                  # Dependencies and scripts
```

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Get testnet funds**:
   - **Kasplex**: [Faucet](https://kasplextest.xyz/faucet) - 50 KAS daily (free)
   - **Ethereum Sepolia**: [Faucet](https://sepoliafaucet.com/) - 0.5 ETH daily

3. **Deploy to Kasplex** (recommended - ultra cheap):
   ```bash
   npm run deploy:kasplex
   ```

4. **Or deploy to Ethereum** (expensive but for comparison):
   ```bash
   npm run deploy:sepolia    # Testnet (free but still expensive gas)
   npm run deploy:ethereum   # Mainnet ($$$ real money!)
   ```

5. **Interact with your token**:
   ```bash
   npm run interact:kasplex
   ```

## 🔍 The Token Contract (Identical for All Networks)

```solidity
// contracts/MyToken.sol
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MyToken is ERC20, Ownable, ERC20Permit {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) 
        ERC20(name, symbol) 
        Ownable(msg.sender)
        ERC20Permit(name)
    {
        _mint(msg.sender, initialSupply * 10**decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}
```

**Key Features**:
- ✅ **Standard ERC20** - Transfer, approve, allowance
- ✅ **Ownable** - Only owner can mint new tokens  
- ✅ **ERC20Permit** - Gasless approvals via signatures
- ✅ **Mintable** - Owner can create new tokens
- ✅ **Burnable** - Anyone can burn their own tokens

## 📊 Network Comparison

### Deployment Results
```bash
# Ethereum Mainnet
⛽ Gas Used: 1,150,000
💰 Cost: 0.023 ETH (~$50-100)
⏰ Confirmation Time: 12+ minutes

# Kasplex L2  
⛽ Gas Used: 1,150,000 (same!)
💰 Cost: 0.023 KAS (~$0.02)
⏰ Confirmation Time: 10 seconds
```

### Token Operations Cost
```bash
# Transfer 100 tokens

Ethereum:
- Gas: 65,000
- Cost: ~$8-25
- Time: 12+ minutes

Kasplex:
- Gas: 65,000 (identical!)
- Cost: ~$0.003
- Time: 10 seconds
```

## 🧪 Testing Your Token

Run the comprehensive test suite:

```bash
# Test on local network (fast)
npm test

# Test on Kasplex (real network, still fast)
npx hardhat test --network kasplex

# Test on Ethereum Sepolia (slow but free)  
npx hardhat test --network sepolia
```

Sample test output:
```
✅ Deployment
✅ Initial supply minted to owner
✅ Owner can mint additional tokens
✅ Users can transfer tokens
✅ Approval and transferFrom work
✅ Permit (gasless approval) works
✅ Only owner can mint
✅ Anyone can burn their tokens
✅ Events emitted correctly
```

## 🦊 Add Token to MetaMask

After deployment, add your token to MetaMask:

```bash
npm run add-to-metamask
```

Or manually:
1. Open MetaMask
2. Click "Import tokens"
3. Enter your contract address
4. Token symbol and decimals auto-fill
5. Click "Add Custom Token"

## 💻 Interactive Examples

### Mint New Tokens
```bash
npx hardhat console --network kasplex
```

```javascript
// In Hardhat console
const MyToken = await ethers.getContractFactory("MyToken");
const token = MyToken.attach("YOUR_CONTRACT_ADDRESS");

// Mint 1000 tokens to an address
await token.mint("0x742d35Cc6639C43532ef01bcB70c8c6c9e5d7dbb", 1000);

// Check balance
await token.balanceOf("0x742d35Cc6639C43532ef01bcB70c8c6c9e5d7dbb");
```

### Transfer Tokens
```javascript
// Transfer 100 tokens
await token.transfer("0x742d35Cc6639C43532ef01bcB70c8c6c9e5d7dbb", 100);

// Check your balance
await token.balanceOf(await signer.getAddress());
```

### Approve and TransferFrom
```javascript
// Approve someone to spend 50 tokens
await token.approve("0x742d35Cc6639C43532ef01bcB70c8c6c9e5d7dbb", 50);

// They can now transfer on your behalf
const otherSigner = await ethers.getSigner("0x742d35Cc6639C43532ef01bcB70c8c6c9e5d7dbb");
await token.connect(otherSigner).transferFrom(yourAddress, theirAddress, 25);
```

## 🔧 Advanced Features

### ERC20Permit (Gasless Approvals)
```javascript
// Instead of calling approve() and paying gas,
// users can sign a permit message off-chain
const permit = await token.permit(
    owner,
    spender, 
    amount,
    deadline,
    v, r, s  // From signature
);
```

### Token Economics
```javascript
// Check total supply
await token.totalSupply();

// Check decimals (18 by default)
await token.decimals();

// Get token name and symbol
await token.name();
await token.symbol();
```

## 🌟 Real-World Usage Examples

### DeFi Integration
Your token works with all DeFi protocols:
- **Uniswap**: Create liquidity pools
- **SushiSwap**: Provide liquidity, earn fees
- **1inch**: Token swapping
- **Compound**: Lending and borrowing

### DAO Integration
```javascript
// Use as governance token
const GovernorContract = await ethers.getContractFactory("Governor");
const governor = await GovernorContract.deploy(
    token.address,  // Your ERC20 as voting power
    // ... other parameters
);
```

### NFT Integration
```javascript
// Accept token as payment for NFTs
function mintNFT() external {
    require(token.transferFrom(msg.sender, address(this), MINT_PRICE));
    _mint(msg.sender, tokenId++);
}
```

## 🎯 Next Steps

- **[NFT Collection](../03-erc721-nft/)** - Create NFTs that accept your token
- **[MultiSig Wallet](../04-multisig-wallet/)** - Secure multi-signature wallet
- **[DEX Integration](../05-uniswap-v2-fork/)** - Create a trading pair

## 💡 Pro Tips

### Gas Optimization
```solidity
// Batch operations save gas
function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
    for (uint i = 0; i < recipients.length; i++) {
        _transfer(msg.sender, recipients[i], amounts[i]);
    }
}
```

### Security Best Practices  
```solidity
// Always use SafeMath (built into Solidity 0.8+)
// Use OpenZeppelin contracts (already done!)
// Add pause functionality for emergencies
```

### Token Distribution Strategy
```javascript
// Common distribution:
// 40% - Team (vested)
// 30% - Community rewards  
// 20% - Public sale
// 10% - Treasury

const totalSupply = ethers.parseEther("1000000"); // 1M tokens
await token.mint(teamWallet, totalSupply * 40n / 100n);
await token.mint(rewardsContract, totalSupply * 30n / 100n);
// ... etc
```

## ❓ FAQ

**Q: Does this work exactly the same on all networks?**  
A: Yes! Same contract, same functionality, just different gas costs.

**Q: Can I use this token in existing DeFi protocols?**  
A: Absolutely! It's a standard ERC20, compatible with all EVM-based protocols.

**Q: How much does it really cost on Kasplex vs Ethereum?**  
A: Deployment: Ethereum ~$100, Kasplex ~$0.02. That's 99.98% savings!

**Q: What about token security?**  
A: Uses OpenZeppelin's battle-tested contracts, same security everywhere.

---

**🎉 Ready to deploy?** Your token will work identically on all EVM networks - pick Kasplex for ultra-low costs!