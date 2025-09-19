const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { SolidityCompiler } = require('../solidity-compiler');
const { isStandardContract, deployStandardContract } = require('../standard-contracts');

class ContractActions {
  constructor(executor) {
    this.executor = executor;
    this.context = executor.context;
    this.resourcePool = executor.resourcePool;
    this.compiler = new SolidityCompiler();
  }

  /**
   * Deploy a contract
   * @param {string} name - Contract instance name
   * @param {string|Object} config - Contract configuration
   */
  async deployContract(name, config) {
    console.log(chalk.gray(`  📦 Deploying contract: ${name}`));

    let contractType, args, from, value;

    if (typeof config === 'string') {
      // Simple format: "ERC20('MyToken', 'MTK', 1000000)"
      const match = config.match(/^(\w+)\((.*)\)$/);
      if (match) {
        contractType = match[1];
        args = match[2] ? await this.parseArguments(match[2]) : [];
      } else {
        contractType = config;
        args = [];
      }
    } else {
      // Object format with detailed config
      contractType = config.type || config.contract;
      args = config.args || [];
      from = config.from;
      value = config.value;
    }

    // Get deployer account
    const deployer = from
      ? await this.context.resolveReference(from)
      : this.context.getAccount('deployer') || this.context.accounts.values().next().value;

    if (!deployer) {
      throw new Error('No deployer account available');
    }

    let contract;

    // Check if it's a Solidity contract
    if (contractType === 'Solidity' || config.source?.endsWith('.sol')) {
      // Pass the full config object for Solidity compilation
      contract = await this.deployCustomContract(config, args, deployer, value);
    }
    // Check if it's a standard contract type
    else if (isStandardContract(contractType)) {
      const networkConfig = this.executor.networkConfig;
      contract = await deployStandardContract(contractType, args, deployer, networkConfig);
    } else {
      // Custom contract - load from ABI/bytecode
      contract = await this.deployCustomContract(contractType, args, deployer, value);
    }

    // Store contract in context
    this.context.setContract(name, contract);
    this.context.setVariable(`${name}_address`, contract.address);

    console.log(chalk.green(`    ✓ Deployed ${name} at ${contract.address}`));

    // Store deployment in TestResult for database persistence
    if (this.executor.testResult && contract.deployTransaction) {
      await this.executor.testResult.addResult(`deploy_${name}`, true, {
        transactionHash: contract.deployTransaction.hash,
        contractAddress: contract.address,
        contractType: contractType,
        gasUsed: contract.deployTransaction.gasLimit,
        from: deployer.address
      });
    }

    return contract;
  }

  /**
   * Execute contract deployment action
   * @param {Object} deployConfig - Deployment configuration
   */
  async executeDeploy(deployConfig) {
    const { name, contract, args, from, value } = deployConfig;

    const deployedContract = await this.deployContract(name, {
      type: contract,
      args,
      from,
      value
    });

    // Return the contract address for the returns variable
    return deployedContract.address;
  }

  /**
   * Execute a contract call
   * @param {Object} callConfig - Call configuration
   */
  async executeCall(callConfig) {
    const { contract: contractRef, method, args = [], from, value, expect } = callConfig;

    // Resolve contract reference
    const contract = await this.resolveContract(contractRef);

    console.log(chalk.gray(`  📞 Calling ${contractRef}.${method}(${args.join(', ')})`));

    // Resolve arguments
    const resolvedArgs = [];
    for (const arg of args) {
      resolvedArgs.push(await this.context.resolveReference(arg));
    }

    // Prepare call options
    const options = {};
    if (from) {
      const signer = await this.context.resolveReference(from);
      options.from = signer.address || signer;
    }
    if (value) {
      const { amount } = this.context.parseAmount(value);
      options.value = amount;
    }

    // Add gas configuration from network config for state-changing transactions
    const networkConfig = this.executor.networkConfig;
    if (networkConfig && networkConfig.gasConfig) {
      try {
        const { GasManager } = require('../gas-manager');
        const gasManager = new GasManager(networkConfig, this.context.provider);
        const gasPrice = await gasManager.getGasPrice();
        options.gasPrice = gasPrice;

        // For networks with gas estimation issues, use a fixed gas limit
        if (networkConfig.gasConfig.strategy === 'fixed') {
          options.gasLimit = 150000; // Standard gas limit for contract calls
        }
      } catch (error) {
        console.log(`  ⚠️ Failed to get gas price from network config for contract call: ${error.message}`);
      }
    }

    // Check if we're expecting a revert
    const expectedValue = expect !== undefined ? await this.context.resolveReference(expect) : undefined;
    const expectingRevert = expectedValue === 'REVERT' || expectedValue === 'FAIL';

    try {
      let result;

      // Check if it's a view function or state-changing transaction
      if (contract.interface.getFunction(method).constant) {
        // View function - just call
        result = await contract[method](...resolvedArgs);
        console.log(chalk.gray(`     Result: ${JSON.stringify(result)}`));
      } else {
        // State-changing - send transaction
        const signer = from ? await this.context.resolveReference(from) : contract.signer;
        const contractWithSigner = contract.connect(signer);

        const tx = await contractWithSigner[method](...resolvedArgs, options);
        console.log(chalk.gray(`     Tx: ${tx.hash}`));

        const receipt = await tx.wait();
        console.log(chalk.green(`     ✓ Confirmed in block ${receipt.blockNumber}`));

        // Record gas used
        this.context.setVariable('_lastGasUsed', receipt.gasUsed.toString());
        this.context.setVariable('_lastTxHash', receipt.transactionHash);

        if (this.executor.testResult) {
          this.executor.testResult.addGasUsed(receipt.gasUsed);
        }

        result = receipt;
      }

      // If we expected a revert but it succeeded, that's an error
      if (expectingRevert) {
        throw new Error(`Expected transaction to revert but it succeeded`);
      }

      // Check other expectations
      if (expect !== undefined && !expectingRevert) {
        if (JSON.stringify(result) !== JSON.stringify(expectedValue)) {
          throw new Error(`Expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(result)}`);
        }
        console.log(chalk.green(`     ✓ Result matches expected value`));
      }

      // Record result
      this.context.addResult({
        action: 'call',
        contract: contract.address,
        method,
        args: resolvedArgs,
        result: result?.hash || result,
        success: true
      });

      // Store call in TestResult for database persistence
      if (this.executor.testResult) {
        const isTransaction = result && result.hash;
        await this.executor.testResult.addResult(`call_${method}`, true, {
          transactionHash: isTransaction ? result.hash : undefined,
          contractAddress: contract.address,
          method: method,
          gasUsed: isTransaction && result.gasUsed ? result.gasUsed : 0
        });
      }

      return result;

    } catch (error) {
      // If we expected a revert and got one, that's success
      if (expectingRevert && (error.message.includes('revert') || error.message.includes('execution reverted'))) {
        console.log(chalk.green(`     ✓ Transaction reverted as expected`));

        this.context.addResult({
          action: 'call',
          contract: contract.address,
          method,
          args: resolvedArgs,
          revertedAsExpected: true,
          success: true
        });

        return { reverted: true, reason: error.message };
      }

      // Otherwise it's a real error
      console.error(chalk.red(`     ✗ Call failed: ${error.message}`));

      this.context.addResult({
        action: 'call',
        contract: contract.address,
        method,
        args: resolvedArgs,
        error: error.message,
        success: false
      });

      throw error;
    }
  }

  /**
   * Deploy a custom contract from ABI/bytecode or Solidity source
   * @param {string} pathOrName - Path to contract JSON, .sol file, or contract name
   * @param {Array} args - Constructor arguments
   * @param {Object} deployer - Deployer account
   * @param {string} value - ETH value to send
   */
  async deployCustomContract(pathOrName, args, deployer, value) {
    let contractData;
    let config = {};

    // Check if it's a config object for Solidity
    if (typeof pathOrName === 'object' && pathOrName.source) {
      config = pathOrName;
      pathOrName = config.source;
    }

    // Check if it's a Solidity file
    if (pathOrName.endsWith('.sol') || config.type === 'Solidity') {
      // Compile Solidity contract
      try {
        contractData = await this.compiler.compile(
          pathOrName,
          config.contract || config.contractName,
          {
            optimizer: config.optimizer,
            runs: config.runs,
            solc_version: config.solc_version || config.solcVersion,
            imports: config.imports,
            verbose: this.executor.options.verbose
          }
        );

        // Link libraries if specified
        if (config.libraries) {
          contractData.bytecode = this.compiler.linkLibraries(
            contractData.bytecode,
            config.libraries
          );
        }
      } catch (error) {
        throw new Error(`Solidity compilation failed: ${error.message}`);
      }
    }
    // Check if it's a JSON artifact
    else if (pathOrName.endsWith('.json') || pathOrName.endsWith('.abi')) {
      const fullPath = path.resolve(pathOrName);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`Contract file not found: ${fullPath}`);
      }

      const fileContent = fs.readFileSync(fullPath, 'utf8');
      contractData = JSON.parse(fileContent);
    } else {
      // Try to load from artifacts directory
      const artifactPaths = [
        `./artifacts/contracts/${pathOrName}.sol/${pathOrName}.json`,
        `./contracts/${pathOrName}.json`,
        `./build/contracts/${pathOrName}.json`
      ];

      for (const artifactPath of artifactPaths) {
        if (fs.existsSync(artifactPath)) {
          const fileContent = fs.readFileSync(artifactPath, 'utf8');
          contractData = JSON.parse(fileContent);
          break;
        }
      }

      if (!contractData) {
        throw new Error(`Contract artifact not found: ${pathOrName}`);
      }
    }

    // Extract ABI and bytecode
    const abi = contractData.abi || contractData;
    const bytecode = contractData.bytecode || contractData.data || contractData.deployedBytecode;

    if (!abi) {
      throw new Error(`No ABI found in contract data`);
    }
    if (!bytecode || bytecode === '0x') {
      throw new Error(`No bytecode found in contract data`);
    }

    // Deploy contract
    const factory = new ethers.ContractFactory(abi, bytecode, deployer);

    const deployOptions = {};
    if (value) {
      const { amount } = this.context.parseAmount(value);
      deployOptions.value = amount;
    }

    // Estimate gas if needed
    if (config.estimateGas) {
      const estimatedGas = await factory.estimateGas.deploy(...args, deployOptions);
      console.log(chalk.gray(`    ⛽ Estimated gas: ${estimatedGas.toString()}`));
      deployOptions.gasLimit = estimatedGas.mul(120).div(100); // Add 20% buffer
    }

    const contract = await factory.deploy(...args, deployOptions);
    await contract.deployed();

    return contract;
  }

  /**
   * Resolve a contract reference
   * @param {string} ref - Contract reference
   * @returns {Object} Contract instance
   */
  async resolveContract(ref) {
    // Check if it's already a contract object
    if (typeof ref === 'object' && ref.address) {
      return ref;
    }

    // Check context for named contract
    const contract = this.context.getContract(ref);
    if (contract) {
      return contract;
    }

    // Check if it's an address - try to find a deployed contract with this address
    if (ethers.utils.isAddress(ref)) {
      // Search through all contracts to find one with this address
      for (const [name, contract] of this.context.contracts.entries()) {
        if (contract.address.toLowerCase() === ref.toLowerCase()) {
          return contract;
        }
      }
      // If not found, throw error
      throw new Error(`Cannot interact with contract at ${ref} without ABI`);
    }

    // Try to resolve as variable
    const resolved = await this.context.resolveReference(ref);
    if (resolved && resolved.address) {
      return resolved;
    }

    throw new Error(`Cannot resolve contract: ${ref}`);
  }


  /**
   * Parse constructor arguments from string
   * @param {string} argsStr - Arguments string
   * @returns {Array} Parsed arguments
   */
  async parseArguments(argsStr) {
    const args = [];
    const parts = this.splitArguments(argsStr);

    for (const part of parts) {
      const trimmed = part.trim();

      // Remove quotes if present
      if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
          (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        args.push(trimmed.slice(1, -1));
      } else if (/^\d+$/.test(trimmed)) {
        args.push(parseInt(trimmed));
      } else if (/^\d*\.\d+$/.test(trimmed)) {
        args.push(parseFloat(trimmed));
      } else if (trimmed === 'true' || trimmed === 'false') {
        args.push(trimmed === 'true');
      } else {
        // Try to resolve as reference
        const resolved = await this.context.resolveReference(trimmed);
        args.push(resolved !== undefined ? resolved : trimmed);
      }
    }

    return args;
  }

  /**
   * Split arguments string respecting nested parentheses and quotes
   * @param {string} str - Arguments string
   * @returns {Array} Split arguments
   */
  splitArguments(str) {
    const args = [];
    let current = '';
    let depth = 0;
    let inQuotes = false;
    let quoteChar = null;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = null;
        current += char;
      } else if (char === '(' && !inQuotes) {
        depth++;
        current += char;
      } else if (char === ')' && !inQuotes) {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0 && !inQuotes) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    return args;
  }

  /**
   * Get contract state variable
   * @param {string} contractRef - Contract reference
   * @param {string} property - Property name
   * @returns {any} Property value
   */
  async getState(contractRef, property) {
    const contract = await this.resolveContract(contractRef);

    if (typeof contract[property] === 'function') {
      return await contract[property]();
    }

    return contract[property];
  }

  /**
   * Load contract at address with ABI
   * @param {string} name - Contract instance name
   * @param {string} address - Contract address
   * @param {string} abiPath - Path to ABI file
   */
  async loadContract(name, address, abiPath) {
    console.log(chalk.gray(`  📄 Loading contract ${name} at ${address}`));

    const fullPath = path.resolve(abiPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`ABI file not found: ${fullPath}`);
    }

    const abiContent = fs.readFileSync(fullPath, 'utf8');
    const abi = JSON.parse(abiContent).abi || JSON.parse(abiContent);

    const provider = this.context.provider;
    const contract = new ethers.Contract(address, abi, provider);

    // Connect to first available signer
    const signer = this.context.accounts.values().next().value;
    if (signer) {
      contract = contract.connect(signer);
    }

    this.context.setContract(name, contract);
    this.context.setVariable(`${name}_address`, address);

    console.log(chalk.green(`    ✓ Loaded ${name}`));
    return contract;
  }
}

module.exports = { ContractActions };