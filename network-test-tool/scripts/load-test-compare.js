const { ethers } = require("hardhat");
const readline = require('readline');
const chalk = require('chalk');
const Table = require('cli-table3');
require('dotenv').config();

const { logger } = require('../utils/logger');
const { priceFetcher } = require('../utils/price-fetcher');

// Helper function to ask user for input
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

// Network configurations
const NETWORKS = {
  kasplex: {
    name: "Kasplex L2",
    rpc: "https://rpc.kasplextest.xyz",
    chainId: 167012,
    explorer: "https://explorer.testnet.kasplextest.xyz",
    currency: "KAS",
    faucets: [
      "https://faucet.zealousswap.com/",
      "https://app.kaspafinance.io/faucets"
    ]
  },
  sepolia: {
    name: "Ethereum Sepolia",
    rpc: process.env.ALCHEMY_API_KEY ? 
      `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` :
      "https://rpc.sepolia.org",
    chainId: 11155111,
    explorer: "https://sepolia.etherscan.io",
    currency: "ETH",
    faucets: [
      "https://sepoliafaucet.com/",
      "https://www.alchemy.com/faucets/ethereum-sepolia"
    ]
  },
  holesky: {
    name: "Ethereum Holesky",
    rpc: "https://ethereum-holesky-rpc.publicnode.com",
    chainId: 17000,
    explorer: "https://holesky.etherscan.io",
    currency: "ETH",
    faucets: [
      "https://faucets.chain.link/holesky"
    ]
  }
};

async function runTestOnNetwork(networkName, contractAddress, transactionCount) {
  logger.cyan(`\n🚀 Testing ${NETWORKS[networkName].name}...`);
  logger.gray("=".repeat(60));
  
  const results = {
    network: NETWORKS[networkName].name,
    networkKey: networkName,
    transactions: [],
    totalGasUsed: 0,
    totalCost: "0",
    successCount: 0,
    failureCount: 0,
    averageConfirmationTime: 0,
    throughput: 0,
    startTime: 0,
    endTime: 0,
    totalTime: 0,
    error: null
  };

  try {
    // Set up provider and signer for this specific network
    const provider = new ethers.providers.JsonRpcProvider(NETWORKS[networkName].rpc);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Check balance
    const balance = await signer.getBalance();
    const balanceFormatted = ethers.utils.formatEther(balance);
    logger.info(`👤 Testing from account: ${signer.address}`);
    logger.info(`💰 Account balance: ${balanceFormatted} ${NETWORKS[networkName].currency}`);
    logger.info(`📍 Contract address: ${contractAddress}`);
    
    // Connect to contract
    const LoadTestContract = await ethers.getContractFactory("LoadTestContract", signer);
    const contract = LoadTestContract.attach(contractAddress);
    
    // Test connectivity
    logger.warning("🏓 Testing contract connectivity...");
    const pong = await contract.ping();
    const initialState = await contract.getCurrentState();
    logger.success(`✅ Contract responsive: ${pong}`);
    logger.info(`🔢 Initial global counter: ${initialState.globalCount.toString()}`);
    
    // Get gas price for this network
    const gasPrice = await provider.getGasPrice();
    const gasPriceGwei = ethers.utils.formatUnits(gasPrice, "gwei");
    logger.info(`⛽ Network gas price: ${gasPriceGwei} Gwei`);
    
    // Estimate gas
    const gasEstimate = await contract.estimateGas.increment();
    logger.info(`⛽ Estimated gas per transaction: ${gasEstimate.toString()}`);
    
    // Start the test
    logger.cyan(`\n🚀 Starting ${transactionCount} transactions on ${NETWORKS[networkName].name}...`);
    results.startTime = Date.now();
    
    for (let i = 0; i < transactionCount; i++) {
      logger.warning(`📤 Sending transaction ${i + 1}/${transactionCount}...`);
      
      const txStartTime = Date.now();
      
      try {
        // Get nonce to avoid conflicts
        const nonce = await provider.getTransactionCount(signer.address, 'pending');
        
        // Network-optimized gas parameters for better performance
        const gasPriceMultiplier = network === 'kasplex' ? 150 : 300; // Kasplex: 50% buffer, Ethereum: 200% for low gas prices
        const gasLimitMultiplier = network === 'kasplex' ? 150 : 150; // Higher buffer for faster confirmation
        
        // Ensure minimum gas price for Ethereum networks (prevent ultra-low gas prices)
        let finalGasPrice = gasPrice.mul(gasPriceMultiplier).div(100);
        if (network !== 'kasplex') {
          const minGasPrice = ethers.utils.parseUnits('1', 'gwei'); // Minimum 1 Gwei for Ethereum
          if (finalGasPrice.lt(minGasPrice)) {
            finalGasPrice = minGasPrice;
            logger.warning(`   ⚠️ Gas price too low, using minimum 1 Gwei for Ethereum`);
          }
        }
        
        const tx = await contract.increment({
          gasPrice: finalGasPrice,
          gasLimit: gasEstimate.mul(gasLimitMultiplier).div(100),
          nonce: nonce
        });
        
        logger.success(`   ✅ Transaction sent! Hash: ${tx.hash.substring(0, 20)}...`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        const txEndTime = Date.now();
        const confirmationTime = txEndTime - txStartTime;
        
        logger.success(`   🎉 Confirmed in block ${receipt.blockNumber}! Time: ${confirmationTime}ms`);
        logger.info(`   ⛽ Gas used: ${receipt.gasUsed.toString()}`);
        
        results.transactions.push({
          index: i + 1,
          hash: tx.hash,
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
          confirmationTime: confirmationTime,
          success: true
        });
        
        results.totalGasUsed += parseInt(receipt.gasUsed.toString());
        results.successCount++;
        
        // Optimized delay based on network type for better TPS comparison
        if (i < transactionCount - 1) {
          const delayMs = network === 'kasplex' ? 500 : 1000; // Kasplex: 500ms, Ethereum: 1000ms
          logger.gray(`   ⏸️  Waiting ${delayMs}ms for optimal TPS...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
      } catch (error) {
        logger.error(`   ❌ Transaction ${i + 1} failed: ${error.message}`);
        
        results.transactions.push({
          index: i + 1,
          hash: null,
          blockNumber: null,
          gasUsed: null,
          confirmationTime: Date.now() - txStartTime,
          success: false,
          error: error.message
        });
        
        results.failureCount++;
      }
    }
    
    results.endTime = Date.now();
    results.totalTime = results.endTime - results.startTime;
    
    // Calculate metrics
    if (results.successCount > 0) {
      results.averageConfirmationTime = results.transactions
        .filter(tx => tx.success)
        .reduce((sum, tx) => sum + tx.confirmationTime, 0) / results.successCount;
      results.throughput = results.successCount / (results.totalTime / 1000);
      results.totalCost = ethers.utils.formatEther(
        ethers.BigNumber.from(results.totalGasUsed.toString()).mul(gasPrice)
      );
    }
    
    logger.success(`\n✅ ${NETWORKS[networkName].name} test completed!`);
    
  } catch (error) {
    logger.error(`\n❌ ${NETWORKS[networkName].name} test failed: ${error.message}`);
    results.error = error.message;
  }
  
  return results;
}

async function displayComparison(results) {
  logger.cyan("\n🏆 NETWORK COMPARISON RESULTS");
  logger.gray("=".repeat(80));
  
  // Get USD cost comparisons for all networks
  logger.info("💰 Fetching real-time prices from CoinGecko...");
  const costComparisons = {};
  for (const result of results) {
    if (!result.error && result.totalCost !== "0") {
      costComparisons[result.networkKey] = await priceFetcher.getUSDValue(result.networkKey, result.totalCost);
    }
  }
  
  // Create comparison table
  const table = new Table({
    head: [
      chalk.white('Metric'),
      ...results.map(r => chalk.cyan(r.network))
    ],
    colWidths: [25, 25, 25]
  });
  
  // Success Rate
  table.push([
    'Success Rate',
    ...results.map(r => {
      if (r.error) return chalk.red('ERROR');
      const rate = ((r.successCount / (r.successCount + r.failureCount)) * 100).toFixed(1);
      return r.successCount === (r.successCount + r.failureCount) ? 
        chalk.green(`${rate}% ✅`) : 
        chalk.yellow(`${rate}% ⚠️`);
    })
  ]);
  
  // Average Confirmation Time
  table.push([
    'Avg Confirmation',
    ...results.map(r => {
      if (r.error) return chalk.red('N/A');
      const color = r.averageConfirmationTime < 5000 ? chalk.green : 
                   r.averageConfirmationTime < 15000 ? chalk.yellow : chalk.red;
      return color(`${r.averageConfirmationTime.toFixed(0)}ms`);
    })
  ]);
  
  // Throughput
  table.push([
    'Throughput (TPS)',
    ...results.map(r => {
      if (r.error) return chalk.red('N/A');
      const color = r.throughput > 0.5 ? chalk.green : 
                   r.throughput > 0.2 ? chalk.yellow : chalk.red;
      return color(`${r.throughput.toFixed(3)}`);
    })
  ]);
  
  // Total Gas Used
  table.push([
    'Total Gas Used',
    ...results.map(r => {
      if (r.error) return chalk.red('N/A');
      return chalk.blue(r.totalGasUsed.toLocaleString());
    })
  ]);
  
  // Total Cost
  table.push([
    'Total Cost',
    ...results.map(r => {
      if (r.error) return chalk.red('N/A');
      const currency = NETWORKS[r.networkKey].currency;
      return chalk.blue(`${r.totalCost} ${currency}`);
    })
  ]);
  
  // Total Cost (USD)
  table.push([
    'Total Cost (USD)',
    ...results.map(r => {
      if (r.error) return chalk.red('N/A');
      const costData = costComparisons[r.networkKey];
      if (!costData || !costData.success) {
        return chalk.yellow('Price unavailable');
      }
      return chalk.green(`$${costData.usdValue.toFixed(4)}`);
    })
  ]);
  
  // Total Time
  table.push([
    'Total Time',
    ...results.map(r => {
      if (r.error) return chalk.red('N/A');
      return chalk.blue(`${(r.totalTime / 1000).toFixed(1)}s`);
    })
  ]);
  
  logger.table(table.toString());
  
  // Winner analysis
  const successfulResults = results.filter(r => !r.error && r.successCount > 0);
  if (successfulResults.length >= 2) {
    logger.cyan("\n🎯 ANALYSIS:");
    
    // Fastest confirmation
    const fastest = successfulResults.reduce((min, r) => 
      r.averageConfirmationTime < min.averageConfirmationTime ? r : min
    );
    logger.success(`⚡ Fastest: ${fastest.network} (${fastest.averageConfirmationTime.toFixed(0)}ms avg)`);
    
    // Highest throughput
    const highestTps = successfulResults.reduce((max, r) => 
      r.throughput > max.throughput ? r : max
    );
    logger.success(`🚀 Highest TPS: ${highestTps.network} (${highestTps.throughput.toFixed(3)} TPS)`);
    
    // Cheapest (USD comparison)
    const successfulCosts = successfulResults.filter(r => costComparisons[r.networkKey] && costComparisons[r.networkKey].success);
    if (successfulCosts.length > 0) {
      const cheapest = successfulCosts.reduce((min, r) => 
        costComparisons[r.networkKey].usdValue < costComparisons[min.networkKey].usdValue ? r : min
      );
      const cheapestCost = costComparisons[cheapest.networkKey];
      logger.success(`💰 Cheapest: ${cheapest.network} (${cheapest.totalCost} ${NETWORKS[cheapest.networkKey].currency} ≈ $${cheapestCost.usdValue.toFixed(4)} USD)`);
    } else {
      // Fallback to token comparison if USD prices unavailable
      const cheapest = successfulResults.reduce((min, r) => 
        parseFloat(r.totalCost) < parseFloat(min.totalCost) ? r : min
      );
      logger.success(`💰 Cheapest: ${cheapest.network} (${cheapest.totalCost} ${NETWORKS[cheapest.networkKey].currency})`);
    }
    
    // Most reliable
    const mostReliable = successfulResults.reduce((max, r) => 
      r.successCount > max.successCount ? r : max
    );
    logger.success(`🛡️  Most Reliable: ${mostReliable.network} (${mostReliable.successCount}/${mostReliable.successCount + mostReliable.failureCount} success)`);
  }
}

async function main() {
  logger.log(chalk.magenta("🔥 Enhanced Blockchain Network Comparison Tool"));
  logger.gray("=".repeat(80));
  
  // Get user configuration
  const txInput = await askQuestion(chalk.yellow("⚡ How many transactions to test? (default 3): "));
  const TRANSACTION_COUNT = parseInt(txInput) || 3;
  
  if (TRANSACTION_COUNT < 1 || TRANSACTION_COUNT > 20) {
    logger.error("❌ Invalid transaction count! Must be between 1 and 20");
    process.exit(1);
  }
  
  // Ask for networks to compare
  logger.cyan("\nAvailable networks:");
  Object.keys(NETWORKS).forEach((key, index) => {
    logger.info(`${index + 1}. ${key} - ${NETWORKS[key].name}`);
  });
  
  const networksInput = await askQuestion(chalk.yellow("📡 Which networks to compare? (e.g., 'kasplex,sepolia' or 'all'): "));
  let networksToTest = [];
  
  if (networksInput.toLowerCase() === 'all') {
    networksToTest = Object.keys(NETWORKS);
  } else {
    networksToTest = networksInput.split(',').map(n => n.trim().toLowerCase()).filter(n => NETWORKS[n]);
  }
  
  if (networksToTest.length === 0) {
    logger.error("❌ No valid networks specified!");
    process.exit(1);
  }
  
  logger.cyan(`\nSelected networks: ${networksToTest.map(n => NETWORKS[n].name).join(', ')}`);
  
  // Get contract addresses from environment variables
  const contractAddresses = {};
  const envMapping = {
    'kasplex': 'CONTRACT_ADDRESS_KASPLEX',
    'sepolia': 'CONTRACT_ADDRESS_SEPOLIA',
    'holesky': 'CONTRACT_ADDRESS_HOLESKY',
    'goerli': 'CONTRACT_ADDRESS_GOERLI'
  };
  
  for (const network of networksToTest) {
    const envKey = envMapping[network];
    const contractAddress = process.env[envKey] || process.env.CONTRACT_ADDRESS;
    
    if (contractAddress && contractAddress.trim()) {
      contractAddresses[network] = contractAddress.trim();
      logger.success(`📍 Using contract address for ${NETWORKS[network].name}: ${contractAddress.substring(0, 20)}...`);
    } else {
      logger.warning(`⚠️  Skipping ${NETWORKS[network].name} - no contract address in ${envKey} or CONTRACT_ADDRESS`);
    }
  }
  
  const networksWithContracts = networksToTest.filter(n => contractAddresses[n]);
  
  if (networksWithContracts.length === 0) {
    logger.error("❌ No networks have contract addresses! Deploy contracts first.");
    logger.info("\n💡 DEPLOYMENT COMMANDS:");
    networksToTest.forEach(network => {
      logger.info(`   npm run deploy:${network}`);
    });
    process.exit(1);
  }
  
  // Run tests on all networks
  logger.cyan(`\n🚀 Starting comparison test with ${TRANSACTION_COUNT} transactions...`);
  const results = [];
  
  for (const network of networksWithContracts) {
    const result = await runTestOnNetwork(network, contractAddresses[network], TRANSACTION_COUNT);
    results.push(result);
  }
  
  // Display comparison
  await displayComparison(results);
  
  // Show useful links
  logger.cyan("\n🔗 USEFUL LINKS:");
  results.forEach(r => {
    if (!r.error) {
      logger.info(`${r.network}:`);
      logger.info(`  🔍 Explorer: ${NETWORKS[r.networkKey].explorer}`);
      logger.info(`  💧 Faucets: ${NETWORKS[r.networkKey].faucets.join(', ')}`);
    }
  });
  
  logger.success("\n🎉 Network comparison complete!");
  logger.info("\n💡 TIP: Deploy contracts to more networks to expand your comparison!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("❌ Comparison test failed:"));
    console.error(error);
    logger.warning("\n🔧 TROUBLESHOOTING:");
    logger.warning("1. Make sure you have deployed contracts to the networks you want to test");
    logger.warning("2. Check that you have sufficient funds in your wallet for all networks");
    logger.warning("3. Verify network connectivity and RPC endpoints");
    logger.warning("4. For Ethereum testnets, consider setting ALCHEMY_API_KEY for better reliability");
    process.exit(1);
  });