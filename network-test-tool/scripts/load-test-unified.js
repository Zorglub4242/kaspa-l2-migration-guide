#!/usr/bin/env node

const { ethers } = require("hardhat");
const { program } = require('commander');
const { LoadTestRunner } = require('../lib/load-test-runner');

program
  .name('load-test-unified')
  .description('Unified load testing tool for blockchain networks')
  .version('1.0.0');

program
  .command('simple')
  .description('Run simple sequential load test')
  .option('-c, --contract <address>', 'Contract address to test')
  .option('-t, --transactions <number>', 'Number of transactions', '5')
  .action(async (options) => {
    await runSimpleTest(options);
  });

program
  .command('stress')
  .description('Run stress test with configurable TPS')
  .option('-c, --contract <address>', 'Contract address to test')
  .option('-d, --duration <ms>', 'Test duration in milliseconds', '60000')
  .option('--max-tps <number>', 'Maximum transactions per second', '10')
  .option('--ramp-up <ms>', 'Ramp up time in milliseconds', '10000')
  .action(async (options) => {
    await runStressTest(options);
  });

program
  .command('burst')
  .description('Run burst test with transaction batches')
  .option('-c, --contract <address>', 'Contract address to test')
  .option('--burst-size <number>', 'Transactions per burst', '10')
  .option('--burst-count <number>', 'Number of bursts', '3')
  .option('--burst-interval <ms>', 'Interval between bursts in milliseconds', '5000')
  .action(async (options) => {
    await runBurstTest(options);
  });

program
  .command('max-tps')
  .description('Find maximum sustainable TPS')
  .option('-c, --contract <address>', 'Contract address to test')
  .option('-d, --duration <ms>', 'Test duration per TPS level', '30000')
  .action(async (options) => {
    await runMaxTPSTest(options);
  });

async function runSimpleTest(options) {
  console.log('🚀 Starting Simple Load Test');
  
  const runner = await setupRunner();
  const contractAddress = getContractAddress(options.contract);
  const transactionCount = parseInt(options.transactions);

  const results = await runner.runSimpleLoad(contractAddress, transactionCount);
  runner.printSummary();
  
  await results.save(`simple-load-test-${Date.now()}.json`);
}

async function runStressTest(options) {
  console.log('🔥 Starting Stress Test');
  
  const runner = await setupRunner();
  const contractAddress = getContractAddress(options.contract);
  
  const testOptions = {
    duration: parseInt(options.duration),
    maxTPS: parseInt(options.maxTps),
    rampUpTime: parseInt(options.rampUp)
  };

  const results = await runner.runStressTest(contractAddress, testOptions);
  runner.printSummary();
  
  await results.save(`stress-test-${Date.now()}.json`);
}

async function runBurstTest(options) {
  console.log('💥 Starting Burst Test');
  
  const runner = await setupRunner();
  const contractAddress = getContractAddress(options.contract);
  
  const results = await runner.runBurstTest(
    contractAddress,
    parseInt(options.burstSize),
    parseInt(options.burstCount),
    parseInt(options.burstInterval)
  );
  runner.printSummary();
  
  await results.save(`burst-test-${Date.now()}.json`);
}

async function runMaxTPSTest(options) {
  console.log('📊 Starting Max TPS Test');
  
  const runner = await setupRunner();
  const contractAddress = getContractAddress(options.contract);
  
  const { maxTPS, results } = await runner.measureMaxTPS(
    contractAddress,
    parseInt(options.duration)
  );
  
  console.log(`\n🏆 Maximum Sustainable TPS: ${maxTPS}`);
  runner.printSummary();
  
  await results.save(`max-tps-test-${Date.now()}.json`);
}

async function setupRunner() {
  const network = await ethers.provider.getNetwork();
  const runner = new LoadTestRunner(network, {
    maxConcurrency: 10,
    retryAttempts: 3
  });
  
  await runner.initialize();
  return runner;
}

function getContractAddress(providedAddress) {
  const contractAddress = providedAddress || process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.error('❌ Contract address required!');
    console.error('💡 Use --contract <address> or set CONTRACT_ADDRESS environment variable');
    console.error('💡 Deploy first: npm run deploy:<network>');
    process.exit(1);
  }
  
  return contractAddress;
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  program.parse();
}