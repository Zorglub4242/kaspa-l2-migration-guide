const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

class NFTTester {
  constructor() {
    this.network = null;
    this.deployer = null;
    this.contracts = {};
    this.results = {
      startTime: new Date(),
      operations: [],
      errors: []
    };
  }

  async initialize() {
    console.log("🔧 Initializing NFT-only test...");
    
    this.network = await ethers.provider.getNetwork();
    const [deployer] = await ethers.getSigners();
    this.deployer = deployer;
    
    console.log(`📡 Network: ${this.network.name} (${this.network.chainId})`);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);
  }

  async deployContractKasplexSafe(contractName, constructorArgs = [], transactionType, maxRetries = 12) {
    console.log(`\n🚀 Deploying ${contractName}...`);
    
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/${maxRetries}`);
        
        if (attempt > 1) {
          // Extra aggressive delays for NFT contracts
          const baseDelay = 2 * 8000 * Math.pow(1.5, attempt - 2);
          const retryDelay = baseDelay + Math.random() * 5000;
          console.log(`   ⏳ Waiting ${Math.round(retryDelay/1000)}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        const contractFactory = await ethers.getContractFactory(contractName);
        let contract;

        if (this.network.chainId === 167012) {
          // Kasplex-specific deployment
          const gasEstimate = await contractFactory.signer.estimateGas(
            contractFactory.getDeployTransaction(...constructorArgs)
          );
          
          const deployTx = await contractFactory.getDeployTransaction(...constructorArgs);
          deployTx.gasPrice = ethers.utils.parseUnits("2000", "gwei");
          deployTx.gasLimit = gasEstimate.mul(120).div(100);
          delete deployTx.nonce; // Let ethers handle nonce automatically
          
          console.log(`   ⛽ Gas estimate: ${gasEstimate.toString()}`);
          console.log(`   💸 Gas price: 2000 Gwei`);
          
          const txResponse = await this.deployer.sendTransaction(deployTx);
          console.log(`   📝 Transaction sent: ${txResponse.hash}`);
          
          // Network stabilization delay
          await new Promise(resolve => setTimeout(resolve, 12000));
          
          const receipt = await txResponse.wait(2);
          console.log(`   ✅ Transaction mined in block ${receipt.blockNumber}`);
          
          contract = contractFactory.attach(receipt.contractAddress);
        } else {
          // Standard deployment for other networks
          contract = await contractFactory.deploy(...constructorArgs);
          await contract.deployed();
        }

        console.log(`   ✅ ${contractName} deployed at: ${contract.address}`);
        
        const explorerUrl = this.network.chainId === 167012 
          ? `https://explorer.testnet.kasplextest.xyz/address/${contract.address}`
          : `https://sepolia.etherscan.io/address/${contract.address}`;
        
        console.log(`   🔗 Explorer: ${explorerUrl}`);

        this.results.operations.push({
          type: 'deployment',
          contract: contractName,
          address: contract.address,
          attempt: attempt,
          success: true,
          explorerUrl: explorerUrl,
          timestamp: new Date().toISOString()
        });

        return contract;
        
      } catch (error) {
        lastError = error;
        console.log(`   ❌ Attempt ${attempt} failed:`, error.message);
        
        if (error.message.includes('orphan')) {
          console.log(`   🔄 Orphan transaction detected, will retry with longer delay`);
        } else if (attempt === maxRetries) {
          throw error;
        }
      }
    }
    
    throw new Error(`Failed to deploy ${contractName} after ${maxRetries} attempts. Last error: ${lastError.message}`);
  }

  async testNFTContract() {
    try {
      console.log("\n🎨 Testing NFT Contract Deployment...");
      
      const nftContract = await this.deployContractKasplexSafe(
        "SimpleNFT", 
        ["Test NFT Collection", "TNFT"], 
        "NFT deployment"
      );
      
      this.contracts.nft = nftContract;
      
      // Test basic NFT functionality
      console.log("\n🧪 Testing NFT operations...");
      
      const mintTx = await nftContract.mint(this.deployer.address, "https://example.com/1");
      const mintReceipt = await mintTx.wait();
      console.log(`   ✅ NFT minted - Token ID: 0`);
      console.log(`   📝 Mint transaction: ${mintTx.hash}`);
      
      const totalSupply = await nftContract.totalSupply();
      console.log(`   📊 Total supply: ${totalSupply.toString()}`);
      
      const owner = await nftContract.ownerOf(0);
      console.log(`   👤 Token 0 owner: ${owner}`);
      
      this.results.operations.push({
        type: 'operation',
        contract: 'SimpleNFT',
        operation: 'mint',
        success: true,
        transactionHash: mintTx.hash,
        timestamp: new Date().toISOString()
      });
      
      return true;
      
    } catch (error) {
      console.log(`❌ NFT test failed:`, error.message);
      this.results.errors.push({
        operation: 'NFT test',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  async generateReport() {
    const endTime = new Date();
    const duration = (endTime - this.results.startTime) / 1000;
    
    const report = {
      testType: 'NFT-only verification',
      network: {
        name: this.network.name,
        chainId: this.network.chainId
      },
      duration: `${duration.toFixed(2)}s`,
      totalOperations: this.results.operations.length,
      successfulOperations: this.results.operations.filter(op => op.success).length,
      errors: this.results.errors.length,
      operations: this.results.operations,
      errors: this.results.errors,
      timestamp: endTime.toISOString()
    };
    
    console.log("\n📊 NFT Test Summary:");
    console.log(`   Duration: ${report.duration}`);
    console.log(`   Operations: ${report.successfulOperations}/${report.totalOperations} successful`);
    console.log(`   Errors: ${report.errors}`);
    
    // Save report
    const reportPath = path.join(__dirname, '../test-results', `nft-verification-${this.network.chainId}-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved to: ${reportPath}`);
    
    return report;
  }
}

async function main() {
  const tester = new NFTTester();
  
  try {
    await tester.initialize();
    const success = await tester.testNFTContract();
    await tester.generateReport();
    
    if (success) {
      console.log("\n🎉 NFT contract deployment and operations VERIFIED SUCCESSFUL!");
      process.exit(0);
    } else {
      console.log("\n💥 NFT test FAILED - contract issues confirmed");
      process.exit(1);
    }
    
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