#!/usr/bin/env node

const { ethers } = require('ethers');
const chalk = require('chalk');
const { networks } = require('./lib/networks');

/**
 * Measure actual block time for any network
 */
async function measureBlockTime(networkName) {
  const network = networks[networkName.toLowerCase()];

  if (!network) {
    console.error(chalk.red(`Network "${networkName}" not found`));
    console.log('Available networks:', Object.keys(networks).join(', '));
    process.exit(1);
  }

  console.log(chalk.cyan(`\n📊 Measuring Block Time for ${network.name}`));
  console.log('='.repeat(50));

  // Create provider
  const provider = new ethers.providers.JsonRpcProvider(network.rpc, {
    chainId: network.chainId,
    name: network.name
  });

  try {
    // Get current block
    const startBlock = await provider.getBlockNumber();
    console.log(chalk.blue(`Starting at block: ${startBlock}`));
    console.log(chalk.gray('Monitoring blocks (this will take ~1-2 minutes)...\n'));

    const blockTimes = [];
    const blocksToMonitor = 10;
    let lastBlock = null;
    let lastTimestamp = null;
    let blocksRecorded = 0;

    // Monitor blocks
    while (blocksRecorded < blocksToMonitor) {
      const currentBlock = await provider.getBlockNumber();

      if (!lastBlock || currentBlock > lastBlock) {
        const block = await provider.getBlock(currentBlock);

        if (lastTimestamp) {
          const timeDiff = block.timestamp - lastTimestamp;
          blockTimes.push(timeDiff);
          blocksRecorded++;

          console.log(chalk.gray(
            `Block ${currentBlock}: +${timeDiff}s from previous block (${blocksRecorded}/${blocksToMonitor})`
          ));
        }

        lastBlock = currentBlock;
        lastTimestamp = block.timestamp;
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Calculate statistics
    const avgBlockTime = blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length;
    const minBlockTime = Math.min(...blockTimes);
    const maxBlockTime = Math.max(...blockTimes);

    console.log(chalk.green('\n📈 Block Time Analysis:'));
    console.log('='.repeat(50));
    console.log(chalk.yellow(`Network: ${network.name} (Chain ID: ${network.chainId})`));
    console.log(chalk.yellow(`Blocks monitored: ${blocksToMonitor}`));
    console.log(chalk.cyan(`Average block time: ${avgBlockTime.toFixed(1)} seconds`));
    console.log(chalk.blue(`Minimum block time: ${minBlockTime} seconds`));
    console.log(chalk.blue(`Maximum block time: ${maxBlockTime} seconds`));
    console.log(chalk.gray(`Block times: [${blockTimes.join('s, ')}s]`));

    // Performance implications
    console.log(chalk.magenta('\n💡 Performance Implications:'));
    if (avgBlockTime < 3) {
      console.log(chalk.green('✅ Fast block time - good for quick confirmations'));
    } else if (avgBlockTime < 6) {
      console.log(chalk.yellow('⚡ Moderate block time - reasonable confirmation speed'));
    } else {
      console.log(chalk.red('⚠️ Slow block time - expect longer confirmation delays'));
    }

    const txPerMinute = Math.floor(60 / avgBlockTime);
    console.log(chalk.gray(`Expected confirmations per minute: ~${txPerMinute}`));

  } catch (error) {
    console.error(chalk.red('Error measuring block time:'), error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const networkName = args[0];

if (!networkName) {
  console.log(chalk.cyan('📊 Block Time Measurement Tool'));
  console.log(chalk.gray('\nUsage: node measure-block-time.js <network>\n'));
  console.log('Available networks:');
  Object.keys(networks).forEach(name => {
    const net = networks[name];
    console.log(`  ${chalk.green(name.padEnd(10))} - ${net.name} (Chain ID: ${net.chainId})`);
  });
  console.log('\nExample: node measure-block-time.js igra');
  process.exit(0);
}

// Run the measurement
measureBlockTime(networkName).catch(console.error);