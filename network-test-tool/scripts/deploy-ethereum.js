const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying LoadTestContract to Ethereum Sepolia...");
  console.log("=" .repeat(50));
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;
  const balance = await deployer.provider.getBalance(deployerAddress);
  
  console.log("👤 Deploying from account:", deployerAddress);
  console.log("💰 Account balance:", ethers.utils.formatEther(balance), "ETH");
  
  // Check minimum balance for Ethereum
  const minBalance = ethers.utils.parseEther("0.01"); // 0.01 ETH minimum for Ethereum
  if (balance < minBalance) {
    console.log("❌ Insufficient balance!");
    console.log("💡 Get Sepolia ETH from faucet: https://sepoliafaucet.com/ or https://faucet.sepolia.dev/");
    process.exit(1);
  }
  
  console.log("✅ Sufficient balance for deployment");
  console.log("");
  
  // Deploy LoadTestContract
  console.log("📡 Deploying LoadTestContract...");
  const LoadTestContract = await ethers.getContractFactory("LoadTestContract");
  
  // Estimate gas for deployment
  const deployTx = await LoadTestContract.getDeployTransaction();
  const gasEstimate = await deployer.estimateGas(deployTx);
  
  // Get current gas price from network
  const gasPrice = await deployer.provider.getGasPrice();
  const gasPriceGwei = ethers.utils.formatUnits(gasPrice, "gwei");
  
  console.log("⛽ Estimated gas:", gasEstimate.toString());
  console.log("💸 Current gas price:", gasPriceGwei, "Gwei");
  console.log("💰 Estimated cost:", ethers.utils.formatEther(gasEstimate.mul(gasPrice)), "ETH");
  console.log("");
  
  // Deploy the contract
  console.log("🚀 Starting deployment transaction...");
  
  let contractAddress;
  let loadTester;
  let txResponse;
  
  try {
    console.log("📤 Deploying LoadTestContract to Ethereum...");
    
    // Deploy with current network gas price
    loadTester = await LoadTestContract.deploy({
      gasPrice: gasPrice,
      gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
    });
    
    console.log("⏳ Waiting for deployment transaction...");
    txResponse = loadTester.deployTransaction;
    console.log("✅ Deployment transaction sent! Hash:", txResponse.hash);
    
    console.log("⏳ Waiting for transaction confirmation...");
    await loadTester.deployed();
    contractAddress = loadTester.address;
    
    console.log("🎉 Contract deployed successfully at:", contractAddress);
    
  } catch (error) {
    console.log("❌ Deployment failed with error:", error.message);
    if (error.message.includes("insufficient funds")) {
      console.log("💡 You need more ETH for gas fees on Ethereum Sepolia");
      console.log("💡 Get more from: https://sepoliafaucet.com/ or https://faucet.sepolia.dev/");
    }
    throw error;
  }
  
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("=" .repeat(50));
  console.log("📍 Contract Address:", contractAddress);
  console.log("🔍 Explorer URL:", `https://sepolia.etherscan.io/address/${contractAddress}`);
  console.log("📝 Transaction Hash:", txResponse.hash);
  console.log("");
  
  // Test the contract
  console.log("🧪 Testing contract functionality...");
  const globalCounter = await loadTester.globalCounter();
  const totalTransactions = await loadTester.totalTransactions();
  const deployer_address = await loadTester.deployer();
  const contractInfo = await loadTester.getContractInfo();
  const pong = await loadTester.ping();
  
  console.log("🔢 Initial global counter:", globalCounter.toString());
  console.log("📊 Total transactions:", totalTransactions.toString());
  console.log("👤 Contract deployer:", deployer_address);
  console.log("📋 Contract info:", contractInfo[0], "v" + contractInfo[1]);
  console.log("🏓 Ping test:", pong);
  console.log("");
  
  // Test basic increment function  
  console.log("🧪 Testing increment function...");
  console.log("📤 Sending increment transaction...");
  const incrementTx = await loadTester.increment({
    gasPrice: gasPrice
  });
  console.log("⏳ Waiting for increment confirmation...");
  
  await incrementTx.wait();
  const updatedCounter = await loadTester.globalCounter();
  const updatedTotalTxs = await loadTester.totalTransactions();
  const userStats = await loadTester.getUserStats(deployerAddress);
  
  console.log("✅ Increment successful!");
  console.log("🔢 Updated global counter:", updatedCounter.toString());
  console.log("📊 Updated total transactions:", updatedTotalTxs.toString());
  console.log("👤 User stats - Counter:", userStats[0].toString(), "Transactions:", userStats[1].toString());
  console.log("📝 Increment transaction:", incrementTx.hash);
  console.log("");
  
  console.log("🎊 CONTRACT DEPLOYMENT & TESTING COMPLETE!");
  console.log("=" .repeat(50));
  console.log("");
  
  console.log("🎯 NEXT STEPS:");
  console.log("1. 🔍 View your contract: https://sepolia.etherscan.io/address/" + contractAddress);
  console.log("2. 💻 Interact via console: npx hardhat console --network sepolia");
  console.log("3. 🧪 Run load tests: npm run load-test:simple sepolia");
  console.log("4. 📊 Compare with Kasplex: npm run load-test:compare");
  console.log("");
  
  console.log("📋 CONTRACT INFO (save this!):");
  console.log("- Contract Address:", contractAddress);
  console.log("- Network: Ethereum Sepolia Testnet");
  console.log("- Chain ID: 11155111");
  console.log("- Deployer:", deployerAddress);
  console.log("- Gas Used:", gasEstimate.toString());
  console.log("- Functions: increment, batchIncrement, stressTest, simulateParallelLoad");
  console.log("");
  
  // Save deployment info to file
  const deploymentInfo = {
    contractName: "LoadTestContract",
    contractAddress: contractAddress,
    network: "ethereum-sepolia",
    chainId: 11155111,
    deployer: deployerAddress,
    deploymentHash: txResponse.hash,
    gasUsed: gasEstimate.toString(),
    timestamp: new Date().toISOString(),
    explorerUrl: `https://sepolia.etherscan.io/address/${contractAddress}`,
    testFunctions: [
      "increment() - Basic load test function",
      "batchIncrement(uint256) - Batch processing test", 
      "stressTest(uint256, string) - Variable gas usage test",
      "simulateParallelLoad(uint256) - Parallel processing test"
    ]
  };
  
  const fs = require("fs");
  fs.writeFileSync("deployment-info-ethereum.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to: deployment-info-ethereum.json");
  
  console.log("🎉 LoadTestContract deployed to Ethereum! Ready for load testing comparison!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    console.log("");
    console.log("🔧 TROUBLESHOOTING:");
    console.log("1. Check your private key is set in hardhat.config.js");
    console.log("2. Ensure you have Sepolia ETH: https://sepoliafaucet.com/ or https://faucet.sepolia.dev/");
    console.log("3. Verify network config: RPC URL and Chain ID");
    console.log("4. Check if Sepolia testnet is operational");
    process.exit(1);
  });