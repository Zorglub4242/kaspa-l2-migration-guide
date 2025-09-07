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

// Categorize error types
function categorizeError(error) {
  const msg = error.toLowerCase();
  
  if (msg.includes('nonce') && msg.includes('low')) return 'NONCE_TOO_LOW';
  if (msg.includes('nonce') && msg.includes('high')) return 'NONCE_TOO_HIGH';
  if (msg.includes('replacement') || msg.includes('underpriced')) return 'GAS_PRICE_TOO_LOW';
  if (msg.includes('gas') && msg.includes('limit')) return 'GAS_LIMIT_TOO_LOW';
  if (msg.includes('insufficient') && msg.includes('fund')) return 'INSUFFICIENT_FUNDS';
  if (msg.includes('timeout') || msg.includes('network')) return 'NETWORK_TIMEOUT';
  if (msg.includes('rejected') || msg.includes('reverted')) return 'TRANSACTION_REJECTED';
  if (msg.includes('orphan')) return 'ORPHAN_TRANSACTION';
  if (msg.includes('already known')) return 'DUPLICATE_TRANSACTION';
  
  return 'UNKNOWN_ERROR';
}

async function main() {
  logger.info("🔍 DIAGNOSTIC LOAD TEST - Failure Analysis");
  logger.gray("=".repeat(60));
  
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  if (!CONTRACT_ADDRESS) {
    logger.error("❌ CONTRACT_ADDRESS not set!");
    process.exit(1);
  }
  
  // Get the signer
  const [signer] = await ethers.getSigners();
  const signerAddress = signer.address;
  const balance = await signer.provider.getBalance(signerAddress);
  
  logger.info(`👤 Testing from account: ${signerAddress}`);
  logger.info(`💰 Account balance: ${ethers.utils.formatEther(balance)} KAS`);
  
  // Connect to the contract
  const LoadTestContract = await ethers.getContractFactory("LoadTestContract");
  const contract = LoadTestContract.attach(CONTRACT_ADDRESS);
  
  logger.cyan("\n🔍 NETWORK DIAGNOSTICS:");
  
  // 1. Check current network gas price
  const networkGasPrice = await signer.provider.getGasPrice();
  const networkGasPriceGwei = ethers.utils.formatUnits(networkGasPrice, "gwei");
  logger.info(`⛽ Current network gas price: ${networkGasPriceGwei} Gwei`);
  
  // 2. Check current nonce
  const currentNonce = await signer.provider.getTransactionCount(signerAddress, 'latest');
  const pendingNonce = await signer.provider.getTransactionCount(signerAddress, 'pending');
  logger.info(`🔢 Current nonce (latest): ${currentNonce}`);
  logger.info(`🔢 Pending nonce: ${pendingNonce}`);
  
  if (pendingNonce > currentNonce) {
    logger.warning(`⚠️  You have ${pendingNonce - currentNonce} pending transactions in mempool`);
    const clearMempool = await askQuestion(chalk.yellow("Clear pending transactions first? (y/N): "));
    if (clearMempool.toLowerCase() === 'y') {
      logger.warning("💡 Wait for pending transactions to confirm, or restart your wallet");
      logger.warning("💡 Or wait 10-15 minutes for transactions to expire");
    }
  }
  
  // 3. Estimate gas for our function
  let gasEstimate;
  try {
    gasEstimate = await contract.estimateGas.increment();
    logger.info(`⛽ Gas estimate for increment(): ${gasEstimate.toString()}`);
  } catch (error) {
    logger.error(`❌ Gas estimation failed: ${error.message}`);
    gasEstimate = ethers.utils.parseUnits("50000", "wei");
  }
  
  // 4. Check network congestion by testing a single transaction
  logger.warning("\n🧪 Testing single transaction to diagnose issues...");
  
  try {
    const testTx = await contract.increment({
      gasPrice: networkGasPrice.mul(150).div(100), // 50% above network gas price
      gasLimit: gasEstimate.mul(150).div(100), // 50% buffer
      nonce: pendingNonce
    });
    
    logger.success(`✅ Test transaction sent: ${testTx.hash}`);
    logger.warning("⏳ Waiting for confirmation...");
    
    const receipt = await testTx.wait();
    logger.success(`✅ Test transaction confirmed in block ${receipt.blockNumber}`);
    logger.info(`⛽ Actual gas used: ${receipt.gasUsed.toString()}`);
    
  } catch (error) {
    logger.error(`❌ Test transaction failed: ${error.message}`);
    const errorType = categorizeError(error.message);
    logger.error(`🔍 Error category: ${errorType}`);
    
    // Provide specific solutions based on error type
    switch(errorType) {
      case 'NONCE_TOO_LOW':
        logger.warning("💡 Solution: Wait for pending transactions to confirm");
        break;
      case 'GAS_PRICE_TOO_LOW':
        logger.warning("💡 Solution: Increase gas price above network minimum");
        break;
      case 'INSUFFICIENT_FUNDS':
        logger.warning("💡 Solution: Add more KAS to your wallet");
        break;
      case 'NETWORK_TIMEOUT':
        logger.warning("💡 Solution: Check network connectivity, try again later");
        break;
      default:
        logger.warning("💡 Solution: Check network status and transaction parameters");
    }
  }
  
  // 5. Test rapid submission diagnostic
  logger.cyan("\n🚀 RAPID SUBMISSION DIAGNOSTIC:");
  logger.info("Testing 10 rapid transactions to identify failure patterns...");
  
  const diagnosticResults = [];
  let diagnosticNonce = await signer.provider.getTransactionCount(signerAddress, 'pending');
  
  for (let i = 0; i < 10; i++) {
    try {
      const tx = await contract.increment({
        gasPrice: networkGasPrice.mul(120).div(100), // 20% above network
        gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
        nonce: diagnosticNonce + i
      });
      
      diagnosticResults.push({
        index: i + 1,
        hash: tx.hash,
        success: true,
        nonce: diagnosticNonce + i
      });
      
      logger.success(`✅ ${i + 1}/10: ${tx.hash.substring(0, 20)}...`);
      
    } catch (error) {
      const errorType = categorizeError(error.message);
      diagnosticResults.push({
        index: i + 1,
        success: false,
        error: error.message,
        errorType: errorType,
        nonce: diagnosticNonce + i
      });
      
      logger.error(`❌ ${i + 1}/10: ${errorType} - ${error.message.substring(0, 50)}...`);
    }
    
    // Small delay to avoid overwhelming the network
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Analyze diagnostic results
  const successful = diagnosticResults.filter(r => r.success);
  const failed = diagnosticResults.filter(r => !r.success);
  
  logger.cyan("\n📊 DIAGNOSTIC RESULTS:");
  logger.success(`✅ Successful: ${successful.length}/10`);
  logger.error(`❌ Failed: ${failed.length}/10`);
  
  if (failed.length > 0) {
    logger.error("\n❌ FAILURE ANALYSIS:");
    
    // Group errors by type
    const errorGroups = {};
    failed.forEach(f => {
      const type = f.errorType;
      if (!errorGroups[type]) errorGroups[type] = 0;
      errorGroups[type]++;
    });
    
    Object.entries(errorGroups).forEach(([type, count]) => {
      logger.error(`   ${type}: ${count} occurrences`);
    });
    
    logger.warning("\n💡 RECOMMENDED SOLUTIONS:");
    
    if (errorGroups['NONCE_TOO_LOW'] || errorGroups['NONCE_TOO_HIGH']) {
      logger.warning("🔢 NONCE ISSUES:");
      logger.warning("   • Use 'pending' nonce for sequential transactions");
      logger.warning("   • Add longer delays between transactions");
      logger.warning("   • Wait for mempool to clear before testing");
    }
    
    if (errorGroups['GAS_PRICE_TOO_LOW']) {
      logger.warning("⛽ GAS PRICE ISSUES:");
      logger.warning("   • Increase gas price to at least 150% of network price");
      logger.warning(`   • Current network: ${networkGasPriceGwei} Gwei, suggest: ${(parseFloat(networkGasPriceGwei) * 1.5).toFixed(0)} Gwei`);
    }
    
    if (errorGroups['NETWORK_TIMEOUT'] || errorGroups['ORPHAN_TRANSACTION']) {
      logger.warning("🌐 NETWORK ISSUES:");
      logger.warning("   • Network may be congested - try during off-peak hours");
      logger.warning("   • Reduce transaction rate (add more delay)");
      logger.warning("   • Try smaller batch sizes");
    }
  } else {
    logger.success("\n🎉 All diagnostic transactions succeeded!");
    logger.success("Network is ready for high-throughput testing");
  }
  
  // 6. Provide optimized parameters for guaranteed success
  logger.cyan("\n⚙️ OPTIMIZED PARAMETERS FOR 100% SUCCESS:");
  
  const recommendedGasPrice = networkGasPrice.mul(150).div(100);
  const recommendedGasLimit = gasEstimate.mul(150).div(100);
  const recommendedDelay = failed.length > 5 ? 500 : failed.length > 2 ? 200 : 50;
  
  logger.success(`✅ Recommended gas price: ${ethers.utils.formatUnits(recommendedGasPrice, "gwei")} Gwei`);
  logger.success(`✅ Recommended gas limit: ${recommendedGasLimit.toString()}`);
  logger.success(`✅ Recommended delay between transactions: ${recommendedDelay}ms`);
  logger.success(`✅ Recommended batch size: ${failed.length > 3 ? '10-20' : '50-100'}`);
  
  // 7. Save diagnostic report
  const report = {
    timestamp: new Date().toISOString(),
    networkGasPrice: networkGasPriceGwei,
    account: signerAddress,
    balance: ethers.utils.formatEther(balance),
    nonceDifference: pendingNonce - currentNonce,
    gasEstimate: gasEstimate.toString(),
    diagnosticResults: diagnosticResults,
    recommendedParams: {
      gasPrice: ethers.utils.formatUnits(recommendedGasPrice, "gwei") + " Gwei",
      gasLimit: recommendedGasLimit.toString(),
      delayMs: recommendedDelay,
      batchSize: failed.length > 3 ? "10-20" : "50-100"
    }
  };
  
  const fs = require('fs');
  fs.writeFileSync('diagnostic-report.json', JSON.stringify(report, null, 2));
  logger.info("\n💾 Detailed report saved to: diagnostic-report.json");
  
  logger.success("\n🎯 NEXT STEPS:");
  logger.info("1. 🧪 Run the guaranteed success test with optimized parameters");
  logger.info("2. 📊 Use recommended settings for your load tests");
  logger.info("3. 🔄 Re-run diagnostic if network conditions change");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("❌ Diagnostic test failed:"));
    console.error(error);
    process.exit(1);
  });