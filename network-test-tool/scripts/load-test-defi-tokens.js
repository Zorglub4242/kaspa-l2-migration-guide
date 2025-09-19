const { ethers } = require("hardhat");
const readline = require('readline');
const chalk = require('chalk');
const Table = require('cli-table3');
require('dotenv').config();

const { logger } = require('../utils/logger');
const { priceFetcher } = require('../utils/price-fetcher');
const { defiMetrics } = require('../utils/defi-metrics');

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
    currency: "KAS"
  },
  sepolia: {
    name: "Ethereum Sepolia",
    rpc: process.env.ALCHEMY_API_KEY ? 
      `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` :
      "https://rpc.sepolia.org",
    chainId: 11155111,
    explorer: "https://sepolia.etherscan.io",
    currency: "ETH"
  },
  holesky: {
    name: "Ethereum Holesky",
    rpc: "https://ethereum-holesky-rpc.publicnode.com",
    chainId: 17000,
    explorer: "https://holesky.etherscan.io",
    currency: "ETH"
  }
};

async function deployTokenForTesting(network, signer) {
  logger.info(`📄 Deploying test token on ${NETWORKS[network].name}...`);
  
  const MockERC20 = await ethers.getContractFactory("MockERC20", signer);
  const token = await MockERC20.deploy(
    "Test Token",
    "TEST", 
    18,
    1000000 // 1M initial supply
  );
  await token.deployed();
  
  logger.success(`✅ Test token deployed: ${token.address}`);
  return token;
}

async function runERC20TestOnNetwork(networkName, testConfig) {
  logger.cyan(`\n💰 Testing ${NETWORKS[networkName].name}...`);
  logger.gray("=".repeat(60));
  
  const results = {
    network: NETWORKS[networkName].name,
    networkKey: networkName,
    operations: [],
    totalGasUsed: 0,
    totalCost: "0",
    successCount: 0,
    failureCount: 0,
    averageExecutionTime: 0,
    throughput: 0,
    startTime: 0,
    endTime: 0,
    totalTime: 0,
    tokenAddress: null,
    error: null
  };

  try {
    // Set up provider and signer
    const provider = new ethers.providers.JsonRpcProvider(NETWORKS[networkName].rpc);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Check balance
    const balance = await signer.getBalance();
    const balanceFormatted = ethers.utils.formatEther(balance);
    logger.info(`👤 Testing from account: ${signer.address}`);
    logger.info(`💰 Account balance: ${balanceFormatted} ${NETWORKS[networkName].currency}`);
    
    // Deploy test token
    const token = await deployTokenForTesting(networkName, signer);
    results.tokenAddress = token.address;
    
    // Get gas price
    const gasPrice = await provider.getGasPrice();
    const gasPriceGwei = ethers.utils.formatUnits(gasPrice, "gwei");
    logger.info(`⛽ Network gas price: ${gasPriceGwei} Gwei`);
    
    // Optimize gas price for network
    let finalGasPrice = gasPrice.mul(150).div(100); // 50% buffer
    if (networkName !== 'kasplex') {
      const minGasPrice = ethers.utils.parseUnits('1', 'gwei');
      if (finalGasPrice.lt(minGasPrice)) {
        finalGasPrice = minGasPrice;
        logger.warning(`   ⚠️ Using minimum 1 Gwei for Ethereum`);
      }
    }
    
    // Mint tokens for testing
    const mintAmount = ethers.utils.parseEther("10000");
    logger.info(`🏭 Minting ${ethers.utils.formatEther(mintAmount)} TEST tokens...`);
    const mintTx = await token.mintForTesting(signer.address, mintAmount, { gasPrice: finalGasPrice });
    await mintTx.wait();
    
    // Start testing
    logger.cyan(`\n🚀 Starting ${testConfig.operationCount} ERC20 operations...`);
    results.startTime = Date.now();
    
    // Generate test recipients
    const recipients = [];
    for (let i = 0; i < testConfig.operationCount; i++) {
      recipients.push(ethers.Wallet.createRandom().address);
    }
    
    const transferAmount = ethers.utils.parseEther(testConfig.transferAmount);
    
    for (let i = 0; i < testConfig.operationCount; i++) {
      const operation = testConfig.testType === 'batch' && i === 0 ? 'batchTransfer' : 'transfer';
      logger.warning(`📤 ${operation} ${i + 1}/${testConfig.operationCount}...`);
      
      const opStartTime = Date.now();
      
      try {
        let tx;
        let gasEstimate;
        
        if (operation === 'batchTransfer') {
          // Batch transfer all at once
          const amounts = new Array(testConfig.operationCount).fill(transferAmount);
          gasEstimate = await token.estimateGas.batchTransfer(recipients, amounts);
          
          tx = await token.batchTransfer(recipients, amounts, {
            gasPrice: finalGasPrice,
            gasLimit: gasEstimate.mul(120).div(100)
          });
        } else {
          // Individual transfer
          gasEstimate = await token.estimateGas.transfer(recipients[i], transferAmount);
          
          tx = await token.transfer(recipients[i], transferAmount, {
            gasPrice: finalGasPrice,
            gasLimit: gasEstimate.mul(120).div(100)
          });
        }
        
        logger.success(`   ✅ Transaction sent! Hash: ${tx.hash.substring(0, 20)}...`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        const opEndTime = Date.now();
        const executionTime = opEndTime - opStartTime;
        
        logger.success(`   🎉 Confirmed in block ${receipt.blockNumber}! Time: ${executionTime}ms`);
        logger.info(`   ⛽ Gas used: ${receipt.gasUsed.toString()}`);
        
        // Record metrics
        defiMetrics.recordGasUsage('erc20_transfer', networkName, receipt.gasUsed, finalGasPrice);
        defiMetrics.recordExecutionTime('erc20_transfer', networkName, opStartTime, opEndTime, true);
        
        results.operations.push({
          index: i + 1,
          operation: operation,
          hash: tx.hash,
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
          executionTime: executionTime,
          success: true
        });
        
        results.totalGasUsed += parseInt(receipt.gasUsed.toString());
        results.successCount++;
        
        // If batch transfer, we're done
        if (operation === 'batchTransfer') {
          results.successCount = testConfig.operationCount;
          break;
        }
        
        // Delay between individual transfers
        if (i < testConfig.operationCount - 1) {
          const delayMs = networkName === 'kasplex' ? 300 : 600;
          logger.gray(`   ⏸️  Waiting ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
      } catch (error) {
        const opEndTime = Date.now();
        logger.error(`   ❌ Operation ${i + 1} failed: ${error.message}`);
        
        // Record metrics
        defiMetrics.recordExecutionTime('erc20_transfer', networkName, opStartTime, opEndTime, false);
        defiMetrics.recordFailure('erc20_transfer', networkName, error.message.substring(0, 100));
        
        results.operations.push({
          index: i + 1,
          operation: operation,
          hash: null,
          blockNumber: null,
          gasUsed: null,
          executionTime: opEndTime - opStartTime,
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
      const successfulOps = results.operations.filter(op => op.success);
      results.averageExecutionTime = successfulOps.reduce((sum, op) => sum + op.executionTime, 0) / successfulOps.length;
      results.throughput = (results.successCount * 1000) / results.totalTime;
      results.totalCost = ethers.utils.formatEther(
        ethers.BigNumber.from(results.totalGasUsed.toString()).mul(finalGasPrice)
      );
    }
    
    logger.success(`\n✅ ${NETWORKS[networkName].name} ERC20 test completed!`);
    
    // Check final token balances
    const finalBalance = await token.balanceOf(signer.address);
    const expectedBalance = mintAmount.sub(transferAmount.mul(testConfig.operationCount));
    logger.info(`💰 Final token balance: ${ethers.utils.formatEther(finalBalance)} TEST`);
    logger.info(`📊 Expected balance: ${ethers.utils.formatEther(expectedBalance)} TEST`);
    
  } catch (error) {
    logger.error(`\n❌ ${NETWORKS[networkName].name} test failed: ${error.message}`);
    results.error = error.message;
  }
  
  return results;
}

async function displayERC20Comparison(results) {
  logger.cyan("\n🏆 ERC20 PERFORMANCE COMPARISON");
  logger.gray("=".repeat(80));
  
  // Get USD cost comparisons
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
    colWidths: [25, 25, 25, 25]
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
  
  // Average Execution Time  
  table.push([
    'Avg Execution Time',
    ...results.map(r => {
      if (r.error) return chalk.red('N/A');
      const color = r.averageExecutionTime < 3000 ? chalk.green : 
                   r.averageExecutionTime < 10000 ? chalk.yellow : chalk.red;
      return color(`${r.averageExecutionTime.toFixed(0)}ms`);
    })
  ]);
  
  // Throughput (TPS)
  table.push([
    'Throughput (TPS)',
    ...results.map(r => {
      if (r.error) return chalk.red('N/A');
      const color = r.throughput > 2 ? chalk.green : 
                   r.throughput > 0.5 ? chalk.yellow : chalk.red;
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
  
  // Token Cost
  table.push([
    'Total Cost',
    ...results.map(r => {
      if (r.error) return chalk.red('N/A');
      const currency = NETWORKS[r.networkKey].currency;
      return chalk.blue(`${r.totalCost} ${currency}`);
    })
  ]);
  
  // USD Cost
  table.push([
    'Total Cost (USD)',
    ...results.map(r => {
      if (r.error) return chalk.red('N/A');
      const costData = costComparisons[r.networkKey];
      if (!costData || !costData.success) {
        return chalk.yellow('Price unavailable');
      }
      return chalk.green(`$${costData.usdValue.toFixed(6)}`);
    })
  ]);
  
  logger.table(table.toString());
  
  // Analysis
  const successfulResults = results.filter(r => !r.error && r.successCount > 0);
  if (successfulResults.length >= 2) {
    logger.cyan("\n🎯 ANALYSIS:");
    
    // Fastest execution
    const fastest = successfulResults.reduce((min, r) => 
      r.averageExecutionTime < min.averageExecutionTime ? r : min
    );
    logger.success(`⚡ Fastest: ${fastest.network} (${fastest.averageExecutionTime.toFixed(0)}ms avg)`);
    
    // Highest throughput
    const highestTps = successfulResults.reduce((max, r) => 
      r.throughput > max.throughput ? r : max
    );
    logger.success(`🚀 Highest TPS: ${highestTps.network} (${highestTps.throughput.toFixed(3)} TPS)`);
    
    // Most cost effective (USD)
    const successfulCosts = successfulResults.filter(r => costComparisons[r.networkKey] && costComparisons[r.networkKey].success);
    if (successfulCosts.length > 0) {
      const cheapest = successfulCosts.reduce((min, r) => 
        costComparisons[r.networkKey].usdValue < costComparisons[min.networkKey].usdValue ? r : min
      );
      const cheapestCost = costComparisons[cheapest.networkKey];
      logger.success(`💰 Cheapest: ${cheapest.network} ($${cheapestCost.usdValue.toFixed(6)} USD)`);
    }
  }
}

async function main() {
  logger.log(chalk.magenta("💰 DeFi ERC20 Token Testing Framework"));
  logger.gray("=".repeat(80));
  
  // Reset metrics for new test
  defiMetrics.reset();
  
  // Get test configuration
  const opInput = await askQuestion(chalk.yellow("📊 How many transfer operations? (default 5): "));
  const operationCount = parseInt(opInput) || 5;
  
  const amountInput = await askQuestion(chalk.yellow("💸 Transfer amount per operation in ETH? (default 0.1): "));
  const transferAmount = amountInput || "0.1";
  
  const testTypeInput = await askQuestion(chalk.yellow("🔄 Test type - individual/batch? (default individual): "));
  const testType = testTypeInput.toLowerCase() === 'batch' ? 'batch' : 'individual';
  
  if (operationCount < 1 || operationCount > 50) {
    logger.error("❌ Operation count must be between 1 and 50");
    process.exit(1);
  }
  
  // Get networks to test
  logger.cyan("\nAvailable networks:");
  Object.keys(NETWORKS).forEach((key, index) => {
    logger.info(`${index + 1}. ${key} - ${NETWORKS[key].name}`);
  });
  
  const networksInput = await askQuestion(chalk.yellow("📡 Networks to test (e.g., 'kasplex,sepolia' or 'all'): "));
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
  
  const testConfig = {
    operationCount,
    transferAmount,
    testType
  };
  
  logger.cyan(`\n🚀 Starting ERC20 ${testType} testing with ${operationCount} operations...`);
  logger.info(`💸 Transfer amount: ${transferAmount} tokens per operation`);
  
  // Run tests on all networks
  const results = [];
  for (const network of networksToTest) {
    const result = await runERC20TestOnNetwork(network, testConfig);
    results.push(result);
  }
  
  // Display comparison
  await displayERC20Comparison(results);
  
  // Show DeFi metrics summary
  logger.cyan("\n📊 DEFI METRICS SUMMARY:");
  const metricsComparison = await defiMetrics.compareNetworks('erc20_transfer', networksToTest);
  
  for (const [network, metrics] of Object.entries(metricsComparison)) {
    logger.info(`${NETWORKS[network].name}:`);
    logger.info(`  💨 Throughput: ${metrics.throughputTPS} TPS`);
    logger.info(`  ✅ Success Rate: ${metrics.successRate}%`);
    logger.info(`  💰 Cost: ${metrics.usdCost}`);
    logger.info(`  🏆 Recommendation: ${metrics.recommendation}`);
  }
  
  logger.success("\n🎉 ERC20 testing complete!");
  logger.info("💡 TIP: Use batch transfers for better gas efficiency!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("❌ ERC20 test failed:"));
    console.error(error);
    logger.warning("\n🔧 TROUBLESHOOTING:");
    logger.warning("1. Ensure you have sufficient funds for gas fees");
    logger.warning("2. Check network connectivity");
    logger.warning("3. Verify PRIVATE_KEY is set in .env");
    process.exit(1);
  });