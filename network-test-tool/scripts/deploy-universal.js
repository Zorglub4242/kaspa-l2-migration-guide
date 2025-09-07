const { ethers } = require("hardhat");
const chalk = require('chalk');

// Network configurations
const NETWORKS = {
  kasplex: {
    name: "Kasplex L2",
    currency: "KAS",
    explorer: "https://explorer.testnet.kasplextest.xyz",
    minBalance: "0.001", // KAS
    faucets: [
      "https://faucet.zealousswap.com/",
      "https://app.kaspafinance.io/faucets"
    ]
  },
  igra: {
    name: "Igra Caravel",
    currency: "ETH",
    explorer: "https://explorer.caravel.igralabs.com",
    minBalance: "0.001", // ETH
    faucets: [
      "https://faucet.caravel.igralabs.com/"
    ]
  },
  sepolia: {
    name: "Ethereum Sepolia",
    currency: "ETH",
    explorer: "https://sepolia.etherscan.io",
    minBalance: "0.01", // ETH
    faucets: [
      "https://sepoliafaucet.com/",
      "https://www.alchemy.com/faucets/ethereum-sepolia"
    ]
  },
  holesky: {
    name: "Ethereum Holesky", 
    currency: "ETH",
    explorer: "https://holesky.etherscan.io",
    minBalance: "0.01", // ETH
    faucets: [
      "https://faucets.chain.link/holesky"
    ]
  },
  goerli: {
    name: "Ethereum Goerli",
    currency: "ETH", 
    explorer: "https://goerli.etherscan.io",
    minBalance: "0.01", // ETH
    faucets: [
      "https://goerlifaucet.com/"
    ]
  }
};

async function main() {
  // Detect network from hardhat runtime
  const networkName = hre.network.name;
  const networkConfig = NETWORKS[networkName];
  
  if (!networkConfig) {
    console.log(chalk.red(`❌ Unknown network: ${networkName}`));
    console.log(chalk.yellow("Supported networks: " + Object.keys(NETWORKS).join(', ')));
    process.exit(1);
  }
  
  console.log(chalk.cyan(`🚀 Deploying LoadTestContract to ${networkConfig.name}...`));
  console.log(chalk.gray("=".repeat(60)));
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;
  const balance = await deployer.provider.getBalance(deployerAddress);
  const network = await deployer.provider.getNetwork();
  
  console.log(chalk.blue(`👤 Deploying from account: ${deployerAddress}`));
  console.log(chalk.blue(`💰 Account balance: ${ethers.utils.formatEther(balance)} ${networkConfig.currency}`));
  console.log(chalk.blue(`📡 Network: ${networkConfig.name} (Chain ID: ${network.chainId})`));
  
  // Check minimum balance
  const minBalance = ethers.utils.parseEther(networkConfig.minBalance);
  if (balance < minBalance) {
    console.log(chalk.red("❌ Insufficient balance!"));
    console.log(chalk.yellow(`💡 You need at least ${networkConfig.minBalance} ${networkConfig.currency} for deployment`));
    console.log(chalk.blue("💧 Get testnet funds from:"));
    networkConfig.faucets.forEach(faucet => {
      console.log(chalk.blue(`   - ${faucet}`));
    });
    process.exit(1);
  }
  
  console.log(chalk.green("✅ Sufficient balance for deployment"));
  console.log("");
  
  // Deploy LoadTestContract
  console.log(chalk.yellow("📡 Deploying LoadTestContract..."));
  const LoadTestContract = await ethers.getContractFactory("LoadTestContract");
  
  // Estimate gas for deployment
  let gasEstimate;
  try {
    const deployTx = await LoadTestContract.getDeployTransaction();
    gasEstimate = await deployer.estimateGas(deployTx);
    console.log(chalk.blue(`⛽ Estimated gas: ${gasEstimate.toString()}`));
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Could not estimate gas: ${error.message}`));
    gasEstimate = ethers.utils.parseUnits("2000000", "wei"); // 2M gas default
  }
  
  // Get current gas price
  const gasPrice = await deployer.provider.getGasPrice();
  const gasPriceGwei = ethers.utils.formatUnits(gasPrice, "gwei");
  console.log(chalk.blue(`💸 Gas price: ${gasPriceGwei} Gwei`));
  
  // Calculate deployment cost
  const deploymentCost = gasEstimate.mul(gasPrice);
  const deploymentCostFormatted = ethers.utils.formatEther(deploymentCost);
  console.log(chalk.blue(`💰 Estimated cost: ${deploymentCostFormatted} ${networkConfig.currency}`));
  console.log("");
  
  // Deploy the contract
  console.log(chalk.cyan("🚀 Starting deployment transaction..."));
  
  let loadTester;
  let contractAddress;
  let deploymentHash;
  
  try {
    // Use a higher gas limit for deployment safety
    const gasLimit = gasEstimate.mul(120).div(100); // 20% buffer
    
    loadTester = await LoadTestContract.deploy({
      gasPrice: gasPrice.mul(110).div(100), // 10% buffer over current gas price
      gasLimit: gasLimit
    });
    
    console.log(chalk.green(`✅ Deployment transaction sent! Hash: ${loadTester.deployTransaction.hash}`));
    deploymentHash = loadTester.deployTransaction.hash;
    
    console.log(chalk.yellow("⏳ Waiting for deployment confirmation..."));
    await loadTester.deployed();
    
    contractAddress = loadTester.address;
    console.log(chalk.green(`🎉 Contract deployed successfully!`));
    
  } catch (error) {
    console.log(chalk.red(`❌ Deployment failed: ${error.message}`));
    
    if (error.message.includes("insufficient funds")) {
      console.log(chalk.yellow("💡 You need more funds for gas fees"));
      console.log(chalk.blue("💧 Get more testnet funds from the faucets listed above"));
    } else if (error.message.includes("gas")) {
      console.log(chalk.yellow("💡 Try adjusting gas settings or wait for network congestion to decrease"));
    }
    
    throw error;
  }
  
  console.log(chalk.green("\n🎉 DEPLOYMENT SUCCESSFUL!"));
  console.log(chalk.gray("=".repeat(60)));
  console.log(chalk.cyan(`📍 Contract Address: ${contractAddress}`));
  console.log(chalk.blue(`🔍 Explorer URL: ${networkConfig.explorer}/address/${contractAddress}`));
  console.log(chalk.blue(`📝 Transaction Hash: ${deploymentHash}`));
  console.log("");
  
  // Test the contract
  console.log(chalk.yellow("🧪 Testing contract functionality..."));
  
  try {
    const globalCounter = await loadTester.globalCounter();
    const totalTransactions = await loadTester.totalTransactions();
    const deployerAddress_contract = await loadTester.deployer();
    const contractInfo = await loadTester.getContractInfo();
    const pong = await loadTester.ping();
    
    console.log(chalk.green("✅ Contract tests passed:"));
    console.log(chalk.blue(`   🔢 Initial global counter: ${globalCounter.toString()}`));
    console.log(chalk.blue(`   📊 Total transactions: ${totalTransactions.toString()}`));
    console.log(chalk.blue(`   👤 Contract deployer: ${deployerAddress_contract}`));
    console.log(chalk.blue(`   📋 Contract info: ${contractInfo[0]} v${contractInfo[1]}`));
    console.log(chalk.blue(`   🏓 Ping test: ${pong}`));
    
    // Test basic increment function
    console.log(chalk.yellow("\n🧪 Testing increment function..."));
    const incrementTx = await loadTester.increment({
      gasPrice: gasPrice.mul(110).div(100) // 10% buffer
    });
    
    console.log(chalk.blue(`📤 Increment transaction sent: ${incrementTx.hash}`));
    await incrementTx.wait();
    
    const updatedCounter = await loadTester.globalCounter();
    const updatedTotalTxs = await loadTester.totalTransactions();
    const userStats = await loadTester.getUserStats(deployerAddress);
    
    console.log(chalk.green("✅ Increment test successful:"));
    console.log(chalk.blue(`   🔢 Updated counter: ${updatedCounter.toString()}`));
    console.log(chalk.blue(`   📊 Total transactions: ${updatedTotalTxs.toString()}`));
    console.log(chalk.blue(`   👤 Your stats: ${userStats[0].toString()} counter, ${userStats[1].toString()} transactions`));
    
  } catch (error) {
    console.log(chalk.red(`❌ Contract testing failed: ${error.message}`));
    console.log(chalk.yellow("💡 Contract deployed but functionality test failed"));
  }
  
  console.log(chalk.green("\n🎊 DEPLOYMENT & TESTING COMPLETE!"));
  console.log(chalk.gray("=".repeat(60)));
  
  console.log(chalk.cyan("\n🎯 NEXT STEPS:"));
  console.log(chalk.blue(`1. 🔍 View contract: ${networkConfig.explorer}/address/${contractAddress}`));
  console.log(chalk.blue(`2. 💻 Set CONTRACT_ADDRESS: export CONTRACT_ADDRESS=${contractAddress}`));
  console.log(chalk.blue(`3. 🧪 Run load tests:`));
  console.log(chalk.blue(`   npm run load-test:simple ${networkName}`));
  console.log(chalk.blue(`   npm run load-test:stress ${networkName}`));
  console.log(chalk.blue(`4. 📊 Compare networks: npm run load-test:compare`));
  console.log("");
  
  console.log(chalk.blue("📋 CONTRACT INFO (save this!):"));
  console.log(chalk.blue(`- Contract Address: ${contractAddress}`));
  console.log(chalk.blue(`- Network: ${networkConfig.name}`));
  console.log(chalk.blue(`- Chain ID: ${network.chainId}`));
  console.log(chalk.blue(`- Deployer: ${deployerAddress}`));
  console.log(chalk.blue(`- Deployment Hash: ${deploymentHash}`));
  console.log(chalk.blue(`- Functions: increment, batchIncrement, stressTest, simulateParallelLoad`));
  console.log("");
  
  // Save deployment info
  const deploymentInfo = {
    contractName: "LoadTestContract",
    contractAddress: contractAddress,
    network: networkName,
    networkName: networkConfig.name,
    chainId: network.chainId,
    deployer: deployerAddress,
    deploymentHash: deploymentHash,
    gasUsed: gasEstimate.toString(),
    timestamp: new Date().toISOString(),
    explorerUrl: `${networkConfig.explorer}/address/${contractAddress}`,
    testFunctions: [
      "increment() - Basic load test function",
      "batchIncrement(uint256) - Batch processing test", 
      "stressTest(uint256, string) - Variable gas usage test",
      "simulateParallelLoad(uint256) - Parallel processing test"
    ]
  };
  
  const fs = require("fs");
  const deploymentFile = `deployment-${networkName}.json`;
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(chalk.blue(`💾 Deployment info saved to: ${deploymentFile}`));
  
  console.log(chalk.green(`🎉 LoadTestContract deployed to ${networkConfig.name}! Ready for load testing!`));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("❌ Deployment failed:"));
    console.error(error);
    console.log("");
    console.log(chalk.yellow("🔧 TROUBLESHOOTING:"));
    console.log(chalk.yellow("1. Check your private key is set in the .env file"));
    console.log(chalk.yellow("2. Ensure you have sufficient testnet funds"));
    console.log(chalk.yellow("3. Verify network connectivity and RPC endpoints"));
    console.log(chalk.yellow("4. Try again in a few minutes if network is congested"));
    console.log(chalk.yellow("5. For Ethereum networks, consider setting ALCHEMY_API_KEY for better reliability"));
    process.exit(1);
  });