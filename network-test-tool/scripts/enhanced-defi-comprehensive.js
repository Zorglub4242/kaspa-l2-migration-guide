const { ethers } = require("hardhat");
const { dataStorage } = require('../utils/data-storage');
const { logger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Enhanced Comprehensive DeFi Load Testing Suite
 * - Full address reporting (no truncation)
 * - Detailed transaction tracking with explorer links
 * - Comprehensive metrics (TPS, costs, timing)
 * - Multi-network comparison ready
 */

class EnhancedReporter {
  constructor() {
    this.transactions = [];
    this.contracts = {};
    this.startTime = Date.now();
    this.metrics = {
      gasUsed: 0,
      transactionCount: 0,
      costs: 0,
      blockCount: 0
    };
  }

  recordTransaction(type, hash, gasUsed, gasPrice, address = null) {
    const tx = {
      type,
      hash,
      gasUsed,
      gasPrice: gasPrice.toString(),
      gasCost: (gasUsed * gasPrice).toString(),
      timestamp: new Date().toISOString(),
      address,
      explorerLink: this.getExplorerLink(hash)
    };
    
    this.transactions.push(tx);
    this.metrics.gasUsed += gasUsed;
    this.metrics.transactionCount++;
    this.metrics.costs += gasUsed * gasPrice;
    
    logger.info(`📝 TX Recorded: ${type} | Hash: ${hash} | Gas: ${gasUsed.toLocaleString()}`);
  }

  getExplorerLink(hash) {
    const network = process.env.NETWORK || 'local';
    const explorers = {
      'sepolia': `https://sepolia.etherscan.io/tx/${hash}`,
      'kasplex': `https://explorer.kasplex.org/tx/${hash}`,
      'ethereum': `https://etherscan.io/tx/${hash}`,
      'local': `Local Network - Hash: ${hash}`
    };
    return explorers[network] || explorers.local;
  }

  async generateReport(network, sessionId) {
    const duration = Date.now() - this.startTime;
    const tps = this.metrics.transactionCount / (duration / 1000);
    
    const report = {
      metadata: {
        sessionId,
        network: network.name,
        chainId: network.chainId.toString(),
        timestamp: new Date().toISOString(),
        testDuration: `${duration}ms`,
        transactionsPerSecond: tps.toFixed(2)
      },
      contracts: this.contracts,
      performance: {
        totalTransactions: this.metrics.transactionCount,
        totalGasUsed: this.metrics.gasUsed.toLocaleString(),
        averageGasPerTx: Math.round(this.metrics.gasUsed / this.metrics.transactionCount).toLocaleString(),
        totalDuration: duration,
        tps: tps.toFixed(2)
      },
      transactions: this.transactions,
      summary: {
        deployments: this.transactions.filter(tx => tx.type.includes('deploy')).length,
        tokenOperations: this.transactions.filter(tx => tx.type.includes('token')).length,
        dexOperations: this.transactions.filter(tx => tx.type.includes('dex')).length,
        successRate: '100%'
      }
    };

    // Save detailed report
    const reportPath = path.join(process.cwd(), 'test-results', 'enhanced-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Generate markdown summary
    await this.generateMarkdownSummary(report);
    
    return report;
  }

  async generateMarkdownSummary(report) {
    const markdown = `# 🚀 Enhanced DeFi Load Test Results

## 📊 Test Summary
- **Network**: ${report.metadata.network} (Chain ID: ${report.metadata.chainId})
- **Session**: ${report.metadata.sessionId}
- **Duration**: ${report.metadata.testDuration}
- **TPS**: ${report.metadata.transactionsPerSecond} transactions/second

## 📋 Contract Deployments

| Contract | Full Address | Transaction Hash | Gas Used | Explorer Link |
|----------|--------------|------------------|----------|---------------|
${Object.entries(this.contracts).map(([name, data]) => 
  `| **${name}** | \`${data.address}\` | \`${data.hash}\` | ${data.gasUsed.toLocaleString()} | [View](${data.explorerLink}) |`
).join('\n')}

## 📊 Performance Metrics

- **Total Transactions**: ${report.performance.totalTransactions}
- **Total Gas Used**: ${report.performance.totalGasUsed}
- **Average Gas/TX**: ${report.performance.averageGasPerTx}
- **Throughput**: ${report.performance.tps} TPS

## 📝 All Transactions

| # | Type | Hash | Gas Used | Explorer Link |
|---|------|------|----------|---------------|
${this.transactions.map((tx, i) => 
  `| ${i+1} | ${tx.type} | \`${tx.hash}\` | ${tx.gasUsed.toLocaleString()} | [View](${tx.explorerLink}) |`
).join('\n')}

---
*Generated: ${new Date().toISOString()}*
*Enhanced Blockchain Load Tester v1.1*
`;

    const markdownPath = path.join(process.cwd(), 'test-results', 'ENHANCED-REPORT.md');
    await fs.writeFile(markdownPath, markdown);
  }
}

async function main() {
  const reporter = new EnhancedReporter();
  
  logger.cyan('\n🚀 ENHANCED COMPREHENSIVE DEFI LOAD TEST SUITE');
  logger.gray('='.repeat(80));
  
  try {
    // Initialize data storage
    await dataStorage.init();
    dataStorage.setTestConfiguration('enhanced-defi-comprehensive', { 
      networks: ['current'],
      testTypes: ['deployment', 'token_ops', 'dex_ops', 'stress_test'],
      enhanced: true
    });

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    logger.info(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);
    logger.info(`👤 Deployer: ${deployer.address}`);
    logger.info(`💰 Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

    // Phase 1: Contract Deployments
    logger.cyan('\n📋 PHASE 1: CONTRACT DEPLOYMENTS');
    logger.gray('-'.repeat(60));
    
    const deployStartTime = Date.now();
    
    // Deploy MockERC20 TokenA
    logger.info('🪙 Deploying MockERC20 TokenA...');
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const tokenA = await MockERC20.deploy("TokenA", "TKA", 18, 1000000);
    const tokenAReceipt = await tokenA.deployTransaction.wait();
    
    reporter.recordTransaction(
      'contract_deploy_tokenA', 
      tokenA.deployTransaction.hash, 
      tokenAReceipt.gasUsed.toNumber(),
      tokenA.deployTransaction.gasPrice,
      tokenA.address
    );
    reporter.contracts['TokenA'] = {
      address: tokenA.address,
      hash: tokenA.deployTransaction.hash,
      gasUsed: tokenAReceipt.gasUsed.toNumber(),
      explorerLink: reporter.getExplorerLink(tokenA.deployTransaction.hash)
    };
    
    logger.success(`✅ TokenA: ${tokenA.address}`);

    // Deploy MockERC20 TokenB
    logger.info('🪙 Deploying MockERC20 TokenB...');
    const tokenB = await MockERC20.deploy("TokenB", "TKB", 18, 1000000);
    const tokenBReceipt = await tokenB.deployTransaction.wait();
    
    reporter.recordTransaction(
      'contract_deploy_tokenB', 
      tokenB.deployTransaction.hash, 
      tokenBReceipt.gasUsed.toNumber(),
      tokenB.deployTransaction.gasPrice,
      tokenB.address
    );
    reporter.contracts['TokenB'] = {
      address: tokenB.address,
      hash: tokenB.deployTransaction.hash,
      gasUsed: tokenBReceipt.gasUsed.toNumber(),
      explorerLink: reporter.getExplorerLink(tokenB.deployTransaction.hash)
    };
    
    logger.success(`✅ TokenB: ${tokenB.address}`);

    // Deploy MockDEX
    logger.info('🏪 Deploying MockDEX...');
    const MockDEX = await ethers.getContractFactory("MockDEX");
    const dex = await MockDEX.deploy();
    const dexReceipt = await dex.deployTransaction.wait();
    
    reporter.recordTransaction(
      'contract_deploy_dex', 
      dex.deployTransaction.hash, 
      dexReceipt.gasUsed.toNumber(),
      dex.deployTransaction.gasPrice,
      dex.address
    );
    reporter.contracts['MockDEX'] = {
      address: dex.address,
      hash: dex.deployTransaction.hash,
      gasUsed: dexReceipt.gasUsed.toNumber(),
      explorerLink: reporter.getExplorerLink(dex.deployTransaction.hash)
    };
    
    logger.success(`✅ MockDEX: ${dex.address}`);
    logger.info(`⏱️ Deployment phase: ${Date.now() - deployStartTime}ms`);

    // Phase 2: Token Operations
    logger.cyan('\n📋 PHASE 2: TOKEN OPERATIONS');
    logger.gray('-'.repeat(60));
    
    const tokenStartTime = Date.now();
    
    // Mint tokens
    logger.info('🏭 Minting tokens...');
    const mintAmount = ethers.utils.parseEther("1000000");
    
    const mintTxA = await tokenA.mintForTesting(deployer.address, mintAmount);
    const mintReceiptA = await mintTxA.wait();
    reporter.recordTransaction('token_mint_A', mintTxA.hash, mintReceiptA.gasUsed.toNumber(), mintTxA.gasPrice);
    
    const mintTxB = await tokenB.mintForTesting(deployer.address, mintAmount);
    const mintReceiptB = await mintTxB.wait();
    reporter.recordTransaction('token_mint_B', mintTxB.hash, mintReceiptB.gasUsed.toNumber(), mintTxB.gasPrice);
    
    // Token transfers
    logger.info('💸 Performing token transfers...');
    const transferAmount = ethers.utils.parseEther("100");
    const transfers = 10; // Reduced for cleaner reporting
    
    for (let i = 0; i < transfers; i++) {
      const transferTx = await tokenA.transfer(tokenB.address, transferAmount);
      const transferReceipt = await transferTx.wait();
      reporter.recordTransaction(`token_transfer_${i+1}`, transferTx.hash, transferReceipt.gasUsed.toNumber(), transferTx.gasPrice);
      
      if (i % 5 === 4) {
        logger.info(`📊 Completed ${i + 1}/${transfers} transfers`);
      }
    }
    
    logger.success(`✅ Token operations: ${Date.now() - tokenStartTime}ms`);

    // Phase 3: DEX Operations
    logger.cyan('\n📋 PHASE 3: DEX OPERATIONS');
    logger.gray('-'.repeat(60));
    
    const dexStartTime = Date.now();
    
    // Approve DEX
    logger.info('🔓 Approving DEX...');
    const approveAmount = ethers.utils.parseEther("10000");
    
    const approveATx = await tokenA.approve(dex.address, approveAmount);
    const approveAReceipt = await approveATx.wait();
    reporter.recordTransaction('dex_approve_A', approveATx.hash, approveAReceipt.gasUsed.toNumber(), approveATx.gasPrice);
    
    const approveBTx = await tokenB.approve(dex.address, approveAmount);
    const approveBReceipt = await approveBTx.wait();
    reporter.recordTransaction('dex_approve_B', approveBTx.hash, approveBReceipt.gasUsed.toNumber(), approveBTx.gasPrice);

    // Create pair
    logger.info('🔗 Creating trading pair...');
    const createPairTx = await dex.createPair(tokenA.address, tokenB.address);
    const createPairReceipt = await createPairTx.wait();
    reporter.recordTransaction('dex_create_pair', createPairTx.hash, createPairReceipt.gasUsed.toNumber(), createPairTx.gasPrice);

    // Add liquidity
    logger.info('💧 Adding liquidity...');
    const liquidityAmount = ethers.utils.parseEther("5000");
    const addLiquidityTx = await dex.addLiquidity(tokenA.address, tokenB.address, liquidityAmount, liquidityAmount);
    const liquidityReceipt = await addLiquidityTx.wait();
    reporter.recordTransaction('dex_add_liquidity', addLiquidityTx.hash, liquidityReceipt.gasUsed.toNumber(), addLiquidityTx.gasPrice);

    // Swap operations
    logger.info('🔄 Performing swaps...');
    const swapAmount = ethers.utils.parseEther("10");
    const swaps = 10; // Reduced for cleaner reporting
    
    for (let i = 0; i < swaps; i++) {
      const swapTx = i % 2 === 0 
        ? await dex.swapTokens(tokenA.address, tokenB.address, swapAmount, 0)
        : await dex.swapTokens(tokenB.address, tokenA.address, swapAmount, 0);
        
      const swapReceipt = await swapTx.wait();
      reporter.recordTransaction(`dex_swap_${i+1}`, swapTx.hash, swapReceipt.gasUsed.toNumber(), swapTx.gasPrice);
      
      if (i % 5 === 4) {
        logger.info(`📊 Completed ${i + 1}/${swaps} swaps`);
      }
    }
    
    logger.success(`✅ DEX operations: ${Date.now() - dexStartTime}ms`);

    // Generate comprehensive report
    logger.cyan('\n📋 GENERATING ENHANCED REPORT');
    logger.gray('-'.repeat(60));
    
    const finalReport = await reporter.generateReport(network, dataStorage.currentSession?.sessionId);
    
    logger.success('🎉 ENHANCED TEST SUITE COMPLETED!');
    logger.info(`📊 Total Duration: ${finalReport.performance.totalDuration}ms`);
    logger.info(`🚀 Throughput: ${finalReport.performance.tps} TPS`);
    logger.info(`⛽ Total Gas: ${finalReport.performance.totalGasUsed}`);
    logger.info(`📁 Report saved: test-results/ENHANCED-REPORT.md`);
    
    // Save console output
    const consolePath = path.join(process.cwd(), 'test-results', 'console-output.log');
    await fs.writeFile(consolePath, `Enhanced DeFi Test Completed Successfully\nSee enhanced-report.json for full details\n`);

  } catch (error) {
    logger.error(`❌ Test failed: ${error.message}`);
    throw error;
  }
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