const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class OperationsOnlyTester {
  constructor() {
    this.network = null;
    this.deployer = null;
    this.contracts = {};
    this.results = {
      startTime: new Date(),
      operations: [],
      errors: [],
      totalGasUsed: 0,
      totalCostTokens: 0
    };
  }

  async initialize() {
    console.log("🔧 Initializing Operations-Only Test (Reusing Deployed Contracts)...");
    
    this.network = await ethers.provider.getNetwork();
    const [deployer] = await ethers.getSigners();
    this.deployer = deployer;
    
    console.log(`📡 Network: ${this.network.name} (${this.network.chainId})`);
    console.log(`👤 Deployer: ${deployer.address}`);
    
    const initialBalance = await deployer.getBalance();
    this.initialBalance = initialBalance;
    console.log(`💰 Initial Balance: ${ethers.utils.formatEther(initialBalance)} ${this.getTokenSymbol()}`);
  }

  getTokenSymbol() {
    return this.network.chainId === 167012 ? 'KAS' : 'ETH';
  }

  async loadExistingContracts() {
    console.log("\n📖 Loading existing deployed contracts from .env...");
    
    // Determine network prefix based on chain ID
    let networkPrefix;
    if (this.network.chainId === 167012) {
      networkPrefix = 'KASPLEX';
    } else if (this.network.chainId === 11155111) {
      networkPrefix = 'SEPOLIA';
    } else if (this.network.chainId === 1) {
      networkPrefix = 'MAINNET';
    } else {
      throw new Error(`Unsupported network chainId: ${this.network.chainId}`);
    }
    
    // Load addresses from environment variables
    const addresses = {
      tokenA: process.env[`${networkPrefix}_TOKEN_A`],
      tokenB: process.env[`${networkPrefix}_TOKEN_B`],
      rewardToken: process.env[`${networkPrefix}_REWARD_TOKEN`],
      dex: process.env[`${networkPrefix}_DEX`],
      lending: process.env[`${networkPrefix}_LENDING`],
      yieldFarm: process.env[`${networkPrefix}_YIELD_FARM`],
      nft: process.env[`${networkPrefix}_NFT`],
      multisig: process.env[`${networkPrefix}_MULTISIG`]
    };
    
    // Check if all required addresses are available
    const missingAddresses = [];
    Object.entries(addresses).forEach(([key, address]) => {
      if (!address || address === '') {
        missingAddresses.push(`${networkPrefix}_${key.toUpperCase()}`);
      }
    });
    
    if (missingAddresses.length > 0) {
      console.log(`❌ Missing contract addresses in .env file:`);
      missingAddresses.forEach(addr => console.log(`   - ${addr}`));
      throw new Error('Please add the missing contract addresses to .env file');
    }
    
    console.log(`   ✅ TokenA: ${addresses.tokenA}`);
    console.log(`   ✅ TokenB: ${addresses.tokenB}`);
    console.log(`   ✅ RewardToken: ${addresses.rewardToken}`);
    console.log(`   ✅ DEX: ${addresses.dex}`);
    console.log(`   ✅ Lending: ${addresses.lending}`);
    console.log(`   ✅ YieldFarm: ${addresses.yieldFarm}`);

    // Attach to contract instances using the correct contract names
    this.contracts.tokenA = await ethers.getContractAt("MockERC20", addresses.tokenA);
    this.contracts.tokenB = await ethers.getContractAt("MockERC20", addresses.tokenB);
    this.contracts.rewardToken = await ethers.getContractAt("MockERC20", addresses.rewardToken);
    this.contracts.dex = await ethers.getContractAt("MockDEX", addresses.dex);
    this.contracts.lending = await ethers.getContractAt("MockLendingProtocol", addresses.lending);
    this.contracts.yieldFarm = await ethers.getContractAt("MockYieldFarm", addresses.yieldFarm);

    console.log(`✅ All 6 contracts loaded successfully from .env!`);
    return true;
  }

  async executeKasplexSafeTransaction(contract, methodName, args = [], description, gasLimit = null) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   🔄 ${description} (attempt ${attempt}/${maxRetries})`);
        
        if (attempt > 1) {
          const delay = 5000 * attempt;
          console.log(`   ⏳ Waiting ${delay/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        let tx;
        if (args.length === 0) {
          tx = await contract[methodName]();
        } else {
          tx = await contract[methodName](...args);
        }

        const receipt = await tx.wait();
        const gasCost = receipt.gasUsed.mul(tx.gasPrice || ethers.utils.parseUnits("2000", "gwei"));
        
        console.log(`   ✅ ${description} - Gas: ${receipt.gasUsed.toString()}`);
        console.log(`   📝 Tx: ${tx.hash}`);
        
        const operation = {
          type: methodName,
          description: description,
          hash: tx.hash,
          gasUsed: receipt.gasUsed.toString(),
          gasCost: gasCost.toString(),
          success: true,
          attempt: attempt,
          timestamp: new Date().toISOString()
        };
        
        this.results.operations.push(operation);
        this.results.totalGasUsed += parseInt(receipt.gasUsed.toString());
        
        return { tx, receipt };
        
      } catch (error) {
        lastError = error;
        console.log(`   ❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          this.results.errors.push({
            operation: description,
            error: error.message,
            attempts: maxRetries,
            timestamp: new Date().toISOString()
          });
          throw error;
        }
      }
    }
  }

  async performTokenOperations() {
    console.log("\n🪙 Testing Token Operations...");
    
    try {
      // Token transfers
      await this.executeKasplexSafeTransaction(
        this.contracts.tokenA, 
        'transfer', 
        [this.deployer.address, ethers.utils.parseEther("100")],
        "Transfer TokenA"
      );

      await this.executeKasplexSafeTransaction(
        this.contracts.tokenB, 
        'transfer', 
        [this.deployer.address, ethers.utils.parseEther("100")],
        "Transfer TokenB"
      );

      // Check balances
      const balanceA = await this.contracts.tokenA.balanceOf(this.deployer.address);
      const balanceB = await this.contracts.tokenB.balanceOf(this.deployer.address);
      
      console.log(`   💰 TokenA Balance: ${ethers.utils.formatEther(balanceA)}`);
      console.log(`   💰 TokenB Balance: ${ethers.utils.formatEther(balanceB)}`);
      
      return true;
    } catch (error) {
      console.log("❌ Token operations failed:", error.message);
      return false;
    }
  }

  async performDEXOperations() {
    console.log("\n🏪 Testing DEX Operations...");
    
    try {
      // Approve tokens for DEX
      await this.executeKasplexSafeTransaction(
        this.contracts.tokenA,
        'approve',
        [this.contracts.dex.address, ethers.utils.parseEther("1000")],
        "Approve TokenA for DEX"
      );

      await this.executeKasplexSafeTransaction(
        this.contracts.tokenB,
        'approve', 
        [this.contracts.dex.address, ethers.utils.parseEther("1000")],
        "Approve TokenB for DEX"
      );

      // Perform swaps
      await this.executeKasplexSafeTransaction(
        this.contracts.dex,
        'swapAforB',
        [ethers.utils.parseEther("10")],
        "Swap A for B"
      );

      await this.executeKasplexSafeTransaction(
        this.contracts.dex,
        'swapBforA', 
        [ethers.utils.parseEther("5")],
        "Swap B for A"
      );
      
      return true;
    } catch (error) {
      console.log("❌ DEX operations failed:", error.message);
      return false;
    }
  }

  async performLendingOperations() {
    console.log("\n🏦 Testing Lending Operations...");
    
    try {
      // Supply liquidity first
      await this.executeKasplexSafeTransaction(
        this.contracts.tokenB,
        'approve',
        [this.contracts.lending.address, ethers.utils.parseEther("1000")], 
        "Approve TokenB for Lending"
      );

      await this.executeKasplexSafeTransaction(
        this.contracts.lending,
        'supply',
        [this.contracts.tokenB.address, ethers.utils.parseEther("500")],
        "Supply TokenB to Lending"
      );

      // Deposit collateral
      await this.executeKasplexSafeTransaction(
        this.contracts.tokenA,
        'approve',
        [this.contracts.lending.address, ethers.utils.parseEther("1000")],
        "Approve TokenA for Lending"
      );

      await this.executeKasplexSafeTransaction(
        this.contracts.lending,
        'deposit', 
        [this.contracts.tokenA.address, ethers.utils.parseEther("200")],
        "Deposit TokenA as collateral"
      );

      // Borrow
      await this.executeKasplexSafeTransaction(
        this.contracts.lending,
        'borrow',
        [this.contracts.tokenB.address, ethers.utils.parseEther("50")],
        "Borrow TokenB"
      );

      return true;
    } catch (error) {
      console.log("❌ Lending operations failed:", error.message);
      return false;
    }
  }

  async performYieldOperations() {
    console.log("\n🌾 Testing Yield Farming Operations...");
    
    try {
      // Fund rewards
      await this.executeKasplexSafeTransaction(
        this.contracts.rewardToken,
        'approve',
        [this.contracts.yieldFarm.address, ethers.utils.parseEther("1000")],
        "Approve Reward Token for Yield Farm"
      );

      await this.executeKasplexSafeTransaction(
        this.contracts.yieldFarm,
        'fundRewards',
        [ethers.utils.parseEther("100")],
        "Fund Yield Farm Rewards"
      );

      // Stake tokens
      await this.executeKasplexSafeTransaction(
        this.contracts.tokenA,
        'approve',
        [this.contracts.yieldFarm.address, ethers.utils.parseEther("1000")],
        "Approve TokenA for Staking"
      );

      await this.executeKasplexSafeTransaction(
        this.contracts.yieldFarm,
        'stake', 
        [0, ethers.utils.parseEther("100")],
        "Stake TokenA in Pool 0"
      );

      return true;
    } catch (error) {
      console.log("❌ Yield farming operations failed:", error.message);
      return false;
    }
  }

  async calculateRealCosts() {
    const endBalance = await this.deployer.getBalance();
    const totalSpent = this.initialBalance.sub(endBalance);
    
    this.results.totalCostTokens = parseFloat(ethers.utils.formatEther(totalSpent));
    
    console.log(`\n💰 Real Cost Analysis:`);
    console.log(`   Initial: ${ethers.utils.formatEther(this.initialBalance)} ${this.getTokenSymbol()}`);
    console.log(`   Final: ${ethers.utils.formatEther(endBalance)} ${this.getTokenSymbol()}`);
    console.log(`   Total Spent: ${ethers.utils.formatEther(totalSpent)} ${this.getTokenSymbol()}`);
    console.log(`   Operations: ${this.results.operations.length}`);
    console.log(`   Cost per Op: ${(this.results.totalCostTokens / this.results.operations.length).toFixed(6)} ${this.getTokenSymbol()}`);
  }

  async generateReport() {
    const endTime = new Date();
    const duration = (endTime - this.results.startTime) / 1000;
    
    const report = {
      testType: 'Operations-only (reusing deployed contracts)',
      network: {
        name: this.network.name || `Chain ${this.network.chainId}`,
        chainId: this.network.chainId,
        tokenSymbol: this.getTokenSymbol()
      },
      duration: `${duration.toFixed(2)}s`,
      totalOperations: this.results.operations.length,
      successfulOperations: this.results.operations.filter(op => op.success).length,
      errors: this.results.errors.length,
      realWorldCosts: {
        totalTokens: this.results.totalCostTokens,
        tokenSymbol: this.getTokenSymbol(),
        costPerOperation: this.results.totalCostTokens / this.results.operations.length,
        note: "These are actual wallet costs from real transactions"
      },
      operations: this.results.operations,
      errors: this.results.errors,
      timestamp: endTime.toISOString()
    };
    
    console.log(`\n📊 Test Summary:`);
    console.log(`   Duration: ${report.duration}`);
    console.log(`   Operations: ${report.successfulOperations}/${report.totalOperations} successful`);
    console.log(`   Real Cost: ${report.realWorldCosts.totalTokens.toFixed(6)} ${report.realWorldCosts.tokenSymbol}`);
    console.log(`   Errors: ${report.errors}`);
    
    // Save report
    const reportPath = path.join(__dirname, '../test-results', `operations-only-${this.network.chainId}-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved to: ${reportPath}`);
    
    return report;
  }
}

async function main() {
  const tester = new OperationsOnlyTester();
  
  try {
    await tester.initialize();
    await tester.loadExistingContracts();
    
    console.log("\n🚀 Starting Operations-Only Test Cycle...");
    
    const results = await Promise.allSettled([
      tester.performTokenOperations(),
      tester.performDEXOperations(),
      tester.performLendingOperations(), 
      tester.performYieldOperations()
    ]);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    console.log(`\n✅ ${successful}/${results.length} protocol categories completed successfully`);
    
    await tester.calculateRealCosts();
    const report = await tester.generateReport();
    
    console.log("\n🎉 Operations-only test completed!");
    console.log(`📄 Real wallet cost: ${report.realWorldCosts.totalTokens.toFixed(6)} ${report.realWorldCosts.tokenSymbol}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error("💥 Test failed:", error.message);
    await tester.generateReport();
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}