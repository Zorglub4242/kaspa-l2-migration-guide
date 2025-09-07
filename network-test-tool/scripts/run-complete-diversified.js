const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

class CompleteDiversifiedTester {
    constructor() {
        this.results = {
            network: {},
            timestamp: new Date().toISOString(),
            tests: [],
            summary: {},
            deployments: {},
            sessionInfo: {
                strategy: "Complete diversified testing: DeFi + EVM compatibility",
                description: "Combines DeFi operations with EVM tests using optimal timing"
            }
        };
        this.testCount = 0;
        this.successCount = 0;
        
        // Full contract suite
        this.contracts = {
            // EVM test contracts
            precompileTest: null,
            assemblyTest: null,
            create2Factory: null,
            // DeFi contracts
            tokenA: null,
            tokenB: null,
            rewardToken: null,
            dex: null,
            lending: null,
            yieldFarm: null,
            nft: null,
            multiSig: null
        };
    }

    async initialize() {
        const [deployer] = await ethers.getSigners();
        this.deployer = deployer;
        
        const network = await ethers.provider.getNetwork();
        this.results.network = {
            name: network.name || "unknown",
            chainId: network.chainId
        };

        console.log("\n🚀 COMPLETE DIVERSIFIED TESTER");
        console.log("================================================================================");
        console.log("📋 Strategy: Combined DeFi + EVM compatibility testing");
        console.log(`🌐 Network: ${this.results.network.name} (Chain ID: ${this.results.network.chainId})`);
        console.log(`👤 Tester: ${deployer.address}`);
        
        const balance = await deployer.getBalance();
        console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH`);

        await this.loadAllContracts();
        
        console.log("\n⏸️  Initial 10-second preparation delay...");
        await this.sleep(10000);
    }

    async loadAllContracts() {
        const network = this.results.network.chainId;
        
        console.log("📡 Loading all deployed contracts...");
        
        try {
            // Load EVM test contract addresses
            const precompileAddr = network === 167012 ? 
                process.env.KASPLEX_PRECOMPILE_TEST : 
                process.env.SEPOLIA_PRECOMPILE_TEST;
                
            const assemblyAddr = network === 167012 ? 
                process.env.KASPLEX_ASSEMBLY_TEST : 
                process.env.SEPOLIA_ASSEMBLY_TEST;
                
            const create2Addr = network === 167012 ? 
                process.env.KASPLEX_CREATE2_FACTORY : 
                process.env.SEPOLIA_CREATE2_FACTORY;

            // Load DeFi contract addresses
            const tokenAAddr = network === 167012 ? process.env.KASPLEX_TOKEN_A : process.env.SEPOLIA_TOKEN_A;
            const tokenBAddr = network === 167012 ? process.env.KASPLEX_TOKEN_B : process.env.SEPOLIA_TOKEN_B;
            const rewardAddr = network === 167012 ? process.env.KASPLEX_REWARD_TOKEN : process.env.SEPOLIA_REWARD_TOKEN;
            const dexAddr = network === 167012 ? process.env.KASPLEX_DEX : process.env.SEPOLIA_DEX;
            const lendingAddr = network === 167012 ? process.env.KASPLEX_LENDING : process.env.SEPOLIA_LENDING;
            const yieldAddr = network === 167012 ? process.env.KASPLEX_YIELD_FARM : process.env.SEPOLIA_YIELD_FARM;
            const nftAddr = network === 167012 ? process.env.KASPLEX_NFT : process.env.SEPOLIA_NFT;
            const multiSigAddr = network === 167012 ? process.env.KASPLEX_MULTISIG : process.env.SEPOLIA_MULTISIG;

            // Load EVM test contracts
            if (precompileAddr && assemblyAddr && create2Addr) {
                const PrecompileTest = await ethers.getContractFactory("PrecompileTest");
                const AssemblyTest = await ethers.getContractFactory("AssemblyTest");
                const CREATE2Factory = await ethers.getContractFactory("CREATE2Factory");
                
                this.contracts.precompileTest = PrecompileTest.attach(precompileAddr);
                this.contracts.assemblyTest = AssemblyTest.attach(assemblyAddr);
                this.contracts.create2Factory = CREATE2Factory.attach(create2Addr);
                console.log("✅ Loaded EVM test contracts");
            }

            // Load DeFi contracts
            if (tokenAAddr && dexAddr) {
                const MockERC20 = await ethers.getContractFactory("MockERC20");
                const MockDEX = await ethers.getContractFactory("MockDEX");
                const LendingProtocol = await ethers.getContractFactory("LendingProtocol");
                const YieldFarm = await ethers.getContractFactory("YieldFarm");
                const MockERC721Collection = await ethers.getContractFactory("MockERC721Collection");
                const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
                
                this.contracts.tokenA = MockERC20.attach(tokenAAddr);
                this.contracts.tokenB = tokenBAddr ? MockERC20.attach(tokenBAddr) : null;
                this.contracts.rewardToken = rewardAddr ? MockERC20.attach(rewardAddr) : null;
                this.contracts.dex = MockDEX.attach(dexAddr);
                this.contracts.lending = lendingAddr ? LendingProtocol.attach(lendingAddr) : null;
                this.contracts.yieldFarm = yieldAddr ? YieldFarm.attach(yieldAddr) : null;
                this.contracts.nft = nftAddr ? MockERC721Collection.attach(nftAddr) : null;
                this.contracts.multiSig = multiSigAddr ? MultiSigWallet.attach(multiSigAddr) : null;
                
                console.log("✅ Loaded DeFi contract suite");
            }

            this.results.deployments = {
                precompileTest: precompileAddr,
                assemblyTest: assemblyAddr,
                create2Factory: create2Addr,
                tokenA: tokenAAddr,
                tokenB: tokenBAddr,
                rewardToken: rewardAddr,
                dex: dexAddr,
                lending: lendingAddr,
                yieldFarm: yieldAddr,
                nft: nftAddr,
                multiSig: multiSigAddr
            };
            
        } catch (error) {
            console.log(`❌ Error loading contracts: ${error.message}`);
            console.log("⚠️ Will proceed with available contracts only");
        }
    }

    getGasOverrides() {
        const network = this.results.network?.chainId;
        if (network === 11155111) { // Sepolia
            return {
                gasPrice: ethers.utils.parseUnits("20", "gwei"),
                gasLimit: 3000000
            };
        } else if (network === 167012) { // Kasplex
            return {
                gasPrice: ethers.utils.parseUnits("2001", "gwei"),
                gasLimit: 3000000
            };
        }
        return { gasLimit: 3000000 };
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async logTransaction(testName, description, txHash, gasUsed, blockNumber, success = true) {
        const timestamp = new Date().toLocaleTimeString();
        if (success) {
            console.log(`[${timestamp}] 📝 ${testName} | Hash: ${txHash} | Gas: ${gasUsed?.toLocaleString()} | Block: ${blockNumber}`);
        } else {
            console.log(`[${timestamp}] ❌ ${testName} | Failed`);
        }
    }

    async executeTest(testName, description, testFunction, delayAfter = 15000) {
        this.testCount++;
        const startTime = Date.now();
        
        try {
            const result = await testFunction();
            const duration = Date.now() - startTime;
            
            let gasUsed = "0";
            let hash = "view_function";
            let blockNumber = 0;
            let events = 0;
            
            if (result && result.hash) {
                hash = result.hash;
                const receipt = await result.wait();
                gasUsed = receipt.gasUsed.toString();
                blockNumber = receipt.blockNumber;
                events = receipt.events ? receipt.events.length : 0;
                
                await this.logTransaction(testName, description, hash, receipt.gasUsed, blockNumber, true);
            } else {
                console.log(`[${new Date().toLocaleTimeString()}] ✅ ${testName} | View function | Duration: ${duration}ms`);
            }

            this.results.tests.push({
                name: testName,
                description,
                success: true,
                duration,
                gasUsed,
                hash,
                blockNumber,
                events
            });
            
            this.successCount++;
            
            // Diversified delay pattern
            console.log(`⏸️  Waiting ${delayAfter/1000}s for network stabilization...`);
            await this.sleep(delayAfter);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.results.tests.push({
                name: testName,
                description,
                success: false,
                error: error.message,
                duration,
                gasUsed: "0"
            });
            
            console.log(`[${new Date().toLocaleTimeString()}] ❌ ${testName} | ${error.message}`);
            
            // Still wait after failures
            await this.sleep(8000);
        }
    }

    async runCompleteDiversifiedTests() {
        console.log("\n📋 PHASE 1: COMPLETE DIVERSIFIED TESTING");
        console.log("------------------------------------------------------------");
        
        // Test 1: Start with assembly view function (guaranteed success)
        if (this.contracts.assemblyTest) {
            await this.executeTest(
                "assembly_warmup",
                "Assembly bitwise operations warmup",
                async () => {
                    return await this.contracts.assemblyTest.testBitwiseOperations();
                },
                20000
            );
        }

        // Test 2: DeFi token balance check (view function)
        if (this.contracts.tokenA) {
            await this.executeTest(
                "defi_token_balance",
                "Check DeFi token A balance",
                async () => {
                    return await this.contracts.tokenA.balanceOf(this.deployer.address);
                },
                18000
            );
        }

        // Test 3: EVM precompile test (transaction)
        if (this.contracts.precompileTest) {
            await this.executeTest(
                "evm_ecrecover",
                "Test EVM ecrecover precompile",
                async () => {
                    const tx = await this.contracts.precompileTest.testEcrecover(this.getGasOverrides());
                    return tx;
                },
                25000 // Longer delay after precompile
            );
        }

        // Test 4: DeFi DEX query (view function)
        if (this.contracts.dex) {
            await this.executeTest(
                "defi_dex_info",
                "Query DeFi DEX trading information",
                async () => {
                    return await this.contracts.dex.getTotalLiquidity();
                },
                16000
            );
        }

        // Test 5: Assembly gas operations (view function)
        if (this.contracts.assemblyTest) {
            await this.executeTest(
                "evm_assembly_gas",
                "Test EVM assembly gas operations",
                async () => {
                    return await this.contracts.assemblyTest.testGasOperations();
                },
                19000
            );
        }

        // Test 6: DeFi token transfer (transaction)
        if (this.contracts.tokenA) {
            await this.executeTest(
                "defi_token_transfer",
                "DeFi token transfer operation",
                async () => {
                    const amount = ethers.utils.parseEther("1.0");
                    const tx = await this.contracts.tokenA.transfer(this.deployer.address, amount, this.getGasOverrides());
                    return tx;
                },
                22000
            );
        }

        // Test 7: EVM SHA256 precompile (transaction)
        if (this.contracts.precompileTest) {
            await this.executeTest(
                "evm_sha256",
                "Test EVM SHA256 precompile function",
                async () => {
                    const data = ethers.utils.toUtf8Bytes("Complete Diversified Test");
                    const tx = await this.contracts.precompileTest.testSha256(data, this.getGasOverrides());
                    return tx;
                },
                24000
            );
        }

        // Test 8: DeFi lending query (view function if available)
        if (this.contracts.lending) {
            await this.executeTest(
                "defi_lending_info",
                "Query DeFi lending protocol information",
                async () => {
                    return await this.contracts.lending.getTotalSupplied();
                },
                17000
            );
        }

        // Test 9: EVM assembly memory (transaction)
        if (this.contracts.assemblyTest) {
            await this.executeTest(
                "evm_assembly_memory",
                "Test EVM assembly memory operations",
                async () => {
                    const tx = await this.contracts.assemblyTest.testMemoryOperations(this.getGasOverrides());
                    return tx;
                },
                26000
            );
        }

        // Test 10: DeFi yield farming (view function if available)
        if (this.contracts.yieldFarm) {
            await this.executeTest(
                "defi_yield_info",
                "Query DeFi yield farming information",
                async () => {
                    return await this.contracts.yieldFarm.getTotalStaked();
                },
                18000
            );
        }

        // Test 11: EVM RIPEMD160 precompile (transaction)
        if (this.contracts.precompileTest) {
            await this.executeTest(
                "evm_ripemd160",
                "Test EVM RIPEMD160 precompile",
                async () => {
                    const data = ethers.utils.toUtf8Bytes("Diversified EVM+DeFi Test");
                    const tx = await this.contracts.precompileTest.testRipemd160(data, this.getGasOverrides());
                    return tx;
                },
                23000
            );
        }

        // Test 12: DeFi NFT balance (view function if available)
        if (this.contracts.nft) {
            await this.executeTest(
                "defi_nft_balance",
                "Check DeFi NFT collection balance",
                async () => {
                    return await this.contracts.nft.balanceOf(this.deployer.address);
                },
                16000
            );
        }

        // Test 13: EVM ModExp precompile (transaction)
        if (this.contracts.precompileTest) {
            await this.executeTest(
                "evm_modexp",
                "Test EVM modular exponentiation precompile",
                async () => {
                    const tx = await this.contracts.precompileTest.testModExp(this.getGasOverrides());
                    return tx;
                },
                25000
            );
        }

        // Test 14: EVM assembly storage (transaction)
        if (this.contracts.assemblyTest) {
            await this.executeTest(
                "evm_assembly_storage",
                "Test EVM assembly storage operations",
                async () => {
                    const tx = await this.contracts.assemblyTest.testStorageOperations(this.getGasOverrides());
                    return tx;
                },
                27000
            );
        }

        // Test 15: EVM Identity precompile (transaction)
        if (this.contracts.precompileTest) {
            await this.executeTest(
                "evm_identity",
                "Test EVM identity precompile function",
                async () => {
                    const data = ethers.utils.toUtf8Bytes("Final diversified test data");
                    const tx = await this.contracts.precompileTest.testIdentity(data, this.getGasOverrides());
                    return tx;
                },
                21000
            );
        }

        // Test 16: EVM CREATE2 deployment (transaction)
        if (this.contracts.create2Factory) {
            await this.executeTest(
                "evm_create2",
                "Test EVM CREATE2 deterministic deployment",
                async () => {
                    const salt = ethers.utils.randomBytes(32);
                    const bytecode = "0x608060405234801561001057600080fd5b50600080fd5b60006020828403121561002f57600080fd5b81356001600160a01b038116811461004657600080fd5b939250505056";
                    const tx = await this.contracts.create2Factory.deployContract(bytecode, salt, this.getGasOverrides());
                    return tx;
                },
                30000 // Longest delay after deployment
            );
        }

        console.log("\n📊 GENERATING COMPLETE ANALYSIS");
        console.log("------------------------------------------------------------");
    }

    generateSummary() {
        const totalGasUsed = this.results.tests.reduce((sum, test) => {
            return sum + parseInt(test.gasUsed || "0");
        }, 0);

        const avgGasPerTest = totalGasUsed > 0 ? Math.round(totalGasUsed / this.testCount) : 0;
        const successRate = ((this.successCount / this.testCount) * 100).toFixed(2);

        // Categorize tests
        const categories = {
            evm_precompiles: { passed: 0, total: 0, rate: "0.0%" },
            evm_assembly: { passed: 0, total: 0, rate: "0.0%" },
            evm_create2: { passed: 0, total: 0, rate: "0.0%" },
            defi_operations: { passed: 0, total: 0, rate: "0.0%" }
        };

        this.results.tests.forEach(test => {
            if (test.name.includes("evm_") && (test.name.includes("ecrecover") || 
                test.name.includes("sha256") || test.name.includes("ripemd160") || 
                test.name.includes("modexp") || test.name.includes("identity"))) {
                categories.evm_precompiles.total++;
                if (test.success) categories.evm_precompiles.passed++;
            } else if (test.name.includes("evm_assembly") || test.name.includes("assembly")) {
                categories.evm_assembly.total++;
                if (test.success) categories.evm_assembly.passed++;
            } else if (test.name.includes("evm_create2") || test.name.includes("create2")) {
                categories.evm_create2.total++;
                if (test.success) categories.evm_create2.passed++;
            } else if (test.name.includes("defi_")) {
                categories.defi_operations.total++;
                if (test.success) categories.defi_operations.passed++;
            }
        });

        Object.keys(categories).forEach(cat => {
            const category = categories[cat];
            category.rate = category.total > 0 ? 
                ((category.passed / category.total) * 100).toFixed(1) + "%" : 
                "0.0%";
        });

        this.results.summary = {
            totalTests: this.testCount,
            successfulTests: this.successCount,
            failedTests: this.testCount - this.successCount,
            successRate: successRate + "%",
            totalGasUsed: totalGasUsed,
            averageGasPerTest: avgGasPerTest,
            categories: categories
        };

        console.log(`🎉 COMPLETE DIVERSIFIED TEST FINISHED!`);
        console.log(`📊 Success Rate: ${successRate}%`);
        console.log(`⛽ Total Gas: ${totalGasUsed.toLocaleString()}`);
        console.log(`📈 EVM Precompiles: ${categories.evm_precompiles.rate} | Assembly: ${categories.evm_assembly.rate} | CREATE2: ${categories.evm_create2.rate} | DeFi: ${categories.defi_operations.rate}`);
    }

    async saveResults() {
        const filename = `complete-diversified-${this.results.network.chainId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filepath = path.join(__dirname, '..', 'test-results', filename);
        
        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        
        console.log(`💾 Results saved: ${filepath}`);
        return filepath;
    }

    async run() {
        try {
            await this.initialize();
            await this.runCompleteDiversifiedTests();
            this.generateSummary();
            await this.saveResults();
        } catch (error) {
            console.error("❌ Complete diversified test failed:", error.message);
            this.results.error = error.message;
            await this.saveResults();
        }
    }
}

// Run the complete diversified tester
async function main() {
    const tester = new CompleteDiversifiedTester();
    await tester.run();
}

main().catch(console.error);