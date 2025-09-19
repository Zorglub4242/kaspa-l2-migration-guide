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
  logger.error("💥 BURST TPS TEST - Pure Submission Rate");
  logger.gray("=".repeat(60));
  
  // Get user configuration
  const burstInput = await askQuestion(chalk.yellow("⚡ How many transactions to burst? (default 100): "));
  const BURST_SIZE = parseInt(burstInput) || 100;
  
  const delayInput = await askQuestion(chalk.yellow("⏱️ Delay between submissions in ms? (0 = no delay, default 10): "));
  const SUBMISSION_DELAY = parseInt(delayInput) || 10;
  
  if (BURST_SIZE < 1 || BURST_SIZE > 1000) {
    logger.error("❌ Invalid burst size! Must be between 1 and 1000");
    process.exit(1);
  }
  
  logger.cyan(`\n💥 BURST TEST CONFIGURATION:`);
  logger.info(`   ⚡ Burst size: ${BURST_SIZE} transactions`);
  logger.info(`   ⏱️ Submission delay: ${SUBMISSION_DELAY}ms`);
  logger.warning(`   🎯 This measures pure transaction submission speed!`);
  
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
  logger.info(`📍 Contract address: ${CONTRACT_ADDRESS}`);
  
  // Connect to the contract
  const LoadTestContract = await ethers.getContractFactory("LoadTestContract");
  const contract = LoadTestContract.attach(CONTRACT_ADDRESS);
  
  // Test connectivity
  logger.warning("\n🏓 Testing contract connectivity...");
  try {
    const pong = await contract.ping();
    logger.success(`✅ Contract responsive: ${pong}`);
  } catch (error) {
    logger.error(`❌ Contract not accessible: ${error.message}`);
    process.exit(1);
  }
  
  // Configure gas
  const gasPrice = ethers.utils.parseUnits("2000", "gwei");
  const gasEstimate = ethers.utils.parseUnits("50000", "wei"); // Conservative estimate
  
  logger.info(`⛽ Gas price: ${ethers.utils.formatUnits(gasPrice, "gwei")} Gwei`);
  logger.info(`⛽ Gas limit: ${gasEstimate.toString()}`);
  
  // Get starting nonce
  let currentNonce = await signer.provider.getTransactionCount(signerAddress, 'latest');
  logger.info(`🔢 Starting nonce: ${currentNonce}`);
  
  logger.error(`\n⚠️  BURST TEST WARNING:`);
  logger.warning(`   This will rapidly submit ${BURST_SIZE} transactions`);
  logger.warning(`   We will NOT wait for confirmations - pure submission speed test!`);
  
  const confirm = await askQuestion(chalk.yellow("Continue? (y/N): "));
  if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    logger.info("Test cancelled");
    process.exit(0);
  }
  
  logger.cyan(`\n💥 STARTING BURST TEST...`);
  logger.info(`⏰ Start time: ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  const submissionTimes = [];
  const results = [];
  let successCount = 0;
  let errorCount = 0;
  
  // Rapid-fire submission loop
  for (let i = 0; i < BURST_SIZE; i++) {
    const submissionStart = Date.now();
    
    try {
      // Fire and forget - don't wait for confirmation
      const txPromise = contract.increment({
        gasPrice: gasPrice,
        gasLimit: gasEstimate,
        nonce: currentNonce + i
      });
      
      // We only wait for the transaction to be submitted to mempool, not confirmed
      const tx = await txPromise;
      
      const submissionEnd = Date.now();
      const submissionTime = submissionEnd - submissionStart;
      
      submissionTimes.push(submissionEnd);
      
      results.push({
        index: i + 1,
        hash: tx.hash,
        nonce: currentNonce + i,
        submissionTime: submissionTime,
        success: true,
        timestamp: submissionEnd
      });
      
      successCount++;
      
      // Progress indicator
      if (i % 10 === 0 || i < 10) {
        logger.success(`⚡ ${i + 1}/${BURST_SIZE} submitted (${submissionTime}ms) - ${tx.hash.substring(0, 20)}...`);
      }
      
    } catch (error) {
      const submissionEnd = Date.now();
      const submissionTime = submissionEnd - submissionStart;
      
      results.push({
        index: i + 1,
        hash: null,
        nonce: currentNonce + i,
        submissionTime: submissionTime,
        success: false,
        error: error.message.substring(0, 100),
        timestamp: submissionEnd
      });
      
      errorCount++;
      
      if (i < 10 || i % 20 === 0) {
        logger.error(`❌ ${i + 1}/${BURST_SIZE} failed (${submissionTime}ms) - ${error.message.substring(0, 50)}...`);
      }
    }
    
    // Optional minimal delay
    if (SUBMISSION_DELAY > 0 && i < BURST_SIZE - 1) {
      await new Promise(resolve => setTimeout(resolve, SUBMISSION_DELAY));
    }
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  // Calculate pure submission metrics
  const successfulSubmissions = results.filter(r => r.success);
  const failedSubmissions = results.filter(r => !r.success);
  const avgSubmissionTime = successfulSubmissions.length > 0 ? 
    successfulSubmissions.reduce((sum, r) => sum + r.submissionTime, 0) / successfulSubmissions.length : 0;
  const minSubmissionTime = successfulSubmissions.length > 0 ? 
    Math.min(...successfulSubmissions.map(r => r.submissionTime)) : 0;
  const maxSubmissionTime = successfulSubmissions.length > 0 ? 
    Math.max(...successfulSubmissions.map(r => r.submissionTime)) : 0;
  
  // Calculate different TPS metrics
  const overallTPS = successfulSubmissions.length / (totalTime / 1000);
  
  // Calculate peak TPS in the fastest submission window
  let peakTPS = 0;
  if (submissionTimes.length > 10) {
    const windowSize = 1000; // 1-second windows
    for (let i = 0; i < submissionTimes.length - 10; i++) {
      const windowStart = submissionTimes[i];
      let count = 0;
      for (let j = i; j < submissionTimes.length; j++) {
        if (submissionTimes[j] - windowStart <= windowSize) {
          count++;
        } else {
          break;
        }
      }
      const windowTPS = count / (windowSize / 1000);
      if (windowTPS > peakTPS) {
        peakTPS = windowTPS;
      }
    }
  }
  
  logger.success("\n💥 BURST TEST COMPLETE!");
  logger.gray("=".repeat(60));
  
  // Results table
  const resultsTable = new Table({
    head: [
      chalk.white('Metric'),
      chalk.cyan('Value')
    ],
    colWidths: [35, 20]
  });
  
  resultsTable.push(
    ['Total Transactions Attempted', chalk.blue(BURST_SIZE.toString())],
    ['Successful Submissions', chalk.green(`${successCount}/${BURST_SIZE}`)],
    ['Success Rate', chalk.green(`${((successCount/BURST_SIZE)*100).toFixed(1)}%`)],
    ['Failed Submissions', errorCount > 0 ? chalk.red(errorCount.toString()) : chalk.green('0')],
    ['Total Test Time', chalk.blue(`${(totalTime/1000).toFixed(2)}s`)],
    ['Avg Submission Time', chalk.blue(`${avgSubmissionTime.toFixed(0)}ms`)],
    ['Min Submission Time', chalk.green(`${minSubmissionTime}ms`)],
    ['Max Submission Time', chalk.red(`${maxSubmissionTime}ms`)],
    ['Overall Submission TPS', chalk.yellow(`${overallTPS.toFixed(2)}`)],
    ['Peak TPS (1s window)', chalk.red(`${peakTPS.toFixed(2)}`)],
    ['Submission Delay Used', chalk.blue(`${SUBMISSION_DELAY}ms`)]
  );
  
  logger.log(resultsTable.toString());
  
  // Show submission rate breakdown
  if (successfulSubmissions.length > 0) {
    logger.cyan("\n📊 SUBMISSION RATE ANALYSIS:");
    
    // Fast submissions (< 100ms)
    const fastSubmissions = successfulSubmissions.filter(r => r.submissionTime < 100);
    const mediumSubmissions = successfulSubmissions.filter(r => r.submissionTime >= 100 && r.submissionTime < 500);
    const slowSubmissions = successfulSubmissions.filter(r => r.submissionTime >= 500);
    
    logger.success(`   ⚡ Fast (< 100ms): ${fastSubmissions.length} (${((fastSubmissions.length/successCount)*100).toFixed(1)}%)`);
    logger.warning(`   📊 Medium (100-500ms): ${mediumSubmissions.length} (${((mediumSubmissions.length/successCount)*100).toFixed(1)}%)`);
    logger.error(`   🐌 Slow (> 500ms): ${slowSubmissions.length} (${((slowSubmissions.length/successCount)*100).toFixed(1)}%)`);
  }
  
  // Show sample transaction hashes
  const sampleTxs = successfulSubmissions.slice(0, 5);
  if (sampleTxs.length > 0) {
    logger.cyan("\n📋 SAMPLE TRANSACTIONS (first 5):");
    sampleTxs.forEach(tx => {
      logger.info(`   ${tx.index}. ${tx.hash} (${tx.submissionTime}ms, nonce ${tx.nonce})`);
    });
  }
  
  // Show failures if any
  if (failedSubmissions.length > 0) {
    logger.error(`\n❌ SUBMISSION FAILURES (${failedSubmissions.length}):`);
    failedSubmissions.slice(0, 3).forEach(tx => {
      logger.error(`   ${tx.index}. ${tx.error}`);
    });
    if (failedSubmissions.length > 3) {
      logger.error(`   ... and ${failedSubmissions.length - 3} more failures`);
    }
  }
  
  logger.cyan("\n🎯 BURST TPS ANALYSIS:");
  if (overallTPS > 50) {
    logger.success("🚀 Excellent! Network has very high transaction ingestion capacity");
  } else if (overallTPS > 20) {
    logger.success("⚡ Great submission rate! Network handles rapid transaction influx well");  
  } else if (overallTPS > 10) {
    logger.warning("📊 Good submission rate for blockchain network");
  } else if (overallTPS > 5) {
    logger.warning("📈 Moderate submission rate");
  } else {
    logger.error("⏳ Low submission rate - network may be congested or need optimization");
  }
  
  logger.cyan("\n💡 OPTIMIZATION TIPS:");
  logger.info("• Remove submission delay (set to 0) for maximum burst speed");
  logger.info("• Increase burst size to test sustained high load");
  logger.info("• Monitor mempool to see if transactions are being accepted");
  logger.info("• Lower gas price if submissions are failing due to cost");
  
  logger.success(`\n🎉 Peak burst rate achieved: ${Math.max(overallTPS, peakTPS).toFixed(2)} TPS`);
  logger.info("Note: This is pure submission rate - transactions still need time to confirm");
  logger.gray("Use this to find the network's maximum transaction ingestion capacity");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("❌ Burst test failed:"));
    console.error(error);
    logger.warning("\n🔧 TROUBLESHOOTING:");
    logger.warning("1. Reduce burst size if getting too many nonce errors");
    logger.warning("2. Add small submission delay if network is rejecting transactions");
    logger.warning("3. Check your balance can cover all transactions");
    logger.warning("4. Verify contract address is correct");
    process.exit(1);
  });