#!/usr/bin/env node

const { ethers } = require("hardhat");
const { program } = require('commander');
const { EVMCompatibilityTester } = require('../lib/evm-test-runner');

program
  .name('evm-test-unified')
  .description('Unified EVM compatibility testing tool')
  .version('1.0.0');

program
  .command('standard')
  .description('Run standard EVM compatibility tests')
  .action(async () => {
    await runTests('standard');
  });

program
  .command('sequential')
  .description('Run tests sequentially with detailed logging')
  .action(async () => {
    await runTests('sequential');
  });

program
  .command('parallel')
  .description('Run tests in parallel for speed')
  .action(async () => {
    await runTests('parallel');
  });

program
  .command('diversified')
  .description('Run diversified test scenarios including stress tests')
  .action(async () => {
    await runTests('diversified');
  });

program
  .command('precompiles-only')
  .description('Test only precompiled contracts')
  .action(async () => {
    await runPrecompilesOnly();
  });

program
  .command('assembly-only')
  .description('Test only assembly operations')
  .action(async () => {
    await runAssemblyOnly();
  });

program
  .command('create2-only')
  .description('Test only CREATE2 functionality')
  .action(async () => {
    await runCREATE2Only();
  });

async function runTests(mode) {
  console.log(`🧪 Starting EVM Compatibility Tests - ${mode} mode`);
  
  try {
    const network = await ethers.provider.getNetwork();
    const tester = new EVMCompatibilityTester(network);
    
    await tester.initialize();
    const results = await tester.runAllTests(mode);
    
    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `evm-${mode}-${network.chainId}-${timestamp}.json`;
    await results.save(filename);
    
    console.log('\n🎉 EVM compatibility tests completed successfully!');
    
  } catch (error) {
    console.error('❌ EVM compatibility tests failed:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function runPrecompilesOnly() {
  console.log('🔧 Testing Precompiled Contracts Only');
  
  try {
    const network = await ethers.provider.getNetwork();
    const tester = new EVMCompatibilityTester(network);
    
    await tester.initialize();
    
    const addresses = tester.getContractAddresses();
    const gasPrice = await tester.gasManager.getGasPrice();
    
    await tester.testPrecompiles(addresses.precompileTest, gasPrice);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `evm-precompiles-only-${network.chainId}-${timestamp}.json`;
    await tester.results.save(filename);
    
    tester.printTestSummary();
    
  } catch (error) {
    console.error('❌ Precompile tests failed:', error.message);
    process.exit(1);
  }
}

async function runAssemblyOnly() {
  console.log('⚙️ Testing Assembly Operations Only');
  
  try {
    const network = await ethers.provider.getNetwork();
    const tester = new EVMCompatibilityTester(network);
    
    await tester.initialize();
    
    const addresses = tester.getContractAddresses();
    const gasPrice = await tester.gasManager.getGasPrice();
    
    await tester.testAssemblyOperations(addresses.assemblyTest, gasPrice);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `evm-assembly-only-${network.chainId}-${timestamp}.json`;
    await tester.results.save(filename);
    
    tester.printTestSummary();
    
  } catch (error) {
    console.error('❌ Assembly tests failed:', error.message);
    process.exit(1);
  }
}

async function runCREATE2Only() {
  console.log('🏭 Testing CREATE2 Functionality Only');
  
  try {
    const network = await ethers.provider.getNetwork();
    const tester = new EVMCompatibilityTester(network);
    
    await tester.initialize();
    
    const addresses = tester.getContractAddresses();
    const gasPrice = await tester.gasManager.getGasPrice();
    
    await tester.testCREATE2Functionality(addresses.create2Factory, gasPrice);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `evm-create2-only-${network.chainId}-${timestamp}.json`;
    await tester.results.save(filename);
    
    tester.printTestSummary();
    
  } catch (error) {
    console.error('❌ CREATE2 tests failed:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  program.parse();
}