const { ethers } = require("hardhat");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

// Helper function to get user input
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

// Helper function to encode image to Base64
function encodeImageToBase64(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    
    let mimeType;
    switch (ext) {
      case '.png': mimeType = 'image/png'; break;
      case '.jpg': 
      case '.jpeg': mimeType = 'image/jpeg'; break;
      case '.gif': mimeType = 'image/gif'; break;
      case '.svg': mimeType = 'image/svg+xml'; break;
      case '.webp': mimeType = 'image/webp'; break;
      default: mimeType = 'image/png'; break;
    }
    
    return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  } catch (error) {
    console.log(`❌ Failed to read image ${imagePath}: ${error.message}`);
    return null;
  }
}

// Helper function to generate metadata JSON
function generateMetadata(tokenId, name, description, imageBase64, attributes = []) {
  return JSON.stringify({
    name: name,
    description: description,
    image: imageBase64,
    attributes: attributes,
    compiler: "Kasplex NFT Example",
    date: Date.now()
  }, null, 2);
}

// Helper function to create data URI from JSON
function createMetadataDataURI(metadataJSON) {
  const base64Metadata = Buffer.from(metadataJSON).toString('base64');
  return `data:application/json;base64,${base64Metadata}`;
}

async function main() {
  console.log("🎨 DEPLOYING NFT COLLECTION TO KASPLEX L2");
  console.log("=".repeat(60));
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;
  const balance = await deployer.provider.getBalance(deployerAddress);
  
  console.log("👤 Deploying from account:", deployerAddress);
  console.log("💰 Account balance:", ethers.utils.formatEther(balance), "KAS");
  
  // Check minimum balance
  const minBalance = ethers.utils.parseEther("0.05"); // 0.05 KAS minimum for NFTs
  if (balance < minBalance) {
    console.log("❌ Insufficient balance!");
    console.log("💡 Get free KAS from faucet: https://faucet.zealousswap.com/ or https://app.kaspafinance.io/faucets");
    console.log("💡 You need at least 0.05 KAS for NFT deployment");
    process.exit(1);
  }
  
  console.log("✅ Sufficient balance for deployment");
  console.log("");
  
  // Interactive NFT collection configuration
  console.log("🎯 NFT COLLECTION CONFIGURATION");
  
  let collectionName, collectionSymbol, collectionDescription, maxSupply, mintPrice;
  
  if (process.env.AUTO_MODE === 'true') {
    // Use defaults for automated deployment
    collectionName = "Kasplex NFT Collection";
    collectionSymbol = "KNFT";
    collectionDescription = "Example NFT collection deployed on Kasplex L2";
    maxSupply = 1000;
    mintPrice = 0; // Free minting
    console.log("🤖 Using default configuration (AUTO_MODE=true):");
    console.log(`   Name: ${collectionName}`);
    console.log(`   Symbol: ${collectionSymbol}`);
    console.log(`   Description: ${collectionDescription}`);
    console.log(`   Max Supply: ${maxSupply.toLocaleString()}`);
    console.log(`   Mint Price: ${mintPrice} KAS (Free)`);
  } else {
    console.log("Please provide your NFT collection details:");
    console.log("");
    
    const nameInput = await askQuestion("🎨 Collection name (e.g., 'My Awesome NFTs'): ");
    const symbolInput = await askQuestion("🔖 Collection symbol (e.g., 'MAN'): ");
    const descInput = await askQuestion("📝 Collection description: ");
    const maxSupplyStr = await askQuestion("📊 Maximum supply (e.g., '1000'): ");
    const mintPriceStr = await askQuestion("💰 Mint price in KAS (e.g., '0' for free): ");
    
    collectionName = nameInput || "Kasplex NFT Collection";
    collectionSymbol = symbolInput || "KNFT";
    collectionDescription = descInput || "Example NFT collection deployed on Kasplex L2";
    maxSupply = parseInt(maxSupplyStr) || 1000;
    mintPrice = parseFloat(mintPriceStr) || 0;
  }
  
  console.log("");
  console.log("🖼️ IMAGE CONFIGURATION");
  
  // Look for images in the images folder
  const imagesFolder = path.join(__dirname, '..', 'images');
  const metadataFolder = path.join(__dirname, '..', 'metadata');
  
  // Ensure metadata folder exists
  if (!fs.existsSync(metadataFolder)) {
    fs.mkdirSync(metadataFolder, { recursive: true });
  }
  
  let imageFiles = [];
  if (fs.existsSync(imagesFolder)) {
    imageFiles = fs.readdirSync(imagesFolder).filter(file => 
      file.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)
    );
  }
  
  console.log(`📁 Images folder: ${imagesFolder}`);
  console.log(`📄 Found ${imageFiles.length} image files: ${imageFiles.join(', ')}`);
  
  if (imageFiles.length === 0) {
    console.log("⚠️  No images found! Creating placeholder metadata...");
  }
  
  let mintCount = 0;
  if (process.env.AUTO_MODE !== 'true' && imageFiles.length > 0) {
    const mintCountStr = await askQuestion(`🎯 How many NFTs to mint initially (max ${Math.min(imageFiles.length, 10)}): `);
    mintCount = Math.min(parseInt(mintCountStr) || Math.min(imageFiles.length, 3), imageFiles.length, 10);
  } else if (imageFiles.length > 0) {
    mintCount = Math.min(imageFiles.length, 3); // Auto mode: mint first 3
  }
  
  console.log("");
  console.log("📋 FINAL COLLECTION CONFIGURATION:");
  console.log(`   Name: ${collectionName}`);
  console.log(`   Symbol: ${collectionSymbol}`);
  console.log(`   Description: ${collectionDescription}`);
  console.log(`   Max Supply: ${maxSupply.toLocaleString()} NFTs`);
  console.log(`   Mint Price: ${mintPrice} KAS ${mintPrice === 0 ? '(Free)' : ''}`);
  console.log(`   Initial Mint: ${mintCount} NFTs`);
  console.log("");
  
  // Create contract metadata
  const contractMetadata = {
    name: collectionName,
    description: collectionDescription,
    image: imageFiles.length > 0 ? encodeImageToBase64(path.join(imagesFolder, imageFiles[0])) : "",
    external_link: "https://kasplex.org",
    seller_fee_basis_points: 250, // 2.5% royalty
    fee_recipient: deployerAddress
  };
  
  const contractURI = createMetadataDataURI(JSON.stringify(contractMetadata, null, 2));
  
  // Deploy MyNFT contract
  console.log("📡 Deploying NFT contract...");
  const MyNFT = await ethers.getContractFactory("MyNFT");
  
  // Estimate gas for deployment
  const deployTx = await MyNFT.getDeployTransaction(
    collectionName,
    collectionSymbol,
    contractURI,
    maxSupply,
    ethers.utils.parseEther(mintPrice.toString())
  );
  const gasEstimate = await deployer.estimateGas(deployTx);
  
  // Use configured gas price (2000 Gwei) to match working configuration
  const configuredGasPrice = ethers.utils.parseUnits("2000", "gwei");
  
  console.log("⛽ Estimated gas:", gasEstimate.toString());
  console.log("💸 Gas price:", ethers.utils.formatUnits(configuredGasPrice, "gwei"), "Gwei (configured)");
  console.log("💰 Estimated cost:", ethers.utils.formatEther(gasEstimate.mul(configuredGasPrice)), "KAS");
  console.log("");
  
  // Deploy the contract with explicit gas configuration
  const nft = await MyNFT.deploy(
    collectionName,
    collectionSymbol,
    contractURI,
    maxSupply,
    ethers.utils.parseEther(mintPrice.toString()),
    {
      gasPrice: configuredGasPrice,
      gasLimit: gasEstimate
    }
  );
  
  console.log("⏳ Waiting for deployment confirmation...");
  await nft.deployed();
  const contractAddress = nft.address;
  
  console.log("🎉 NFT CONTRACT DEPLOYMENT SUCCESSFUL!");
  console.log("=".repeat(60));
  console.log("📍 Contract Address:", contractAddress);
  console.log("🔍 Explorer URL:", `https://frontend.kasplextest.xyz/address/${contractAddress}`);
  console.log("📝 Transaction Hash:", nft.deployTransaction.hash);
  console.log("");
  
  // Verify contract information
  console.log("📊 VERIFYING CONTRACT INFORMATION:");
  const name = await nft.name();
  const symbol = await nft.symbol();
  const totalSupply = await nft.maxSupply();
  const currentMinted = await nft.totalMinted();
  const owner = await nft.owner();
  const contractURIResult = await nft.contractURI();
  
  console.log("✅ Collection Name:", name);
  console.log("✅ Collection Symbol:", symbol);
  console.log("✅ Max Supply:", totalSupply.toString());
  console.log("✅ Current Minted:", currentMinted.toString());
  console.log("✅ Contract Owner:", owner);
  console.log("✅ Contract URI: Set successfully");
  console.log("");
  
  // Mint initial NFTs if we have images
  if (mintCount > 0 && imageFiles.length > 0) {
    console.log("🎨 MINTING INITIAL NFTS:");
    console.log("");
    
    const tokenURIs = [];
    const tokenMetadata = [];
    
    // Generate metadata for each NFT
    for (let i = 0; i < mintCount; i++) {
      const imageFile = imageFiles[i];
      const imagePath = path.join(imagesFolder, imageFile);
      const imageBase64 = encodeImageToBase64(imagePath);
      
      if (!imageBase64) {
        console.log(`⚠️ Skipping ${imageFile} due to read error`);
        continue;
      }
      
      // Create attributes based on image properties
      const stats = fs.statSync(imagePath);
      const attributes = [
        {
          "trait_type": "File Type",
          "value": path.extname(imageFile).substring(1).toUpperCase()
        },
        {
          "trait_type": "File Size",
          "value": `${Math.round(stats.size / 1024)} KB`
        },
        {
          "trait_type": "Minted On",
          "value": "Kasplex L2"
        },
        {
          "display_type": "date",
          "trait_type": "Created",
          "value": Math.floor(Date.now() / 1000)
        }
      ];
      
      const metadata = generateMetadata(
        i,
        `${collectionName} #${i + 1}`,
        `${collectionDescription} - Token #${i + 1}`,
        imageBase64,
        attributes
      );
      
      // Save metadata to file
      const metadataPath = path.join(metadataFolder, `${i + 1}.json`);
      fs.writeFileSync(metadataPath, metadata);
      
      // Create data URI for on-chain storage
      const metadataURI = createMetadataDataURI(metadata);
      tokenURIs.push(metadataURI);
      tokenMetadata.push(metadata);
      
      console.log(`📄 Generated metadata for token ${i + 1}: ${imageFile}`);
    }
    
    if (tokenURIs.length > 0) {
      console.log("");
      console.log(`🚀 Batch minting ${tokenURIs.length} NFTs...`);
      
      const batchMintTx = await nft.batchMint(deployerAddress, tokenURIs, {
        gasPrice: configuredGasPrice
      });
      await batchMintTx.wait();
      
      console.log("✅ Batch mint successful!");
      console.log("📝 Transaction Hash:", batchMintTx.hash);
      console.log("");
      
      // Verify minting
      const newMintedCount = await nft.totalMinted();
      const ownerBalance = await nft.balanceOf(deployerAddress);
      const ownerTokens = await nft.tokensOfOwner(deployerAddress);
      
      console.log("📊 POST-MINT VERIFICATION:");
      console.log(`✅ Total Minted: ${newMintedCount.toString()} NFTs`);
      console.log(`✅ Owner Balance: ${ownerBalance.toString()} NFTs`);
      console.log(`✅ Owner Token IDs: [${ownerTokens.map(id => id.toString()).join(', ')}]`);
      console.log("");
      
      // Display first token details
      if (ownerTokens.length > 0) {
        const firstTokenId = ownerTokens[0];
        const firstTokenURI = await nft.tokenURI(firstTokenId);
        console.log("🎨 FIRST NFT DETAILS:");
        console.log(`   Token ID: ${firstTokenId.toString()}`);
        console.log(`   Owner: ${deployerAddress}`);
        console.log(`   Metadata: Embedded as Base64 data URI`);
        console.log("");
      }
    }
  } else {
    console.log("📝 No initial minting performed (no images or mintCount = 0)");
    console.log("💡 You can mint NFTs later using the contract's mint functions");
    console.log("");
  }
  
  // Test other contract functions
  console.log("🧪 TESTING CONTRACT FUNCTIONALITY:");
  
  // Test remaining supply
  const remaining = await nft.remainingSupply();
  console.log("✅ Remaining supply:", remaining.toString(), "NFTs");
  
  // Test total supply vs minted
  const maxSupplyCheck = await nft.maxSupply();
  const totalMintedCheck = await nft.totalMinted();
  console.log("✅ Supply check: " + totalMintedCheck.toString() + " / " + maxSupplyCheck.toString() + " minted");
  console.log("");
  
  console.log("🎊 NFT COLLECTION DEPLOYMENT & MINTING COMPLETE!");
  console.log("=".repeat(60));
  console.log("");
  
  console.log("📱 ADD YOUR COLLECTION TO METAMASK:");
  console.log("=".repeat(50));
  console.log("");
  console.log("📋 STEP-BY-STEP INSTRUCTIONS:");
  console.log("1. 🌐 Switch to Kasplex Network in MetaMask (top dropdown)");
  console.log("   • Network Name: Kasplex Network Testnet");
  console.log("   • Chain ID: 167012");
  console.log("   • RPC URL: https://rpc.kasplextest.xyz");
  console.log("");
  console.log("2. 📥 Import Your NFT Collection:");
  console.log("   • Go to MetaMask → Assets → NFTs tab");
  console.log("   • Click 'Import NFT'");
  console.log("   • Contract Address: " + contractAddress);
  console.log("   • Token ID: 0 (for first NFT, if minted)");
  console.log("   • Click 'Add'");
  console.log("");
  console.log("3. ✅ Verify: Your NFTs should appear in MetaMask!");
  console.log("");
  console.log("📱 QUICK COPY-PASTE:");
  console.log("Contract Address: " + contractAddress);
  console.log("Collection Name: " + collectionName);
  console.log("Collection Symbol: " + collectionSymbol);
  console.log("");
  
  console.log("❓ TROUBLESHOOTING:");
  console.log("• NFTs not showing? Check you're on Kasplex Network (Chain ID: 167012)");
  console.log("• Wrong collection? Verify you're using the correct contract address");
  console.log("• Need help? Check the README or Kasplex documentation");
  console.log("");
  
  console.log("🎯 NEXT STEPS:");
  console.log("1. 🔍 View your collection: https://frontend.kasplextest.xyz/address/" + contractAddress);
  console.log("2. 💻 Interact via console: npx hardhat console --network kasplex");
  console.log("3. 🎨 Mint more NFTs: Use the mint() or batchMint() functions");
  console.log("4. 💸 Transfer NFTs: Ultra-cheap transfers on Kasplex!");
  console.log("5. 🎪 Try OpenSea: Your NFTs work on any NFT marketplace");
  console.log("");
  
  console.log("💰 COST COMPARISON:");
  const costInEth = ethers.utils.formatEther(gasEstimate.mul(configuredGasPrice));
  const costInUsd = parseFloat(costInEth) * 0.01; // Rough KAS price
  console.log("- Deployment cost: ~$" + costInUsd.toFixed(4));
  console.log("- Minting cost: ~$0.001 per NFT");
  console.log("- Transfer cost: ~$0.0001");
  console.log("- Same on Ethereum: ~$500+ deployment, $50+ per mint, $20+ transfers");
  console.log("- Your savings: 99.9%+ 🎉");
  console.log("");
  
  // Save deployment info for easy access
  const deploymentInfo = {
    network: "kasplex-testnet",
    chainId: 167012,
    contractAddress: contractAddress,
    collectionName: collectionName,
    collectionSymbol: collectionSymbol,
    maxSupply: maxSupply,
    mintPrice: mintPrice,
    totalMinted: (await nft.totalMinted()).toString(),
    deployer: deployerAddress,
    deploymentHash: nft.deployTransaction.hash,
    gasUsed: gasEstimate.toString(),
    timestamp: new Date().toISOString(),
    explorerUrl: `https://frontend.kasplextest.xyz/address/${contractAddress}`,
    imagesUsed: imageFiles.slice(0, mintCount),
    metadataFolder: metadataFolder,
    metamaskConfig: {
      address: contractAddress,
      name: collectionName,
      symbol: collectionSymbol
    }
  };
  
  fs.writeFileSync(path.join(__dirname, '..', 'nft-deployment.json'), JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Collection info saved to: nft-deployment.json");
  
  console.log("🌟 SUCCESS! Your NFT collection is live on Kasplex L2!");
  console.log("🎯 Same contract code, 99%+ lower costs than Ethereum!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ NFT deployment failed:");
    console.error(error);
    console.log("");
    console.log("🔧 TROUBLESHOOTING:");
    console.log("1. Make sure you have KAS: https://faucet.zealousswap.com/ or https://app.kaspafinance.io/faucets");
    console.log("2. Check your private key is set in hardhat.config.js");
    console.log("3. Verify network config: RPC https://rpc.kasplextest.xyz");
    console.log("4. Try: npx hardhat compile (ensure contract compiles)");
    console.log("5. Check images folder has valid image files");
    console.log("6. Ensure gas price is set to 2000 Gwei for Kasplex");
    process.exit(1);
  });