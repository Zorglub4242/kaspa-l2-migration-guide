const { ethers } = require("hardhat");
const readline = require('readline');
const chalk = require('chalk');
const Table = require('cli-table3');

const { logger } = require('../utils/logger');

// Helper function to get timestamp for logging
function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

// Enhanced console.log with timestamp
function logWithTime(message, color = chalk.white) {
  const timestamp = chalk.gray(`[${getTimestamp()}]`);
  logger.log(`${timestamp} ${color(message)}`);
}

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
  logWithTime("🚀 Enhanced Kasplex Load Test", chalk.cyan);
  logWithTime("=" .repeat(50), chalk.gray);
  
  // Ask user for configuration
  const txInput = await askQuestion(chalk.yellow("⚡ How many transactions to send? (default 5): "));
  const TRANSACTIONS_TO_SEND = parseInt(txInput) || 5;
  
  if (TRANSACTIONS_TO_SEND < 1 || TRANSACTIONS_TO_SEND > 50) {
    logWithTime("❌ Invalid transaction count! Must be between 1 and 50", chalk.red);
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
  logger.log("🧪 Transactions to send:", TRANSACTIONS_TO_SEND);
  logger.log("");
  
  // Connect to the contract
  const LoadTestContract = await ethers.getContractFactory("LoadTestContract");
  const contract = LoadTestContract.attach(CONTRACT_ADDRESS);
  
  // Test contract connectivity
  logger.log("🏓 Testing contract connectivity...");
  try {
    const pong = await contract.ping();
    const initialState = await contract.getCurrentState();
    logger.log("✅ Contract responsive:", pong);
    logger.log("🔢 Initial global counter:", initialState.globalCount.toString());
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
  
  // Estimate gas for increment function
  let gasEstimate;
  try {
    gasEstimate = await contract.estimateGas.increment();
    logger.log("⛽ Estimated gas per transaction:", gasEstimate.toString());
    logger.log("💰 Estimated cost per transaction:", ethers.utils.formatEther(gasEstimate.mul(gasPrice)), "KAS");
    logger.log("💸 Total estimated cost:", ethers.utils.formatEther(gasEstimate.mul(gasPrice).mul(TRANSACTIONS_TO_SEND)), "KAS");
  } catch (error) {
    logger.log("⚠️  Could not estimate gas, using default:", error.message);
    gasEstimate = ethers.utils.parseUnits("50000", "wei"); // Default 50k gas
  }
  logger.log("");
  
  // Start the load test
  logger.log("🚀 Starting simple load test...");
  logger.log("⏰ Start time:", new Date().toISOString());
  
  const startTime = Date.now();
  const results = [];
  const txHashes = [];
  
  // Send transactions sequentially for reliability on Kasplex
  for (let i = 0; i < TRANSACTIONS_TO_SEND; i++) {
    logger.log(`📤 Sending transaction ${i + 1}/${TRANSACTIONS_TO_SEND}...`);
    
    const txStartTime = Date.now();
    
    try {
      // Send transaction with explicit nonce to avoid conflicts
      const nonce = await signer.provider.getTransactionCount(signerAddress, 'pending');
      
      const tx = await contract.increment({
        gasPrice: gasPrice,
        gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
        nonce: nonce
      });
      
      logger.log(`   ✅ Transaction sent! Hash: ${tx.hash}`);
      txHashes.push(tx.hash);
      
      // Wait for confirmation
      logger.log(`   ⏳ Waiting for confirmation...`);
      const receipt = await tx.wait();
      
      const txEndTime = Date.now();
      const confirmationTime = txEndTime - txStartTime;
      
      logger.log(`   🎉 Confirmed in block ${receipt.blockNumber}! Time: ${confirmationTime}ms`);
      logger.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}`);
      
      results.push({
        txIndex: i + 1,
        hash: tx.hash,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        confirmationTime: confirmationTime,
        success: true
      });
      
    } catch (error) {
      logger.log(`   ❌ Transaction ${i + 1} failed:`, error.message);
      
      results.push({
        txIndex: i + 1,
        hash: null,
        blockNumber: null,
        gasUsed: null,
        confirmationTime: Date.now() - txStartTime,
        success: false,
        error: error.message
      });
    }
    
    // Small delay between transactions for Kasplex
    if (i < TRANSACTIONS_TO_SEND - 1) {
      logger.log(`   ⏸️  Waiting 2 seconds before next transaction...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    logger.log("");
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  // Calculate results
  const successfulTxs = results.filter(r => r.success);
  const failedTxs = results.filter(r => !r.success);
  const avgConfirmationTime = successfulTxs.length > 0 ? 
    successfulTxs.reduce((sum, r) => sum + r.confirmationTime, 0) / successfulTxs.length : 0;
  const totalGasUsed = successfulTxs.reduce((sum, r) => sum + parseInt(r.gasUsed || "0"), 0);
  const totalCost = ethers.utils.formatEther(ethers.BigNumber.from(totalGasUsed.toString()).mul(gasPrice));
  const throughput = successfulTxs.length / (totalTime / 1000); // TPS
  
  logger.log("🎊 LOAD TEST COMPLETE!");
  logger.log("=" .repeat(50));
  logger.log("📊 RESULTS SUMMARY:");
  logger.log(`✅ Successful transactions: ${successfulTxs.length}/${TRANSACTIONS_TO_SEND}`);
  logger.log(`❌ Failed transactions: ${failedTxs.length}`);
  logger.log(`⏱️  Total test time: ${(totalTime / 1000).toFixed(2)} seconds`);
  logger.log(`⚡ Average confirmation time: ${avgConfirmationTime.toFixed(0)}ms`);
  logger.log(`🚀 Throughput: ${throughput.toFixed(3)} TPS`);
  logger.log(`⛽ Total gas used: ${totalGasUsed.toLocaleString()}`);
  logger.log(`💰 Total cost: ${totalCost} KAS (~$${(parseFloat(totalCost) * 0.1).toFixed(4)} USD)`);
  logger.log("");
  
  // Show detailed transaction results with full hashes
  if (successfulTxs.length > 0) {
    logger.cyan("📋 TRANSACTION DETAILS:");
    successfulTxs.forEach(tx => {
      logger.info(`   ${tx.txIndex}. Block ${tx.blockNumber} | ${tx.confirmationTime}ms | ${parseInt(tx.gasUsed).toLocaleString()} gas`);
      logger.gray(`      Hash: ${tx.hash}`);
    });
    logger.log("");
  }
  
  if (failedTxs.length > 0) {
    logger.log("❌ FAILED TRANSACTIONS:");
    failedTxs.forEach(tx => {
      logger.log(`   ${tx.txIndex}. ${tx.error}`);
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
  logger.log("🎯 NEXT STEPS:");
  logger.log("1. 🔍 View transactions: https://explorer.testnet.kasplextest.xyz/");
  logger.log("2. 🧪 Run stress test: npm run load-test:stress kasplex");
  logger.log("3. 📊 View contract: https://explorer.testnet.kasplextest.xyz/address/" + CONTRACT_ADDRESS);
  logger.log("");
  logger.log("🎉 Kasplex L2: Fast, cheap, and reliable!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Load test failed:");
    console.error(error);
    logger.log("");
    logger.log("🔧 TROUBLESHOOTING:");
    logger.log("1. Make sure CONTRACT_ADDRESS is set correctly");
    logger.log("2. Ensure you have enough KAS for gas fees");
    logger.log("3. Check that the contract is deployed and accessible");
    logger.log("4. Verify Kasplex testnet is operational");
    process.exit(1);
  });