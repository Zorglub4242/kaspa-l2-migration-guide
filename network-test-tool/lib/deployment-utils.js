const ethers = require('ethers');
const fs = require('fs').promises;
const path = require('path');
const { GasManager } = require('./gas-manager');
const { getNetworkConfig } = require('./networks');

class DeploymentUtils {
  constructor(network, signer) {
    console.log(`🔍 DeploymentUtils constructor called`);
    console.log(`🔍 Network: ${network.name} (${network.chainId})`);
    console.log(`🔍 Network has RPC:`, !!network.rpc);
    console.log(`🔍 Signer provider network:`, {
      chainId: signer.provider?.network?.chainId,
      name: signer.provider?.network?.name
    });
    
    this.signer = signer;
    // Handle both ethers network objects and our config objects
    if (network.chainId && network.name && !network.rpc) {
      // It's an ethers network object
      console.log(`🔍 Detected as ethers network object`);
      this.network = network;
      this.config = getNetworkConfig(network.chainId);

      if (!this.config) {
        console.log(`🔍 Could not find config for chainId ${network.chainId}, trying by name...`);
        this.config = getNetworkConfig(network.name.toLowerCase());
      }

      if (!this.config) {
        console.log(`❌ Could not find network config for chainId ${network.chainId} or name ${network.name}`);
        throw new Error(`Network configuration not found for chainId ${network.chainId} or name ${network.name}`);
      }
    } else if (network.chainId && network.rpc) {
      // It's our config object
      console.log(`🔍 Detected as our config object`);
      this.config = network;
      this.network = { chainId: network.chainId, name: network.name };
    } else {
      console.log(`❌ Invalid network object - missing required properties`);
      console.log(`🔍 Has chainId:`, !!network.chainId);
      console.log(`🔍 Has name:`, !!network.name);
      console.log(`🔍 Has rpc:`, !!network.rpc);
      throw new Error('Invalid network object provided to DeploymentUtils');
    }
    
    console.log(`🔍 Final this.network: ${this.network.name} (${this.network.chainId})`);
    console.log(`🔍 Final this.config: ${this.config.name} (${this.config.chainId})`);

    // Initialize GasManager with the full config object instead of simplified network object
    this.gasManager = new GasManager(this.config, signer.provider);
    this.deployments = new Map();
    console.log(`✅ DeploymentUtils constructor completed`);
  }

  async deployContract(contractName, constructorArgs = [], options = {}) {
    const startTime = Date.now();
    console.log(`🚀 Deploying ${contractName} on ${this.config.name}...`);
    
    try {
      // Try Hardhat's getContractFactory first, fallback to manual contract factory
      let contractFactory;
      try {
        contractFactory = await ethers.getContractFactory(contractName, this.signer);
      } catch (error) {
        // In CLI context, create contract factory manually from artifacts
        const fs = require('fs');
        const path = require('path');
        
        const artifactPath = path.join(__dirname, '../artifacts/contracts', `${contractName}.sol`, `${contractName}.json`);
        if (!fs.existsSync(artifactPath)) {
          throw new Error(`Contract artifact not found: ${artifactPath}. Please run 'npm run compile' first.`);
        }
        
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        contractFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, this.signer);
      }
      let gasPrice;
      let gasLimit;

      // Network-specific gas handling
      if (this.config.chainId === 19416) { // Igra L2
        gasPrice = ethers.utils.parseUnits("2000", "gwei"); // Exactly 2000 gwei required for Igra

        // Gas limits based on complexity level
        const gasComplexity = options.gasComplexity || 'simple';
        const gasLimits = {
          simple: 2000000,      // 2M gas for tokens, basic contracts
          complex: 3000000,     // 3M gas for NFT, MultiSig, DEX
          veryComplex: 4000000  // 4M gas for advanced contracts
        };

        gasLimit = options.gasLimit || gasLimits[gasComplexity] || gasLimits.simple;
      } else {
        gasPrice = await this.gasManager.getGasPrice();
        gasLimit = options.gasLimit || 5000000;
      }

      const deploymentOverrides = {
        gasPrice,
        gasLimit,
        ...options.overrides
      };

      // Network-specific deployment logic
      if (this.config.chainId === 167012) { // Kasplex
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (this.config.chainId === 19416) { // Igra
        console.log(`💰 Using fixed gas price for Igra L2: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay for Igra
      }

      const contract = await contractFactory.deploy(...constructorArgs, deploymentOverrides);
      
      console.log(`⏳ Waiting for ${contractName} deployment transaction...`);
      const receipt = await this.gasManager.waitForTransaction(contract.deployTransaction);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      const totalCost = receipt.gasUsed.mul(gasPrice);
      
      const deployment = {
        name: contractName,
        address: contract.address,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: gasPrice.toString(),
        deployedAt: new Date().toISOString(),
        constructorArgs,
        network: {
          name: this.config.name,
          chainId: this.config.chainId
        }
      };

      this.deployments.set(contractName, deployment);
      
      console.log(`✅ ${contractName} deployed at: ${contract.address}`);
      console.log(`🔗 Explorer: ${this.config.explorer.address(contract.address)}`);
      
      // Return enhanced result structure for database recording
      const deploymentResult = {
        success: true,
        contractName: contractName,
        contractAddress: contract.address,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: gasPrice.toString(),
        totalCost: parseFloat(ethers.utils.formatEther(totalCost)), // Convert Wei to Ether as float
        executionTime: executionTime,
        deployerAddress: await this.signer.getAddress(),
        constructorArgs: constructorArgs,
        contract: contract,
        deployment: deployment
      };
      
      return deploymentResult;
    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      console.error(`❌ Failed to deploy ${contractName}:`, error.message);
      
      // Return failed deployment result for database recording
      return {
        success: false,
        contractName: contractName,
        error: error.message,
        executionTime: executionTime,
        gasUsed: 0,
        gasPrice: 0,
        totalCost: 0
      };
    }
  }

  async saveDeployments(filename) {
    const deploymentData = {
      network: {
        name: this.config.name,
        chainId: this.config.chainId
      },
      timestamp: new Date().toISOString(),
      deployments: Object.fromEntries(this.deployments)
    };

    const filePath = path.join('deployments', filename || `deployment-${this.config.chainId}-${Date.now()}.json`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(deploymentData, null, 2));
    
    console.log(`💾 Deployments saved to: ${filePath}`);
    return filePath;
  }

  async loadDeployments(filename) {
    try {
      const filePath = path.join('deployments', filename);
      const data = await fs.readFile(filePath, 'utf8');
      const deploymentData = JSON.parse(data);
      
      for (const [name, deployment] of Object.entries(deploymentData.deployments)) {
        this.deployments.set(name, deployment);
      }
      
      console.log(`📂 Loaded deployments from: ${filePath}`);
      return deploymentData;
    } catch (error) {
      console.warn(`⚠️ Could not load deployments from ${filename}:`, error.message);
      return null;
    }
  }

  getDeployment(contractName) {
    return this.deployments.get(contractName);
  }

  async getContract(contractName, address) {
    if (!address) {
      const deployment = this.getDeployment(contractName);
      if (!deployment) {
        throw new Error(`No deployment found for ${contractName}`);
      }
      address = deployment.address;
    }
    
    // Try Hardhat's getContractAt first, fallback to manual contract instantiation
    try {
      return await ethers.getContractAt(contractName, address, this.signer);
    } catch (error) {
      // In CLI context, create contract instance manually from artifacts
      const fs = require('fs');
      const path = require('path');
      
      const artifactPath = path.join(__dirname, '../artifacts/contracts', `${contractName}.sol`, `${contractName}.json`);
      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Contract artifact not found: ${artifactPath}. Please run 'npm run compile' first.`);
      }
      
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      return new ethers.Contract(address, artifact.abi, this.signer);
    }
  }

  async verifyDeployment(contractName, expectedAddress) {
    const deployment = this.getDeployment(contractName);
    if (!deployment) {
      throw new Error(`No deployment found for ${contractName}`);
    }
    
    if (expectedAddress && deployment.address !== expectedAddress) {
      throw new Error(`Address mismatch for ${contractName}: expected ${expectedAddress}, got ${deployment.address}`);
    }
    
    try {
      const contract = await this.getContract(contractName);
      const code = await this.signer.provider.getCode(contract.address);
      
      if (code === '0x') {
        throw new Error(`No contract code found at ${contract.address}`);
      }
      
      console.log(`✅ ${contractName} verified at ${contract.address}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to verify ${contractName}:`, error.message);
      return false;
    }
  }

  async executeWithRetry(operation, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === retries - 1) throw error;
        
        console.warn(`⚠️ Attempt ${i + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Exponential backoff
      }
    }
  }
}

module.exports = { DeploymentUtils };