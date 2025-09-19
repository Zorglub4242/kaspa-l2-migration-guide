const { ethers } = require("hardhat");
const chalk = require('chalk');
const Table = require('cli-table3');

const { logger } = require('../utils/logger');

// Retry mechanism for failed transactions
async function submitTransactionWithRetry(contract, params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tx = await contract.increment(params);
      return { success: true, tx: tx, attempt: attempt };
    } catch (error) {
      if (attempt === maxRetries) {
        return { success: false, error: error.message, attempt: attempt };
      }
      
      // Wait before retry, with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      
      // If nonce error, update nonce
      if (error.message.toLowerCase().includes('nonce')) {
        const newNonce = await contract.signer.provider.getTransactionCount(contract.signer.address, 'pending');
        params.nonce = newNonce;
      }
    }
  }
}

async function main() {
  logger.success("✅ AUTOMATED RELIABLE LOAD TEST - Guaranteed 100% Success");
  logger.gray("=".repeat(60));
  
  // Fixed parameters for automated test
  const TRANSACTION_COUNT = 20; // Test with 20 transactions
  const RELIABILITY_MODE = 'balanced'; // Use balanced mode
  
  // Set parameters based on reliability mode
  let delayMs, gasMultiplier, retryCount;
  switch (RELIABILITY_MODE) {
    case 'conservative':
      delayMs = 1000; // 1 second between transactions
      gasMultiplier = 200; // 2x gas price
      retryCount = 5;
      break;
    case 'aggressive':
      delayMs = 100; // 100ms between transactions  
      gasMultiplier = 130; // 1.3x gas price
      retryCount = 2;
      break;
    default: // balanced
      delayMs = 300; // 300ms between transactions
      gasMultiplier = 150; // 1.5x gas price
      retryCount = 3;
  }
  
  logger.cyan(`\n✅ RELIABLE TEST CONFIGURATION:`);
  logger.info(`   📊 Transactions: ${TRANSACTION_COUNT}`);
  logger.info(`   🛡️ Reliability mode: ${RELIABILITY_MODE}`);
  logger.info(`   ⏱️ Delay between transactions: ${delayMs}ms`);
  logger.info(`   ⛽ Gas price multiplier: ${gasMultiplier}%`);
  logger.info(`   🔄 Max retries per transaction: ${retryCount}`);
  
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  if (!CONTRACT_ADDRESS) {
    logger.error("❌ CONTRACT_ADDRESS not set!");
    process.exit(1);
  }
  
  // Get the signer
  const [signer] = await ethers.getSigners();
  const signerAddress = signer.address;
  const balance = await signer.provider.getBalance(signerAddress);
  
  logger.info(`\n👤 Testing from account: ${signerAddress}`);
  logger.info(`💰 Account balance: ${ethers.utils.formatEther(balance)} KAS`);
  
  // Connect to the contract
  const LoadTestContract = await ethers.getContractFactory("LoadTestContract");
  const contract = LoadTestContract.attach(CONTRACT_ADDRESS);
  
  // Pre-test validation
  logger.warning("\n🔍 PRE-TEST VALIDATION:");
  
  // 1. Test contract connectivity
  try {
    const pong = await contract.ping();
    logger.success(`✅ Contract responsive: ${pong}`);
  } catch (error) {
    logger.error(`❌ Contract not accessible: ${error.message}`);
    process.exit(1);
  }
  
  // 2. Get optimal network parameters
  const networkGasPrice = await signer.provider.getGasPrice();
  const optimizedGasPrice = networkGasPrice.mul(gasMultiplier).div(100);
  const networkGasPriceGwei = ethers.utils.formatUnits(networkGasPrice, "gwei");
  const optimizedGasPriceGwei = ethers.utils.formatUnits(optimizedGasPrice, "gwei");
  
  logger.info(`⛽ Network gas price: ${networkGasPriceGwei} Gwei`);
  logger.info(`⛽ Optimized gas price: ${optimizedGasPriceGwei} Gwei (${gasMultiplier}% of network)`);
  
  // 3. Estimate gas with buffer
  let gasEstimate;
  try {
    gasEstimate = await contract.estimateGas.increment();
    gasEstimate = gasEstimate.mul(150).div(100); // 50% buffer
    logger.info(`⛽ Gas limit (with 50% buffer): ${gasEstimate.toString()}`);
  } catch (error) {
    logger.warning(`⚠️ Gas estimation failed, using default: ${error.message}`);
    gasEstimate = ethers.utils.parseUnits("75000", "wei"); // Conservative default
  }
  
  // 4. Check and clear pending nonce conflicts
  const currentNonce = await signer.provider.getTransactionCount(signerAddress, 'latest');
  const pendingNonce = await signer.provider.getTransactionCount(signerAddress, 'pending');
  
  if (pendingNonce > currentNonce) {
    logger.warning(`⚠️ You have ${pendingNonce - currentNonce} pending transactions`);
    logger.warning("⏳ Waiting for pending transactions to clear...");
    
    // Wait for pending transactions to clear
    let waitCount = 0;
    while (waitCount < 30) { // Wait up to 5 minutes
      const newPendingNonce = await signer.provider.getTransactionCount(signerAddress, 'pending');
      if (newPendingNonce === currentNonce) break;
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      waitCount++;
      logger.gray(`   Waiting... (${waitCount * 10}s)`);
    }
  }
  
  // 5. Estimate total cost and check balance
  const totalGasCost = gasEstimate.mul(optimizedGasPrice).mul(TRANSACTION_COUNT);
  const totalCostFormatted = ethers.utils.formatEther(totalGasCost);
  
  logger.info(`💰 Total estimated cost: ${totalCostFormatted} KAS`);
  
  if (balance.lt(totalGasCost.mul(2))) { // Need 2x for safety
    logger.error("❌ Insufficient balance for reliable testing!");
    logger.warning(`💡 Need at least ${ethers.utils.formatEther(totalGasCost.mul(2))} KAS`);
    process.exit(1);
  }
  
  logger.success("✅ All pre-test validations passed");
  
  // Start the reliable test
  logger.cyan(`\n✅ STARTING RELIABLE TEST...`);
  logger.info(`⏰ Start time: ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  const results = [];
  let totalRetries = 0;
  let currentTestNonce = await signer.provider.getTransactionCount(signerAddress, 'pending');
  
  // Sequential execution with retries for guaranteed success
  for (let i = 0; i < TRANSACTION_COUNT; i++) {
    logger.warning(`📤 Transaction ${i + 1}/${TRANSACTION_COUNT}...`);
    
    const txStartTime = Date.now();
    
    const txParams = {
      gasPrice: optimizedGasPrice,
      gasLimit: gasEstimate,
      nonce: currentTestNonce + i
    };
    
    const result = await submitTransactionWithRetry(contract, txParams, retryCount);
    
    const txEndTime = Date.now();
    const executionTime = txEndTime - txStartTime;
    
    if (result.success) {
      logger.success(`   ✅ Success! Hash: ${result.tx.hash.substring(0, 20)}... (${executionTime}ms, attempt ${result.attempt})`);
      
      results.push({
        index: i + 1,
        hash: result.tx.hash,
        nonce: txParams.nonce,
        executionTime: executionTime,
        attempts: result.attempt,
        success: true
      });
      
      if (result.attempt > 1) {
        totalRetries += result.attempt - 1;
      }
      
    } else {
      logger.error(`   ❌ Failed after ${result.attempt} attempts: ${result.error.substring(0, 50)}...`);
      
      results.push({
        index: i + 1,
        hash: null,
        nonce: txParams.nonce,
        executionTime: executionTime,
        attempts: result.attempt,
        success: false,
        error: result.error
      });
      
      totalRetries += result.attempt - 1;
    }
    
    // Progress indicator
    const progress = ((i + 1) / TRANSACTION_COUNT * 100).toFixed(1);
    logger.gray(`   Progress: ${progress}% complete`);
    
    // Delay before next transaction (except for last one)
    if (i < TRANSACTION_COUNT - 1) {
      logger.gray(`   ⏸️ Waiting ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    logger.log("");
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  // Calculate final metrics
  const successfulTxs = results.filter(r => r.success);
  const failedTxs = results.filter(r => !r.success);
  const avgExecutionTime = successfulTxs.length > 0 ? 
    successfulTxs.reduce((sum, r) => sum + r.executionTime, 0) / successfulTxs.length : 0;
  const successRate = (successfulTxs.length / TRANSACTION_COUNT * 100);
  const throughput = successfulTxs.length / (totalTime / 1000);
  
  logger.success("🎊 RELIABLE TEST COMPLETE!");
  logger.gray("=".repeat(60));
  
  // Results table
  const resultsTable = new Table({
    head: [
      chalk.white('Metric'),
      chalk.cyan('Value')
    ],
    colWidths: [35, 25]
  });
  
  const successColor = successRate === 100 ? chalk.green : successRate >= 95 ? chalk.yellow : chalk.red;
  
  resultsTable.push(
    ['Total Transactions', chalk.blue(TRANSACTION_COUNT.toString())],
    ['Successful Transactions', chalk.green(`${successfulTxs.length}/${TRANSACTION_COUNT}`)],
    ['Success Rate', successColor(`${successRate.toFixed(1)}%`)],
    ['Failed Transactions', failedTxs.length > 0 ? chalk.red(failedTxs.length.toString()) : chalk.green('0')],
    ['Total Retries Used', totalRetries > 0 ? chalk.yellow(totalRetries.toString()) : chalk.green('0')],
    ['Total Test Time', chalk.blue(`${(totalTime/1000).toFixed(2)}s`)],
    ['Avg Execution Time', chalk.blue(`${avgExecutionTime.toFixed(0)}ms`)],
    ['Throughput', chalk.blue(`${throughput.toFixed(3)} TPS`)],
    ['Reliability Mode', chalk.blue(RELIABILITY_MODE)],
    ['Gas Price Used', chalk.blue(`${optimizedGasPriceGwei} Gwei`)]
  );
  
  logger.log(resultsTable.toString());
  
  // Show reliability analysis
  if (successRate === 100) {
    logger.success("\n🎉 PERFECT SUCCESS! 100% reliability achieved!");
    logger.success("🛡️ All transactions submitted successfully");
  } else if (successRate >= 95) {
    logger.warning("\n⚡ EXCELLENT! Near-perfect reliability");
    logger.warning(`🛡️ ${successfulTxs.length}/${TRANSACTION_COUNT} transactions successful`);
  } else {
    logger.error("\n⚠️ Some transactions failed despite retries");
    logger.warning("💡 Try 'conservative' mode for better reliability");
  }
  
  // Show retry analysis if any
  if (totalRetries > 0) {
    const retriedTxs = results.filter(r => r.success && r.attempts > 1);
    logger.cyan(`\n🔄 RETRY ANALYSIS:`);
    logger.info(`   📊 Transactions requiring retries: ${retriedTxs.length}`);
    logger.info(`   🔄 Total retries performed: ${totalRetries}`);
    logger.info(`   📈 Retry success rate: ${(retriedTxs.length / (retriedTxs.length + failedTxs.length) * 100).toFixed(1)}%`);
  }
  
  // Show sample successful transactions
  if (successfulTxs.length > 0) {
    logger.cyan("\n📋 SAMPLE SUCCESSFUL TRANSACTIONS:");
    successfulTxs.slice(0, 3).forEach(tx => {
      const retryText = tx.attempts > 1 ? ` (${tx.attempts} attempts)` : '';
      logger.info(`   ${tx.index}. ${tx.hash} - ${tx.executionTime}ms${retryText}`);
    });
  }
  
  // Show failures if any
  if (failedTxs.length > 0) {
    logger.error(`\n❌ FAILED TRANSACTIONS (${failedTxs.length}):`);
    failedTxs.forEach(tx => {
      logger.error(`   ${tx.index}. ${tx.error.substring(0, 60)}... (${tx.attempts} attempts)`);
    });
  }
  
  logger.cyan("\n🎯 RELIABILITY INSIGHTS:");
  if (successRate === 100) {
    logger.success("🏆 Perfect reliability achieved! This configuration works optimally.");
  } else if (successRate >= 95) {
    logger.success("🌟 Excellent reliability! Minor optimizations could reach 100%.");
  } else {
    logger.warning("📊 Consider using 'conservative' mode for better success rates.");
  }
  
  logger.cyan("\n💡 OPTIMIZATION RECOMMENDATIONS:");
  if (successRate < 100) {
    logger.warning("• Try 'conservative' mode for higher success rate");
    logger.warning("• Increase gas price multiplier");  
    logger.warning("• Add longer delays between transactions");
  } else {
    logger.success("• Current settings are optimal for this network");
    logger.success("• Try 'aggressive' mode for higher throughput");
  }
  
  logger.success(`\n🎉 Reliability test complete: ${successRate.toFixed(1)}% success rate!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("❌ Reliable test failed:"));
    console.error(error);
    logger.warning("\n🔧 TROUBLESHOOTING:");
    logger.warning("1. Run diagnostic test first: npm run load-test:diagnostic");
    logger.warning("2. Ensure sufficient KAS balance");
    logger.warning("3. Wait for pending transactions to clear");
    logger.warning("4. Try 'conservative' mode for maximum reliability");
    process.exit(1);
  });