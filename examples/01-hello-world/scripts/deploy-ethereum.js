const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying HelloWorld to Ethereum...");
  console.log("⚠️  WARNING: This will cost real ETH on mainnet!");
  console.log("=" .repeat(50));
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;
  const balance = await deployer.provider.getBalance(deployerAddress);
  
  console.log("👤 Deploying from account:", deployerAddress);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  
  // Check minimum balance (Ethereum is expensive!)
  const minBalance = ethers.parseEther("0.1"); // 0.1 ETH minimum for safety
  if (balance < minBalance) {
    console.log("❌ Insufficient balance!");
    console.log("💡 You need at least 0.1 ETH for deployment + gas");
    console.log("💡 Consider using Sepolia testnet instead: --network sepolia");
    process.exit(1);
  }
  
  console.log("✅ Sufficient balance for deployment");
  console.log("");
  
  // Deploy HelloWorld contract
  console.log("📡 Deploying HelloWorld contract...");
  const HelloWorld = await ethers.getContractFactory("HelloWorld");
  
  // Estimate gas for deployment
  const deployTx = await HelloWorld.getDeployTransaction();
  const gasEstimate = await deployer.estimateGas(deployTx);
  const gasPrice = await deployer.provider.getFeeData();
  
  console.log("⛽ Estimated gas:", gasEstimate.toString());
  console.log("💸 Gas price:", ethers.formatUnits(gasPrice.gasPrice, "gwei"), "Gwei");
  console.log("💰 Estimated cost:", ethers.formatEther(gasEstimate * gasPrice.gasPrice), "ETH");
  
  // Show cost warning
  const costInEth = ethers.formatEther(gasEstimate * gasPrice.gasPrice);
  const costInUsd = parseFloat(costInEth) * 2000; // Rough ETH price
  console.log("💸 Estimated cost in USD: ~$" + costInUsd.toFixed(2));
  
  console.log("");
  console.log("⚠️  COST COMPARISON:");
  console.log("   Ethereum: ~$" + costInUsd.toFixed(2));
  console.log("   Kasplex:  ~$0.01 (99.95% savings!)");
  console.log("");
  
  // Deployment confirmation
  console.log("⏳ Proceeding with deployment...");
  console.log("💡 Tip: Press Ctrl+C to cancel if costs are too high");
  console.log("");
  
  // Deploy the contract
  const hello = await HelloWorld.deploy();
  console.log("⏳ Waiting for deployment confirmation...");
  console.log("⏳ This may take 1-5 minutes on Ethereum...");
  
  await hello.waitForDeployment();
  const contractAddress = await hello.getAddress();
  
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("=" .repeat(50));
  console.log("📍 Contract Address:", contractAddress);
  
  // Determine explorer based on network
  const network = await ethers.provider.getNetwork();
  let explorerUrl;
  switch (network.chainId.toString()) {
    case "1":
      explorerUrl = `https://etherscan.io/address/${contractAddress}`;
      break;
    case "11155111": // Sepolia
      explorerUrl = `https://sepolia.etherscan.io/address/${contractAddress}`;
      break;
    default:
      explorerUrl = "Check your network's block explorer";
  }
  
  console.log("🔍 Explorer URL:", explorerUrl);
  console.log("📝 Transaction Hash:", hello.deploymentTransaction().hash);
  console.log("");
  
  // Test the contract
  console.log("🧪 Testing contract functionality...");
  const initialMessage = await hello.getMessage();
  const owner = await hello.owner();
  const messageCount = await hello.messageCount();
  
  console.log("💬 Initial message:", `"${initialMessage}"`);
  console.log("👤 Contract owner:", owner);
  console.log("🔢 Message count:", messageCount.toString());
  console.log("");
  
  // Test changing the message (show cost)
  console.log("🔄 Testing message change...");
  console.log("💸 Note: This will cost additional gas fees!");
  
  const newMessage = "Hello from Ethereum! 🚀";
  const changeTx = await hello.setMessage(newMessage);
  console.log("⏳ Waiting for transaction confirmation...");
  
  await changeTx.wait();
  const updatedMessage = await hello.getMessage();
  const updatedCount = await hello.messageCount();
  
  console.log("✅ Message updated!");
  console.log("💬 New message:", `"${updatedMessage}"`);
  console.log("🔢 Updated count:", updatedCount.toString());
  console.log("📝 Change transaction:", changeTx.hash);
  console.log("");
  
  console.log("🎊 CONTRACT DEPLOYMENT & TESTING COMPLETE!");
  console.log("=" .repeat(50));
  console.log("");
  
  console.log("🎯 NEXT STEPS:");
  console.log("1. 🔍 View your contract:", explorerUrl);
  console.log("2. 💻 Interact via console: npx hardhat console --network <network>");
  console.log("3. 🧪 Run tests: npx hardhat test");
  console.log("4. 💡 Try the same on Kasplex for 99% cost savings!");
  console.log("");
  
  console.log("💰 COST ANALYSIS:");
  console.log("- Deployment cost: ~$" + costInUsd.toFixed(2));
  console.log("- Message change cost: ~$" + (costInUsd * 0.3).toFixed(2));
  console.log("- Total cost: ~$" + (costInUsd * 1.3).toFixed(2));
  console.log("- Same on Kasplex: ~$0.02 (99.95% savings!)");
  console.log("");
  
  console.log("💡 KASPLEX COMPARISON:");
  console.log("- Same contract code ✅");
  console.log("- Same tools (Hardhat) ✅");
  console.log("- Same wallet (MetaMask) ✅");
  console.log("- 99% lower gas fees ✅");
  console.log("- 10 second finality vs 12 minutes ✅");
  console.log("");
  
  // Save deployment info to file
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployerAddress,
    deploymentHash: hello.deploymentTransaction().hash,
    gasUsed: gasEstimate.toString(),
    estimatedCostEth: costInEth,
    estimatedCostUsd: costInUsd.toFixed(2),
    timestamp: new Date().toISOString(),
    explorerUrl: explorerUrl
  };
  
  const fs = require("fs");
  fs.writeFileSync("deployment-info-ethereum.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to: deployment-info-ethereum.json");
  
  console.log("🌟 Now try deploying the same contract on Kasplex for comparison!");
  console.log("   npx hardhat run scripts/deploy-kasplex.js --network kasplex");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    console.log("");
    console.log("🔧 TROUBLESHOOTING:");
    console.log("1. Check your private key is set in hardhat.config.js");
    console.log("2. Ensure you have enough ETH for gas fees");
    console.log("3. Consider using Sepolia testnet: --network sepolia");
    console.log("4. Get testnet ETH: https://sepoliafaucet.com/");
    console.log("5. For cheaper deployment, try Kasplex: --network kasplex");
    process.exit(1);
  });