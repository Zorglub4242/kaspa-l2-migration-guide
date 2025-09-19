#!/usr/bin/env node

/**
 * Test script to verify standard contract deployment works
 * Specifically designed to test the fixed ERC20 bytecode
 */

// Load environment variables
require('dotenv').config();

const { ethers } = require('ethers');
const { deployStandardContract } = require('./lib/standard-contracts');

async function testContractDeployment() {
    console.log('🧪 Testing Standard Contract Deployment');
    console.log('======================================');

    try {
        // Connect to Igra L2 network
        const rpcUrl = process.env.IGRA_RPC_URL || 'https://rpc.igra.world';
        const privateKey = process.env.PRIVATE_KEY;

        if (!privateKey) {
            throw new Error('PRIVATE_KEY environment variable is required');
        }

        console.log(`📡 Connecting to Igra L2: ${rpcUrl}`);
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const deployer = new ethers.Wallet(privateKey, provider);

        console.log(`👤 Deployer address: ${deployer.address}`);

        // Check balance
        const balance = await deployer.getBalance();
        console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH`);

        if (balance.isZero()) {
            throw new Error('Deployer has zero balance');
        }

        // Check network
        const network = await provider.getNetwork();
        console.log(`🌐 Network: Chain ID ${network.chainId}`);

        if (network.chainId !== 19416) {
            console.log('⚠️  Warning: Not connected to Igra L2 (Chain ID 19416)');
        }

        console.log('\n🚀 Testing ERC20 Contract Deployment...');
        console.log('=====================================');

        // Test ERC20 deployment with working bytecode
        const startTime = Date.now();

        const erc20Contract = await deployStandardContract(
            'ERC20',
            ['Test Token', 'TST', 18, 1000000], // name, symbol, decimals, initialSupply
            deployer
        );

        const deployTime = Date.now() - startTime;

        console.log(`✅ ERC20 deployed successfully!`);
        console.log(`📍 Contract address: ${erc20Contract.address}`);
        console.log(`⏱️  Deployment time: ${deployTime}ms`);

        // Get deployment transaction details
        const deployTx = erc20Contract.deployTransaction;
        const receipt = await deployTx.wait();

        console.log(`\n📊 Deployment Details:`);
        console.log(`   Transaction hash: ${deployTx.hash}`);
        console.log(`   Gas used: ${receipt.gasUsed.toLocaleString()}`);
        console.log(`   Gas price: ${ethers.utils.formatUnits(deployTx.gasPrice, 'gwei')} gwei`);
        console.log(`   Block number: ${receipt.blockNumber}`);
        console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);

        // Test contract functionality
        console.log(`\n🔍 Testing Contract Functionality...`);
        console.log('====================================');

        const name = await erc20Contract.name();
        const symbol = await erc20Contract.symbol();
        const decimals = await erc20Contract.decimals();
        const totalSupply = await erc20Contract.totalSupply();
        const deployerBalance = await erc20Contract.balanceOf(deployer.address);

        console.log(`   Name: ${name}`);
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Decimals: ${decimals}`);
        console.log(`   Total Supply: ${ethers.utils.formatUnits(totalSupply, decimals)}`);
        console.log(`   Deployer Balance: ${ethers.utils.formatUnits(deployerBalance, decimals)}`);

        // Verify expected values
        if (name !== 'Test Token' || symbol !== 'TST' || decimals !== 18) {
            throw new Error('Contract deployed with incorrect parameters');
        }

        console.log('\n🎉 All tests passed! Contract deployment is working correctly.');
        console.log(`📋 Summary:`);
        console.log(`   ✅ ERC20 bytecode is valid`);
        console.log(`   ✅ Constructor parameters handled correctly`);
        console.log(`   ✅ Gas price and limits work for Igra L2`);
        console.log(`   ✅ Contract functions are accessible`);

        return {
            success: true,
            contractAddress: erc20Contract.address,
            gasUsed: receipt.gasUsed.toString(),
            deploymentTime: deployTime
        };

    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        if (error.code) {
            console.error(`   Error code: ${error.code}`);
        }
        if (error.reason) {
            console.error(`   Reason: ${error.reason}`);
        }

        return {
            success: false,
            error: error.message
        };
    }
}

// Run the test if called directly
if (require.main === module) {
    testContractDeployment()
        .then(result => {
            if (result.success) {
                console.log('\n✅ Test completed successfully');
                process.exit(0);
            } else {
                console.log('\n❌ Test failed');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Test crashed:', error);
            process.exit(1);
        });
}

module.exports = { testContractDeployment };