const { ethers } = require("hardhat");
const { dataStorage } = require('../utils/data-storage');
const { logger } = require('../utils/logger');
const chalk = require('chalk');

/**
 * Comprehensive DeFi Load Testing Suite
 * Tests token operations, DEX trading, and complex DeFi scenarios
 * Captures all data for analytics and sharing
 */

async function main() {
  logger.cyan('\n🚀 COMPREHENSIVE DEFI LOAD TEST SUITE');
  logger.gray('='.repeat(80));
  
  try {
    // Initialize data storage for this session
    await dataStorage.init();
    dataStorage.setTestConfiguration('defi-comprehensive', { 
      networks: ['kasplex'],
      testTypes: ['token_deployment', 'dex_deployment', 'token_operations', 'dex_trading', 'stress_testing'],
      operationCount: 100,
      sessionName: `defi-suite-${Date.now()}`
    });

    logger.info('📊 Initialized data storage and session tracking');

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    logger.info(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);
    logger.info(`👤 Deployer: ${deployer.address}`);
    logger.info(`💰 Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

    // Phase 1: Deploy DeFi Contract Suite
    logger.cyan('\n📋 PHASE 1: DEPLOYING DEFI CONTRACTS');
    logger.gray('-'.repeat(60));
    
    const deployStartTime = Date.now();
    
    // Deploy MockERC20 tokens
    logger.info('🪙 Deploying MockERC20 tokens...');
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    const tokenA = await MockERC20.deploy("TokenA", "TKA", 18, 1000000);
    await tokenA.deployed();
    await dataStorage.recordDeployment(network.name, 'MockERC20-TokenA', {
      address: tokenA.address,
      transactionHash: tokenA.deployTransaction.hash,
      gasUsed: (await tokenA.deployTransaction.wait()).gasUsed.toNumber()
    });
    logger.success(`✅ TokenA deployed: ${tokenA.address}`);

    const tokenB = await MockERC20.deploy("TokenB", "TKB", 18, 1000000);
    await tokenB.deployed();
    await dataStorage.recordDeployment(network.name, 'MockERC20-TokenB', {
      address: tokenB.address,
      transactionHash: tokenB.deployTransaction.hash,
      gasUsed: (await tokenB.deployTransaction.wait()).gasUsed.toNumber()
    });
    logger.success(`✅ TokenB deployed: ${tokenB.address}`);

    // Deploy MockDEX
    logger.info('🏪 Deploying MockDEX...');
    const MockDEX = await ethers.getContractFactory("MockDEX");
    const dex = await MockDEX.deploy();
    await dex.deployed();
    await dataStorage.recordDeployment(network.name, 'MockDEX', {
      address: dex.address,
      transactionHash: dex.deployTransaction.hash,
      gasUsed: (await dex.deployTransaction.wait()).gasUsed.toNumber()
    });
    logger.success(`✅ MockDEX deployed: ${dex.address}`);

    const deployEndTime = Date.now();
    logger.info(`⏱️ Deployment completed in ${deployEndTime - deployStartTime}ms`);

    // Phase 2: Token Operations Load Testing
    logger.cyan('\n📋 PHASE 2: TOKEN OPERATIONS LOAD TESTING');
    logger.gray('-'.repeat(60));

    const tokenTestStartTime = Date.now();
    
    // Mint tokens for testing
    logger.info('🏭 Minting test tokens...');
    const mintAmount = ethers.utils.parseEther("1000000");
    
    const mintTxA = await tokenA.mintForTesting(deployer.address, mintAmount);
    await dataStorage.recordTransaction(network.name, 'token_mint', {
      hash: mintTxA.hash,
      gasUsed: (await mintTxA.wait()).gasUsed.toNumber(),
      gasPrice: mintTxA.gasPrice.toNumber(),
      executionTime: Date.now() - tokenTestStartTime
    });
    
    const mintTxB = await tokenB.mintForTesting(deployer.address, mintAmount);
    await dataStorage.recordTransaction(network.name, 'token_mint', {
      hash: mintTxB.hash,
      gasUsed: (await mintTxB.wait()).gasUsed.toNumber(),
      gasPrice: mintTxB.gasPrice.toNumber(),
      executionTime: Date.now() - tokenTestStartTime
    });
    
    logger.success('✅ Tokens minted successfully');

    // Token transfer operations
    logger.info('💸 Performing token transfer operations...');
    const transferAmount = ethers.utils.parseEther("100");
    const transferOperations = 25;
    
    for (let i = 0; i < transferOperations; i++) {
      const opStart = Date.now();
      
      try {
        const transferTx = await tokenA.transfer(deployer.address, transferAmount);
        const receipt = await transferTx.wait();
        
        await dataStorage.recordTransaction(network.name, 'token_transfer', {
          hash: transferTx.hash,
          gasUsed: receipt.gasUsed.toNumber(),
          gasPrice: transferTx.gasPrice.toNumber(),
          executionTime: Date.now() - opStart,
          status: 1
        });
        
        if (i % 5 === 0) {
          logger.info(`📊 Completed ${i + 1}/${transferOperations} token transfers`);
        }
      } catch (error) {
        await dataStorage.recordError(network.name, 'token_transfer', error.message);
        logger.warning(`⚠️ Transfer ${i + 1} failed: ${error.message.slice(0, 50)}...`);
      }
    }

    const tokenTestEndTime = Date.now();
    logger.success(`✅ Token operations completed in ${tokenTestEndTime - tokenTestStartTime}ms`);

    // Phase 3: DEX Trading Load Testing
    logger.cyan('\n📋 PHASE 3: DEX TRADING LOAD TESTING');
    logger.gray('-'.repeat(60));

    const dexTestStartTime = Date.now();
    
    // Approve DEX to spend tokens
    logger.info('🔓 Approving DEX for token spending...');
    const approveAmount = ethers.utils.parseEther("10000");
    
    const approveATx = await tokenA.approve(dex.address, approveAmount);
    await approveATx.wait();
    const approveBTx = await tokenB.approve(dex.address, approveAmount);
    await approveBTx.wait();
    
    logger.success('✅ DEX approvals completed');

    // Create trading pair first
    logger.info('🔗 Creating trading pair...');
    const createPairTx = await dex.createPair(tokenA.address, tokenB.address);
    await createPairTx.wait();
    logger.success('✅ Trading pair created');

    // Add liquidity
    logger.info('💧 Adding liquidity to DEX...');
    const liquidityAmount = ethers.utils.parseEther("5000");
    const addLiquidityTx = await dex.addLiquidity(tokenA.address, tokenB.address, liquidityAmount, liquidityAmount);
    const liquidityReceipt = await addLiquidityTx.wait();
    
    await dataStorage.recordTransaction(network.name, 'dex_add_liquidity', {
      hash: addLiquidityTx.hash,
      gasUsed: liquidityReceipt.gasUsed.toNumber(),
      gasPrice: addLiquidityTx.gasPrice.toNumber(),
      executionTime: Date.now() - dexTestStartTime
    });
    
    logger.success('✅ Liquidity added successfully');

    // Perform swap operations
    logger.info('🔄 Performing DEX swap operations...');
    const swapAmount = ethers.utils.parseEther("10");
    const swapOperations = 30;
    
    for (let i = 0; i < swapOperations; i++) {
      const opStart = Date.now();
      
      try {
        // Alternate between A->B and B->A swaps
        const swapTx = i % 2 === 0 
          ? await dex.swapTokens(tokenA.address, tokenB.address, swapAmount, 0)
          : await dex.swapTokens(tokenB.address, tokenA.address, swapAmount, 0);
          
        const receipt = await swapTx.wait();
        
        await dataStorage.recordTransaction(network.name, 'dex_swap', {
          hash: swapTx.hash,
          gasUsed: receipt.gasUsed.toNumber(),
          gasPrice: swapTx.gasPrice.toNumber(),
          executionTime: Date.now() - opStart,
          status: 1
        });
        
        if (i % 5 === 0) {
          logger.info(`📊 Completed ${i + 1}/${swapOperations} DEX swaps`);
        }
      } catch (error) {
        await dataStorage.recordError(network.name, 'dex_swap', error.message);
        logger.warning(`⚠️ Swap ${i + 1} failed: ${error.message.slice(0, 50)}...`);
      }
    }

    const dexTestEndTime = Date.now();
    logger.success(`✅ DEX operations completed in ${dexTestEndTime - dexTestStartTime}ms`);

    // Phase 4: Stress Testing
    logger.cyan('\n📋 PHASE 4: STRESS TESTING');
    logger.gray('-'.repeat(60));

    const stressTestStartTime = Date.now();
    logger.info('⚡ Running concurrent transaction stress test...');
    
    const stressOperations = 20;
    const stressPromises = [];
    
    for (let i = 0; i < stressOperations; i++) {
      const promise = (async (index) => {
        const opStart = Date.now();
        try {
          const tx = await tokenA.transfer(deployer.address, ethers.utils.parseEther("1"));
          const receipt = await tx.wait();
          
          await dataStorage.recordTransaction(network.name, 'stress_test_transfer', {
            hash: tx.hash,
            gasUsed: receipt.gasUsed.toNumber(),
            gasPrice: tx.gasPrice.toNumber(),
            executionTime: Date.now() - opStart,
            status: 1
          });
        } catch (error) {
          await dataStorage.recordError(network.name, 'stress_test_transfer', error.message);
          logger.warning(`⚠️ Stress test ${index + 1} failed`);
        }
      })(i);
      
      stressPromises.push(promise);
    }
    
    await Promise.all(stressPromises);
    const stressTestEndTime = Date.now();
    logger.success(`✅ Stress testing completed in ${stressTestEndTime - stressTestStartTime}ms`);

    // Phase 5: Final Analytics and Reporting
    logger.cyan('\n📋 PHASE 5: ANALYTICS AND REPORTING');
    logger.gray('-'.repeat(60));

    const finalMetrics = {
      totalTestDuration: Date.now() - deployStartTime,
      deploymentTime: deployEndTime - deployStartTime,
      tokenTestTime: tokenTestEndTime - tokenTestStartTime,
      dexTestTime: dexTestEndTime - dexTestStartTime,
      stressTestTime: stressTestEndTime - stressTestStartTime,
      networkLatency: await measureNetworkLatency(),
      blockHeight: await ethers.provider.getBlockNumber(),
      gasPriceUsed: (await ethers.provider.getGasPrice()).toString()
    };

    // Finalize the session with metrics
    await dataStorage.finalizeSession(finalMetrics);
    
    logger.success('\n🎉 COMPREHENSIVE DEFI TEST SUITE COMPLETED SUCCESSFULLY!');
    logger.gray('='.repeat(80));
    logger.info(`📊 Total Duration: ${finalMetrics.totalTestDuration}ms`);
    logger.info(`⛽ Average Gas Price: ${ethers.utils.formatUnits(finalMetrics.gasPriceUsed, 'gwei')} gwei`);
    logger.info(`🏁 Final Block Height: ${finalMetrics.blockHeight}`);
    
    // Export data for sharing
    logger.info('\n📤 Exporting test data for sharing...');
    const exportPath = await dataStorage.exportForAnalytics('json', {
      includeRawData: true,
      includeAggregated: true
    });
    logger.success(`✅ Test data exported to: ${exportPath}`);
    
    return {
      success: true,
      metrics: finalMetrics,
      exportPath,
      contracts: {
        tokenA: tokenA.address,
        tokenB: tokenB.address,
        dex: dex.address
      }
    };

  } catch (error) {
    logger.error(`❌ DeFi test suite failed: ${error.message}`);
    await dataStorage.recordError('kasplex', 'suite_failure', error.message);
    
    // Still try to finalize the session with error info
    try {
      await dataStorage.finalizeSession({
        failed: true,
        error: error.message,
        failureTime: Date.now()
      });
    } catch (finalizeError) {
      logger.error(`❌ Failed to finalize error session: ${finalizeError.message}`);
    }
    
    throw error;
  }
}

async function measureNetworkLatency() {
  const start = Date.now();
  await ethers.provider.getBlockNumber();
  return Date.now() - start;
}

// Handle script execution
if (require.main === module) {
  main()
    .then((result) => {
      console.log('\n📋 FINAL RESULTS:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ SUITE FAILED:');
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };