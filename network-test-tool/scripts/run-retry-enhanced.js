const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

class RetryEnhancedTester {
    constructor() {
        this.results = {
            network: {},
            timestamp: new Date().toISOString(),
            tests: [],
            summary: {},
            deployments: {},
            sessionInfo: {
                strategy: "Retry-Enhanced EVM Testing with Anti-Orphan Logic",
                description: "Advanced retry logic to achieve 100% test success by overcoming orphan transactions"
            }
        };
        this.testCount = 0;
        this.successCount = 0;
        this.maxRetries = 5;
        this.baseRetryDelay = 30000; // 30 seconds base delay
        
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

        console.log("\n🚀 RETRY-ENHANCED EVM COMPATIBILITY TESTER");
        console.log("================================================================================");
        console.log("📋 Strategy: Advanced retry logic to achieve 100% test success");
        console.log("🔄 Max Retries: 5 per test with exponential backoff");
        console.log(`🌐 Network: ${this.results.network.name} (Chain ID: ${this.results.network.chainId})`);
        console.log(`👤 Tester: ${deployer.address}`);
        
        const balance = await deployer.getBalance();
        console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH`);

        await this.loadExistingContracts();
        
        console.log("\n⏸️  Initial 15-second preparation delay...");
        await this.sleep(15000);
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

            if (!precompileAddr || !assemblyAddr || !create2Addr) {
                throw new Error("EVM test contract addresses not found in environment");
            }

            // Load contract instances with correct function names
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

            this.results.deployments = {
                precompileTest: precompileAddr,
                assemblyTest: assemblyAddr,
                create2Factory: create2Addr,
                tokenA: tokenAAddr
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
                gasPrice: ethers.utils.parseUnits("25", "gwei"), // Increased gas price
                gasLimit: 5000000 // Increased gas limit
            };
        } else if (network === 167012) { // Kasplex
            return {
                gasPrice: ethers.utils.parseUnits("2500", "gwei"), // Higher gas price to avoid orphan transactions
                gasLimit: 5000000 // Increased gas limit
            };
        }
        return { gasLimit: 5000000 };
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async logTransaction(testName, description, txHash, gasUsed, blockNumber, success = true, attempt = 1) {
        const timestamp = new Date().toLocaleTimeString();
        if (success) {
            console.log(`[${timestamp}] ✅ ${testName} | Attempt: ${attempt} | Hash: ${txHash} | Gas: ${gasUsed?.toLocaleString()} | Block: ${blockNumber}`);
        } else {
            console.log(`[${timestamp}] ❌ ${testName} | Attempt: ${attempt} | Failed`);
        }
    }

    async executeTestWithRetry(testName, description, testFunction, maxDelayAfter = 45000) {
        this.testCount++;
        let lastError = null;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            const startTime = Date.now();
            
            try {
                console.log(`\n🔄 ${testName} - Attempt ${attempt}/${this.maxRetries}`);
                
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
                    
                    await this.logTransaction(testName, description, hash, receipt.gasUsed, blockNumber, true, attempt);
                } else {
                    console.log(`[${new Date().toLocaleTimeString()}] ✅ ${testName} | Attempt: ${attempt} | View function | Duration: ${duration}ms`);
                }

                this.results.tests.push({
                    name: testName,
                    description,
                    success: true,
                    duration,
                    gasUsed,
                    hash,
                    blockNumber,
                    events,
                    attempts: attempt,
                    finalAttempt: true
                });
                
                this.successCount++;
                
                // Success! Add randomized delay before next test
                const randomDelay = Math.floor(Math.random() * 15000) + 30000; // 30-45 seconds
                console.log(`✅ Success on attempt ${attempt}! Waiting ${randomDelay/1000}s before next test...`);
                await this.sleep(randomDelay);
                
                return; // Exit retry loop on success
                
            } catch (error) {
                const duration = Date.now() - startTime;
                lastError = error;
                
                console.log(`[${new Date().toLocaleTimeString()}] ❌ ${testName} | Attempt: ${attempt} | ${error.message}`);
                
                // If this isn't the last attempt, wait with exponential backoff
                if (attempt < this.maxRetries) {
                    const retryDelay = this.baseRetryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                    console.log(`⏸️  Waiting ${retryDelay/1000}s before retry attempt ${attempt + 1}...`);
                    await this.sleep(retryDelay);
                }
            }
        }
        
        // All retries failed
        const duration = Date.now() - startTime;
        this.results.tests.push({
            name: testName,
            description,
            success: false,
            error: lastError.message,
            duration,
            gasUsed: "0",
            attempts: this.maxRetries,
            finalAttempt: false
        });
        
        console.log(`❌ ${testName} failed after ${this.maxRetries} attempts`);
        await this.sleep(10000); // Brief pause before next test
    }

    async runRetryEnhancedTests() {
        console.log("\n📋 PHASE 1: RETRY-ENHANCED EVM COMPATIBILITY TESTS");
        console.log("------------------------------------------------------------");
        
        // Test 1: Assembly warmup (view function - should always work)
        await this.executeTestWithRetry(
            "assembly_bitwise_operations",
            "Assembly bitwise operations warmup test",
            async () => {
                return await this.contracts.assemblyTest.testBitwiseOperations();
            }
        );

        // Test 2: Assembly gas operations (view function)
        await this.executeTestWithRetry(
            "assembly_gas_measurement",
            "Assembly gas operations and measurement",
            async () => {
                return await this.contracts.assemblyTest.testGasOperations();
            }
        );

        // Test 3: EVM ModExp (proven to work)
        await this.executeTestWithRetry(
            "evm_modular_exponentiation",
            "EVM modular exponentiation precompile with retry",
            async () => {
                const tx = await this.contracts.precompileTest.testModExp(this.getGasOverrides());
                return tx;
            }
        );

        // Test 4: EVM Identity (proven to work)
        await this.executeTestWithRetry(
            "evm_identity_precompile",
            "EVM identity precompile function with retry",
            async () => {
                const data = ethers.utils.toUtf8Bytes("Retry Enhanced EVM Test Data");
                const tx = await this.contracts.precompileTest.testIdentity(data, this.getGasOverrides());
                return tx;
            }
        );

        // Test 5: EVM Ecrecover (with retry logic)
        await this.executeTestWithRetry(
            "evm_ecrecover_signature",
            "EVM ecrecover signature recovery with retry",
            async () => {
                const tx = await this.contracts.precompileTest.testEcrecover(this.getGasOverrides());
                return tx;
            }
        );

        // Test 6: EVM SHA256 (with retry logic)
        await this.executeTestWithRetry(
            "evm_sha256_hash",
            "EVM SHA256 hash precompile with retry",
            async () => {
                const data = ethers.utils.toUtf8Bytes("SHA256 Retry Enhanced Test");
                const tx = await this.contracts.precompileTest.testSha256(data, this.getGasOverrides());
                return tx;
            }
        );

        // Test 7: EVM RIPEMD160 (with retry logic)
        await this.executeTestWithRetry(
            "evm_ripemd160_hash",
            "EVM RIPEMD160 hash precompile with retry",
            async () => {
                const data = ethers.utils.toUtf8Bytes("RIPEMD160 Retry Test");
                const tx = await this.contracts.precompileTest.testRipemd160(data, this.getGasOverrides());
                return tx;
            }
        );

        // Test 8: Assembly storage access (fixed function name)
        await this.executeTestWithRetry(
            "assembly_storage_access",
            "Assembly storage slot access operations",
            async () => {
                const tx = await this.contracts.assemblyTest.testStorageAccess(this.getGasOverrides());
                return tx;
            }
        );

        // Test 9: Assembly memory operations
        await this.executeTestWithRetry(
            "assembly_memory_operations",
            "Assembly memory allocation and operations",
            async () => {
                const tx = await this.contracts.assemblyTest.testMemoryOperations(this.getGasOverrides());
                return tx;
            }
        );

        // Test 10: CREATE2 deployment (fixed function name)
        await this.executeTestWithRetry(
            "create2_deterministic_deployment",
            "CREATE2 deterministic contract deployment",
            async () => {
                const salt = ethers.utils.randomBytes(32);
                const bytecode = await this.contracts.create2Factory.getSimpleStorageBytecode(42);
                const tx = await this.contracts.create2Factory.deploy(salt, bytecode, this.getGasOverrides());
                return tx;
            }
        );

        console.log("\n📊 GENERATING RETRY-ENHANCED TEST ANALYSIS");
        console.log("------------------------------------------------------------");
    }

    generateSummary() {
        const totalGasUsed = this.results.tests.reduce((sum, test) => {
            return sum + parseInt(test.gasUsed || "0");
        }, 0);

        const avgGasPerTest = totalGasUsed > 0 ? Math.round(totalGasUsed / this.testCount) : 0;
        const successRate = ((this.successCount / this.testCount) * 100).toFixed(2);

        // Calculate retry statistics
        const testsWithRetries = this.results.tests.filter(test => test.attempts > 1);
        const avgAttempts = this.results.tests.reduce((sum, test) => sum + (test.attempts || 1), 0) / this.testCount;

        // Categorize tests
        const categories = {
            precompiles: { passed: 0, total: 0, rate: "0.0%" },
            assembly: { passed: 0, total: 0, rate: "0.0%" },
            create2: { passed: 0, total: 0, rate: "0.0%" }
        };

        this.results.tests.forEach(test => {
            if (test.name.includes("evm_") && !test.name.includes("assembly")) {
                categories.precompiles.total++;
                if (test.success) categories.precompiles.passed++;
            } else if (test.name.includes("assembly")) {
                categories.assembly.total++;
                if (test.success) categories.assembly.passed++;
            } else if (test.name.includes("create2")) {
                categories.create2.total++;
                if (test.success) categories.create2.passed++;
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
            categories: categories,
            retryStatistics: {
                testsRequiringRetries: testsWithRetries.length,
                averageAttempts: avgAttempts.toFixed(2),
                maxRetriesUsed: Math.max(...this.results.tests.map(t => t.attempts || 1))
            }
        };

        console.log(`🎉 RETRY-ENHANCED EVM TEST COMPLETED!`);
        console.log(`📊 Success Rate: ${successRate}%`);
        console.log(`🔄 Tests requiring retries: ${testsWithRetries.length}/${this.testCount}`);
        console.log(`📈 Average attempts per test: ${avgAttempts.toFixed(2)}`);
        console.log(`⛽ Total Gas: ${totalGasUsed.toLocaleString()}`);
        console.log(`📈 EVM Precompiles: ${categories.precompiles.rate} | Assembly: ${categories.assembly.rate} | CREATE2: ${categories.create2.rate}`);
    }

    async saveResults() {
        const filename = `retry-enhanced-${this.results.network.chainId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filepath = path.join(__dirname, '..', 'test-results', filename);
        
        // Ensure directory exists
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        
        console.log(`💾 Results saved: ${filepath}`);
        return filepath;
    }

    async run() {
        try {
            await this.initialize();
            await this.runRetryEnhancedTests();
            this.generateSummary();
            await this.saveResults();
            
            // Show final status
            const successRate = ((this.successCount / this.testCount) * 100).toFixed(2);
            console.log(`\n🏁 FINAL RESULT: ${successRate}% SUCCESS RATE (${this.successCount}/${this.testCount} tests)`);
            
            if (this.successCount === this.testCount) {
                console.log("🎯 🎉 100% SUCCESS ACHIEVED! 🎉 🎯");
            } else {
                console.log(`💪 Significant improvement! Keep running to approach 100%`);
            }
            
        } catch (error) {
            console.error("❌ Retry-enhanced test failed:", error.message);
            this.results.error = error.message;
            await this.saveResults();
        }
    }
}

// Run the retry-enhanced tester
async function main() {
    const tester = new RetryEnhancedTester();
    await tester.run();
}

main().catch(console.error);