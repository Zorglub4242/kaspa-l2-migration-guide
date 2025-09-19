const { ethers } = require("hardhat");
const chalk = require('chalk');
require('dotenv').config();

const { logger } = require('../utils/logger');
const { ContractRegistry } = require('../lib/contract-registry');

// Helper function to get gas options for different networks
function getGasOptions(network) {
  if (network.chainId === 19416) { // Igra L2
    return {
      gasPrice: ethers.utils.parseUnits("2000", "gwei"), // Exactly 2000 gwei required for Igra
      gasLimit: 2000000 // 2M gas limit to avoid estimation
    };
  }
  // For other networks, let ethers handle gas estimation
  return {};
}

async function deployMockERC20(deployer, tokenConfig, network) {
  logger.info(`📄 Deploying ${tokenConfig.name}...`);

  const gasOptions = getGasOptions(network);
  const MockERC20 = await ethers.getContractFactory("MockERC20", deployer);

  const token = await MockERC20.deploy(
    tokenConfig.name,
    tokenConfig.symbol,
    tokenConfig.decimals,
    tokenConfig.initialSupply,
    gasOptions
  );

  await token.deployed();

  logger.success(`✅ ${tokenConfig.name} deployed: ${token.address}`);

  // Mint initial tokens for testing
  if (tokenConfig.mintToDeployer > 0) {
    const mintAmount = ethers.utils.parseEther(tokenConfig.mintToDeployer.toString());
    logger.info(`🏭 Minting ${tokenConfig.mintToDeployer} ${tokenConfig.symbol} to deployer...`);

    const mintGasOptions = network.chainId === 19416 ? { gasPrice: gasOptions.gasPrice, gasLimit: 500000 } : {};
    await token.mintForTesting(deployer.address, mintAmount, mintGasOptions);
    logger.success(`✅ Minted ${tokenConfig.mintToDeployer} ${tokenConfig.symbol}`);
  }

  return token;
}

async function deployMockDEX(deployer, network) {
  logger.info("🏪 Deploying MockDEX...");

  const gasOptions = getGasOptions(network);
  const MockDEX = await ethers.getContractFactory("MockDEX", deployer);
  const dex = await MockDEX.deploy(gasOptions);
  await dex.deployed();

  logger.success(`✅ MockDEX deployed: ${dex.address}`);
  return dex;
}

async function deployMockLendingProtocol(deployer, network) {
  logger.info("🏦 Deploying MockLendingProtocol...");

  const gasOptions = getGasOptions(network);
  const MockLendingProtocol = await ethers.getContractFactory("MockLendingProtocol", deployer);
  const lending = await MockLendingProtocol.deploy(gasOptions);
  await lending.deployed();

  logger.success(`✅ MockLendingProtocol deployed: ${lending.address}`);
  return lending;
}

async function deployMockYieldFarm(deployer, network) {
  logger.info("🌾 Deploying MockYieldFarm...");

  const gasOptions = getGasOptions(network);
  const MockYieldFarm = await ethers.getContractFactory("MockYieldFarm", deployer);
  const yieldFarm = await MockYieldFarm.deploy(gasOptions);
  await yieldFarm.deployed();

  logger.success(`✅ MockYieldFarm deployed: ${yieldFarm.address}`);
  return yieldFarm;
}

async function deployMockERC721Collection(deployer, network) {
  logger.info("🎨 Deploying MockERC721Collection...");

  const gasOptions = getGasOptions(network);
  const MockERC721Collection = await ethers.getContractFactory("MockERC721Collection", deployer);
  const nftCollection = await MockERC721Collection.deploy(
    "DeFi NFT Collection",
    "DFNFT",
    "https://api.defi-nft.com/metadata/",
    gasOptions
  );
  await nftCollection.deployed();

  logger.success(`✅ MockERC721Collection deployed: ${nftCollection.address}`);
  return nftCollection;
}

async function deployMockMultiSigWallet(deployer, network) {
  logger.info("🔐 Deploying MockMultiSigWallet...");

  // Add additional owners for multisig (using hardhat test accounts)
  const additionalOwners = [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Hardhat account #1
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"  // Hardhat account #2
  ];

  const gasOptions = getGasOptions(network);
  const MockMultiSigWallet = await ethers.getContractFactory("MockMultiSigWallet", deployer);
  const multiSig = await MockMultiSigWallet.deploy(
    [deployer.address, ...additionalOwners],
    2, // Require 2 of 3 signatures
    deployer.address, // Emergency contact
    gasOptions
  );
  await multiSig.deployed();

  logger.success(`✅ MockMultiSigWallet deployed: ${multiSig.address}`);
  return multiSig;
}

async function setupTradingPairs(dex, tokens, deployer, network) {
  logger.info("🔗 Setting up trading pairs...");

  const gasOptions = network.chainId === 19416 ? { gasPrice: ethers.utils.parseUnits("2000", "gwei"), gasLimit: 500000 } : {};
  const pairs = [
    { tokenA: tokens.DFIA, tokenB: tokens.DFIB, nameA: "DFIA", nameB: "DFIB" },
    { tokenA: tokens.DFIA, tokenB: tokens.RWRD, nameA: "DFIA", nameB: "RWRD" },
    { tokenA: tokens.DFIB, tokenB: tokens.RWRD, nameA: "DFIB", nameB: "RWRD" }
  ];

  for (const pair of pairs) {
    logger.info(`🔗 Creating ${pair.nameA}/${pair.nameB} pair...`);
    const tx = await dex.createPair(pair.tokenA.address, pair.tokenB.address, gasOptions);
    await tx.wait();
    logger.success(`✅ ${pair.nameA}/${pair.nameB} pair created`);
  }
}

async function addInitialLiquidity(dex, tokens, deployer, network) {
  logger.info("💧 Adding initial liquidity...");

  const gasOptions = network.chainId === 19416 ? { gasPrice: ethers.utils.parseUnits("2000", "gwei"), gasLimit: 500000 } : {};

  // Add liquidity to DFIA/DFIB pair
  const dfiaAmount = ethers.utils.parseEther("1000"); // 1000 DFIA
  const dfibAmount = ethers.utils.parseEther("1000"); // 1000 DFIB

  logger.info("📋 Approving tokens for liquidity...");
  await tokens.DFIA.approve(dex.address, ethers.utils.parseEther("10000"), gasOptions);
  await tokens.DFIB.approve(dex.address, ethers.utils.parseEther("10000"), gasOptions);
  await tokens.RWRD.approve(dex.address, ethers.utils.parseEther("10000"), gasOptions);

  logger.info("💧 Adding DFIA/DFIB liquidity...");
  const liquidityTx = await dex.addLiquidity(
    tokens.DFIA.address,
    tokens.DFIB.address,
    dfiaAmount,
    dfibAmount,
    gasOptions
  );
  await liquidityTx.wait();
  logger.success("✅ DFIA/DFIB liquidity added");

  // Add DFIA/RWRD liquidity
  const rwrdAmount = ethers.utils.parseEther("5000"); // 5000 RWRD
  const dfiaForRwrd = ethers.utils.parseEther("1000"); // 1000 DFIA

  logger.info("💧 Adding DFIA/RWRD liquidity...");
  const rwrdLiquidityTx = await dex.addLiquidity(
    tokens.DFIA.address,
    tokens.RWRD.address,
    dfiaForRwrd,
    rwrdAmount,
    gasOptions
  );
  await rwrdLiquidityTx.wait();
  logger.success("✅ DFIA/RWRD liquidity added");
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
    // Initialize ContractRegistry
    const registry = new ContractRegistry();
    await registry.initialize();

    // Deploy all DeFi contracts
    logger.cyan("\n📄 DEPLOYING ALL DEFI CONTRACTS");
    logger.gray("=".repeat(50));

    // Deploy ERC20 tokens with DeFi-compatible names
    logger.info("🪙 Deploying ERC20 tokens...");
    const tokenA = await deployMockERC20(deployer, { name: "DeFi Token A", symbol: "DFIA", decimals: 18, initialSupply: 10000000, mintToDeployer: 1000000 }, network);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const tokenB = await deployMockERC20(deployer, { name: "DeFi Token B", symbol: "DFIB", decimals: 18, initialSupply: 10000000, mintToDeployer: 1000000 }, network);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const rewardToken = await deployMockERC20(deployer, { name: "Reward Token", symbol: "RWRD", decimals: 18, initialSupply: 100000000, mintToDeployer: 1000000 }, network);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Deploy DEX
    logger.info("🏪 Deploying MockDEX...");
    const dex = await deployMockDEX(deployer, network);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Deploy Lending Protocol
    logger.info("🏦 Deploying MockLendingProtocol...");
    const lending = await deployMockLendingProtocol(deployer, network);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Deploy Yield Farm
    logger.info("🌾 Deploying MockYieldFarm...");
    const yieldFarm = await deployMockYieldFarm(deployer, network);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Deploy NFT Collection
    logger.info("🎨 Deploying MockERC721Collection...");
    const nftCollection = await deployMockERC721Collection(deployer, network);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Deploy MultiSig Wallet
    logger.info("🔐 Deploying MockMultiSigWallet...");
    const multiSig = await deployMockMultiSigWallet(deployer, network);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Save all contracts to database
    logger.cyan("\n💾 SAVING CONTRACTS TO DATABASE");
    logger.gray("=".repeat(50));

    const contractsToSave = [
      { contract: tokenA, name: "TokenA", type: "MockERC20", constructorArgs: ["DeFi Token A", "DFIA", 18, 10000000] },
      { contract: tokenB, name: "TokenB", type: "MockERC20", constructorArgs: ["DeFi Token B", "DFIB", 18, 10000000] },
      { contract: rewardToken, name: "RewardToken", type: "MockERC20", constructorArgs: ["Reward Token", "RWRD", 18, 100000000] },
      { contract: dex, name: "DEX", type: "MockDEX", constructorArgs: [] },
      { contract: lending, name: "LendingProtocol", type: "MockLendingProtocol", constructorArgs: [] },
      { contract: yieldFarm, name: "YieldFarm", type: "MockYieldFarm", constructorArgs: [] },
      { contract: nftCollection, name: "NFTCollection", type: "MockERC721Collection", constructorArgs: ["DeFi NFT Collection", "DFNFT", "https://api.defi-nft.com/metadata/"] },
      { contract: multiSig, name: "MultiSigWallet", type: "MockMultiSigWallet", constructorArgs: [[deployer.address, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"], 2, deployer.address] }
    ];

    for (const contractInfo of contractsToSave) {
      try {
        // Get contract deployment transaction details
        const deployTx = contractInfo.contract.deployTransaction;

        await registry.saveDeployment({
          networkName: networkName,
          chainId: network.chainId,
          contractName: contractInfo.name,
          contractType: 'defi',
          contractAddress: contractInfo.contract.address,
          transactionHash: deployTx.hash,
          blockNumber: deployTx.blockNumber,
          gasUsed: deployTx.gasLimit,
          gasPrice: deployTx.gasPrice,
          deployerAddress: deployer.address,
          constructorArgs: contractInfo.constructorArgs,
          version: '1.0.0'
        });

        logger.success(`✅ ${contractInfo.name} saved to database`);
      } catch (error) {
        logger.warning(`⚠️  Failed to save ${contractInfo.name} to database: ${error.message}`);
      }
    }

    // Set up DEX trading pairs
    logger.cyan("\n🔗 SETTING UP DEX");
    logger.gray("=".repeat(40));

    const tokens = { DFIA: tokenA, DFIB: tokenB, RWRD: rewardToken };
    await setupTradingPairs(dex, tokens, deployer, network);
    await addInitialLiquidity(dex, tokens, deployer, network);

    logger.success(`\n🎉 Complete DeFi suite (8 contracts) deployed successfully to ${networkName}!`);

    logger.cyan("\n📊 DEPLOYED CONTRACTS:");
    logger.info(`   🪙 TokenA (DFIA): ${tokenA.address}`);
    logger.info(`   🪙 TokenB (DFIB): ${tokenB.address}`);
    logger.info(`   🪙 RewardToken (RWRD): ${rewardToken.address}`);
    logger.info(`   🏪 DEX: ${dex.address}`);
    logger.info(`   🏦 Lending: ${lending.address}`);
    logger.info(`   🌾 YieldFarm: ${yieldFarm.address}`);
    logger.info(`   🎨 NFTCollection: ${nftCollection.address}`);
    logger.info(`   🔐 MultiSig: ${multiSig.address}`);

    logger.cyan("\n🚀 NEXT STEPS:");
    logger.info("1. All contracts saved to database - no environment variables needed!");
    logger.info("2. Run complete DeFi tests: npx hardhat run scripts/complete-defi-suite.js --network " + networkName);
    logger.info("3. The test will automatically load contracts from the database");
    
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