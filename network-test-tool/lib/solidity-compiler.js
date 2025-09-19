const solc = require('solc');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const axios = require('axios');

class SolidityCompiler {
  constructor(options = {}) {
    this.options = {
      optimizer: options.optimizer || false,
      runs: options.runs || 200,
      evmVersion: options.evmVersion || 'london',
      ...options
    };

    this.cache = new Map();
  }

  /**
   * Compile Solidity source code
   * @param {string} sourcePath - Path to .sol file or source code
   * @param {string} contractName - Specific contract to extract
   * @param {Object} options - Compilation options
   * @returns {Object} Compiled contract data
   */
  async compile(sourcePath, contractName, options = {}) {
    const compileOptions = { ...this.options, ...options };

    // Check cache
    const cacheKey = `${sourcePath}-${contractName}-${JSON.stringify(compileOptions)}`;
    if (this.cache.has(cacheKey)) {
      console.log(chalk.gray(`  📦 Using cached compilation for ${contractName}`));
      return this.cache.get(cacheKey);
    }

    console.log(chalk.gray(`  🔨 Compiling ${contractName || 'contract'} from ${sourcePath}`));

    let sourceCode;
    let fileName;

    // Check if it's a file path or inline source
    if (sourcePath.endsWith('.sol') && fs.existsSync(sourcePath)) {
      sourceCode = fs.readFileSync(sourcePath, 'utf8');
      fileName = path.basename(sourcePath);
    } else if (sourcePath.startsWith('http')) {
      // Fetch from URL
      const response = await axios.get(sourcePath);
      sourceCode = response.data;
      fileName = 'Contract.sol';
    } else {
      // Treat as inline source code
      sourceCode = sourcePath;
      fileName = 'Contract.sol';
    }

    // Prepare input for solc
    const input = {
      language: 'Solidity',
      sources: {
        [fileName]: {
          content: sourceCode
        }
      },
      settings: {
        optimizer: {
          enabled: compileOptions.optimizer,
          runs: compileOptions.runs
        },
        evmVersion: compileOptions.evmVersion,
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'evm.gasEstimates']
          }
        }
      }
    };

    // Set up import callback for resolving imports
    const findImports = (importPath) => {
      console.log(chalk.gray(`    📚 Resolving import: ${importPath}`));

      // Try to resolve the import
      const resolved = this.resolveImport(importPath, path.dirname(sourcePath), compileOptions.imports);

      if (resolved) {
        return { contents: resolved };
      }

      return { error: `Import "${importPath}" not found` };
    };

    // Compile
    let output;
    try {
      // Check if we need a specific compiler version
      if (compileOptions.solc_version || compileOptions.solcVersion) {
        const version = compileOptions.solc_version || compileOptions.solcVersion;
        const compiler = await this.loadCompilerVersion(version);
        output = JSON.parse(compiler.compile(JSON.stringify(input), { import: findImports }));
      } else {
        // Use default compiler
        output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
      }
    } catch (error) {
      throw new Error(`Compilation failed: ${error.message}`);
    }

    // Check for errors
    if (output.errors) {
      const errors = output.errors.filter(e => e.severity === 'error');
      const warnings = output.errors.filter(e => e.severity === 'warning');

      if (warnings.length > 0) {
        console.log(chalk.yellow(`  ⚠️ ${warnings.length} warnings`));
        if (compileOptions.verbose) {
          warnings.forEach(w => console.log(chalk.yellow(`    ${w.formattedMessage}`)));
        }
      }

      if (errors.length > 0) {
        console.error(chalk.red(`  ❌ ${errors.length} compilation errors`));
        errors.forEach(e => console.error(chalk.red(`    ${e.formattedMessage}`)));
        throw new Error('Compilation failed with errors');
      }
    }

    // Extract contract data
    let contractData;

    if (!output.contracts || !output.contracts[fileName]) {
      throw new Error(`No contracts found in ${fileName}`);
    }

    const contracts = output.contracts[fileName];

    if (contractName) {
      // Get specific contract
      if (!contracts[contractName]) {
        const available = Object.keys(contracts).join(', ');
        throw new Error(`Contract "${contractName}" not found. Available: ${available}`);
      }
      contractData = this.extractContractData(contracts[contractName]);
    } else {
      // Get the first/main contract
      const mainContract = Object.values(contracts)[0];
      contractData = this.extractContractData(mainContract);
    }

    // Cache the result
    this.cache.set(cacheKey, contractData);

    console.log(chalk.green(`    ✓ Compilation successful`));
    return contractData;
  }

  /**
   * Extract contract data from compilation output
   * @param {Object} contract - Compiled contract object
   * @returns {Object} Contract data with ABI and bytecode
   */
  extractContractData(contract) {
    return {
      abi: contract.abi,
      bytecode: '0x' + contract.evm.bytecode.object,
      deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
      gasEstimates: contract.evm.gasEstimates
    };
  }

  /**
   * Resolve import paths
   * @param {string} importPath - Import path from Solidity file
   * @param {string} baseDir - Base directory for relative imports
   * @param {Object} importMappings - Custom import mappings
   * @returns {string|null} Resolved file content
   */
  resolveImport(importPath, baseDir, importMappings = {}) {
    // Check custom mappings first
    for (const [key, value] of Object.entries(importMappings)) {
      if (importPath.startsWith(key)) {
        const mappedPath = importPath.replace(key, value);
        if (fs.existsSync(mappedPath)) {
          return fs.readFileSync(mappedPath, 'utf8');
        }
      }
    }

    // Try common locations
    const attempts = [
      // Relative to source file
      path.join(baseDir, importPath),
      // Node modules
      path.join(process.cwd(), 'node_modules', importPath),
      // Common contract locations
      path.join(process.cwd(), 'contracts', importPath),
      path.join(process.cwd(), 'src', importPath),
      // Direct path
      importPath
    ];

    for (const attemptPath of attempts) {
      if (fs.existsSync(attemptPath)) {
        return fs.readFileSync(attemptPath, 'utf8');
      }

      // Try with .sol extension
      const withSol = attemptPath + '.sol';
      if (fs.existsSync(withSol)) {
        return fs.readFileSync(withSol, 'utf8');
      }
    }

    // Try to fetch from OpenZeppelin or other known sources
    if (importPath.startsWith('@openzeppelin/')) {
      return this.fetchOpenZeppelinContract(importPath);
    }

    return null;
  }

  /**
   * Fetch OpenZeppelin contracts
   * @param {string} importPath - OpenZeppelin import path
   * @returns {string|null} Contract source code
   */
  fetchOpenZeppelinContract(importPath) {
    // Map to installed package
    const localPath = path.join(
      process.cwd(),
      'node_modules',
      importPath.endsWith('.sol') ? importPath : importPath + '.sol'
    );

    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath, 'utf8');
    }

    console.log(chalk.yellow(`    ⚠️ Could not resolve OpenZeppelin import: ${importPath}`));
    console.log(chalk.yellow(`    💡 Try: npm install @openzeppelin/contracts`));

    return null;
  }

  /**
   * Load specific Solidity compiler version
   * @param {string} version - Compiler version
   * @returns {Object} Compiler instance
   */
  async loadCompilerVersion(version) {
    console.log(chalk.gray(`    📥 Loading Solidity compiler v${version}`));

    // This would normally use solc-js loadRemoteVersion
    // For now, use the installed version
    console.log(chalk.yellow(`    ⚠️ Using installed compiler (version-specific loading not implemented)`));
    return solc;
  }

  /**
   * Compile multiple contracts from a source file
   * @param {string} sourcePath - Path to .sol file
   * @param {Object} options - Compilation options
   * @returns {Object} All compiled contracts
   */
  async compileAll(sourcePath, options = {}) {
    console.log(chalk.gray(`  🔨 Compiling all contracts from ${sourcePath}`));

    const sourceCode = fs.readFileSync(sourcePath, 'utf8');
    const fileName = path.basename(sourcePath);

    const input = {
      language: 'Solidity',
      sources: {
        [fileName]: {
          content: sourceCode
        }
      },
      settings: {
        optimizer: {
          enabled: options.optimizer || false,
          runs: options.runs || 200
        },
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode']
          }
        }
      }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
      const errors = output.errors.filter(e => e.severity === 'error');
      if (errors.length > 0) {
        throw new Error(`Compilation failed: ${errors[0].formattedMessage}`);
      }
    }

    const contracts = {};

    if (output.contracts && output.contracts[fileName]) {
      for (const [name, contract] of Object.entries(output.contracts[fileName])) {
        contracts[name] = this.extractContractData(contract);
      }
    }

    return contracts;
  }

  /**
   * Estimate deployment gas
   * @param {Object} contractData - Compiled contract data
   * @param {Array} constructorArgs - Constructor arguments
   * @returns {number} Estimated gas
   */
  estimateDeploymentGas(contractData, constructorArgs = []) {
    if (!contractData.gasEstimates) {
      return 3000000; // Default estimate
    }

    const creation = contractData.gasEstimates.creation;
    if (!creation) {
      return 3000000;
    }

    // Base deployment cost + execution cost
    const totalGas = (creation.codeDepositCost || 0) + (creation.executionCost || 0);

    // Add some buffer for constructor arguments
    const buffer = constructorArgs.length * 20000;

    return totalGas + buffer;
  }

  /**
   * Link libraries to bytecode
   * @param {string} bytecode - Contract bytecode
   * @param {Object} libraries - Library addresses
   * @returns {string} Linked bytecode
   */
  linkLibraries(bytecode, libraries) {
    let linkedBytecode = bytecode;

    for (const [name, address] of Object.entries(libraries)) {
      // Libraries are referenced by placeholder in bytecode
      // Format: __$<library hash>$__
      const placeholder = `__\\$${this.libraryHashPlaceholder(name)}\\$__`;
      const regex = new RegExp(placeholder, 'g');

      // Remove 0x prefix from address and pad
      const cleanAddress = address.replace('0x', '').toLowerCase();
      linkedBytecode = linkedBytecode.replace(regex, cleanAddress);
    }

    return linkedBytecode;
  }

  /**
   * Generate library hash placeholder
   * @param {string} libraryName - Library name
   * @returns {string} Hash placeholder
   */
  libraryHashPlaceholder(libraryName) {
    // This is a simplified version
    // Real implementation would use keccak256 hash
    return libraryName.slice(0, 34).padEnd(34, '0');
  }

  /**
   * Clear compilation cache
   */
  clearCache() {
    this.cache.clear();
    console.log(chalk.gray('  🧹 Compilation cache cleared'));
  }
}

module.exports = { SolidityCompiler };