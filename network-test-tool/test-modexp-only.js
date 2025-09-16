require('dotenv').config();
const ethers = require('ethers');

async function testModExp() {
  try {
    console.log('🔧 Testing ModExp on Igra L2');

    const provider = new ethers.providers.JsonRpcProvider('https://caravel.igralabs.com:8545');
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const contractAddress = '0xa9C38f0Ce06d6FA66E102f1bf0823343542Bd226';
    const abi = ['function testModExp() external returns (bytes memory)'];
    const contract = new ethers.Contract(contractAddress, abi, signer);

    console.log('📍 Calling testModExp with timeout...');

    // Try with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000)
    );

    const testPromise = (async () => {
      const tx = await contract.testModExp({
        gasPrice: ethers.utils.parseUnits('2000', 'gwei'),
        gasLimit: 5000000
      });
      const receipt = await tx.wait();
      return receipt;
    })();

    try {
      const receipt = await Promise.race([testPromise, timeoutPromise]);
      console.log('✅ ModExp test passed - gas used:', receipt.gasUsed.toString());
    } catch (err) {
      if (err.message.includes('Timeout')) {
        console.log('⏱️ ModExp test timed out - may not be supported on Igra');
      } else {
        console.log('❌ ModExp test failed:', err.message);
      }
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
  }

  process.exit(0);
}

testModExp();