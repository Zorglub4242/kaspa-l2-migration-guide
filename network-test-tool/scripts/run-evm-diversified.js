const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

class DiversifiedEVMTester {
    constructor() {
        this.results = {
            network: {},
            timestamp: new Date().toISOString(),
            tests: [],
            summary: {},
            deployments: {},
            sessionInfo: {
                strategy: "DeFi-style diversified EVM testing",
                description: "Mimics successful DeFi suite timing and transaction diversity"
            }
        };
        this.testCount = 0;
        this.successCount = 0;
        
        // Using existing deployed contracts
        this.contracts = {
            precompileTest: null,
            assemblyTest: null,
            create2Factory: null,
            tokenA: null,
            dex: null,
            yieldFarm: null
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

        console.log("\n🚀 DIVERSIFIED EVM COMPATIBILITY TESTER");
        console.log("================================================================================");
        console.log("📋 Strategy: DeFi-style diverse transaction testing");
        console.log(`🌐 Network: ${this.results.network.name} (Chain ID: ${this.results.network.chainId})`);
        console.log(`👤 Tester: ${deployer.address}`);
        
        const balance = await deployer.getBalance();
        console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH`);

        // Load existing contract addresses
        await this.loadExistingContracts();
        
        console.log("\n⏸️  Initial 10-second preparation delay...");
        await this.sleep(10000);
    }

    async loadExistingContracts() {
        const network = this.results.network.chainId;
        
        console.log("📡 Loading existing deployed contracts...");
        
        try {
            // Load contract addresses from .env
            const precompileAddr = network === 167012 ? 
                process.env.KASPLEX_PRECOMPILE_TEST : 
                process.env.SEPOLIA_PRECOMPILE_TEST;
                
            const assemblyAddr = network === 167012 ? 
                process.env.KASPLEX_ASSEMBLY_TEST : 
                process.env.SEPOLIA_ASSEMBLY_TEST;
                
            const create2Addr = network === 167012 ? 
                process.env.KASPLEX_CREATE2_FACTORY : 
                process.env.SEPOLIA_CREATE2_FACTORY;

            const tokenAAddr = network === 167012 ? 
                process.env.KASPLEX_TOKEN_A : 
                process.env.SEPOLIA_TOKEN_A;

            const dexAddr = network === 167012 ? 
                process.env.KASPLEX_DEX : 
                process.env.SEPOLIA_DEX;

            const yieldAddr = network === 167012 ? 
                process.env.KASPLEX_YIELD_FARM : 
                process.env.SEPOLIA_YIELD_FARM;

            if (!precompileAddr || !assemblyAddr || !create2Addr) {
                throw new Error("EVM test contract addresses not found in environment");
            }

            // Load contract instances
            const PrecompileTest = await ethers.getContractFactory("PrecompileTest");
            const AssemblyTest = await ethers.getContractFactory("AssemblyTest");
            const CREATE2Factory = await ethers.getContractFactory("CREATE2Factory");
            
            this.contracts.precompileTest = PrecompileTest.attach(precompileAddr);
            this.contracts.assemblyTest = AssemblyTest.attach(assemblyAddr);
            this.contracts.create2Factory = CREATE2Factory.attach(create2Addr);

            // Load DeFi contracts if available
            if (tokenAAddr) {
                try {
                    const MockERC20 = await ethers.getContractFactory("MockERC20");
                    this.contracts.tokenA = MockERC20.attach(tokenAAddr);
                    console.log("✅ Loaded ERC20 token contract");
                } catch (e) {
                    console.log("⚠️ ERC20 contract not available:", e.message);
                }
            }
            
            // Note: Skipping other DeFi contracts to focus on EVM compatibility tests

            this.results.deployments = {
                precompileTest: precompileAddr,
                assemblyTest: assemblyAddr,
                create2Factory: create2Addr,
                tokenA: tokenAAddr,
                dex: dexAddr,
                yieldFarm: yieldAddr
            };

            console.log(`✅ Loaded EVM test contracts: ${precompileAddr}`);
            console.log(`✅ Loaded DeFi contracts: ${tokenAAddr ? 'Available' : 'Not available'}`);
            
        } catch (error) {
            console.log(`❌ Error loading contracts: ${error.message}`);
            throw error;
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
            
            // DeFi-style delay after each test
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
            
            // Still wait after failures to maintain rhythm
            await this.sleep(8000);
        }
    }

    async runDiversifiedTests() {
        console.log("\n📋 PHASE 1: DIVERSIFIED EVM FUNCTION TESTING");
        console.log("------------------------------------------------------------");
        
        // Test 1: Start with a view function (known to work)
        await this.executeTest(
            "assembly_bitwise_warmup",
            "Warmup test with assembly bitwise operations",
            async () => {
                return await this.contracts.assemblyTest.testBitwiseOperations();
            },
            20000 // 20 second delay
        );

        // Test 2: Assembly gas operations (another view function)
        await this.executeTest(
            "assembly_gas_measurement_early",
            "Test assembly gas operations early in sequence",
            async () => {
                return await this.contracts.assemblyTest.testGasOperations();
            },
            18000
        );

        // Test 3: Try ecrecover (precompile)
        await this.executeTest(
            "ecrecover_signature_recovery",
            "Test ecrecover precompile for signature recovery",
            async () => {
                const tx = await this.contracts.precompileTest.testEcrecover(this.getGasOverrides());
                return tx;
            },
            25000 // Longer delay after precompile
        );

        // Test 4: Assembly gas operations (view function)
        await this.executeTest(
            "assembly_gas_measurement",
            "Test assembly gas operations and measurement",
            async () => {
                return await this.contracts.assemblyTest.testGasOperations();
            },
            15000
        );

        // Test 5: SHA256 precompile
        await this.executeTest(
            "sha256_hash_function",
            "Test SHA256 hash precompile function",
            async () => {
                const data = ethers.utils.toUtf8Bytes("Hello Kasplex Diversified Test");
                const tx = await this.contracts.precompileTest.testSha256(data, this.getGasOverrides());
                return tx;
            },
            22000
        );

        // Test 6: Another assembly operation (view function)
        await this.executeTest(
            "assembly_bitwise_second",
            "Test assembly bitwise operations again with different timing",
            async () => {
                return await this.contracts.assemblyTest.testBitwiseOperations();
            },
            16000
        );

        // Test 7: Assembly memory operations
        await this.executeTest(
            "assembly_memory_ops",
            "Test assembly memory allocation and operations",
            async () => {
                const tx = await this.contracts.assemblyTest.testMemoryOperations(this.getGasOverrides());
                return tx;
            },
            28000 // Longer delay
        );

        // Test 8: RIPEMD160 precompile
        await this.executeTest(
            "ripemd160_hash",
            "Test RIPEMD160 hash precompile",
            async () => {
                const data = ethers.utils.toUtf8Bytes("Diversified EVM Test");
                const tx = await this.contracts.precompileTest.testRipemd160(data, this.getGasOverrides());
                return tx;
            },
            20000
        );

        // Test 9: Assembly gas operations (third view function test)
        await this.executeTest(
            "assembly_gas_third",
            "Test assembly gas operations third time for consistency",
            async () => {
                return await this.contracts.assemblyTest.testGasOperations();
            },
            17000
        );

        // Test 10: ModExp precompile
        await this.executeTest(
            "modular_exponentiation",
            "Test modular exponentiation precompile",
            async () => {
                const tx = await this.contracts.precompileTest.testModExp(this.getGasOverrides());
                return tx;
            },
            24000
        );

        // Test 11: Assembly storage operations  
        await this.executeTest(
            "assembly_storage_access",
            "Test assembly storage slot access operations",
            async () => {
                const tx = await this.contracts.assemblyTest.testStorageOperations(this.getGasOverrides());
                return tx;
            },
            26000
        );

        // Test 12: Identity precompile
        await this.executeTest(
            "identity_precompile",
            "Test identity precompile function",
            async () => {
                const data = ethers.utils.toUtf8Bytes("Identity test data for diversified EVM");
                const tx = await this.contracts.precompileTest.testIdentity(data, this.getGasOverrides());
                return tx;
            },
            21000
        );

        // Test 13: CREATE2 factory operation
        await this.executeTest(
            "create2_deterministic",
            "Test CREATE2 deterministic contract deployment",
            async () => {
                const salt = ethers.utils.randomBytes(32);
                const bytecode = "0x608060405234801561001057600080fd5b50600080fd5b60006020828403121561002f57600080fd5b81356001600160a01b038116811461004657600080fd5b939250505056";
                const tx = await this.contracts.create2Factory.deployContract(bytecode, salt, this.getGasOverrides());
                return tx;
            },
            30000 // Longest delay after deployment
        );

        console.log("\n📊 GENERATING DIVERSIFIED TEST ANALYSIS");
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
            precompiles: { passed: 0, total: 0, rate: "0.0%" },
            assembly: { passed: 0, total: 0, rate: "0.0%" },
            create2: { passed: 0, total: 0, rate: "0.0%" },
            defi: { passed: 0, total: 0, rate: "0.0%" }
        };

        this.results.tests.forEach(test => {
            if (test.name.includes("ecrecover") || test.name.includes("sha256") || 
                test.name.includes("ripemd160") || test.name.includes("modexp") || 
                test.name.includes("identity")) {
                categories.precompiles.total++;
                if (test.success) categories.precompiles.passed++;
            } else if (test.name.includes("assembly")) {
                categories.assembly.total++;
                if (test.success) categories.assembly.passed++;
            } else if (test.name.includes("create2")) {
                categories.create2.total++;
                if (test.success) categories.create2.passed++;
            } else if (test.name.includes("token") || test.name.includes("dex") || test.name.includes("yield")) {
                categories.defi.total++;
                if (test.success) categories.defi.passed++;
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

        console.log(`🎉 DIVERSIFIED EVM TEST COMPLETED!`);
        console.log(`📊 Success Rate: ${successRate}%`);
        console.log(`⛽ Total Gas: ${totalGasUsed.toLocaleString()}`);
        console.log(`📈 Precompiles: ${categories.precompiles.rate} | Assembly: ${categories.assembly.rate} | CREATE2: ${categories.create2.rate}`);
    }

    async saveResults() {
        const filename = `evm-diversified-${this.results.network.chainId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filepath = path.join(__dirname, '..', 'test-results', filename);
        
        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        
        console.log(`💾 Results saved: ${filepath}`);
        return filepath;
    }

    async run() {
        try {
            await this.initialize();
            await this.runDiversifiedTests();
            this.generateSummary();
            await this.saveResults();
        } catch (error) {
            console.error("❌ Diversified EVM test failed:", error.message);
            this.results.error = error.message;
            await this.saveResults();
        }
    }
}

// Run the diversified EVM tester
async function main() {
    const tester = new DiversifiedEVMTester();
    await tester.run();
}

main().catch(console.error);