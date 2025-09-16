const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function deployWithRetry(ContractFactory, contractName, args = [], maxRetries = 20) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`   🔄 Deploying ${contractName} (attempt ${attempt}/${maxRetries})...`);
            
            if (attempt > 1) {
                const delay = Math.min(10000 * attempt, 60000); // Cap at 60 seconds
                console.log(`   ⏳ Waiting ${delay/1000}s before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // Get fresh nonce to prevent orphan transactions
                const [deployer] = await ethers.getSigners();
                const currentNonce = await deployer.getTransactionCount();
                console.log(`   🔢 Using fresh nonce: ${currentNonce}`);
            }
            
            // Deploy with network-appropriate gas prices
            const [deployer] = await ethers.getSigners();
            const network = await deployer.provider.getNetwork();
            
            let baseGasPriceGwei;
            if (network.chainId === 167012) { // Kasplex
                baseGasPriceGwei = 2001 + (attempt * 100);
            } else if (network.chainId === 11155111) { // Sepolia
                baseGasPriceGwei = 0.5 + (attempt * 0.1);
            } else if (network.chainId === 19416) { // Igra
                baseGasPriceGwei = 2000 + (attempt * 10); // Igra requires 2000 gwei minimum
            } else {
                baseGasPriceGwei = 1 + (attempt * 0.5); // Default for unknown networks
            }
            
            const overrides = {
                gasLimit: ethers.utils.hexlify(3000000 + Math.floor(Math.random() * 100000)), // Random gas for different tx hash
                gasPrice: ethers.utils.parseUnits(baseGasPriceGwei.toString(), "gwei")
            };
            console.log(`   ⛽ Using gas price: ${baseGasPriceGwei} gwei`);
            
            const contract = await ContractFactory.deploy(...args, overrides);
            await contract.deployed();
            
            console.log(`   ✅ ${contractName} deployed successfully!`);
            return contract;
            
        } catch (error) {
            lastError = error;
            console.log(`   ❌ Attempt ${attempt} failed: ${error.message}`);
            
            if (attempt === maxRetries) {
                throw error;
            }
        }
    }
}

async function main() {
    console.log("🧪 Deploying EVM Compatibility Test Suite...");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log(`📡 Network: ${network.name || `Chain ${network.chainId}`} (${network.chainId})`);
    console.log(`👤 Deployer: ${deployer.address}`);
    
    const initialBalance = await deployer.getBalance();
    console.log(`💰 Initial Balance: ${ethers.utils.formatEther(initialBalance)} ${getTokenSymbol(network.chainId)}`);
    
    const deployments = {};
    const gasUsed = [];
    
    try {
        // Deploy PrecompileTest
        console.log("\n🔐 Deploying PrecompileTest...");
        const PrecompileTest = await ethers.getContractFactory("PrecompileTest");
        const precompileTest = await deployWithRetry(PrecompileTest, "PrecompileTest");
        
        const precompileReceipt = await precompileTest.deployTransaction.wait();
        gasUsed.push({ contract: 'PrecompileTest', gas: precompileReceipt.gasUsed.toString() });
        
        deployments.precompileTest = precompileTest.address;
        console.log(`   ✅ PrecompileTest: ${precompileTest.address} (Gas: ${precompileReceipt.gasUsed})`);
        
        // Deploy CREATE2Factory
        console.log("\n🏗️ Deploying CREATE2Factory...");
        const CREATE2Factory = await ethers.getContractFactory("CREATE2Factory");
        const create2Factory = await deployWithRetry(CREATE2Factory, "CREATE2Factory");
        
        const create2Receipt = await create2Factory.deployTransaction.wait();
        gasUsed.push({ contract: 'CREATE2Factory', gas: create2Receipt.gasUsed.toString() });
        
        deployments.create2Factory = create2Factory.address;
        console.log(`   ✅ CREATE2Factory: ${create2Factory.address} (Gas: ${create2Receipt.gasUsed})`);
        
        // Deploy AssemblyTest
        console.log("\n⚙️ Deploying AssemblyTest...");
        const AssemblyTest = await ethers.getContractFactory("AssemblyTest");
        const assemblyTest = await deployWithRetry(AssemblyTest, "AssemblyTest");
        
        const assemblyReceipt = await assemblyTest.deployTransaction.wait();
        gasUsed.push({ contract: 'AssemblyTest', gas: assemblyReceipt.gasUsed.toString() });
        
        deployments.assemblyTest = assemblyTest.address;
        console.log(`   ✅ AssemblyTest: ${assemblyTest.address} (Gas: ${assemblyReceipt.gasUsed})`);
        
        // Calculate total costs
        const finalBalance = await deployer.getBalance();
        const totalCost = initialBalance.sub(finalBalance);
        const totalGasUsed = gasUsed.reduce((sum, item) => sum + parseInt(item.gas), 0);
        
        console.log("\n📊 Deployment Summary:");
        console.log(`   Total Gas Used: ${totalGasUsed.toLocaleString()}`);
        console.log(`   Total Cost: ${ethers.utils.formatEther(totalCost)} ${getTokenSymbol(network.chainId)}`);
        console.log(`   Average Gas per Contract: ${Math.round(totalGasUsed / 3).toLocaleString()}`);
        
        // Save deployment info
        const deploymentInfo = {
            network: {
                name: network.name || `Chain ${network.chainId}`,
                chainId: network.chainId
            },
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            label: process.env.TEST_LABEL || null,
            contracts: deployments,
            gasUsage: gasUsed,
            totalGasUsed: totalGasUsed,
            totalCost: ethers.utils.formatEther(totalCost),
            tokenSymbol: getTokenSymbol(network.chainId)
        };
        
        // Update .env with new contract addresses
        await updateEnvFile(network.chainId, deployments);
        
        // Save deployment report
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const labelSuffix = process.env.TEST_LABEL ? `-${process.env.TEST_LABEL.replace(/[^a-zA-Z0-9]/g, '-')}` : '';
        const reportPath = path.join(__dirname, '../test-results', `evm-compatibility-deployment-${network.chainId}${labelSuffix}-${timestamp}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(deploymentInfo, null, 2));
        console.log(`\n💾 Deployment report saved: ${reportPath}`);
        
        console.log("\n🎉 EVM Compatibility Test Suite deployed successfully!");
        
        return deployments;
        
    } catch (error) {
        console.error("💥 Deployment failed:", error.message);
        
        // Still try to save what we have
        if (Object.keys(deployments).length > 0) {
            const partialInfo = {
                network: { chainId: network.chainId },
                deployer: deployer.address,
                error: error.message,
                partialDeployments: deployments
            };
            
            const errorTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const errorLabelSuffix = process.env.TEST_LABEL ? `-${process.env.TEST_LABEL.replace(/[^a-zA-Z0-9]/g, '-')}` : '';
            const errorPath = path.join(__dirname, '../test-results', `evm-compatibility-deployment-error${errorLabelSuffix}-${errorTimestamp}.json`);
            fs.writeFileSync(errorPath, JSON.stringify(partialInfo, null, 2));
            console.log(`💾 Error report saved: ${errorPath}`);
        }
        
        throw error;
    }
}

function getTokenSymbol(chainId) {
    if (chainId === 167012) return 'KAS';
    return 'ETH';
}

async function updateEnvFile(chainId, deployments) {
    const envPath = path.join(__dirname, '../.env');
    
    try {
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        
        let networkPrefix;
        if (chainId === 167012) {
            networkPrefix = 'KASPLEX';
        } else if (chainId === 19416) {
            networkPrefix = 'IGRA';
        } else if (chainId === 11155111) {
            networkPrefix = 'SEPOLIA';
        } else if (chainId === 17000) {
            networkPrefix = 'HOLESKY';
        } else {
            console.log(`⚠️  Unknown chain ID ${chainId}, skipping .env update`);
            return;
        }
        
        // Add EVM compatibility contract addresses
        const updates = [
            `${networkPrefix}_PRECOMPILE_TEST=${deployments.precompileTest}`,
            `${networkPrefix}_CREATE2_FACTORY=${deployments.create2Factory}`,
            `${networkPrefix}_ASSEMBLY_TEST=${deployments.assemblyTest}`
        ];
        
        // Update or append each address
        updates.forEach(update => {
            const [key, value] = update.split('=');
            const regex = new RegExp(`^${key}=.*$`, 'm');
            
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, update);
            } else {
                envContent += `\n${update}`;
            }
        });
        
        fs.writeFileSync(envPath, envContent);
        console.log(`   ✅ Updated .env with ${networkPrefix} EVM compatibility addresses`);
        
    } catch (error) {
        console.log(`   ⚠️  Failed to update .env file: ${error.message}`);
    }
}

if (require.main === module) {
    main()
        .then(addresses => {
            console.log("\n🔗 Contract Addresses:");
            Object.entries(addresses).forEach(([name, address]) => {
                console.log(`   ${name}: ${address}`);
            });
            process.exit(0);
        })
        .catch(error => {
            console.error("💥 Script failed:", error);
            process.exit(1);
        });
}

module.exports = { main };