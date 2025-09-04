const { ethers } = require("hardhat");

async function main() {
  console.log("🪙 DEPLOYING ERC20 TOKEN TO KASPLEX L2");
  console.log("=" .repeat(60));
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;
  const balance = await deployer.provider.getBalance(deployerAddress);
  
  console.log("👤 Deploying from account:", deployerAddress);
  console.log("💰 Account balance:", ethers.utils.formatEther(balance), "KAS");
  
  // Check minimum balance
  const minBalance = ethers.utils.parseEther("0.01"); // 0.01 KAS minimum
  if (balance < minBalance) {
    console.log("❌ Insufficient balance!");
    console.log("💡 Get free KAS from faucet: https://faucet.zealousswap.com/ or https://app.kaspafinance.io/faucets");
    console.log("💡 You need at least 0.01 KAS for deployment");
    process.exit(1);
  }
  
  console.log("✅ Sufficient balance for deployment");
  console.log("");
  
  // Token configuration (customize these!)
  const TOKEN_CONFIG = {
    name: "Kasplex Example Token",
    symbol: "KET",
    initialSupply: 1000000, // 1 million tokens
  };
  
  console.log("🎯 TOKEN CONFIGURATION:");
  console.log(`   Name: ${TOKEN_CONFIG.name}`);
  console.log(`   Symbol: ${TOKEN_CONFIG.symbol}`);
  console.log(`   Initial Supply: ${TOKEN_CONFIG.initialSupply.toLocaleString()} tokens`);
  console.log(`   Deployer gets: ${TOKEN_CONFIG.initialSupply.toLocaleString()} ${TOKEN_CONFIG.symbol}`);
  console.log("");
  
  // Deploy MyToken contract
  console.log("📡 Deploying ERC20 token contract...");
  const MyToken = await ethers.getContractFactory("MyToken");
  
  // Estimate gas for deployment
  const deployTx = await MyToken.getDeployTransaction(
    TOKEN_CONFIG.name,
    TOKEN_CONFIG.symbol, 
    TOKEN_CONFIG.initialSupply
  );
  const gasEstimate = await deployer.estimateGas(deployTx);
  
  // Use configured gas price (20 Gwei) instead of querying network
  const configuredGasPrice = ethers.utils.parseUnits("20", "gwei");
  
  console.log("⛽ Estimated gas:", gasEstimate.toString());
  console.log("💸 Gas price:", ethers.utils.formatUnits(configuredGasPrice, "gwei"), "Gwei (configured)");
  console.log("💰 Estimated cost:", ethers.utils.formatEther(gasEstimate.mul(configuredGasPrice)), "KAS");
  console.log("");
  
  // Deploy the token with explicit gas configuration
  const token = await MyToken.deploy(
    TOKEN_CONFIG.name,
    TOKEN_CONFIG.symbol,
    TOKEN_CONFIG.initialSupply,
    {
      gasPrice: configuredGasPrice,
      gasLimit: gasEstimate
    }
  );
  
  console.log("⏳ Waiting for deployment confirmation...");
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  
  console.log("🎉 TOKEN DEPLOYMENT SUCCESSFUL!");
  console.log("=" .repeat(60));
  console.log("📍 Contract Address:", tokenAddress);
  console.log("🔍 Explorer URL:", `https://frontend.kasplextest.xyz/address/${tokenAddress}`);
  console.log("📝 Transaction Hash:", token.deploymentTransaction().hash);
  console.log("");
  
  // Get token information
  console.log("📊 VERIFYING TOKEN INFORMATION:");
  const tokenInfo = await token.getTokenInfo();
  const deployerBalance = await token.balanceOf(deployerAddress);
  
  console.log("✅ Token Name:", tokenInfo.name_);
  console.log("✅ Token Symbol:", tokenInfo.symbol_);
  console.log("✅ Decimals:", tokenInfo.decimals_.toString());
  console.log("✅ Total Supply:", ethers.utils.formatUnits(tokenInfo.totalSupply_, 18), tokenInfo.symbol_);
  console.log("✅ Max Supply:", ethers.utils.formatUnits(tokenInfo.maxSupply_, 18), tokenInfo.symbol_);
  console.log("✅ Deployer Balance:", ethers.utils.formatUnits(deployerBalance, 18), tokenInfo.symbol_);
  console.log("✅ Owner Address:", await token.owner());
  console.log("");
  
  // Test basic token functionality
  console.log("🧪 TESTING TOKEN FUNCTIONALITY:");
  
  // Test minting (only owner can do this)
  console.log("🔄 Testing mint function...");
  const mintAmount = ethers.utils.parseUnits("10000", 18); // 10,000 tokens
  const mintTx = await token.mint(deployerAddress, mintAmount);
  await mintTx.wait();
  
  const newBalance = await token.balanceOf(deployerAddress);
  console.log("✅ Minted 10,000 tokens successfully!");
  console.log("✅ New balance:", ethers.utils.formatUnits(newBalance, 18), tokenInfo.symbol_);
  console.log("");
  
  // Test burning
  console.log("🔄 Testing burn function...");
  const burnAmount = ethers.utils.parseUnits("5000", 18); // 5,000 tokens
  const burnTx = await token.burn(burnAmount);
  await burnTx.wait();
  
  const finalBalance = await token.balanceOf(deployerAddress);
  const finalTotalSupply = await token.totalSupply();
  console.log("✅ Burned 5,000 tokens successfully!");
  console.log("✅ Final balance:", ethers.utils.formatUnits(finalBalance, 18), tokenInfo.symbol_);
  console.log("✅ Final total supply:", ethers.utils.formatUnits(finalTotalSupply, 18), tokenInfo.symbol_);
  console.log("");
  
  console.log("🎊 TOKEN DEPLOYMENT & TESTING COMPLETE!");
  console.log("=" .repeat(60));
  console.log("");
  
  console.log("🦊 ADD TO METAMASK:");
  console.log("1. Open MetaMask");
  console.log("2. Click 'Import tokens'");
  console.log("3. Paste contract address:", tokenAddress);
  console.log("4. Symbol and decimals will auto-fill");
  console.log("5. Click 'Add Custom Token'");
  console.log("");
  
  console.log("🎯 NEXT STEPS:");
  console.log("1. 🔍 View your token: https://frontend.kasplextest.xyz/address/" + tokenAddress);
  console.log("2. 💻 Interact via console: npx hardhat console --network kasplex");
  console.log("3. 🧪 Run tests: npx hardhat test");
  console.log("4. 🦊 Add to MetaMask using address above");
  console.log("5. 💸 Send tokens to friends (ultra-cheap transfers!)");
  console.log("");
  
  console.log("💰 COST COMPARISON:");
  const costInEth = ethers.utils.formatEther(gasEstimate.mul(configuredGasPrice));
  const costInUsd = parseFloat(costInEth) * 0.01; // Rough KAS price
  console.log("- Deployment cost: ~$" + costInUsd.toFixed(4));
  console.log("- Transfer cost: ~$0.0001");
  console.log("- Same on Ethereum: ~$100+ deployment, $10+ transfers");
  console.log("- Your savings: 99.99% 🎉");
  console.log("");
  
  // Save deployment info for easy access
  const deploymentInfo = {
    network: "kasplex-testnet",
    chainId: 167012,
    tokenAddress: tokenAddress,
    tokenName: tokenInfo.name_,
    tokenSymbol: tokenInfo.symbol_,
    decimals: tokenInfo.decimals_.toString(),
    totalSupply: ethers.utils.formatUnits(finalTotalSupply, 18),
    deployer: deployerAddress,
    deploymentHash: token.deploymentTransaction().hash,
    gasUsed: gasEstimate.toString(),
    timestamp: new Date().toISOString(),
    explorerUrl: `https://frontend.kasplextest.xyz/address/${tokenAddress}`,
    metamaskConfig: {
      address: tokenAddress,
      symbol: tokenInfo.symbol_,
      decimals: tokenInfo.decimals_.toString(),
      image: "" // Add token logo URL here
    }
  };
  
  const fs = require("fs");
  fs.writeFileSync("token-deployment.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Token info saved to: token-deployment.json");
  
  console.log("🌟 SUCCESS! Your ERC20 token is live on Kasplex L2!");
  console.log("🎯 Same contract code, 99% lower costs than Ethereum!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Token deployment failed:");
    console.error(error);
    console.log("");
    console.log("🔧 TROUBLESHOOTING:");
    console.log("1. Make sure you have KAS: https://faucet.zealousswap.com/ or https://app.kaspafinance.io/faucets");
    console.log("2. Check your private key is set in hardhat.config.js");
    console.log("3. Verify network config: RPC https://rpc.kasplextest.xyz");
    console.log("4. Try: npx hardhat compile (ensure contract compiles)");
    console.log("5. Join Discord for help: https://discord.gg/kasplex");
    process.exit(1);
  });