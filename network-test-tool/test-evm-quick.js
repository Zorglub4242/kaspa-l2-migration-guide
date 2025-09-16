const ethers = require('ethers');

async function quickTest() {
  try {
    console.log('🔧 Quick EVM Test on Igra L2');

    // Connect to Igra
    const provider = new ethers.providers.JsonRpcProvider('https://caravel.igralabs.com:8545');
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // PrecompileTest contract
    const contractAddress = '0xa9C38f0Ce06d6FA66E102f1bf0823343542Bd226';

    // Simple ABI for testEcrecover
    const abi = [
      'function testEcrecover() public returns (address)',
      'function testSha256(bytes calldata data) external returns (bytes32)',
      'function testRipemd160(bytes calldata data) external returns (bytes20)'
    ];

    const contract = new ethers.Contract(contractAddress, abi, signer);

    // Test 1: ecrecover
    console.log('\n📍 Testing ecrecover...');
    try {
      const tx1 = await contract.testEcrecover({ gasPrice: ethers.utils.parseUnits('2000', 'gwei') });
      const receipt1 = await tx1.wait();
      console.log('✅ ecrecover passed - gas used:', receipt1.gasUsed.toString());
    } catch (err) {
      console.log('❌ ecrecover failed:', err.message);
    }

    // Test 2: sha256
    console.log('\n📍 Testing sha256...');
    try {
      const testData = ethers.utils.toUtf8Bytes('Hello Kasplex');
      const tx2 = await contract.testSha256(testData, { gasPrice: ethers.utils.parseUnits('2000', 'gwei') });
      const receipt2 = await tx2.wait();
      console.log('✅ sha256 passed - gas used:', receipt2.gasUsed.toString());
    } catch (err) {
      console.log('❌ sha256 failed:', err.message);
    }

    // Test 3: ripemd160
    console.log('\n📍 Testing ripemd160...');
    try {
      const testData = ethers.utils.toUtf8Bytes('Hello Kasplex');
      const tx3 = await contract.testRipemd160(testData, { gasPrice: ethers.utils.parseUnits('2000', 'gwei') });
      const receipt3 = await tx3.wait();
      console.log('✅ ripemd160 passed - gas used:', receipt3.gasUsed.toString());
    } catch (err) {
      console.log('❌ ripemd160 failed:', err.message);
    }

    console.log('\n✨ Quick test completed');

  } catch (error) {
    console.error('Fatal error:', error.message);
  }
}

// Load env and run
require('dotenv').config();
quickTest();