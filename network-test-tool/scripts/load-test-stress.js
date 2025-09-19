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
  logger.error("🔥 Enhanced Kasplex Stress Load Test");
  logger.gray("=" .repeat(50));
  
  // Ask user for configuration
  const concurrencyInput = await askQuestion(chalk.yellow("⚡ How many concurrent transactions? (default 10): "));
  const CONCURRENT_TRANSACTIONS = parseInt(concurrencyInput) || 10;
  
  const batchInput = await askQuestion(chalk.yellow("📦 Batch size per transaction? (default 3): "));
  const BATCH_SIZE = parseInt(batchInput) || 3;
  
  if (CONCURRENT_TRANSACTIONS < 1 || CONCURRENT_TRANSACTIONS > 50) {
    logger.error("❌ Invalid concurrency! Must be between 1 and 50");
    process.exit(1);
  }
  
  if (BATCH_SIZE < 1 || BATCH_SIZE > 20) {
    logger.error("❌ Invalid batch size! Must be between 1 and 20");
    process.exit(1);
  }
  
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  
  if (!CONTRACT_ADDRESS) {
    logger.log("❌ CONTRACT_ADDRESS not set!");
    logger.log("💡 Set it in your .env file or run: export CONTRACT_ADDRESS=0x...");
    logger.log("💡 Or deploy first: npm run deploy:kasplex");
    process.exit(1);
  }
  
  // Get the signer
  const [signer] = await ethers.getSigners();
  const signerAddress = signer.address;
  const balance = await signer.provider.getBalance(signerAddress);
  
  logger.log("👤 Testing from account:", signerAddress);
  logger.log("💰 Account balance:", ethers.utils.formatEther(balance), "KAS");
  logger.log("📍 Contract address:", CONTRACT_ADDRESS);
  logger.log("⚡ Concurrent transactions:", CONCURRENT_TRANSACTIONS);
  logger.log("📦 Batch size per transaction:", BATCH_SIZE);
  logger.log("");
  
  // Connect to the contract
  const LoadTestContract = await ethers.getContractFactory("LoadTestContract");
  const contract = LoadTestContract.attach(CONTRACT_ADDRESS);
  
  // Test contract connectivity and get initial state
  logger.log("🏓 Testing contract connectivity...");
  let initialState, initialCounter;
  try {
    const pong = await contract.ping();
    initialState = await contract.getCurrentState();
    initialCounter = parseInt(initialState.globalCount.toString());
    logger.log("✅ Contract responsive:", pong);
    logger.log("🔢 Initial global counter:", initialCounter.toLocaleString());
    logger.log("📊 Initial total transactions:", initialState.totalTxs.toString());
    logger.log("📦 Current block:", initialState.blockNumber.toString());
  } catch (error) {
    logger.log("❌ Contract not accessible:", error.message);
    process.exit(1);
  }
  logger.log("");
  
  // Configure gas for Kasplex
  const gasPrice = ethers.utils.parseUnits("2000", "gwei"); // 2000 Gwei for Kasplex
  logger.log("⛽ Using gas price:", ethers.utils.formatUnits(gasPrice, "gwei"), "Gwei");
  
  // Estimate gas for batch increment function
  let gasEstimate;
  try {
    gasEstimate = await contract.estimateGas.batchIncrement(BATCH_SIZE);
    logger.log("⛽ Estimated gas per batch transaction:", gasEstimate.toString());
    logger.log("💰 Estimated cost per transaction:", ethers.utils.formatEther(gasEstimate.mul(gasPrice)), "KAS");
    logger.log("💸 Total estimated cost:", ethers.utils.formatEther(gasEstimate.mul(gasPrice).mul(CONCURRENT_TRANSACTIONS)), "KAS");
  } catch (error) {
    logger.log("⚠️  Could not estimate gas, using default:", error.message);
    gasEstimate = ethers.utils.parseUnits("100000", "wei"); // Default 100k gas for batch
  }
  logger.log("");
  
  // Check if we have enough balance
  const totalEstimatedCost = gasEstimate.mul(gasPrice).mul(CONCURRENT_TRANSACTIONS);
  if (balance.lt(totalEstimatedCost.mul(2))) { // 2x buffer
    logger.log("❌ Insufficient balance for stress test!");
    logger.log("💡 Need:", ethers.utils.formatEther(totalEstimatedCost.mul(2)), "KAS");
    logger.log("💡 Get more KAS from: https://faucet.zealousswap.com/");
    process.exit(1);
  }
  
  // Start the stress test
  logger.log("🚀 Starting stress test...");
  logger.log("⏰ Start time:", new Date().toISOString());
  logger.log("🔥 This will test Kasplex's ability to handle concurrent transactions!");
  logger.log("");
  
  const startTime = Date.now();
  const results = [];
  const txPromises = [];
  
  // Get starting nonce
  let currentNonce = await signer.provider.getTransactionCount(signerAddress, 'pending');
  logger.log("🔢 Starting nonce:", currentNonce);
  
  // Create all transaction promises concurrently
  for (let i = 0; i < CONCURRENT_TRANSACTIONS; i++) {
    logger.log(`📤 Preparing transaction ${i + 1}/${CONCURRENT_TRANSACTIONS}...`);
    
    const txPromise = (async (txIndex, nonce) => {
      const txStartTime = Date.now();
      
      try {
        logger.log(`   🚀 Sending batch transaction ${txIndex + 1} with nonce ${nonce}...`);
        
        const tx = await contract.batchIncrement(BATCH_SIZE, {
          gasPrice: gasPrice,
          gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
          nonce: nonce
        });
        
        logger.log(`   ✅ Transaction ${txIndex + 1} sent! Hash: ${tx.hash}`);
        
        // Wait for confirmation
        logger.log(`   ⏳ Waiting for confirmation of tx ${txIndex + 1}...`);
        const receipt = await tx.wait();
        
        const txEndTime = Date.now();
        const confirmationTime = txEndTime - txStartTime;
        
        logger.log(`   🎉 Transaction ${txIndex + 1} confirmed in block ${receipt.blockNumber}! Time: ${confirmationTime}ms`);
        
        return {
          txIndex: txIndex + 1,
          hash: tx.hash,
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
          confirmationTime: confirmationTime,
          success: true,
          nonce: nonce
        };
        
      } catch (error) {
        logger.log(`   ❌ Transaction ${txIndex + 1} failed:`, error.message);
        
        return {
          txIndex: txIndex + 1,
          hash: null,
          blockNumber: null,
          gasUsed: null,
          confirmationTime: Date.now() - txStartTime,
          success: false,
          error: error.message,
          nonce: nonce
        };
      }
    })(i, currentNonce + i);
    
    txPromises.push(txPromise);
  }
  
  logger.log("");
  logger.log("⚡ All transactions submitted! Waiting for results...");
  logger.log("🔄 This tests Kasplex's concurrent transaction processing capability");
  logger.log("");
  
  // Wait for all transactions to complete
  const allResults = await Promise.allSettled(txPromises);
  
  // Process results
  allResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      results.push({
        txIndex: index + 1,
        hash: null,
        blockNumber: null,
        gasUsed: null,
        confirmationTime: 0,
        success: false,
        error: result.reason.message || 'Unknown error',
        nonce: currentNonce + index
      });
    }
  });
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  // Calculate results
  const successfulTxs = results.filter(r => r.success);
  const failedTxs = results.filter(r => !r.success);
  const avgConfirmationTime = successfulTxs.length > 0 ? 
    successfulTxs.reduce((sum, r) => sum + r.confirmationTime, 0) / successfulTxs.length : 0;
  const minConfirmationTime = successfulTxs.length > 0 ? 
    Math.min(...successfulTxs.map(r => r.confirmationTime)) : 0;
  const maxConfirmationTime = successfulTxs.length > 0 ? 
    Math.max(...successfulTxs.map(r => r.confirmationTime)) : 0;
  const totalGasUsed = successfulTxs.reduce((sum, r) => sum + parseInt(r.gasUsed || "0"), 0);
  const totalCost = ethers.utils.formatEther(ethers.BigNumber.from(totalGasUsed.toString()).mul(gasPrice));
  const throughput = successfulTxs.length / (totalTime / 1000); // TPS
  const totalIncrements = successfulTxs.length * BATCH_SIZE; // Each successful tx increments by BATCH_SIZE
  
  logger.log("🎊 STRESS TEST COMPLETE!");
  logger.log("=" .repeat(50));
  
  // Get final counter state
  let finalCounter = initialCounter;
  let counterIncrease = 0;
  try {
    const finalState = await contract.getCurrentState();
    finalCounter = parseInt(finalState.globalCount.toString());
    counterIncrease = finalCounter - initialCounter;
  } catch (error) {
    logger.log("⚠️  Could not read final counter state");
  }
  
  logger.log("📊 RESULTS SUMMARY:");
  logger.log(`✅ Successful transactions: ${successfulTxs.length}/${CONCURRENT_TRANSACTIONS}`);
  logger.log(`❌ Failed transactions: ${failedTxs.length}`);
  logger.log(`⏱️  Total test time: ${(totalTime / 1000).toFixed(2)} seconds`);
  logger.log(`⚡ Average confirmation time: ${avgConfirmationTime.toFixed(0)}ms`);
  logger.log(`🏃 Min confirmation time: ${minConfirmationTime}ms`);
  logger.log(`🐌 Max confirmation time: ${maxConfirmationTime}ms`);
  logger.log(`🚀 Throughput (TPS): ${throughput.toFixed(3)} transactions per second`);
  logger.log(`🔢 Total increments processed: ${totalIncrements}`);
  logger.log(`⛽ Total gas spent: ${totalGasUsed.toLocaleString()} gas`);
  logger.log(`💰 Total cost: ${totalCost} KAS (~$${(parseFloat(totalCost) * 0.1).toFixed(4)} USD)`);
  logger.log("");
  
  logger.log("🔢 COUNTER STATE CHANGES:");
  logger.log(`📈 Initial counter: ${initialCounter.toLocaleString()}`);
  logger.log(`📊 Final counter: ${finalCounter.toLocaleString()}`);
  logger.log(`➕ Counter increased by: ${counterIncrease.toLocaleString()}`);
  logger.log(`🎯 Expected increase: ${totalIncrements} (${BATCH_SIZE} per successful transaction)`);
  if (counterIncrease === totalIncrements) {
    logger.log("✅ Counter matches expected increase perfectly!");
  } else {
    logger.log("⚠️  Counter mismatch - check for concurrent tests or errors");
  }
  logger.log("");
  
  // Performance analysis
  if (successfulTxs.length > 0) {
    logger.log("📈 PERFORMANCE ANALYSIS:");
    logger.log(`🎯 Success rate: ${((successfulTxs.length / CONCURRENT_TRANSACTIONS) * 100).toFixed(1)}%`);
    logger.log(`⚡ Network handled ${successfulTxs.length} concurrent transactions successfully`);
    logger.log(`📊 Average gas per transaction: ${Math.round(totalGasUsed / successfulTxs.length).toLocaleString()}`);
    logger.log(`💰 Average cost per transaction: ${(parseFloat(totalCost) / successfulTxs.length).toFixed(6)} KAS`);
    logger.log("");
  }
  
  // Show block distribution
  if (successfulTxs.length > 0) {
    const blockDistribution = {};
    successfulTxs.forEach(tx => {
      const block = tx.blockNumber;
      blockDistribution[block] = (blockDistribution[block] || 0) + 1;
    });
    
    logger.log("📦 BLOCK DISTRIBUTION:");
    Object.entries(blockDistribution)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([block, count]) => {
        logger.log(`   Block ${block}: ${count} transactions`);
      });
    logger.log("");
  }
  
  if (failedTxs.length > 0) {
    logger.log("❌ FAILED TRANSACTIONS:");
    failedTxs.forEach(tx => {
      logger.log(`   ${tx.txIndex}. Nonce ${tx.nonce}: ${tx.error}`);
    });
    logger.log("");
  }
  
  // Check final contract state
  logger.log("🔍 Final contract state:");
  try {
    const finalState = await contract.getCurrentState();
    const userStats = await contract.getUserStats(signerAddress);
    
    logger.log(`🔢 Global counter: ${finalState.globalCount.toString()}`);
    logger.log(`📊 Total transactions: ${finalState.totalTxs.toString()}`);
    logger.log(`👤 Your counter: ${userStats[0].toString()}`);
    logger.log(`📈 Your transactions: ${userStats[1].toString()}`);
  } catch (error) {
    logger.log("❌ Could not read final state:", error.message);
  }
  
  logger.log("");
  logger.log("🎯 STRESS TEST INSIGHTS:");
  if (throughput > 2) {
    logger.log("🚀 Excellent! Kasplex handled high concurrency well (>2 TPS)");
  } else if (throughput > 1) {
    logger.log("⚡ Good performance! Kasplex processed transactions efficiently (>1 TPS)");
  } else {
    logger.log("⏳ Moderate performance. Consider sequential execution for reliability.");
  }
  
  if (successfulTxs.length === CONCURRENT_TRANSACTIONS) {
    logger.log("🎉 Perfect! All concurrent transactions succeeded!");
  } else if (successfulTxs.length > CONCURRENT_TRANSACTIONS * 0.8) {
    logger.log("👍 Great success rate! Kasplex handles concurrent load well.");
  } else {
    logger.log("⚠️  Some transactions failed. This is normal under high stress.");
  }
  
  logger.log("");
  logger.log("🎯 NEXT STEPS:");
  logger.log("1. 🔍 Analyze failed transactions if any");
  logger.log("2. 🧪 Try different batch sizes or concurrency levels");
  logger.log("3. 📊 View contract: https://explorer.testnet.kasplextest.xyz/address/" + CONTRACT_ADDRESS);
  logger.log("4. 🔄 Run simple test: npm run load-test:simple kasplex");
  logger.log("");
  logger.log("🎉 Kasplex L2: Built for high-throughput applications!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Stress test failed:");
    console.error(error);
    logger.log("");
    logger.log("🔧 TROUBLESHOOTING:");
    logger.log("1. Reduce CONCURRENT_TRANSACTIONS if network is congested");
    logger.log("2. Ensure sufficient KAS balance for all transactions");
    logger.log("3. Check Kasplex testnet status and RPC availability");
    logger.log("4. Try sequential execution instead of concurrent");
    process.exit(1);
  });