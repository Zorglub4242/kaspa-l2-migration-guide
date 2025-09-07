const { ethers } = require("hardhat");
const readline = require('readline');
const chalk = require('chalk');
require('dotenv').config();

const { logger } = require('../utils/logger');
const { defiMetrics } = require('../utils/defi-metrics');
const { priceFetcher } = require('../utils/price-fetcher');

/**
 * DEX Trading Load Testing Script
 * Tests decentralized exchange operations across networks
 * Measures swap performance, slippage, and liquidity management
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

// Configuration options for DEX testing
const DEX_SCENARIOS = {
  swaps: 'Token Swaps Only - ETH ↔ USDC swaps',
  liquidity: 'Liquidity Management - Add/remove liquidity',  
  full: 'Full DEX Simulation - Swaps + LP + price impact',
  mev: 'MEV Resistance Test - Front/back-running simulation'
};

const NETWORKS = {
  kasplex: 'Kasplex L2',
  sepolia: 'Ethereum Sepolia',
  holesky: 'Ethereum Holesky',
  goerli: 'Ethereum Goerli',
  localhost: 'Local Network'
};

async function displayWelcome() {
  logger.log(chalk.cyan('🏪 DEX Trading Load Tester - DeFi Edition'));
  logger.gray('='.repeat(80));
  
  logger.info('📊 Test realistic DEX operations across blockchain networks');
  logger.info('⚡ Compare swap costs, slippage, and liquidity efficiency');
  logger.info('🔍 Analyze MEV resistance and price impact patterns');
  logger.gray('='.repeat(80));
}

async function getTestConfiguration() {
  logger.cyan('\n📈 Trading Scenario Options:');
  Object.entries(DEX_SCENARIOS).forEach(([key, desc], index) => {
    logger.info(`${index + 1}. ${desc}`);
  });
  
  const scenarioChoice = await question('\n📊 Scenario [1-4] (default 1): ');
  const scenarioKeys = Object.keys(DEX_SCENARIOS);
  const selectedScenario = scenarioKeys[(parseInt(scenarioChoice) || 1) - 1] || 'swaps';
  
  const operationCount = parseInt(await question('⚡ Number of swap transactions [5]: ')) || 5;
  const swapAmount = await question('💰 Swap amount in ETH [0.001]: ') || '0.001';
  const tokenPair = await question('🎯 Token pair [USDC/USDT]: ') || 'USDC/USDT';
  
  logger.cyan('\n📡 Available Networks:');
  Object.entries(NETWORKS).forEach(([key, name], index) => {
    logger.info(`${index + 1}. ${key} - ${name}`);
  });
  
  const networksInput = await question('\n📡 Networks to test [all]: ') || 'all';
  const networks = networksInput === 'all' ? 
    Object.keys(NETWORKS) : 
    networksInput.split(',').map(n => n.trim());
  
  return {
    scenario: selectedScenario,
    operationCount,
    swapAmount,
    tokenPair,
    networks: networks.filter(n => Object.keys(NETWORKS).includes(n))
  };
}

async function deployDexForTesting(networkName, signer) {
  logger.info(`🏗️ Deploying DEX contracts for ${networkName}...`);
  
  try {
    // Deploy test tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20", signer);
    
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6, 1000000);
    await usdc.deployed();
    
    const usdt = await MockERC20.deploy("Tether USD", "USDT", 6, 1000000);  
    await usdt.deployed();
    
    // Deploy DEX
    const MockDEX = await ethers.getContractFactory("MockDEX", signer);
    const dex = await MockDEX.deploy();
    await dex.deployed();
    
    // Setup trading pair
    await dex.createPair(usdc.address, usdt.address);
    
    // Mint tokens for testing
    const mintAmount = ethers.utils.parseEther('10000');
    await usdc.mintForTesting(signer.address, mintAmount);
    await usdt.mintForTesting(signer.address, mintAmount);
    
    // Add initial liquidity
    const liquidityAmount = ethers.utils.parseEther('1000');
    await usdc.approveMax(dex.address);
    await usdt.approveMax(dex.address);
    
    await dex.addLiquidity(
      usdc.address,
      usdt.address,
      liquidityAmount,
      liquidityAmount
    );
    
    logger.success(`✅ DEX deployed: ${dex.address}`);
    logger.info(`📄 USDC: ${usdc.address}`);
    logger.info(`📄 USDT: ${usdt.address}`);
    
    return {
      dex,
      tokens: { usdc, usdt },
      addresses: {
        dex: dex.address,
        usdc: usdc.address,
        usdt: usdt.address
      }
    };
    
  } catch (error) {
    logger.error(`❌ DEX deployment failed: ${error.message}`);
    throw error;
  }
}

async function executeSwapOperations(dex, tokens, config, networkName, signer) {
  logger.info(`\n🔄 Executing ${config.operationCount} swaps on ${networkName}...`);
  
  const results = {
    successfulSwaps: 0,
    totalGasUsed: 0,
    slippageData: [],
    operationTimes: [],
    gasUsages: []
  };
  
  const swapAmount = ethers.utils.parseEther(config.swapAmount);
  
  for (let i = 0; i < config.operationCount; i++) {
    const swapStartTime = Date.now();
    
    try {
      // Get expected output before swap
      const expectedOut = await dex.getAmountOut(
        tokens.usdc.address,
        tokens.usdt.address,
        swapAmount
      );
      
      // Execute swap
      const tx = await dex.swapTokens(
        tokens.usdc.address,
        tokens.usdt.address,
        swapAmount,
        expectedOut.mul(99).div(100) // 1% slippage tolerance
      );
      
      const receipt = await tx.wait();
      const swapEndTime = Date.now();
      
      // Extract actual output from events
      const swapEvent = receipt.events.find(e => e.event === 'Swap');
      const actualOut = swapEvent ? swapEvent.args.amountOut : expectedOut;
      
      // Record metrics
      defiMetrics.recordGasUsage('dex_swap', networkName, receipt.gasUsed, tx.gasPrice);
      defiMetrics.recordExecutionTime('dex_swap', networkName, swapStartTime, swapEndTime, true);
      defiMetrics.recordSlippage(
        networkName, 
        parseFloat(ethers.utils.formatEther(expectedOut)),
        parseFloat(ethers.utils.formatEther(actualOut)),
        'USDC/USDT'
      );
      
      results.successfulSwaps++;
      results.totalGasUsed += parseInt(receipt.gasUsed.toString());
      results.operationTimes.push(swapEndTime - swapStartTime);
      results.gasUsages.push(parseInt(receipt.gasUsed.toString()));
      
      logger.success(`✅ Swap ${i + 1}/${config.operationCount} completed (${swapEndTime - swapStartTime}ms)`);
      
    } catch (error) {
      const swapEndTime = Date.now();
      logger.error(`❌ Swap ${i + 1} failed: ${error.message}`);
      
      defiMetrics.recordExecutionTime('dex_swap', networkName, swapStartTime, swapEndTime, false);
      defiMetrics.recordFailure('dex_swap', networkName, error.message.split(' ')[0]);
    }
    
    // Small delay between swaps to prevent nonce issues
    if (i < config.operationCount - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

async function runLiquidityTests(dex, tokens, config, networkName, signer) {
  logger.info(`\n💧 Testing liquidity management on ${networkName}...`);
  
  const liquidityAmount = ethers.utils.parseEther(config.swapAmount).mul(10);
  
  try {
    // Add liquidity test
    const addLiquidityStart = Date.now();
    
    const addLiquidityTx = await dex.addLiquidity(
      tokens.usdc.address,
      tokens.usdt.address,
      liquidityAmount,
      liquidityAmount
    );
    
    const addReceipt = await addLiquidityTx.wait();
    const addLiquidityEnd = Date.now();
    
    defiMetrics.recordGasUsage('dex_add_liquidity', networkName, addReceipt.gasUsed, addLiquidityTx.gasPrice);
    defiMetrics.recordExecutionTime('dex_add_liquidity', networkName, addLiquidityStart, addLiquidityEnd, true);
    
    logger.success(`✅ Added liquidity (${addLiquidityEnd - addLiquidityStart}ms, ${addReceipt.gasUsed} gas)`);
    
    // Remove liquidity test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const removeLiquidityStart = Date.now();
    const userLiquidity = await dex.getUserLiquidity(signer.address, tokens.usdc.address, tokens.usdt.address);
    const removeAmount = userLiquidity.div(4); // Remove 25% of liquidity
    
    const removeLiquidityTx = await dex.removeLiquidity(
      tokens.usdc.address,
      tokens.usdt.address,
      removeAmount
    );
    
    const removeReceipt = await removeLiquidityTx.wait();
    const removeLiquidityEnd = Date.now();
    
    defiMetrics.recordGasUsage('dex_remove_liquidity', networkName, removeReceipt.gasUsed, removeLiquidityTx.gasPrice);
    defiMetrics.recordExecutionTime('dex_remove_liquidity', networkName, removeLiquidityStart, removeLiquidityEnd, true);
    
    logger.success(`✅ Removed liquidity (${removeLiquidityEnd - removeLiquidityStart}ms, ${removeReceipt.gasUsed} gas)`);
    
  } catch (error) {
    logger.error(`❌ Liquidity test failed: ${error.message}`);
    defiMetrics.recordFailure('dex_liquidity', networkName, error.message.split(' ')[0]);
  }
}

async function runDexTestOnNetwork(networkName, config) {
  logger.cyan(`\n🌐 Testing DEX operations on ${NETWORKS[networkName] || networkName}...`);
  logger.gray('-'.repeat(60));
  
  try {
    // Setup network connection
    const [signer] = await ethers.getSigners();
    const balance = await signer.getBalance();
    
    logger.info(`👤 Deployer: ${signer.address}`);
    logger.info(`💰 Balance: ${ethers.utils.formatEther(balance)} ${networkName.includes('kasplex') ? 'KAS' : 'ETH'}`);
    
    if (balance.lt(ethers.utils.parseEther('0.05'))) {
      logger.warning('⚠️ Low balance! You may need more funds for testing.');
    }
    
    // Deploy DEX for testing
    const contracts = await deployDexForTesting(networkName, signer);
    
    // Execute swap operations
    const swapResults = await executeSwapOperations(
      contracts.dex,
      contracts.tokens,
      config,
      networkName,
      signer
    );
    
    // Execute liquidity tests if scenario requires it
    if (['liquidity', 'full'].includes(config.scenario)) {
      await runLiquidityTests(
        contracts.dex,
        contracts.tokens,
        config,
        networkName,
        signer
      );
    }
    
    // Network summary
    const avgGasPerSwap = swapResults.totalGasUsed / Math.max(swapResults.successfulSwaps, 1);
    const avgTimePerSwap = swapResults.operationTimes.reduce((sum, time) => sum + time, 0) / Math.max(swapResults.operationTimes.length, 1);
    const successRate = (swapResults.successfulSwaps / config.operationCount) * 100;
    
    logger.cyan(`\n📊 ${networkName.toUpperCase()} RESULTS:`);
    logger.info(`✅ Success Rate: ${successRate.toFixed(1)}%`);
    logger.info(`⛽ Avg Gas per Swap: ${Math.round(avgGasPerSwap)}`);
    logger.info(`⏱️ Avg Time per Swap: ${Math.round(avgTimePerSwap)}ms`);
    logger.info(`🔄 Total Swaps: ${swapResults.successfulSwaps}/${config.operationCount}`);
    
    return {
      networkName,
      contracts: contracts.addresses,
      results: swapResults,
      avgGasPerSwap,
      avgTimePerSwap,
      successRate
    };
    
  } catch (error) {
    logger.error(`❌ Network test failed for ${networkName}: ${error.message}`);
    return {
      networkName,
      error: error.message,
      results: null
    };
  }
}

async function displayDEXComparisonResults(networkResults, config) {
  logger.cyan('\n🏆 DEX PERFORMANCE COMPARISON');
  logger.gray('='.repeat(80));
  
  // Generate detailed comparison
  const validResults = networkResults.filter(r => r.results);
  
  if (validResults.length < 2) {
    logger.warning('⚠️ Need at least 2 successful network tests for comparison');
    return;
  }
  
  // Get detailed metrics comparison
  const metricsComparison = await defiMetrics.compareNetworks('dex_swap', config.networks);
  
  // Display comparison table
  logger.info('\n📊 Cross-Network DEX Metrics:');
  logger.gray('┌─────────────────────┬─────────────────────┬─────────────────────┐');
  logger.gray('│ Metric              │ Network A           │ Network B           │');
  logger.gray('├─────────────────────┼─────────────────────┼─────────────────────┤');
  
  const networks = Object.keys(metricsComparison);
  
  if (networks.length >= 2) {
    const netA = networks[0];
    const netB = networks[1];
    const dataA = metricsComparison[netA];
    const dataB = metricsComparison[netB];
    
    logger.gray('│ Network             │ ' + netA.padEnd(19) + ' │ ' + netB.padEnd(19) + ' │');
    logger.gray('│ Success Rate        │ ' + `${dataA.successRate}%`.padEnd(19) + ' │ ' + `${dataB.successRate}%`.padEnd(19) + ' │');
    logger.gray('│ Avg Gas per Swap    │ ' + `${dataA.gasMetrics.averageGasUsed || 0}`.padEnd(19) + ' │ ' + `${dataB.gasMetrics.averageGasUsed || 0}`.padEnd(19) + ' │');
    logger.gray('│ Throughput (TPS)    │ ' + `${dataA.throughputTPS}`.padEnd(19) + ' │ ' + `${dataB.throughputTPS}`.padEnd(19) + ' │');
    logger.gray('│ Avg Slippage        │ ' + `${dataA.slippage.averageSlippage}%`.padEnd(19) + ' │ ' + `${dataB.slippage.averageSlippage}%`.padEnd(19) + ' │');
    logger.gray('│ USD Cost per Swap   │ ' + `${dataA.usdCost}`.padEnd(19) + ' │ ' + `${dataB.usdCost}`.padEnd(19) + ' │');
    logger.gray('│ Recommendation      │ ' + `${dataA.recommendation}`.padEnd(19) + ' │ ' + `${dataB.recommendation}`.padEnd(19) + ' │');
  }
  
  logger.gray('└─────────────────────┴─────────────────────┴─────────────────────┘');
  
  // Generate comprehensive report
  const report = await defiMetrics.generateReport(config.networks);
  
  logger.cyan('\n💡 RECOMMENDATIONS:');
  report.recommendations.forEach(rec => {
    logger.info(`🏆 ${rec.category}: ${rec.winner} - ${rec.reason}`);
  });
  
  // Display slippage analysis
  logger.cyan('\n📈 SLIPPAGE ANALYSIS:');
  config.networks.forEach(network => {
    const slippageStats = defiMetrics.getSlippageStats(network);
    if (slippageStats.dataPoints > 0) {
      logger.info(`${network}: Avg ${slippageStats.averageSlippage}%, Max ${slippageStats.maxSlippage}% (${slippageStats.dataPoints} swaps)`);
    }
  });
}

async function main() {
  await displayWelcome();
  
  try {
    // Get test configuration
    const config = await getTestConfiguration();
    
    logger.cyan(`\n🚀 Starting DEX testing with scenario: ${DEX_SCENARIOS[config.scenario]}`);
    logger.info(`⚡ Operations per network: ${config.operationCount}`);
    logger.info(`💰 Swap amount: ${config.swapAmount} ETH`);
    logger.info(`🎯 Token pair: ${config.tokenPair}`);
    logger.info(`📡 Networks: ${config.networks.join(', ')}`);
    
    // Reset metrics for clean testing
    defiMetrics.reset();
    
    // Initialize price fetcher
    await priceFetcher.init();
    
    // Run tests on each network
    const networkResults = [];
    
    for (const networkName of config.networks) {
      const result = await runDexTestOnNetwork(networkName, config);
      networkResults.push(result);
      
      // Add delay between networks
      if (config.networks.indexOf(networkName) < config.networks.length - 1) {
        logger.info('\n⏳ Waiting 3 seconds before next network...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Display comparison results
    await displayDEXComparisonResults(networkResults, config);
    
    logger.success('\n🎉 DEX load testing completed successfully!');
    
    logger.cyan('\n🚀 NEXT STEPS:');
    logger.info('1. Run token transfer tests: npm run load-test:defi-tokens');
    logger.info('2. Try different scenarios: liquidity, full, mev');
    logger.info('3. Compare multiple networks for comprehensive analysis');
    logger.info('4. Review slippage data for trading strategy insights');
    
  } catch (error) {
    logger.error(`❌ DEX testing failed: ${error.message}`);
    logger.warning('\n🔧 TROUBLESHOOTING:');
    logger.warning('1. Check network connectivity and RPC endpoints');
    logger.warning('2. Ensure sufficient balance for DEX operations');
    logger.warning('3. Verify DeFi contracts are deployed: npm run deploy:defi-suite');
    logger.warning('4. Check hardhat configuration for selected networks');
  }
  
  rl.close();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };