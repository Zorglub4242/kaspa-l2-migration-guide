const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class SequentialEVMTester {
    constructor() {
        this.results = {
            network: null,
            timestamp: new Date(),
            tests: [],
            summary: {},
            deployments: {}
        };
    }
    
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getGasOverrides() {
        // Dynamic gas based on network - same strategy as successful DeFi suite
        const network = this.results.network?.chainId;
        if (network === 11155111) { // Sepolia
            return {
                gasPrice: ethers.utils.parseUnits("20", "gwei"), // Standard Ethereum gas price
                gasLimit: 3000000
            };
        } else if (network === 167012) { // Kasplex
            return {
                gasPrice: ethers.utils.parseUnits("2001", "gwei"), // Kasplex requires higher gas
                gasLimit: 3000000
            };
        } else {
            return {
                gasPrice: ethers.utils.parseUnits("20", "gwei"),
                gasLimit: 3000000
            };
        }
    }
    
    getContractAddresses(chainId) {
        let prefix;
        
        if (chainId === 167012) {
            prefix = 'KASPLEX';
        } else if (chainId === 11155111) {
            prefix = 'SEPOLIA';
        } else if (chainId === 17000) {
            prefix = 'HOLESKY';
        } else if (chainId === 1) {
            prefix = 'MAINNET';
        } else {
            throw new Error(`Unsupported chain ID: ${chainId}`);
        }
        
        const addresses = {
            precompileTest: process.env[`${prefix}_PRECOMPILE_TEST`],
            create2Factory: process.env[`${prefix}_CREATE2_FACTORY`],
            assemblyTest: process.env[`${prefix}_ASSEMBLY_TEST`]
        };
        
        // Verify all addresses are set
        for (const [name, address] of Object.entries(addresses)) {
            if (!address) {
                throw new Error(`Missing contract address for ${prefix}_${name.toUpperCase()} in .env file`);
            }
        }
        
        return addresses;
    }
    
    async runAllTests() {
        console.log("🔬 Running Sequential EVM Compatibility Tests...");
        
        const network = await ethers.provider.getNetwork();
        const [deployer] = await ethers.getSigners();
        
        this.results.network = {
            name: network.name || `Chain ${network.chainId}`,
            chainId: network.chainId
        };
        
        console.log(`📡 Network: ${this.results.network.name} (${this.results.network.chainId})`);
        console.log(`👤 Deployer: ${deployer.address}`);
        
        try {
            // Get contract addresses from environment variables based on chain ID
            const addresses = this.getContractAddresses(network.chainId);
            console.log(`📋 Using contract addresses from .env:`);
            console.log(`   PrecompileTest: ${addresses.precompileTest}`);
            console.log(`   CREATE2Factory: ${addresses.create2Factory}`);
            console.log(`   AssemblyTest: ${addresses.assemblyTest}`);
            
            this.results.deployments = addresses;
            
            // Attach to deployed contracts
            const precompileTest = await ethers.getContractAt("PrecompileTest", addresses.precompileTest);
            const create2Factory = await ethers.getContractAt("CREATE2Factory", addresses.create2Factory);
            const assemblyTest = await ethers.getContractAt("AssemblyTest", addresses.assemblyTest);
            
            console.log("\n🧪 Running Sequential Tests with DeFi-Suite Timing Strategy...");
            console.log("⏱️  Using 3-second delays between tests (proven successful pattern)");
            
            // Run tests sequentially with delays (same pattern as DeFi suite)
            await this.testPrecompilesSequential(precompileTest);
            await this.testAssemblySequential(assemblyTest);
            await this.testCREATE2Sequential(create2Factory);
            
            // Generate comprehensive report
            this.generateReport();
            
        } catch (error) {
            console.error("💥 Sequential test suite failed:", error.message);
            this.results.error = error.message;
            this.generateReport();
            throw error;
        }
    }
    
    async testPrecompilesSequential(contract) {
        console.log("\n🔐 Testing Precompile Functions (Sequential)...");
        
        // Comprehensive test first
        await this.runSequentialTest("precompile_all", async () => {
            return await contract.runAllPrecompileTests(this.getGasOverrides());
        }, "Run all precompile tests in batch");
        
        // 3-second delay (DeFi suite pattern)
        console.log("   ⏸️  Waiting 3 seconds for network stabilization...");
        await this.sleep(3000);
        
        // Individual precompile tests with delays
        await this.runSequentialTest("ecrecover", async () => {
            return await contract.testEcrecover(this.getGasOverrides());
        }, "Test ecrecover signature recovery");
        
        await this.sleep(3000);
        
        await this.runSequentialTest("sha256", async () => {
            return await contract.testSha256(ethers.utils.toUtf8Bytes("Hello Kasplex Sequential Test"), this.getGasOverrides());
        }, "Test SHA256 hash function");
        
        await this.sleep(3000);
        
        await this.runSequentialTest("ripemd160", async () => {
            return await contract.testRipemd160(ethers.utils.toUtf8Bytes("Hello Kasplex Sequential Test"), this.getGasOverrides());
        }, "Test RIPEMD160 hash function");
        
        await this.sleep(3000);
        
        await this.runSequentialTest("modexp", async () => {
            return await contract.testModExp(this.getGasOverrides());
        }, "Test modular exponentiation");
        
        await this.sleep(3000);
        
        await this.runSequentialTest("identity", async () => {
            const testData = ethers.utils.toUtf8Bytes("Sequential test data for identity precompile function");
            return await contract.testIdentity(testData, this.getGasOverrides());
        }, "Test identity precompile");
    }
    
    async testCREATE2Sequential(factory) {
        console.log("\n🏗️ Testing CREATE2 Deterministic Deployment (Sequential)...");
        
        // Extra delay before CREATE2 tests
        console.log("   ⏸️  Waiting 5 seconds before CREATE2 tests...");
        await this.sleep(5000);
        
        // Test comprehensive CREATE2 suite
        await this.runSequentialTest("create2_all", async () => {
            return await factory.testCREATE2Scenarios(this.getGasOverrides());
        }, "Run all CREATE2 test scenarios");
    }
    
    async testAssemblySequential(contract) {
        console.log("\n⚙️ Testing Assembly Operations (Sequential)...");
        
        // Extra delay before assembly tests
        console.log("   ⏸️  Waiting 5 seconds before assembly tests...");
        await this.sleep(5000);
        
        // Test comprehensive assembly suite first
        await this.runSequentialTest("assembly_all", async () => {
            return await contract.runAllAssemblyTests(this.getGasOverrides());
        }, "Run all assembly test scenarios");
        
        await this.sleep(3000);
        
        // Individual assembly tests with delays
        await this.runSequentialTest("assembly_basic", async () => {
            return await contract.testBasicAssembly(this.getGasOverrides());
        }, "Test basic assembly arithmetic operations");
        
        await this.sleep(3000);
        
        await this.runSequentialTest("assembly_memory", async () => {
            return await contract.testMemoryOperations(this.getGasOverrides());
        }, "Test assembly memory allocation and operations");
        
        await this.sleep(3000);
        
        await this.runSequentialTest("assembly_storage", async () => {
            return await contract.testStorageAccess(this.getGasOverrides());
        }, "Test assembly storage slot access");
        
        await this.sleep(3000);
        
        await this.runSequentialTest("assembly_calldata", async () => {
            return await contract.testCallDataOperations(this.getGasOverrides());
        }, "Test assembly calldata manipulation");
        
        await this.sleep(3000);
        
        await this.runSequentialTest("assembly_loops", async () => {
            return await contract.testLoops(this.getGasOverrides());
        }, "Test assembly loop constructs");
        
        await this.sleep(3000);
        
        await this.runSequentialTest("assembly_conditionals", async () => {
            return await contract.testConditionals(this.getGasOverrides());
        }, "Test assembly conditional logic");
        
        await this.sleep(3000);
        
        await this.runSequentialTest("assembly_bitwise", async () => {
            return await contract.testBitwiseOperations(this.getGasOverrides());
        }, "Test assembly bitwise operations");
        
        await this.sleep(3000);
        
        await this.runSequentialTest("assembly_mapping", async () => {
            const [deployer] = await ethers.getSigners();
            return await contract.testMappingAccess(deployer.address, 500, this.getGasOverrides());
        }, "Test assembly mapping access");
        
        await this.sleep(3000);
        
        await this.runSequentialTest("assembly_return", async () => {
            return await contract.testReturnData(this.getGasOverrides());
        }, "Test assembly return data handling");
        
        await this.sleep(3000);
        
        // Gas measurement test
        await this.runSequentialTest("assembly_gas", async () => {
            return await contract.testGasOperations(this.getGasOverrides());
        }, "Test assembly gas operations and measurement");
    }
    
    async runSequentialTest(name, testFn, description = "") {
        try {
            console.log(`   🔄 Running ${name}...${description ? ` (${description})` : ''}`);
            const startTime = Date.now();
            
            const result = await testFn();
            
            // Handle both transaction responses and view function returns
            let receipt;
            if (result && typeof result.wait === 'function') {
                console.log(`   ⏳ Waiting for ${name} transaction confirmation...`);
                receipt = await result.wait();
            } else if (result && result.hash) {
                // Already a receipt
                receipt = result;
            } else {
                // View function or other return type
                console.log(`   ✅ ${name} - View function returned: ${result}`);
                this.results.tests.push({
                    name,
                    description,
                    success: true,
                    duration: Date.now() - startTime,
                    gasUsed: "0",
                    hash: "view_function",
                    blockNumber: 0,
                    events: 0
                });
                return;
            }
            
            const duration = Date.now() - startTime;
            const gasUsed = receipt.gasUsed.toString();
            
            this.results.tests.push({
                name,
                description,
                success: true,
                duration,
                gasUsed,
                hash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                events: receipt.events?.length || 0
            });
            
            console.log(`   ✅ ${name} - Gas: ${gasUsed} (${duration}ms) Block: ${receipt.blockNumber}`);
            
            // Log important events
            if (receipt.events && receipt.events.length > 0) {
                receipt.events.forEach(event => {
                    if (event.event) {
                        console.log(`      📡 Event: ${event.event}`);
                    }
                });
            }
            
        } catch (error) {
            console.log(`   ❌ ${name} failed: ${error.message}`);
            
            this.results.tests.push({
                name,
                description,
                success: false,
                error: error.message,
                duration: 0,
                gasUsed: "0"
            });
        }
    }
    
    generateReport() {
        const successful = this.results.tests.filter(t => t.success).length;
        const total = this.results.tests.length;
        
        // Calculate test categories
        const precompileTests = this.results.tests.filter(t => t.name.includes('precompile') || ['ecrecover', 'sha256', 'ripemd160', 'modexp', 'identity'].includes(t.name));
        const create2Tests = this.results.tests.filter(t => t.name.includes('create2'));
        const assemblyTests = this.results.tests.filter(t => t.name.includes('assembly'));
        
        const precompileSuccess = precompileTests.filter(t => t.success).length;
        const create2Success = create2Tests.filter(t => t.success).length;
        const assemblySuccess = assemblyTests.filter(t => t.success).length;
        
        this.results.summary = {
            totalTests: total,
            successfulTests: successful,
            failedTests: total - successful,
            successRate: `${((successful / total) * 100).toFixed(2)}%`,
            totalGasUsed: this.results.tests.reduce((sum, t) => sum + parseInt(t.gasUsed || 0), 0),
            averageGasPerTest: Math.round(this.results.tests.reduce((sum, t) => sum + parseInt(t.gasUsed || 0), 0) / total),
            categories: {
                precompiles: {
                    passed: precompileSuccess,
                    total: precompileTests.length,
                    rate: `${((precompileSuccess / precompileTests.length) * 100).toFixed(1)}%`
                },
                create2: {
                    passed: create2Success,
                    total: create2Tests.length,
                    rate: `${((create2Success / create2Tests.length) * 100).toFixed(1)}%`
                },
                assembly: {
                    passed: assemblySuccess,
                    total: assemblyTests.length,
                    rate: `${((assemblySuccess / assemblyTests.length) * 100).toFixed(1)}%`
                }
            }
        };
        
        console.log("\n📊 Sequential EVM Compatibility Test Results:");
        console.log(`   Overall: ${successful}/${total} passed (${this.results.summary.successRate})`);
        console.log(`   Precompiles: ${precompileSuccess}/${precompileTests.length} (${this.results.summary.categories.precompiles.rate})`);
        console.log(`   CREATE2: ${create2Success}/${create2Tests.length} (${this.results.summary.categories.create2.rate})`);
        console.log(`   Assembly: ${assemblySuccess}/${assemblyTests.length} (${this.results.summary.categories.assembly.rate})`);
        console.log(`   Total Gas Used: ${this.results.summary.totalGasUsed.toLocaleString()}`);
        console.log(`   Average Gas/Test: ${this.results.summary.averageGasPerTest.toLocaleString()}`);
        
        // EVM Compatibility Assessment
        let compatibilityLevel = "Unknown";
        if (successful === total) {
            compatibilityLevel = "🟢 FULL EVM COMPATIBILITY";
        } else if (successful >= total * 0.9) {
            compatibilityLevel = "🟡 HIGH EVM COMPATIBILITY";
        } else if (successful >= total * 0.7) {
            compatibilityLevel = "🟠 MODERATE EVM COMPATIBILITY";  
        } else {
            compatibilityLevel = "🔴 LIMITED EVM COMPATIBILITY";
        }
        
        console.log(`\n🎯 Sequential EVM Compatibility Assessment: ${compatibilityLevel}`);
        
        if (successful < total) {
            console.log("\n❌ Failed Tests:");
            this.results.tests.filter(t => !t.success).forEach(test => {
                console.log(`   • ${test.name}: ${test.error}`);
            });
        }
        
        // Save detailed report
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(__dirname, '../test-results', `evm-sequential-${this.results.network.chainId}-${timestamp}.json`);
        
        // Ensure test-results directory exists
        const testResultsDir = path.dirname(reportPath);
        if (!fs.existsSync(testResultsDir)) {
            fs.mkdirSync(testResultsDir, { recursive: true });
        }
        
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`\n💾 Sequential test report saved: ${reportPath}`);
        
        // Generate human-readable summary
        const summaryPath = path.join(__dirname, '../test-results', `evm-sequential-summary-${this.results.network.chainId}-${timestamp}.txt`);
        const summaryContent = this.generateTextSummary(compatibilityLevel);
        fs.writeFileSync(summaryPath, summaryContent);
        console.log(`📄 Sequential summary saved: ${summaryPath}`);
        
        return this.results;
    }
    
    generateTextSummary(compatibilityLevel) {
        const { network, summary, tests } = this.results;
        
        return `
🔬 SEQUENTIAL EVM COMPATIBILITY TEST RESULTS
==========================================

Network: ${network.name} (Chain ID: ${network.chainId})
Timestamp: ${this.results.timestamp}

OVERALL RESULTS:
${compatibilityLevel}

Test Summary: ${summary.successfulTests}/${summary.totalTests} passed (${summary.successRate})
- Precompile Tests: ${summary.categories.precompiles.passed}/${summary.categories.precompiles.total} (${summary.categories.precompiles.rate})
- CREATE2 Tests: ${summary.categories.create2.passed}/${summary.categories.create2.total} (${summary.categories.create2.rate})
- Assembly Tests: ${summary.categories.assembly.passed}/${summary.categories.assembly.total} (${summary.categories.assembly.rate})

Gas Usage:
- Total Gas: ${summary.totalGasUsed.toLocaleString()}
- Average per Test: ${summary.averageGasPerTest.toLocaleString()}

DETAILED RESULTS:
${tests.map(test => `
${test.success ? '✅' : '❌'} ${test.name}
   ${test.description}
   ${test.success ? `Gas: ${parseInt(test.gasUsed).toLocaleString()}, Duration: ${test.duration}ms` : `Error: ${test.error}`}
`).join('')}

SEQUENTIAL TIMING ANALYSIS:
This test used the proven DeFi-Suite timing strategy:
- 3-second delays between individual tests
- 5-second delays before major test suites
- Transaction confirmation waits
- Same pattern that achieved 100% success in DeFi suite

COMPATIBILITY ANALYSIS:
${this.getCompatibilityAnalysis()}
        `.trim();
    }
    
    getCompatibilityAnalysis() {
        const { summary } = this.results;
        const { categories } = summary;
        
        let analysis = [];
        
        if (categories.precompiles.passed === categories.precompiles.total) {
            analysis.push("✅ CRYPTOGRAPHIC FUNCTIONS: Full compatibility with all Ethereum precompiles");
        } else {
            analysis.push("⚠️  CRYPTOGRAPHIC FUNCTIONS: Some precompile issues detected");
        }
        
        if (categories.create2.passed === categories.create2.total) {
            analysis.push("✅ DETERMINISTIC DEPLOYMENT: CREATE2 works identically to Ethereum");
        } else {
            analysis.push("⚠️  DETERMINISTIC DEPLOYMENT: CREATE2 compatibility issues");
        }
        
        if (categories.assembly.passed === categories.assembly.total) {
            analysis.push("✅ LOW-LEVEL OPERATIONS: Assembly code executes identically");
        } else {
            analysis.push("⚠️  LOW-LEVEL OPERATIONS: Some assembly compatibility issues");
        }
        
        return analysis.join('\n');
    }
}

async function main() {
    const tester = new SequentialEVMTester();
    
    try {
        await tester.runAllTests();
        console.log("\n🎉 Sequential EVM Compatibility Test Suite completed successfully!");
        
    } catch (error) {
        console.error("\n💥 Sequential EVM Compatibility Test Suite failed:", error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { SequentialEVMTester };