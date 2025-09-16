require('dotenv').config();
const ethers = require('ethers');
const { EVMCompatibilityTester } = require('./lib/evm-test-runner');

async function testDirectly() {
  try {
    console.log('🧪 Testing EVM runner directly on Igra');

    // Setup network config
    const network = {
      name: 'Igra L2',
      chainId: 19416,
      symbol: 'IKAS',
      rpc: 'https://caravel.igralabs.com:8545',
      gasConfig: {
        strategy: 'fixed',
        required: ethers.utils.parseUnits('2000', 'gwei')
      }
    };

    // Create provider and signer
    const provider = new ethers.providers.JsonRpcProvider(network.rpc);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Create tester
    const tester = new EVMCompatibilityTester(network);
    await tester.initialize(signer);

    // Run just the precompile tests
    console.log('\n📋 Running precompile tests only...\n');

    const contractAddress = '0xa9C38f0Ce06d6FA66E102f1bf0823343542Bd226';
    const gasPrice = ethers.utils.parseUnits('2000', 'gwei');

    await tester.testPrecompiles(contractAddress, gasPrice);

    tester.printTestSummary();

    console.log('\n✅ Test completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testDirectly();