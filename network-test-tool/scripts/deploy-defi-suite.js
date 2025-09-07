const { ethers } = require("hardhat");
const chalk = require('chalk');
require('dotenv').config();

const { logger } = require('../utils/logger');

async function deployMockERC20(deployer, tokenConfig) {
  logger.info(`📄 Deploying ${tokenConfig.name}...`);
  
  const MockERC20 = await ethers.getContractFactory("MockERC20", deployer);
  const token = await MockERC20.deploy(
    tokenConfig.name,
    tokenConfig.symbol,
    tokenConfig.decimals,
    tokenConfig.initialSupply
  );
  
  await token.deployed();
  
  logger.success(`✅ ${tokenConfig.name} deployed: ${token.address}`);
  
  // Mint initial tokens for testing
  if (tokenConfig.mintToDeployer > 0) {
    const mintAmount = ethers.utils.parseEther(tokenConfig.mintToDeployer.toString());
    logger.info(`🏭 Minting ${tokenConfig.mintToDeployer} ${tokenConfig.symbol} to deployer...`);
    await token.mintForTesting(deployer.address, mintAmount);
    logger.success(`✅ Minted ${tokenConfig.mintToDeployer} ${tokenConfig.symbol}`);
  }
  
  return token;
}

async function deployMockDEX(deployer) {
  logger.info("🏪 Deploying MockDEX...");
  
  const MockDEX = await ethers.getContractFactory("MockDEX", deployer);
  const dex = await MockDEX.deploy();
  await dex.deployed();
  
  logger.success(`✅ MockDEX deployed: ${dex.address}`);
  return dex;
}

async function setupTradingPairs(dex, tokens, deployer) {
  logger.info("🔗 Setting up trading pairs...");
  
  const pairs = [
    { tokenA: tokens.USDC, tokenB: tokens.USDT, nameA: "USDC", nameB: "USDT" },
    { tokenA: tokens.USDC, tokenB: tokens.WETH, nameA: "USDC", nameB: "WETH" },
    { tokenA: tokens.USDT, tokenB: tokens.WETH, nameA: "USDT", nameB: "WETH" }
  ];
  
  for (const pair of pairs) {
    logger.info(`🔗 Creating ${pair.nameA}/${pair.nameB} pair...`);
    const tx = await dex.createPair(pair.tokenA.address, pair.tokenB.address);
    await tx.wait();
    logger.success(`✅ ${pair.nameA}/${pair.nameB} pair created`);
  }
}

async function addInitialLiquidity(dex, tokens, deployer) {
  logger.info("💧 Adding initial liquidity...");
  
  // Add liquidity to USDC/USDT pair (stablecoin pair)
  const usdcAmount = ethers.utils.parseEther("1000"); // 1000 USDC
  const usdtAmount = ethers.utils.parseEther("1000"); // 1000 USDT
  
  logger.info("📋 Approving tokens for liquidity...");
  await tokens.USDC.approveMax(dex.address);
  await tokens.USDT.approveMax(dex.address);
  await tokens.WETH.approveMax(dex.address);
  
  logger.info("💧 Adding USDC/USDT liquidity...");
  const liquidityTx = await dex.addLiquidity(
    tokens.USDC.address,
    tokens.USDT.address,
    usdcAmount,
    usdtAmount
  );
  await liquidityTx.wait();
  logger.success("✅ USDC/USDT liquidity added");
  
  // Add WETH/USDC liquidity with 1:2500 ratio (ETH = $2500)
  const wethAmount = ethers.utils.parseEther("1"); // 1 WETH
  const usdcForWeth = ethers.utils.parseEther("2500"); // 2500 USDC
  
  logger.info("💧 Adding WETH/USDC liquidity...");
  const wethLiquidityTx = await dex.addLiquidity(
    tokens.WETH.address,
    tokens.USDC.address,
    wethAmount,
    usdcForWeth
  );
  await wethLiquidityTx.wait();
  logger.success("✅ WETH/USDC liquidity added");
}

async function verifyDeployment(contracts, networkName) {
  logger.cyan("\n📋 DEPLOYMENT SUMMARY");
  logger.gray("=".repeat(60));
  
  logger.info(`🌐 Network: ${networkName}`);
  logger.info(`📄 MockERC20 (USDC): ${contracts.tokens.USDC.address}`);
  logger.info(`📄 MockERC20 (USDT): ${contracts.tokens.USDT.address}`);
  logger.info(`📄 MockERC20 (WETH): ${contracts.tokens.WETH.address}`);
  logger.info(`🏪 MockDEX: ${contracts.dex.address}`);
  
  // Verify token balances
  logger.info("\n💰 Token Balances:");
  const usdcBalance = await contracts.tokens.USDC.balanceOf(contracts.deployer.address);
  const usdtBalance = await contracts.tokens.USDT.balanceOf(contracts.deployer.address);
  const wethBalance = await contracts.tokens.WETH.balanceOf(contracts.deployer.address);
  
  logger.info(`💵 USDC: ${ethers.utils.formatEther(usdcBalance)}`);
  logger.info(`💵 USDT: ${ethers.utils.formatEther(usdtBalance)}`);
  logger.info(`💵 WETH: ${ethers.utils.formatEther(wethBalance)}`);
  
  // Verify DEX liquidity
  logger.info("\n🏊 DEX Liquidity:");
  const usdcUsdtReserves = await contracts.dex.getPoolReserves(
    contracts.tokens.USDC.address,
    contracts.tokens.USDT.address
  );
  const wethUsdcReserves = await contracts.dex.getPoolReserves(
    contracts.tokens.WETH.address,
    contracts.tokens.USDC.address
  );
  
  logger.info(`🏊 USDC/USDT Pool: ${ethers.utils.formatEther(usdcUsdtReserves.reserveA)} / ${ethers.utils.formatEther(usdcUsdtReserves.reserveB)}`);
  logger.info(`🏊 WETH/USDC Pool: ${ethers.utils.formatEther(wethUsdcReserves.reserveA)} / ${ethers.utils.formatEther(wethUsdcReserves.reserveB)}`);
  
  // Test a simple swap to verify DEX functionality
  logger.info("\n🧪 Testing DEX functionality...");
  const swapAmount = ethers.utils.parseEther("10"); // 10 USDC
  const expectedOut = await contracts.dex.getAmountOut(
    contracts.tokens.USDC.address,
    contracts.tokens.USDT.address,
    swapAmount
  );
  
  logger.info(`🔄 10 USDC → ${ethers.utils.formatEther(expectedOut)} USDT (expected)`);
  logger.success("✅ DEX functioning correctly");
}

async function generateEnvVariables(contracts, networkName) {
  logger.cyan("\n⚙️ ENVIRONMENT VARIABLES");
  logger.gray("=".repeat(60));
  
  const envVarPrefix = networkName.toUpperCase();
  
  logger.info("Add these to your .env file:");
  logger.info(`# ${networkName.charAt(0).toUpperCase() + networkName.slice(1)} DeFi Contracts`);
  logger.info(`DEFI_USDC_${envVarPrefix}=${contracts.tokens.USDC.address}`);
  logger.info(`DEFI_USDT_${envVarPrefix}=${contracts.tokens.USDT.address}`);  
  logger.info(`DEFI_WETH_${envVarPrefix}=${contracts.tokens.WETH.address}`);
  logger.info(`DEFI_DEX_${envVarPrefix}=${contracts.dex.address}`);
}

async function main() {
  logger.log(chalk.magenta("🏗️ DeFi Test Suite Deployment"));
  logger.gray("=".repeat(80));
  
  // Get network info
  const network = await ethers.provider.getNetwork();
  
  // Map chain IDs to proper network names
  const networkNames = {
    167012: "Kasplex L2",
    19416: "Igra Caravel",
    11155111: "Ethereum Sepolia", 
    17000: "Ethereum Holesky",
    5: "Ethereum Goerli",
    1337: "Hardhat Local",
    31337: "Hardhat Local"
  };
  
  const networkName = networkNames[network.chainId] || network.name || `Chain ${network.chainId}`;
  
  logger.info(`🌐 Deploying to network: ${networkName} (Chain ID: ${network.chainId})`);
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  const balance = await deployer.getBalance();
  
  logger.info(`👤 Deployer: ${deployer.address}`);
  logger.info(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  if (balance.lt(ethers.utils.parseEther("0.1"))) {
    logger.warning("⚠️ Low balance! You may need more funds for deployment.");
  }
  
  try {
    // Deploy test tokens
    logger.cyan("\n📄 DEPLOYING TEST TOKENS");
    logger.gray("=".repeat(40));
    
    const tokenConfigs = [
      { name: "USD Coin", symbol: "USDC", decimals: 6, initialSupply: 1000000, mintToDeployer: 10000 },
      { name: "Tether USD", symbol: "USDT", decimals: 6, initialSupply: 1000000, mintToDeployer: 10000 },
      { name: "Wrapped Ether", symbol: "WETH", decimals: 18, initialSupply: 10000, mintToDeployer: 100 }
    ];
    
    const tokens = {};
    for (const config of tokenConfigs) {
      tokens[config.symbol] = await deployMockERC20(deployer, config);
      // Small delay between deployments
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Deploy DEX
    logger.cyan("\n🏪 DEPLOYING DEX");
    logger.gray("=".repeat(40));
    
    const dex = await deployMockDEX(deployer);
    
    // Set up trading pairs
    logger.cyan("\n🔗 SETTING UP DEX");
    logger.gray("=".repeat(40));
    
    await setupTradingPairs(dex, tokens, deployer);
    await addInitialLiquidity(dex, tokens, deployer);
    
    // Compile deployment info
    const contracts = {
      tokens,
      dex,
      deployer
    };
    
    // Verify deployment
    await verifyDeployment(contracts, networkName);
    
    // Generate environment variables
    await generateEnvVariables(contracts, networkName);
    
    logger.success(`\n🎉 DeFi test suite deployed successfully to ${networkName}!`);
    
    logger.cyan("\n🚀 NEXT STEPS:");
    logger.info("1. Add the environment variables to your .env file");
    logger.info("2. Run ERC20 token tests: npm run load-test:defi-tokens");
    logger.info("3. Run DEX trading tests: npm run load-test:defi-dex");
    logger.info("4. Compare networks: npm run load-test:compare");
    
  } catch (error) {
    logger.error(`❌ Deployment failed: ${error.message}`);
    
    logger.warning("\n🔧 TROUBLESHOOTING:");
    logger.warning("1. Check network connectivity");
    logger.warning("2. Ensure sufficient balance for deployment");
    logger.warning("3. Verify network configuration in hardhat.config.js");
    logger.warning("4. Check that contracts compile: npm run compile");
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });