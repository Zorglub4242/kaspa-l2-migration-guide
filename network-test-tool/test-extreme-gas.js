#!/usr/bin/env node

const { ethers } = require('ethers');
const chalk = require('chalk');
const { networks } = require('./lib/networks');
require('dotenv').config();

/**
 * Test extreme gas prices to find the limit for fast inclusion
 */
async function testExtremeGas(networkName) {
  const network = networks[networkName.toLowerCase()];

  if (!network) {
    console.error(chalk.red(`Network "${networkName}" not found`));
    process.exit(1);
  }

  console.log(chalk.cyan(`\n⛽ Testing EXTREME Gas Prices on ${network.name}`));
  console.log('='.repeat(60));

  // Create provider and signer
  const provider = new ethers.providers.JsonRpcProvider(network.rpc, {
    chainId: network.chainId,
    name: network.name
  });
  provider.pollingInterval = 200; // Ultra-fast polling

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error(chalk.red('Please set PRIVATE_KEY in .env file'));
    process.exit(1);
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  const address = await wallet.getAddress();
  const balance = await wallet.getBalance();

  console.log(chalk.gray(`Wallet: ${address}`));
  console.log(chalk.gray(`Balance: ${ethers.utils.formatEther(balance)} ${network.symbol}\n`));

  // EXTREME gas prices to test (in gwei)
  const gasPrices = [
    2000,   // Baseline
    5000,   // 2.5x
    10000,  // 5x
    20000,  // 10x
    50000,  // 25x
  ];

  console.log(chalk.red('🔥 Testing EXTREME gas prices:'), gasPrices.map(g => `${g} gwei`).join(', '));
  console.log(chalk.yellow('⚠️  Warning: This will consume significant gas!\n'));

  const results = [];

  for (const gasPriceGwei of gasPrices) {
    console.log(chalk.blue(`\nTesting ${gasPriceGwei} gwei (${(gasPriceGwei/2000).toFixed(1)}x base)...`));

    const gasPrice = ethers.utils.parseUnits(gasPriceGwei.toString(), 'gwei');
    const gasCost = ethers.utils.formatEther(gasPrice.mul(21000));

    console.log(chalk.gray(`  Cost for this tx: ${gasCost} ${network.symbol}`));

    // Create a simple transaction (self-transfer)
    const tx = {
      to: address,
      value: ethers.utils.parseEther('0.0001'),
      gasLimit: 21000,
      gasPrice: gasPrice,
      nonce: await wallet.getTransactionCount('pending')
    };

    const startTime = Date.now();
    let blocksSinceSubmission = 0;
    const startBlock = await provider.getBlockNumber();

    try {
      // Send transaction
      const txResponse = await wallet.sendTransaction(tx);
      console.log(chalk.gray(`  Tx sent: ${txResponse.hash.slice(0, 10)}...`));

      // Track blocks while waiting
      const blockInterval = setInterval(async () => {
        const currentBlock = await provider.getBlockNumber();
        if (currentBlock > startBlock) {
          blocksSinceSubmission = currentBlock - startBlock;
        }
      }, 200);

      // Wait for confirmation
      const receipt = await txResponse.wait(1);
      clearInterval(blockInterval);

      const totalTime = (Date.now() - startTime) / 1000;

      const result = {
        gasPrice: gasPriceGwei,
        totalTime: totalTime.toFixed(1),
        blocksWaited: blocksSinceSubmission,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        cost: ethers.utils.formatEther(gasPrice.mul(receipt.gasUsed))
      };

      results.push(result);

      if (totalTime < 3) {
        console.log(chalk.green(`  ⚡⚡ ULTRA FAST! Confirmed in ${result.totalTime}s (${blocksSinceSubmission} blocks)`));
      } else if (totalTime < 5) {
        console.log(chalk.green(`  ⚡ FAST! Confirmed in ${result.totalTime}s (${blocksSinceSubmission} blocks)`));
      } else {
        console.log(chalk.yellow(`  ✅ Confirmed in ${result.totalTime}s (${blocksSinceSubmission} blocks)`));
      }

      console.log(chalk.gray(`     Cost: ${result.cost} ${network.symbol}`));

      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(chalk.red(`  ❌ Failed: ${error.message}`));
      results.push({
        gasPrice: gasPriceGwei,
        error: error.message
      });
    }
  }

  // Summary
  console.log(chalk.cyan('\n🔥 EXTREME Gas Price Results:'));
  console.log('='.repeat(60));

  const successfulTests = results.filter(r => !r.error);

  if (successfulTests.length > 0) {
    // Find optimal gas price
    const fastest = successfulTests.reduce((min, r) =>
      parseFloat(r.totalTime) < parseFloat(min.totalTime) ? r : min
    );

    console.log(chalk.yellow('\n📊 Confirmation Times by Gas Price:'));
    successfulTests.forEach(r => {
      const marker = r === fastest ? ' 🏆' : '';
      const multiplier = (r.gasPrice / 2000).toFixed(1);
      console.log(`  ${r.gasPrice.toString().padEnd(6)} gwei (${multiplier}x): ${r.totalTime}s, ${r.blocksWaited} blocks${marker}`);
    });

    console.log(chalk.green('\n🎯 Analysis:'));

    const baseline = successfulTests.find(r => r.gasPrice === 2000);
    if (baseline && fastest.gasPrice !== 2000) {
      const improvement = ((parseFloat(baseline.totalTime) - parseFloat(fastest.totalTime)) / parseFloat(baseline.totalTime) * 100).toFixed(0);
      const costIncrease = ((fastest.gasPrice - 2000) / 2000 * 100).toFixed(0);

      console.log(`  Fastest: ${fastest.gasPrice} gwei achieves ${fastest.totalTime}s (${improvement}% faster)`);
      console.log(`  Cost increase: +${costIncrease}% for ${improvement}% speed improvement`);

      if (parseFloat(fastest.totalTime) < 3) {
        console.log(chalk.green(`  ⚡⚡ SUB-3-SECOND confirmations possible with ${fastest.gasPrice} gwei!`));
      }
    }

    // Check if there's a plateau
    const times = successfulTests.map(r => parseFloat(r.totalTime));
    const minTime = Math.min(...times);
    const plateauTests = successfulTests.filter(r => parseFloat(r.totalTime) <= minTime + 1);

    if (plateauTests.length > 1) {
      const lowestPlateau = plateauTests.reduce((min, r) => r.gasPrice < min.gasPrice ? r : min);
      console.log(chalk.magenta(`\n💡 Speed plateau detected at ~${minTime}s`));
      console.log(`  Optimal gas: ${lowestPlateau.gasPrice} gwei (no benefit going higher)`);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const networkName = args[0];

if (!networkName) {
  console.log(chalk.cyan('🔥 Extreme Gas Price Tester'));
  console.log(chalk.gray('\nUsage: node test-extreme-gas.js <network>\n'));
  console.log('Available networks:', Object.keys(networks).join(', '));
  console.log('\nExample: node test-extreme-gas.js igra');
  process.exit(0);
}

// Run the test
testExtremeGas(networkName).catch(console.error);