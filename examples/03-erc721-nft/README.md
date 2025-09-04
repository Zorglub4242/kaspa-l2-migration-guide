# 🎨 ERC721 NFT Collection - Ethereum vs Kasplex

Create and deploy a standard ERC721 NFT collection with local image support using OpenZeppelin. **The exact same contract code works on both Ethereum and Kasplex!**

## 🎯 What You'll Learn

- Deploy OpenZeppelin ERC721 collections on multiple networks
- Use local images with Base64 encoding for completely offline NFTs
- Compare gas costs between Ethereum and Kasplex for NFT operations
- Batch mint multiple NFTs efficiently
- Add your NFT collection to MetaMask
- Generate metadata automatically from local images

## 💰 Cost Comparison Preview

| Action | Ethereum Mainnet | Kasplex L2 | Savings |
|--------|-----------------|------------|---------|
| **Deploy Collection** | ~$500-1500 | **~$0.05** | **99.99%** |
| **Mint Single NFT** | ~$100-300 | **~$0.01** | **99.99%** |
| **Batch Mint 10 NFTs** | ~$800-2000 | **~$0.08** | **99.99%** |
| **Transfer NFT** | ~$50-150 | **~$0.005** | **99.99%** |
| **Approve Marketplace** | ~$30-80 | **~$0.005** | **99.99%** |

## 🏗️ Project Structure

```
03-erc721-nft/
├── contracts/
│   └── MyNFT.sol                # Standard OpenZeppelin ERC721
├── scripts/
│   └── deploy-kasplex.js        # Deploy to Kasplex with local images
├── images/                      # Your NFT images
│   ├── example-1.svg
│   ├── example-2.svg
│   └── example-3.svg
├── metadata/                    # Generated metadata (auto-created)
├── hardhat.config.js            # Network configuration
├── package.json                 # Dependencies and scripts
└── .env.example                 # Environment template
```

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Setup your test wallet**:
   ```bash
   cp .env.example .env
   # Edit .env and add your TEST private key (see security warning below)
   ```

   ⚠️ **SECURITY WARNING**: Only use a TEST wallet with NO real funds!

3. **Add your images**:
   - Place your images in the `images/` folder
   - Supported formats: PNG, JPG, JPEG, GIF, SVG, WEBP
   - Recommended size: 512x512 pixels or larger
   - Keep under 1MB each for faster processing

4. **Get testnet funds**:
   - **Kasplex**: [Faucet](https://faucet.zealousswap.com/) - 50 KAS daily (free)
   - You need at least 0.05 KAS for NFT deployment

5. **Deploy your collection**:
   ```bash
   npm run deploy:kasplex
   ```

6. **Follow the interactive prompts** to configure your collection!

## 🔍 The NFT Contract (Identical for All Networks)

```solidity
// contracts/MyNFT.sol
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MyNFT is ERC721, ERC721URIStorage, ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    uint256 public maxSupply;
    uint256 public mintPrice;
    
    constructor(
        string memory name,
        string memory symbol,
        string memory contractURI,
        uint256 _maxSupply,
        uint256 _mintPrice
    ) ERC721(name, symbol) Ownable(msg.sender) {
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
    }
    
    function mint(address to, string memory uri) public onlyOwner returns (uint256);
    function batchMint(address to, string[] memory uris) public onlyOwner returns (uint256[] memory);
    function publicMint(string memory uri) public payable returns (uint256);
    // ... additional functions
}
```

**Key Features**:
- ✅ **Standard ERC721** - Transfer, approve, marketplace compatible
- ✅ **URI Storage** - Each NFT has unique metadata
- ✅ **Enumerable** - Easy querying and indexing
- ✅ **Ownable** - Owner controls for minting and management
- ✅ **Batch Minting** - Mint multiple NFTs efficiently
- ✅ **Public Minting** - Optional paid minting for users
- ✅ **Max Supply** - Configurable supply limit

## 🖼️ Local Image Support

### How It Works

1. **Place images** in the `images/` folder
2. **Deployment script automatically**:
   - Detects all image files
   - Converts each to Base64 data URI
   - Generates metadata with image embedded
   - Creates on-chain metadata as data URI
   - No external hosting required!

### Example Image Processing

```javascript
// Automatic metadata generation
{
  "name": "My NFT Collection #1",
  "description": "Example NFT with local image",
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "attributes": [
    {
      "trait_type": "File Type",
      "value": "SVG"
    },
    {
      "trait_type": "File Size", 
      "value": "2 KB"
    },
    {
      "trait_type": "Minted On",
      "value": "Kasplex L2"
    }
  ]
}
```

### Benefits of Base64 Approach

- ✅ **Completely offline** - No IPFS, servers, or external dependencies
- ✅ **Permanent** - Images stored forever on-chain
- ✅ **Instant** - No loading delays or broken links
- ✅ **Simple** - Works immediately without setup
- ✅ **Compatible** - Works with all NFT marketplaces and wallets

## 📊 Network Comparison

### Deployment Results
```bash
# Ethereum Mainnet
⛽ Gas Used: 2,800,000
💰 Cost: 0.056 ETH (~$150-400)
⏰ Confirmation Time: 12+ minutes

# Kasplex L2  
⛽ Gas Used: 2,800,000 (same!)
💰 Cost: 0.056 KAS (~$0.05)
⏰ Confirmation Time: 10 seconds
```

### NFT Operations Cost
```bash
# Mint 5 NFTs with metadata

Ethereum:
- Gas: 500,000 per batch
- Cost: ~$200-500
- Time: 12+ minutes

Kasplex:
- Gas: 500,000 (identical!)
- Cost: ~$0.02
- Time: 10 seconds
```

## 🎨 Interactive Deployment

The deployment script guides you through:

```bash
🎯 NFT COLLECTION CONFIGURATION
🎨 Collection name (e.g., 'My Awesome NFTs'): My Art Collection
🔖 Collection symbol (e.g., 'MAN'): MAC
📝 Collection description: Beautiful digital art pieces
📊 Maximum supply (e.g., '1000'): 100
💰 Mint price in KAS (e.g., '0' for free): 0

🖼️ IMAGE CONFIGURATION
📁 Images folder: /path/to/images
📄 Found 5 image files: art1.png, art2.jpg, art3.svg, art4.gif, art5.webp
🎯 How many NFTs to mint initially (max 5): 3

📡 Deploying NFT contract...
🎨 MINTING INITIAL NFTS...
📄 Generated metadata for token 1: art1.png
📄 Generated metadata for token 2: art2.jpg  
📄 Generated metadata for token 3: art3.svg
🚀 Batch minting 3 NFTs...
✅ Batch mint successful!
```

## 📱 Add Your NFT Collection to MetaMask

After successful deployment, add your collection to MetaMask to see your NFTs:

### 📋 Step-by-Step Instructions

1. **Ensure Kasplex Network is Added**:
   ```
   Network Name: Kasplex Network Testnet
   RPC URL: https://rpc.kasplextest.xyz
   Chain ID: 167012
   Currency Symbol: KAS
   Explorer: https://frontend.kasplextest.xyz
   ```

2. **Switch to Kasplex Network** in MetaMask (top dropdown)

3. **Import Your NFT Collection**:
   - Go to MetaMask → Assets → NFTs tab
   - Click "Import NFT"
   - **Contract Address**: Copy from deployment output (e.g., `0x4Ccff78F9C819CF0E09CD30c5BB62aa66DbCa73e`)
   - **Token ID**: 0 (for first NFT, then 1, 2, etc.)
   - Click "Add"
   - Repeat for each NFT you minted

4. **Verify**: Your NFTs should appear in MetaMask with images! 🎉

### 📋 Token Information Reference

After deployment, you'll see output like this:
```
📍 Contract Address: 0x4Ccff78F9C819CF0E09CD30c5BB62aa66DbCa73e
🎯 Collection Name: My Art Collection
🔖 Symbol: MAC
📊 Max Supply: 100
✅ Current Minted: 3
📈 Owner Token IDs: [0, 1, 2]
```

### 🔍 View on Explorer

You can also view your collection on the Kasplex explorer:
- Visit: `https://frontend.kasplextest.xyz/address/YOUR_CONTRACT_ADDRESS`
- See all NFTs, transactions, and collection details
- Verify your deployment publicly

## 💻 Interactive Examples

### Mint Additional NFTs
```bash
npx hardhat console --network kasplex
```

```javascript
// In Hardhat console
const MyNFT = await ethers.getContractFactory("MyNFT");
const nft = MyNFT.attach("YOUR_CONTRACT_ADDRESS");

// Mint single NFT
const metadataURI = "data:application/json;base64,YOUR_BASE64_METADATA";
await nft.mint("0x742d35Cc6639C43532ef01bcB70c8c6c9e5d7dbb", metadataURI);

// Check collection stats
await nft.totalMinted();
await nft.remainingSupply();
```

### Transfer NFTs
```javascript
// Transfer NFT to another address
await nft.transferFrom(
  "YOUR_ADDRESS",
  "0x742d35Cc6639C43532ef01bcB70c8c6c9e5d7dbb", 
  0 // Token ID
);

// Check NFT owner
await nft.ownerOf(0);
```

### Query Collection Data
```javascript
// Get all NFTs owned by an address
await nft.tokensOfOwner("YOUR_ADDRESS");

// Get NFT metadata URI
await nft.tokenURI(0);

// Check collection details
await nft.name();
await nft.symbol();
await nft.maxSupply();
```

## 🎯 Advanced Features

### Batch Operations
```javascript
// Batch mint multiple NFTs
const uris = [metadataURI1, metadataURI2, metadataURI3];
await nft.batchMint("0x742d35Cc6639C43532ef01bcB70c8c6c9e5d7dbb", uris);
```

### Public Minting (if price > 0)
```javascript
// Users can mint directly (if public minting enabled)
await nft.publicMint(metadataURI, { value: ethers.utils.parseEther("0.1") });
```

### Contract Management
```javascript
// Update mint price (owner only)
await nft.setMintPrice(ethers.utils.parseEther("0.05"));

// Withdraw contract balance (owner only)
await nft.withdraw();

// Update contract metadata (owner only) 
await nft.setContractURI(newContractURI);
```

## 🌟 Real-World Usage Examples

### Marketplace Integration
Your NFTs work with all major marketplaces:
- **OpenSea**: Automatic detection and listing
- **LooksRare**: Native ERC721 support
- **Foundation**: Creator-friendly platform
- **SuperRare**: Curated art marketplace

### Gaming Integration
```javascript
// Use NFTs as game items
function equipItem(uint256 tokenId) external {
    require(nft.ownerOf(tokenId) == msg.sender, "Not your NFT");
    // Equip the NFT as a game item
}
```

### Utility Integration
```javascript
// Use NFTs for access control
function accessPremiumContent() external view returns (bool) {
    return nft.balanceOf(msg.sender) > 0;
}
```

## 💡 Pro Tips

### Image Optimization
```bash
# Optimize images before adding to /images folder
- Use PNG for art with transparency
- Use JPG for photographs  
- Use SVG for vector graphics (smallest size)
- Keep files under 1MB for faster processing
- Resize to 512x512 or 1024x1024 for consistency
```

### Metadata Best Practices
```json
{
  "name": "Descriptive name with #ID",
  "description": "Compelling story or utility description", 
  "image": "data:image/...",
  "attributes": [
    {
      "trait_type": "Rarity",
      "value": "Legendary"
    },
    {
      "trait_type": "Background", 
      "value": "Cosmic"
    },
    {
      "display_type": "boost_number",
      "trait_type": "Power",
      "value": 85
    }
  ]
}
```

### Gas Optimization
```solidity
// Batch operations save significant gas
function batchTransfer(
    address to,
    uint256[] calldata tokenIds
) external {
    for (uint256 i = 0; i < tokenIds.length; i++) {
        transferFrom(msg.sender, to, tokenIds[i]);
    }
}
```

## ❓ FAQ

**Q: Why use Base64 instead of IPFS?**  
A: Base64 embedding provides permanent, offline storage with no external dependencies. Perfect for beginners and guaranteed permanence.

**Q: Can I change to IPFS later?**  
A: Yes! The contract supports any URI format. You can update metadata URIs to IPFS links anytime.

**Q: What's the maximum file size for Base64?**  
A: Technically unlimited, but keep images under 1MB for practical gas costs and processing speed.

**Q: Do these work on OpenSea?**  
A: Absolutely! Standard ERC721 with metadata works on all NFT marketplaces.

**Q: Can I add more NFTs after deployment?**  
A: Yes! Use the `mint()` or `batchMint()` functions to add more NFTs up to your max supply.

## 🔧 Troubleshooting

### Images Not Found
- Check that images exist in `images/` folder
- Verify supported formats: PNG, JPG, JPEG, GIF, SVG, WEBP
- Ensure file names don't contain special characters

### Deployment Hanging
- Verify gas price is set to 2000 Gwei in hardhat.config.js
- Check you have sufficient KAS balance (at least 0.05 KAS)
- Ensure network configuration is correct

### NFTs Not Showing in MetaMask
- Confirm you're on Kasplex Network (Chain ID: 167012)
- Import each NFT individually using contract address + token ID
- Check token IDs start from 0 (first NFT is ID 0, not 1)

### Metadata Issues
- Verify images are valid and readable
- Check that metadata folder has write permissions
- Ensure no special characters in filenames

---

**🎉 Ready to create your NFT collection?** Your NFTs will work identically on all EVM networks - pick Kasplex for ultra-low costs!