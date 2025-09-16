const { ethers, network } = require("hardhat");
const fs = require('fs');
const path = require('path');

class CREATE2TestSuite {
    constructor() {
        this.results = {
            network: {
                name: network.name,
                chainId: network.config.chainId
            },
            timestamp: new Date().toISOString(),
            testId: `${new Date().toISOString()}-${Math.random().toString(36).substr(2, 6)}`,
            label: process.env.TEST_LABEL || "test1",
            tests: [],
            deployments: {},
            summary: {}
        };
    }

    async run() {
        try {
            console.log("🏷️  Test Label:", this.results.label);
            console.log("🔬 Running CREATE2 Deterministic Deployment Test Suite...");
            console.log(`📡 Network: ${this.results.network.name} (${this.results.network.chainId})`);
            
            const [deployer] = await ethers.getSigners();
            console.log("👤 Deployer:", deployer.address);
            
            console.log("🚀 Step 1: Deploying Fresh CREATE2Factory...");
            
            // Always deploy a fresh factory for clean state
            const CREATE2Factory = await ethers.getContractFactory("CREATE2Factory");
            const factory = await CREATE2Factory.deploy();
            await factory.deployed();
            
            this.results.deployments.create2Factory = factory.address;
            console.log("✅ Fresh CREATE2Factory deployed at:", factory.address);
            
            console.log("🧪 Step 2: Running CREATE2 Tests...");
            
            // Run CREATE2 tests with dynamic salts to avoid conflicts
            await this.testCREATE2WithDynamicSalts(factory);
            await this.testCREATE2Advanced(factory);
            
            // Generate comprehensive report
            this.generateReport();
            this.saveResults();
            
        } catch (error) {
            console.error("❌ CREATE2 test suite failed:", error.message);
            process.exit(1);
        }
    }

    async testCREATE2WithDynamicSalts(factory) {
        console.log("🏗️ Testing CREATE2 with Dynamic Salts...");
        
        // Test 1: Deploy with timestamp-based salt
        const timestamp = Date.now();
        await this.runTest("create2_dynamic_salt", async (gasOverrides) => {
            const salt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`test_${timestamp}`));
            const bytecode = await factory.getSimpleStorageBytecode(42);
            return await factory.deploy(salt, bytecode, gasOverrides);
        }, "Deploy SimpleStorage with dynamic salt");
        
        // Test 2: Deploy with random salt
        const random = Math.random().toString(36);
        await this.runTest("create2_random_salt", async (gasOverrides) => {
            const salt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`random_${random}`));
            const bytecode = await factory.getSimpleStorageBytecode(100);
            return await factory.deploy(salt, bytecode, gasOverrides);
        }, "Deploy SimpleStorage with random salt");
        
        // Test 3: Verify deterministic addresses
        await this.runTest("create2_deterministic", async (gasOverrides) => {
            const salt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`deterministic_${timestamp}`));
            const bytecode = await factory.getSimpleStorageBytecode(200);
            const bytecodeHash = ethers.utils.keccak256(bytecode);
            
            // Compute address before deployment
            const predictedAddr = await factory.computeAddress(salt, bytecodeHash);
            
            // Deploy and verify
            const tx = await factory.deploy(salt, bytecode, gasOverrides);
            const receipt = await tx.wait();
            
            // Find the deployed address from events
            const event = receipt.events?.find(e => e.event === 'ContractDeployed');
            const deployedAddr = event?.args?.deployed;
            
            if (deployedAddr?.toLowerCase() === predictedAddr.toLowerCase()) {
                return tx;
            } else {
                throw new Error(`Address mismatch: predicted ${predictedAddr}, deployed ${deployedAddr}`);
            }
        }, "Verify CREATE2 deterministic addresses");
    }

    async testCREATE2Advanced(factory) {
        console.log("🔧 Testing Advanced CREATE2 Scenarios...");
        
        // Test with different constructor parameters
        const timestamp = Date.now();
        await this.runTest("create2_different_params", async (gasOverrides) => {
            const salt1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`param_test_1_${timestamp}`));
            const salt2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`param_test_2_${timestamp}`));
            
            const bytecode1 = await factory.getSimpleStorageBytecode(500);
            const bytecode2 = await factory.getSimpleStorageBytecode(600);
            
            // Deploy both
            await factory.deploy(salt1, bytecode1, gasOverrides);
            return await factory.deploy(salt2, bytecode2, gasOverrides);
        }, "Deploy contracts with different constructor parameters");
        
        // Test address prediction accuracy
        await this.runTest("create2_prediction_accuracy", async (gasOverrides) => {
            const salt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`accuracy_test_${timestamp}`));
            const value = 777;
            const bytecode = await factory.getSimpleStorageBytecode(value);
            const bytecodeHash = ethers.utils.keccak256(bytecode);
            
            // Predict address
            const predictedAddr = await factory.computeAddress(salt, bytecodeHash);
            
            // Deploy
            const tx = await factory.deploy(salt, bytecode, gasOverrides);
            const receipt = await tx.wait();
            
            // Verify the deployed contract works correctly
            const SimpleStorage = await ethers.getContractFactory("SimpleStorage");
            const deployed = SimpleStorage.attach(predictedAddr);
            
            const storedValue = await deployed.value();
            if (storedValue.toNumber() !== value) {
                throw new Error(`Contract verification failed: expected ${value}, got ${storedValue}`);
            }
            
            return tx;
        }, "Verify CREATE2 address prediction accuracy");
    }

    async runTest(testName, testFunction, description) {
        const startTime = Date.now();
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
            attempts++;
            console.log(`   🔄 Running ${testName}... (${description})`);
            
            try {
                const gasPrice = await ethers.provider.getGasPrice();
                const gasOverrides = { gasPrice };
                
                const tx = await testFunction(gasOverrides);
                const receipt = await tx.wait();
                
                const duration = Date.now() - startTime;
                const gasUsed = receipt.gasUsed.toString();
                
                console.log(`   ✅ ${testName} - Gas: ${parseInt(gasUsed).toLocaleString()} (${duration}ms)`);
                
                // Log events if any
                if (receipt.events && receipt.events.length > 0) {
                    receipt.events.forEach(event => {
                        if (event.event) {
                            console.log(`      📡 Event: ${event.event}`);
                        }
                    });
                }
                
                this.results.tests.push({
                    name: testName,
                    description,
                    success: true,
                    duration,
                    gasUsed,
                    hash: tx.hash,
                    blockNumber: receipt.blockNumber,
                    events: receipt.events?.length || 0,
                    attempts
                });
                
                return;
                
            } catch (error) {
                console.log(`   ⚠️  ${testName} attempt ${attempts} failed: ${error.message}`);
                
                if (attempts >= maxAttempts) {
                    console.log(`   ❌ ${testName} failed after ${attempts} attempts`);
                    
                    this.results.tests.push({
                        name: testName,
                        description,
                        success: false,
                        error: error.message,
                        duration: 0,
                        gasUsed: "0",
                        attempts
                    });
                    return;
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    generateReport() {
        const tests = this.results.tests;
        const successful = tests.filter(t => t.success).length;
        const failed = tests.filter(t => !t.success).length;
        const total = tests.length;
        const successRate = total > 0 ? ((successful / total) * 100).toFixed(2) + "%" : "0%";
        
        // Calculate gas totals
        const totalGasUsed = tests
            .filter(t => t.success && t.gasUsed !== "N/A (view function)")
            .reduce((sum, test) => sum + parseInt(test.gasUsed), 0);
        
        const avgGasPerTest = successful > 0 ? Math.round(totalGasUsed / successful) : 0;
        
        this.results.summary = {
            totalTests: total,
            successfulTests: successful,
            failedTests: failed,
            successRate,
            totalGasUsed: totalGasUsed > 0 ? totalGasUsed : null,
            averageGasPerTest: avgGasPerTest > 0 ? avgGasPerTest : null
        };
        
        console.log("📊 CREATE2 Test Results:");
        console.log(`   Overall: ${successful}/${total} passed (${successRate})`);
        console.log(`   Total Gas Used: ${totalGasUsed.toLocaleString()}`);
        console.log(`   Average Gas/Test: ${avgGasPerTest.toLocaleString()}`);
        
        // Assessment
        let assessment = "🔴 CREATE2 NOT SUPPORTED";
        if (successful === total) {
            assessment = "🟢 FULL CREATE2 COMPATIBILITY";
        } else if (successful > 0) {
            assessment = "🟡 PARTIAL CREATE2 COMPATIBILITY";
        }
        
        console.log(`🎯 CREATE2 Assessment: ${assessment}`);
        
        // Show failed tests
        const failedTests = tests.filter(t => !t.success);
        if (failedTests.length > 0) {
            console.log("❌ Failed Tests:");
            failedTests.forEach(test => {
                console.log(`   • ${test.name}: ${test.error}`);
            });
        }
        
        console.log("🎉 CREATE2 Test Suite completed!");
    }

    saveResults() {
        const resultsDir = path.join(__dirname, '..', 'test-results');
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        const timestamp = this.results.timestamp.replace(/[:.]/g, '-');
        const filename = `create2-tests-${this.results.network.chainId}-${this.results.label}-${timestamp}.json`;
        const filepath = path.join(resultsDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        console.log("💾 Detailed report saved:", filepath);
    }
}

// Run the test suite
async function main() {
    const testSuite = new CREATE2TestSuite();
    await testSuite.run();
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { CREATE2TestSuite };