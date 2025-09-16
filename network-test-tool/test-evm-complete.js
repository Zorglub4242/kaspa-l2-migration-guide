#!/usr/bin/env node
require('dotenv').config();
const ethers = require('ethers');
const chalk = require('chalk');

async function runCompleteEVMTest() {
  console.log(chalk.cyan('\n🧪 Complete EVM Compatibility Test for Igra L2\n'));

  const provider = new ethers.providers.JsonRpcProvider('https://caravel.igralabs.com:8545');
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // Contract addresses from deployment
  const contracts = {
    precompile: '0xa9C38f0Ce06d6FA66E102f1bf0823343542Bd226',
    assembly: '0xce9f51C9E55aB562a85568716C278ed62F6A3C75',
    create2: '0xA6fCd6d318dE053e6D25c9d3dEE79f1DB87CaE0D'
  };

  const gasPrice = ethers.utils.parseUnits('2000', 'gwei');
  const results = [];

  // Test 1: Precompiles
  console.log(chalk.blue('📦 Testing Precompiles...'));
  const precompileABI = [
    'function testEcrecover() public returns (address)',
    'function testSha256(bytes calldata) external returns (bytes32)',
    'function testRipemd160(bytes calldata) external returns (bytes20)',
    'function testModExp() external returns (bytes memory)',
    'function testIdentity(bytes calldata) external returns (bytes memory)'
  ];
  const precompileContract = new ethers.Contract(contracts.precompile, precompileABI, signer);

  const precompileTests = [
    { name: 'ecrecover', method: 'testEcrecover', args: [] },
    { name: 'sha256', method: 'testSha256', args: [ethers.utils.toUtf8Bytes('Hello Kasplex')] },
    { name: 'ripemd160', method: 'testRipemd160', args: [ethers.utils.toUtf8Bytes('Hello Kasplex')] },
    { name: 'modexp', method: 'testModExp', args: [] },
    { name: 'identity', method: 'testIdentity', args: [ethers.utils.toUtf8Bytes('Test data')] }
  ];

  for (const test of precompileTests) {
    try {
      process.stdout.write(`  ${test.name}... `);
      const tx = await precompileContract[test.method](...test.args, { gasPrice, gasLimit: 3000000 });
      const receipt = await tx.wait();
      console.log(chalk.green(`✅ (gas: ${receipt.gasUsed.toString()})`));
      results.push({ test: test.name, status: 'pass', gas: receipt.gasUsed.toString() });
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message.slice(0, 50)}`));
      results.push({ test: test.name, status: 'fail', error: err.message });
    }
  }

  // Test 2: Assembly Operations
  console.log(chalk.blue('\n⚙️ Testing Assembly Operations...'));
  const assemblyABI = [
    'function testBasicAssembly() external returns (uint256)',
    'function testMemoryOperations() external returns (bytes32)',
    'function testStorageAccess() external returns (uint256)',
    'function testCallDataOperations() external returns (uint256)'
  ];
  const assemblyContract = new ethers.Contract(contracts.assembly, assemblyABI, signer);

  const assemblyTests = [
    { name: 'basic-ops', method: 'testBasicAssembly' },
    { name: 'memory-ops', method: 'testMemoryOperations' },
    { name: 'storage-ops', method: 'testStorageAccess' },
    { name: 'call-ops', method: 'testCallDataOperations' }
  ];

  for (const test of assemblyTests) {
    try {
      process.stdout.write(`  ${test.name}... `);
      const tx = await assemblyContract[test.method]({ gasPrice, gasLimit: 3000000 });
      const receipt = await tx.wait();
      console.log(chalk.green(`✅ (gas: ${receipt.gasUsed.toString()})`));
      results.push({ test: test.name, status: 'pass', gas: receipt.gasUsed.toString() });
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message.slice(0, 50)}`));
      results.push({ test: test.name, status: 'fail', error: err.message });
    }
  }

  // Test 3: CREATE2
  console.log(chalk.blue('\n🏭 Testing CREATE2...'));
  const create2ABI = ['function deployContract(bytes32 salt, bytes calldata bytecode) external returns (address)'];
  const create2Contract = new ethers.Contract(contracts.create2, create2ABI, signer);

  try {
    process.stdout.write('  create2-deploy... ');
    const salt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test' + Date.now()));
    const bytecode = ethers.utils.formatBytes32String('TestContract');
    const tx = await create2Contract.deployContract(salt, bytecode, { gasPrice, gasLimit: 3000000 });
    const receipt = await tx.wait();
    console.log(chalk.green(`✅ (gas: ${receipt.gasUsed.toString()})`));
    results.push({ test: 'create2-deploy', status: 'pass', gas: receipt.gasUsed.toString() });
  } catch (err) {
    console.log(chalk.red(`❌ ${err.message.slice(0, 50)}`));
    results.push({ test: 'create2-deploy', status: 'fail', error: err.message });
  }

  // Summary
  console.log(chalk.cyan('\n📊 Test Summary'));
  console.log('='.repeat(50));
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  console.log(`Total Tests: ${results.length}`);
  console.log(chalk.green(`Passed: ${passed}`));
  console.log(chalk.red(`Failed: ${failed}`));
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log(chalk.yellow('\nFailed Tests:'));
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  - ${r.test}: ${r.error.slice(0, 100)}`);
    });
  }

  console.log(chalk.green('\n✨ Test complete!'));
  process.exit(failed > 0 ? 1 : 0);
}

runCompleteEVMTest().catch(err => {
  console.error(chalk.red('Fatal error:'), err.message);
  process.exit(1);
});