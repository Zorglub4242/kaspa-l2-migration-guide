const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying HelloWorld to Kasplex L2...");
  console.log("=" .repeat(50));
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;
  const balance = await deployer.provider.getBalance(deployerAddress);
  
  console.log("👤 Deploying from account:", deployerAddress);
  console.log("💰 Account balance:", ethers.utils.formatEther(balance), "KAS");
  
  // Check minimum balance (Kasplex is so cheap, 0.01 KAS is plenty!)
  const minBalance = ethers.utils.parseEther("0.001"); // 0.001 KAS minimum
  if (balance < minBalance) {
    console.log("❌ Insufficient balance!");
    console.log("💡 Get free KAS from faucet: https://faucet.zealousswap.com/ or https://app.kaspafinance.io/faucets");
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
  
  // Use configured gas price (2000 Gwei) to match kaspa-dao working config
  const configuredGasPrice = ethers.utils.parseUnits("2000", "gwei");
  
  console.log("⛽ Estimated gas:", gasEstimate.toString());
  console.log("💸 Gas price:", ethers.utils.formatUnits(configuredGasPrice, "gwei"), "Gwei (configured)");
  console.log("💰 Estimated cost:", ethers.utils.formatEther(gasEstimate.mul(configuredGasPrice)), "KAS");
  console.log("");
  
  // Deploy the contract with explicit gas configuration
  console.log("🚀 Starting deployment transaction...");
  
  let contractAddress;
  let hello;
  let txResponse;
  
  try {
    // Try manual deployment transaction instead of ethers deploy() wrapper
    const deployTx = await HelloWorld.getDeployTransaction();
    deployTx.gasPrice = configuredGasPrice;
    // Use a more conservative gas limit (add 20% buffer but cap it)
    const gasLimit = gasEstimate.mul(120).div(100); // Add 20% buffer
    const maxGasLimit = ethers.utils.parseUnits("500000", "wei"); // Cap at 500k gas
    deployTx.gasLimit = gasLimit.gt(maxGasLimit) ? maxGasLimit : gasLimit;
    
    // Let ethers handle nonce automatically to avoid conflicts
    console.log("🔄 Letting ethers handle nonce automatically");
    console.log("💡 This avoids manual nonce conflicts with Kasplex RPC");
    
    // Remove nonce from transaction object - let ethers calculate it
    delete deployTx.nonce;
    
    console.log("🔍 Transaction details:");
    console.log("   - To:", deployTx.to || "Contract Creation");
    console.log("   - Gas Limit:", deployTx.gasLimit.toString());
    console.log("   - Gas Price:", ethers.utils.formatUnits(deployTx.gasPrice, "gwei"), "Gwei");
    console.log("   - Nonce: Auto-calculated by ethers");
    console.log("   - Data Length:", deployTx.data?.length || 0, "bytes");
    
    console.log("📤 Sending raw deployment transaction...");
    
    // Add timeout to sendTransaction
    const sendTxPromise = deployer.sendTransaction(deployTx);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Transaction submission timeout after 30 seconds")), 30000);
    });
    
    txResponse = await Promise.race([sendTxPromise, timeoutPromise]);
    console.log("✅ Raw transaction sent! Hash:", txResponse.hash);
    
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await txResponse.wait();
    console.log("🎉 Transaction confirmed! Contract deployed at:", receipt.contractAddress);
    
    // Create contract instance from deployed address
    hello = HelloWorld.attach(receipt.contractAddress);
    contractAddress = receipt.contractAddress;
    
    console.log("🎉 DEPLOYMENT SUCCESSFUL!");
    console.log("=" .repeat(50));
    console.log("📍 Contract Address:", contractAddress);
  } catch (error) {
    console.log("❌ Deployment failed with error:", error.message);
    if (error.message.includes("timeout")) {
      console.log("💡 This suggests a network connectivity issue with Kasplex RPC");
      console.log("💡 Try again in a few minutes or check if Kasplex testnet is operational");
    }
    throw error;
  }
  
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("=" .repeat(50));
  console.log("📍 Contract Address:", contractAddress);
  console.log("🔍 Explorer URL:", `https://frontend.kasplextest.xyz/address/${contractAddress}`);
  console.log("📝 Transaction Hash:", txResponse.hash);
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
  
  // Test changing the message
  console.log("🔄 Testing message change...");
  const newMessage = "Hello from Kasplex L2! 🚀";
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
  console.log("1. 🔍 View your contract: https://frontend.kasplextest.xyz/address/" + contractAddress);
  console.log("2. 💻 Interact via console: npx hardhat console --network kasplex");
  console.log("3. 🧪 Run tests: npx hardhat test");
  console.log("4. 📚 Try next example: cd ../02-erc20-standard");
  console.log("");
  
  console.log("📋 CONTRACT INFO (save this!):");
  console.log("- Contract Address:", contractAddress);
  console.log("- Network: Kasplex L2 Testnet");
  console.log("- Chain ID: 167012");
  console.log("- Deployer:", deployerAddress);
  console.log("- Gas Used:", gasEstimate.toString());
  console.log("");
  
  // Save deployment info to file
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: "kasplex-testnet",
    chainId: 167012,
    deployer: deployerAddress,
    deploymentHash: txResponse.hash,
    gasUsed: gasEstimate.toString(),
    timestamp: new Date().toISOString(),
    explorerUrl: `https://frontend.kasplextest.xyz/address/${contractAddress}`
  };
  
  const fs = require("fs");
  fs.writeFileSync("deployment-info.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to: deployment-info.json");
  
  console.log("🎉 Welcome to Kasplex! Same Ethereum experience, 99% lower costs!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    console.log("");
    console.log("🔧 TROUBLESHOOTING:");
    console.log("1. Check your private key is set in hardhat.config.js");
    console.log("2. Ensure you have KAS: https://faucet.zealousswap.com/ or https://app.kaspafinance.io/faucets");
    console.log("3. Verify network config: RPC https://rpc.kasplextest.xyz");
    console.log("4. Check Kasplex documentation for network status");
    process.exit(1);
  });