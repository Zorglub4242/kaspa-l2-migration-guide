#!/usr/bin/env node

const { ethers } = require('ethers');
const chalk = require('chalk');
const { networks } = require('./lib/networks');
require('dotenv').config();

/**
 * Test different gas prices to find optimal inclusion speed
 */
async function testGasInclusion(networkName) {
  const network = networks[networkName.toLowerCase()];

  if (!network) {
    console.error(chalk.red(`Network "${networkName}" not found`));
    process.exit(1);
  }

  console.log(chalk.cyan(`\n⛽ Testing Gas Price Inclusion Speed on ${network.name}`));
  console.log('='.repeat(60));

  // Create provider and signer
  const provider = new ethers.providers.JsonRpcProvider(network.rpc, {
    chainId: network.chainId,
    name: network.name
  });
  provider.pollingInterval = 500; // Fast polling

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

  // Gas prices to test (in gwei)
  const gasPrices = [
    2000,  // Minimum
    2100,  // +5%
    2200,  // +10%
    2500,  // +25%
    3000,  // +50%
  ];

  console.log(chalk.yellow('Testing gas prices:'), gasPrices.map(g => `${g} gwei`).join(', '));
  console.log();

  const results = [];

  for (const gasPriceGwei of gasPrices) {
    console.log(chalk.blue(`\nTesting ${gasPriceGwei} gwei...`));

    const gasPrice = ethers.utils.parseUnits(gasPriceGwei.toString(), 'gwei');

    // Create a simple transaction (self-transfer)
    const tx = {
      to: address,
      value: ethers.utils.parseEther('0.0001'),
      gasLimit: 21000,
      gasPrice: gasPrice,
      nonce: await wallet.getTransactionCount('pending')
    };

    const startTime = Date.now();
    let mempoolTime = null;
    let blockNumber = null;
    let blocksWaited = 0;
    const startBlock = await provider.getBlockNumber();

    try {
      // Send transaction
      const txResponse = await wallet.sendTransaction(tx);
      console.log(chalk.gray(`  Tx sent: ${txResponse.hash.slice(0, 10)}...`));

      // Monitor inclusion
      const checkInterval = setInterval(async () => {
        try {
          const receipt = await provider.getTransactionReceipt(txResponse.hash);
          if (receipt) {
            blockNumber = receipt.blockNumber;
            console.log(chalk.gray(`  Mined in block ${blockNumber}`));
          } else {
            const pending = await provider.getTransaction(txResponse.hash);
            if (pending && !mempoolTime) {
              mempoolTime = Date.now();
              const elapsed = ((mempoolTime - startTime) / 1000).toFixed(1);
              console.log(chalk.gray(`  In mempool after ${elapsed}s`));
            }
            const currentBlock = await provider.getBlockNumber();
            if (currentBlock > startBlock) {
              blocksWaited = currentBlock - startBlock;
            }
          }
        } catch (e) {
          // Ignore
        }
      }, 500);

      // Wait for confirmation
      const receipt = await txResponse.wait(1);
      clearInterval(checkInterval);

      const totalTime = Date.now() - startTime;
      const mempoolDelay = mempoolTime ? (mempoolTime - startTime) : 0;
      const miningTime = totalTime - mempoolDelay;

      const result = {
        gasPrice: gasPriceGwei,
        totalTime: (totalTime / 1000).toFixed(1),
        mempoolDelay: (mempoolDelay / 1000).toFixed(1),
        miningTime: (miningTime / 1000).toFixed(1),
        blocksWaited: blocksWaited,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        cost: ethers.utils.formatEther(gasPrice.mul(receipt.gasUsed))
      };

      results.push(result);

      console.log(chalk.green(`  ✅ Confirmed in ${result.totalTime}s`));
      console.log(chalk.gray(`     Mempool: ${result.mempoolDelay}s, Mining: ${result.miningTime}s, Blocks waited: ${blocksWaited}`));
      console.log(chalk.gray(`     Cost: ${result.cost} ${network.symbol}`));

      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error) {
      console.error(chalk.red(`  ❌ Failed: ${error.message}`));
      results.push({
        gasPrice: gasPriceGwei,
        error: error.message
      });
    }
  }

  // Summary
  console.log(chalk.cyan('\n📊 Gas Price Test Results:'));
  console.log('='.repeat(60));

  const successfulTests = results.filter(r => !r.error);

  if (successfulTests.length > 0) {
    // Find optimal gas price
    const fastest = successfulTests.reduce((min, r) =>
      parseFloat(r.totalTime) < parseFloat(min.totalTime) ? r : min
    );

    const cheapest = successfulTests.reduce((min, r) =>
      parseFloat(r.cost) < parseFloat(min.cost) ? r : min
    );

    console.log(chalk.yellow('\nResults by Gas Price:'));
    successfulTests.forEach(r => {
      const marker = r === fastest ? ' ⚡' : '';
      console.log(`  ${r.gasPrice} gwei: ${r.totalTime}s total (${r.mempoolDelay}s mempool, ${r.miningTime}s mining)${marker}`);
    });

    console.log(chalk.green('\n✨ Recommendations:'));
    console.log(`  Fastest inclusion: ${fastest.gasPrice} gwei (${fastest.totalTime}s)`);
    console.log(`  Most economical: ${cheapest.gasPrice} gwei (${cheapest.totalTime}s)`);

    if (parseFloat(fastest.totalTime) < 3) {
      console.log(chalk.green('  ✅ Can achieve <3s confirmations with optimal gas!'));
    } else if (parseFloat(fastest.totalTime) < 5) {
      console.log(chalk.yellow('  ⚡ Can achieve <5s confirmations with optimal gas'));
    } else {
      console.log(chalk.red('  ⚠️ Network has inherent delays even with high gas'));
    }

    // Calculate savings
    const defaultTime = parseFloat(successfulTests[0].totalTime);
    const optimizedTime = parseFloat(fastest.totalTime);
    const savings = ((defaultTime - optimizedTime) / defaultTime * 100).toFixed(0);

    if (savings > 10) {
      console.log(chalk.magenta(`\n💰 Potential time savings: ${savings}% with optimized gas!`));
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const networkName = args[0];

if (!networkName) {
  console.log(chalk.cyan('⛽ Gas Price Inclusion Tester'));
  console.log(chalk.gray('\nUsage: node test-gas-inclusion.js <network>\n'));
  console.log('Available networks:', Object.keys(networks).join(', '));
  console.log('\nExample: node test-gas-inclusion.js igra');
  process.exit(0);
}

// Run the test
testGasInclusion(networkName).catch(console.error);