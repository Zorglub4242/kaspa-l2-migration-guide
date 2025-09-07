const { ethers } = require("hardhat");
const readline = require('readline');
const chalk = require('chalk');
const Table = require('cli-table3');

const { logger } = require('../utils/logger');

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

async function main() {
  logger.error("⚡ MAXIMUM TPS LOAD TEST");
  logger.gray("=".repeat(60));
  
  // Get user configuration for maximum throughput
  const concurrencyInput = await askQuestion(chalk.yellow("🚀 How many parallel transactions? (default 50): "));
  const PARALLEL_TRANSACTIONS = parseInt(concurrencyInput) || 50;
  
  const batchInput = await askQuestion(chalk.yellow("📦 How many batches to run? (default 10): "));
  const BATCH_COUNT = parseInt(batchInput) || 10;
  
  const delayInput = await askQuestion(chalk.yellow("⏱️ Delay between batches in ms? (default 100): "));
  const BATCH_DELAY = parseInt(delayInput) || 100;
  
  if (PARALLEL_TRANSACTIONS < 1 || PARALLEL_TRANSACTIONS > 200) {
    logger.error("❌ Invalid parallel count! Must be between 1 and 200");
    process.exit(1);
  }
  
  if (BATCH_COUNT < 1 || BATCH_COUNT > 50) {
    logger.error("❌ Invalid batch count! Must be between 1 and 50");
    process.exit(1);
  }
  
  const TOTAL_TRANSACTIONS = PARALLEL_TRANSACTIONS * BATCH_COUNT;
  logger.cyan(`\n🎯 MAX TPS TEST CONFIGURATION:`);
  logger.info(`   ⚡ Parallel transactions per batch: ${PARALLEL_TRANSACTIONS}`);
  logger.info(`   📦 Number of batches: ${BATCH_COUNT}`);
  logger.info(`   ⏱️ Delay between batches: ${BATCH_DELAY}ms`);
  logger.info(`   🎲 Total transactions: ${TOTAL_TRANSACTIONS}`);
  logger.warning(`   ⚠️  This will send ${PARALLEL_TRANSACTIONS} transactions simultaneously!`);
  
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  
  if (!CONTRACT_ADDRESS) {
    logger.error("❌ CONTRACT_ADDRESS not set!");
    logger.warning("💡 Set it in your .env file or run: export CONTRACT_ADDRESS=0x...");
    process.exit(1);
  }
  
  // Get the signer
  const [signer] = await ethers.getSigners();
  const signerAddress = signer.address;
  const balance = await signer.provider.getBalance(signerAddress);
  
  logger.info(`\n👤 Testing from account: ${signerAddress}`);
  logger.info(`💰 Account balance: ${ethers.utils.formatEther(balance)} KAS`);
  logger.info(`📍 Contract address: ${CONTRACT_ADDRESS}`);
  
  // Connect to the contract
  const LoadTestContract = await ethers.getContractFactory("LoadTestContract");
  const contract = LoadTestContract.attach(CONTRACT_ADDRESS);
  
  // Test connectivity
  logger.warning("\n🏓 Testing contract connectivity...");
  try {
    const pong = await contract.ping();
    const initialState = await contract.getCurrentState();
    logger.success(`✅ Contract responsive: ${pong}`);
    logger.info(`🔢 Initial counter: ${initialState.globalCount.toString()}`);
  } catch (error) {
    logger.error(`❌ Contract not accessible: ${error.message}`);
    process.exit(1);
  }
  
  // Configure gas
  const gasPrice = ethers.utils.parseUnits("2000", "gwei");
  logger.info(`⛽ Gas price: ${ethers.utils.formatUnits(gasPrice, "gwei")} Gwei`);
  
  // Estimate gas
  let gasEstimate;
  try {
    gasEstimate = await contract.estimateGas.increment();
    logger.info(`⛽ Estimated gas per transaction: ${gasEstimate.toString()}`);
    const totalCost = gasEstimate.mul(gasPrice).mul(TOTAL_TRANSACTIONS);
    logger.info(`💰 Total estimated cost: ${ethers.utils.formatEther(totalCost)} KAS`);
  } catch (error) {
    logger.warning(`⚠️  Could not estimate gas: ${error.message}`);
    gasEstimate = ethers.utils.parseUnits("50000", "wei");
  }
  
  // Warning about high throughput test
  logger.error(`\n⚠️  HIGH THROUGHPUT TEST WARNING:`);
  logger.warning(`   This will stress test the network with ${TOTAL_TRANSACTIONS} transactions`);
  logger.warning(`   Some transactions may fail under extreme load`);
  
  const confirm = await askQuestion(chalk.yellow("Continue? (y/N): "));
  if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    logger.info("Test cancelled");
    process.exit(0);
  }
  
  logger.cyan(`\n🚀 STARTING MAX TPS TEST...`);
  logger.info(`⏰ Start time: ${new Date().toISOString()}`);
  
  const overallStartTime = Date.now();
  const allResults = [];
  const submissionTimes = [];
  
  // Run batches of parallel transactions
  for (let batch = 0; batch < BATCH_COUNT; batch++) {
    logger.cyan(`\n📦 BATCH ${batch + 1}/${BATCH_COUNT} - ${PARALLEL_TRANSACTIONS} parallel transactions`);
    
    const batchStartTime = Date.now();
    const batchPromises = [];
    
    // Get starting nonce for this batch
    let currentNonce = await signer.provider.getTransactionCount(signerAddress, 'latest');
    logger.info(`🔢 Starting nonce for batch: ${currentNonce}`);
    
    // Create all parallel transactions for this batch
    for (let i = 0; i < PARALLEL_TRANSACTIONS; i++) {
      const txIndex = batch * PARALLEL_TRANSACTIONS + i + 1;
      const nonce = currentNonce + i;
      
      const txPromise = (async (index, txNonce) => {
        const txStartTime = Date.now();
        submissionTimes.push(txStartTime);
        
        try {
          const tx = await contract.increment({
            gasPrice: gasPrice,
            gasLimit: gasEstimate.mul(110).div(100), // 10% buffer for speed
            nonce: txNonce
          });
          
          // Don't wait for confirmation in max TPS test - just track submission
          return {
            index: index,
            hash: tx.hash,
            nonce: txNonce,
            submissionTime: Date.now() - txStartTime,
            submitted: true,
            batch: batch + 1,
            success: true // We consider submission as success for TPS calculation
          };
          
        } catch (error) {
          return {
            index: index,
            hash: null,
            nonce: txNonce,
            submissionTime: Date.now() - txStartTime,
            submitted: false,
            batch: batch + 1,
            success: false,
            error: error.message.substring(0, 50) + "..."
          };
        }
      })(txIndex, nonce);
      
      batchPromises.push(txPromise);
    }
    
    // Wait for all submissions in this batch
    logger.warning(`⚡ Submitting ${PARALLEL_TRANSACTIONS} transactions simultaneously...`);
    const batchResults = await Promise.allSettled(batchPromises);
    
    const batchEndTime = Date.now();
    const batchDuration = batchEndTime - batchStartTime;
    
    // Process batch results
    let batchSuccesses = 0;
    let batchFailures = 0;
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allResults.push(result.value);
        if (result.value.success) batchSuccesses++;
        else batchFailures++;
      } else {
        allResults.push({
          index: batch * PARALLEL_TRANSACTIONS + index + 1,
          hash: null,
          nonce: currentNonce + index,
          submissionTime: batchDuration,
          submitted: false,
          batch: batch + 1,
          success: false,
          error: "Promise rejected"
        });
        batchFailures++;
      }
    });
    
    const batchTPS = batchSuccesses / (batchDuration / 1000);
    logger.success(`✅ Batch ${batch + 1} complete: ${batchSuccesses}/${PARALLEL_TRANSACTIONS} submitted in ${batchDuration}ms`);
    logger.success(`🚀 Batch TPS: ${batchTPS.toFixed(2)}`);
    
    // Short delay between batches
    if (batch < BATCH_COUNT - 1) {
      logger.gray(`⏸️  Waiting ${BATCH_DELAY}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }
  
  const overallEndTime = Date.now();
  const totalTestTime = overallEndTime - overallStartTime;
  
  // Calculate overall metrics
  const successfulSubmissions = allResults.filter(r => r.success);
  const failedSubmissions = allResults.filter(r => !r.success);
  const avgSubmissionTime = successfulSubmissions.length > 0 ? 
    successfulSubmissions.reduce((sum, r) => sum + r.submissionTime, 0) / successfulSubmissions.length : 0;
  
  // Calculate different TPS metrics
  const submissionTPS = successfulSubmissions.length / (totalTestTime / 1000);
  const firstSubmission = Math.min(...submissionTimes);
  const lastSubmission = Math.max(...submissionTimes);
  const submissionWindow = lastSubmission - firstSubmission;
  const peakTPS = submissionWindow > 0 ? successfulSubmissions.length / (submissionWindow / 1000) : 0;
  
  logger.success("\n🎊 MAX TPS TEST COMPLETE!");
  logger.gray("=".repeat(60));
  
  // Results table
  const resultsTable = new Table({
    head: [
      chalk.white('Metric'),
      chalk.cyan('Value')
    ],
    colWidths: [30, 20]
  });
  
  resultsTable.push(
    ['Total Transactions', chalk.blue(TOTAL_TRANSACTIONS.toString())],
    ['Successful Submissions', chalk.green(`${successfulSubmissions.length}/${TOTAL_TRANSACTIONS}`)],
    ['Success Rate', chalk.green(`${((successfulSubmissions.length/TOTAL_TRANSACTIONS)*100).toFixed(1)}%`)],
    ['Failed Submissions', failedSubmissions.length > 0 ? chalk.red(failedSubmissions.length.toString()) : chalk.green('0')],
    ['Total Test Time', chalk.blue(`${(totalTestTime/1000).toFixed(2)}s`)],
    ['Avg Submission Time', chalk.blue(`${avgSubmissionTime.toFixed(0)}ms`)],
    ['Overall TPS', chalk.yellow(`${submissionTPS.toFixed(2)}`)],
    ['Peak TPS (submission window)', chalk.red(`${peakTPS.toFixed(2)}`)],
    ['Parallel Transactions', chalk.blue(PARALLEL_TRANSACTIONS.toString())],
    ['Batches', chalk.blue(BATCH_COUNT.toString())]
  );
  
  logger.log(resultsTable.toString());
  
  // Show batch performance
  logger.cyan("\n📊 BATCH PERFORMANCE:");
  const batchPerformance = {};
  allResults.forEach(r => {
    if (!batchPerformance[r.batch]) {
      batchPerformance[r.batch] = { success: 0, total: 0 };
    }
    batchPerformance[r.batch].total++;
    if (r.success) batchPerformance[r.batch].success++;
  });
  
  Object.keys(batchPerformance).forEach(batch => {
    const perf = batchPerformance[batch];
    const rate = ((perf.success / perf.total) * 100).toFixed(1);
    const color = perf.success === perf.total ? chalk.green : perf.success > perf.total * 0.8 ? chalk.yellow : chalk.red;
    logger.log(color(`   Batch ${batch}: ${perf.success}/${perf.total} (${rate}%)`));
  });
  
  // Show sample transaction hashes (first 5 successful)
  const sampleTxs = successfulSubmissions.slice(0, 5);
  if (sampleTxs.length > 0) {
    logger.cyan("\n📋 SAMPLE TRANSACTION HASHES:");
    sampleTxs.forEach(tx => {
      logger.info(`   ${tx.index}. ${tx.hash} (${tx.submissionTime}ms, nonce ${tx.nonce})`);
    });
  }
  
  // Show failures if any
  if (failedSubmissions.length > 0) {
    logger.error(`\n❌ FAILED SUBMISSIONS (${failedSubmissions.length}):`);
    failedSubmissions.slice(0, 5).forEach(tx => {
      logger.error(`   ${tx.index}. ${tx.error} (nonce ${tx.nonce})`);
    });
    if (failedSubmissions.length > 5) {
      logger.error(`   ... and ${failedSubmissions.length - 5} more failures`);
    }
  }
  
  logger.cyan("\n🎯 TPS ANALYSIS:");
  if (submissionTPS > 10) {
    logger.success("🚀 Excellent! Network handled high-throughput load very well");
  } else if (submissionTPS > 5) {
    logger.warning("⚡ Good throughput for blockchain transactions");  
  } else if (submissionTPS > 1) {
    logger.info("📊 Moderate throughput - typical for blockchain networks");
  } else {
    logger.error("⏳ Low throughput - network may be congested or parameters need adjustment");
  }
  
  logger.cyan("\n💡 OPTIMIZATION TIPS:");
  logger.info("• Increase parallel transactions for higher peak TPS");
  logger.info("• Reduce batch delay for continuous high throughput");
  logger.info("• Monitor network congestion and adjust accordingly");
  logger.info("• Use lower gas price for cost optimization (may reduce speed)");
  
  logger.success(`\n🎉 Peak submission rate achieved: ${peakTPS.toFixed(2)} TPS`);
  logger.info("Note: This measures transaction submission rate, not confirmation rate");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("❌ Max TPS test failed:"));
    console.error(error);
    logger.warning("\n🔧 TROUBLESHOOTING:");
    logger.warning("1. Reduce parallel transaction count if getting nonce errors");
    logger.warning("2. Ensure sufficient balance for all transactions");
    logger.warning("3. Check network isn't congested");
    logger.warning("4. Try smaller batches with longer delays");
    process.exit(1);
  });