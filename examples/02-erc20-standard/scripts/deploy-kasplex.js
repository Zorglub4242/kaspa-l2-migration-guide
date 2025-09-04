const { ethers } = require("hardhat");
const readline = require("readline");

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
  
  // Interactive token configuration (or use defaults if AUTO_MODE is set)
  console.log("🎯 TOKEN CONFIGURATION");
  
  let tokenName, tokenSymbol, initialSupply;
  
  if (process.env.AUTO_MODE === 'true') {
    // Use defaults for automated deployment
    tokenName = "Kasplex Example Token";
    tokenSymbol = "KET";
    initialSupply = 1000000;
    console.log("🤖 Using default configuration (AUTO_MODE=true):");
    console.log(`   Name: ${tokenName}`);
    console.log(`   Symbol: ${tokenSymbol}`);  
    console.log(`   Supply: ${initialSupply.toLocaleString()}`);
  } else {
    console.log("Please provide your token details:");
    console.log("");
    
    const tokenNameInput = await askQuestion("💎 Token name (e.g., 'My Awesome Token'): ");
    const tokenSymbolInput = await askQuestion("🔖 Token symbol (e.g., 'MAT'): ");
    const initialSupplyStr = await askQuestion("📊 Initial supply (e.g., '1000000'): ");
    
    tokenName = tokenNameInput || "Kasplex Example Token";
    tokenSymbol = tokenSymbolInput || "KET"; 
    initialSupply = parseInt(initialSupplyStr) || 1000000;
  }
  
  console.log("");
  console.log("👥 TOKEN DISTRIBUTION");
  console.log("Who should receive tokens at deployment?");
  console.log("");
  
  const recipients = [];
  let totalAllocated = 0;
  
  // Always add deployer as first recipient
  recipients.push({
    address: deployerAddress,
    amount: initialSupply,
    label: "Deployer (you)"
  });
  totalAllocated = initialSupply;
  
  console.log(`✅ ${deployerAddress} (Deployer): ${initialSupply.toLocaleString()} tokens`);
  
  if (process.env.AUTO_MODE !== 'true') {
    const addRecipient = await askQuestion("\n🤝 Add additional recipients? (y/n): ");
    if (addRecipient.toLowerCase() === 'y' || addRecipient.toLowerCase() === 'yes') {
    addMore = true;
    
    while (addMore) {
      const recipientAddress = await askQuestion("📍 Recipient address (0x...): ");
      const amountStr = await askQuestion("💰 Amount to send: ");
      const amount = parseInt(amountStr) || 0;
      const label = await askQuestion("🏷️  Label (optional): ") || "Custom recipient";
      
      if (ethers.utils.isAddress(recipientAddress) && amount > 0) {
        recipients.push({
          address: recipientAddress,
          amount: amount,
          label: label
        });
        totalAllocated += amount;
        console.log(`✅ ${recipientAddress} (${label}): ${amount.toLocaleString()} tokens`);
      } else {
        console.log("❌ Invalid address or amount, skipping...");
      }
      
      const continueAdding = await askQuestion("\n➕ Add another recipient? (y/n): ");
      addMore = continueAdding.toLowerCase() === 'y' || continueAdding.toLowerCase() === 'yes';
    }
    
    // Update initial supply for deployer
    if (recipients.length > 1) {
      const additionalTokens = totalAllocated - initialSupply;
      recipients[0].amount = initialSupply; // Deployer keeps original amount
      console.log("");
      console.log("📋 FINAL DISTRIBUTION:");
      recipients.forEach(r => {
        console.log(`   ${r.address} (${r.label}): ${r.amount.toLocaleString()} ${tokenSymbol}`);
      });
      console.log(`   Total tokens needed: ${totalAllocated.toLocaleString()} ${tokenSymbol}`);
    }
    }
  } else {
    console.log("🤖 Auto mode: Only deployer will receive tokens");
  }
  
  const TOKEN_CONFIG = {
    name: tokenName || "Kasplex Example Token",
    symbol: tokenSymbol || "KET", 
    initialSupply: initialSupply,
    recipients: recipients
  };
  
  console.log("");
  console.log("🎯 FINAL TOKEN CONFIGURATION:");
  console.log(`   Name: ${TOKEN_CONFIG.name}`);
  console.log(`   Symbol: ${TOKEN_CONFIG.symbol}`);
  console.log(`   Total Supply: ${TOKEN_CONFIG.initialSupply.toLocaleString()} tokens`);
  console.log(`   Recipients: ${TOKEN_CONFIG.recipients.length}`);
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
  
  // Use configured gas price (2000 Gwei) to match working configuration
  const configuredGasPrice = ethers.utils.parseUnits("2000", "gwei");
  
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
  await token.deployed();
  const tokenAddress = token.address;
  
  console.log("🎉 TOKEN DEPLOYMENT SUCCESSFUL!");
  console.log("=" .repeat(60));
  console.log("📍 Contract Address:", tokenAddress);
  console.log("🔍 Explorer URL:", `https://frontend.kasplextest.xyz/address/${tokenAddress}`);
  console.log("📝 Transaction Hash:", token.deployTransaction.hash);
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
  
  // Distribute tokens to additional recipients
  if (TOKEN_CONFIG.recipients.length > 1) {
    console.log("🚀 DISTRIBUTING TOKENS:");
    console.log("");
    
    for (let i = 1; i < TOKEN_CONFIG.recipients.length; i++) { // Skip deployer (index 0)
      const recipient = TOKEN_CONFIG.recipients[i];
      console.log(`💸 Sending ${recipient.amount.toLocaleString()} ${TOKEN_CONFIG.symbol} to ${recipient.label}...`);
      
      try {
        const transferTx = await token.transfer(recipient.address, ethers.utils.parseUnits(recipient.amount.toString(), 18), {
          gasPrice: configuredGasPrice
        });
        await transferTx.wait();
        
        const recipientBalance = await token.balanceOf(recipient.address);
        console.log(`   ✅ Success! Balance: ${ethers.utils.formatUnits(recipientBalance, 18)} ${TOKEN_CONFIG.symbol}`);
        console.log(`   📝 Transaction: ${transferTx.hash}`);
      } catch (error) {
        console.log(`   ❌ Failed to send to ${recipient.address}: ${error.message}`);
      }
    }
    
    // Show final balances
    console.log("");
    console.log("📊 FINAL TOKEN BALANCES:");
    for (const recipient of TOKEN_CONFIG.recipients) {
      const balance = await token.balanceOf(recipient.address);
      console.log(`   ${recipient.label}: ${ethers.utils.formatUnits(balance, 18)} ${TOKEN_CONFIG.symbol}`);
    }
    console.log("");
  }
  
  // Test basic token functionality
  console.log("🧪 TESTING TOKEN FUNCTIONALITY:");
  
  // Test minting (only owner can do this)
  console.log("🔄 Testing mint function...");
  const mintAmount = ethers.utils.parseUnits("10000", 18); // 10,000 tokens
  const mintTx = await token.mint(deployerAddress, mintAmount, {
    gasPrice: configuredGasPrice
  });
  await mintTx.wait();
  
  const newBalance = await token.balanceOf(deployerAddress);
  console.log("✅ Minted 10,000 tokens successfully!");
  console.log("✅ New balance:", ethers.utils.formatUnits(newBalance, 18), tokenInfo.symbol_);
  console.log("");
  
  // Test burning
  console.log("🔄 Testing burn function...");
  const burnAmount = ethers.utils.parseUnits("5000", 18); // 5,000 tokens
  const burnTx = await token.burn(burnAmount, {
    gasPrice: configuredGasPrice
  });
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
  
  console.log("🦊 ADD YOUR TOKEN TO METAMASK:");
  console.log("=" .repeat(50));
  console.log("");
  console.log("📋 STEP-BY-STEP INSTRUCTIONS:");
  console.log("1. 🌐 Switch to Kasplex Network in MetaMask (top dropdown)");
  console.log("   • Network Name: Kasplex Network Testnet");
  console.log("   • Chain ID: 167012");
  console.log("   • RPC URL: https://rpc.kasplextest.xyz");
  console.log("");
  console.log("2. 📥 Import Your Token:");
  console.log("   • Click 'Import tokens' (bottom of token list)");
  console.log("   • Paste contract address: " + tokenAddress);
  console.log("   • Symbol will auto-fill: " + TOKEN_CONFIG.symbol);
  console.log("   • Decimals will auto-fill: 18");
  console.log("   • Click 'Add Custom Token' → 'Import Tokens'");
  console.log("");
  console.log("3. ✅ Verify: Your " + TOKEN_CONFIG.symbol + " balance should appear!");
  console.log("");
  console.log("📱 QUICK COPY-PASTE:");
  console.log("Contract Address: " + tokenAddress);
  console.log("Token Symbol: " + TOKEN_CONFIG.symbol);
  console.log("Decimals: 18");
  console.log("");
  
  console.log("❓ TROUBLESHOOTING:");
  console.log("• Token not showing? Check you're on Kasplex Network (Chain ID: 167012)");
  console.log("• Wrong balance? Verify you're using the correct MetaMask account");
  console.log("• Need help? Check the README or Kasplex documentation");
  console.log("");
  
  console.log("🎯 NEXT STEPS:");
  console.log("1. 🔍 View your token: https://frontend.kasplextest.xyz/address/" + tokenAddress);
  console.log("2. 💻 Interact via console: npx hardhat console --network kasplex");
  console.log("3. 🧪 Run tests: npx hardhat test");
  console.log("4. 💸 Send tokens to friends (ultra-cheap transfers!)");
  console.log("5. 🌟 Try next example: cd ../03-erc721-nft");
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
    deploymentHash: token.deployTransaction.hash,
    gasUsed: gasEstimate.toString(),
    timestamp: new Date().toISOString(),
    explorerUrl: `https://frontend.kasplextest.xyz/address/${tokenAddress}`,
    recipients: TOKEN_CONFIG.recipients,
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
    console.log("5. Check Kasplex documentation for network status");
    process.exit(1);
  });