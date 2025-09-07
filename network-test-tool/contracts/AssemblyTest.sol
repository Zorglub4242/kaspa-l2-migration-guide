// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AssemblyTest {
    event AssemblyResult(string testName, bool success, bytes result);
    
    // Storage slots for testing
    uint256 private slot0 = 12345;
    uint256 private slot1 = 67890;
    mapping(address => uint256) private balances;
    
    function testBasicAssembly() external returns (uint256 result) {
        assembly {
            // Test basic arithmetic
            let a := 10
            let b := 20
            result := add(a, b)
            
            // Test multiplication and division
            let c := mul(result, 2)
            result := div(c, 4)
            // Result should be 15 (10+20)*2/4 = 60/4 = 15
        }
        
        bool success = (result == 15);
        emit AssemblyResult("basic_math", success, abi.encode(result));
        
        return result;
    }
    
    function testMemoryOperations() external returns (bytes32 hash) {
        assembly {
            // Allocate memory
            let ptr := mload(0x40)
            
            // Store some data
            mstore(ptr, "Hello Assembly Test")
            mstore(add(ptr, 0x20), "Memory Operations")
            
            // Calculate hash of stored data
            hash := keccak256(ptr, 0x40)
            
            // Update free memory pointer
            mstore(0x40, add(ptr, 0x40))
        }
        
        bool success = (hash != bytes32(0));
        emit AssemblyResult("memory_ops", success, abi.encode(hash));
        
        return hash;
    }
    
    function testStorageAccess() external returns (uint256 slot0Value, uint256 slot1Value) {
        assembly {
            slot0Value := sload(0)
            slot1Value := sload(1)
        }
        
        bool success = (slot0Value == 12345 && slot1Value == 67890);
        emit AssemblyResult("storage_access", success, abi.encode(slot0Value, slot1Value));
        
        return (slot0Value, slot1Value);
    }
    
    function testCallDataOperations() external returns (bytes4 selector, uint256 dataLength) {
        assembly {
            // Extract function selector
            selector := shr(224, calldataload(0))
            
            // Get calldata size
            dataLength := calldatasize()
        }
        
        // Verify we got the correct function selector
        bytes4 expectedSelector = this.testCallDataOperations.selector;
        bool success = (selector == expectedSelector && dataLength >= 4);
        
        emit AssemblyResult("calldata_access", success, abi.encode(selector, dataLength));
        
        return (selector, dataLength);
    }
    
    function testLoops() external returns (uint256 result) {
        assembly {
            // Calculate sum of numbers 1 to 10 using assembly loop
            let sum := 0
            let i := 1
            
            for { } lt(i, 11) { i := add(i, 1) } {
                sum := add(sum, i)
            }
            
            result := sum
        }
        
        // Sum of 1 to 10 should be 55
        bool success = (result == 55);
        emit AssemblyResult("loops", success, abi.encode(result));
        
        return result;
    }
    
    function testConditionals() external returns (uint256 result) {
        uint256 input = 25;
        
        assembly {
            // Test if-else logic in assembly
            switch lt(input, 50)
            case 1 {
                result := mul(input, 2)  // input < 50, multiply by 2
            }
            default {
                result := div(input, 2)  // input >= 50, divide by 2
            }
        }
        
        // 25 < 50, so result should be 25 * 2 = 50
        bool success = (result == 50);
        emit AssemblyResult("conditionals", success, abi.encode(result));
        
        return result;
    }
    
    function testBitwiseOperations() external pure returns (uint256 andResult, uint256 orResult, uint256 xorResult) {
        uint256 a = 0xF0F0F0F0;
        uint256 b = 0x0F0F0F0F;
        
        assembly {
            andResult := and(a, b)
            orResult := or(a, b)
            xorResult := xor(a, b)
        }
        
        // Expected results:
        // AND: 0x00000000
        // OR:  0xFFFFFFFF  
        // XOR: 0xFFFFFFFF
        
        return (andResult, orResult, xorResult);
    }
    
    function testMappingAccess(address user, uint256 amount) external returns (uint256 oldBalance) {
        // First set a balance using normal Solidity
        balances[user] = amount;
        
        assembly {
            // Access mapping using assembly
            // mapping storage slot = keccak256(key . slot)
            let slot := balances.slot
            mstore(0x0, user)
            mstore(0x20, slot)
            let mappingSlot := keccak256(0x0, 0x40)
            oldBalance := sload(mappingSlot)
        }
        
        bool success = (oldBalance == amount);
        emit AssemblyResult("mapping_access", success, abi.encode(oldBalance));
        
        return oldBalance;
    }
    
    function testReturnData() external returns (bytes memory data) {
        // Call another contract function and check return data
        bytes memory callData = abi.encodeWithSelector(this.testBasicAssembly.selector);
        
        assembly {
            let success := call(gas(), address(), 0, add(callData, 0x20), mload(callData), 0, 0)
            
            if success {
                let size := returndatasize()
                data := mload(0x40)
                mstore(data, size)
                returndatacopy(add(data, 0x20), 0, size)
                mstore(0x40, add(data, add(0x20, size)))
            }
        }
        
        bool success = (data.length > 0);
        emit AssemblyResult("return_data", success, data);
        
        return data;
    }
    
    function testGasOperations() external view returns (uint256 gasLeft, uint256 gasUsed) {
        uint256 startGas;
        
        assembly {
            startGas := gas()
        }
        
        // Do some operations
        uint256 temp = 0;
        for (uint i = 0; i < 100; i++) {
            temp += i * i;
        }
        
        assembly {
            gasLeft := gas()
            gasUsed := sub(startGas, gasLeft)
        }
        
        return (gasLeft, gasUsed);
    }
    
    // Comprehensive test runner
    function runAllAssemblyTests() external returns (bool allPassed) {
        bool[] memory results = new bool[](9);
        uint256 testIndex = 0;
        
        // Test 1: Basic assembly
        try this.testBasicAssembly() {
            results[testIndex] = true;
        } catch {
            results[testIndex] = false;
        }
        testIndex++;
        
        // Test 2: Memory operations
        try this.testMemoryOperations() {
            results[testIndex] = true;
        } catch {
            results[testIndex] = false;
        }
        testIndex++;
        
        // Test 3: Storage access
        try this.testStorageAccess() {
            results[testIndex] = true;
        } catch {
            results[testIndex] = false;
        }
        testIndex++;
        
        // Test 4: Calldata operations
        try this.testCallDataOperations() {
            results[testIndex] = true;
        } catch {
            results[testIndex] = false;
        }
        testIndex++;
        
        // Test 5: Loops
        try this.testLoops() {
            results[testIndex] = true;
        } catch {
            results[testIndex] = false;
        }
        testIndex++;
        
        // Test 6: Conditionals
        try this.testConditionals() {
            results[testIndex] = true;
        } catch {
            results[testIndex] = false;
        }
        testIndex++;
        
        // Test 7: Bitwise operations
        try this.testBitwiseOperations() {
            results[testIndex] = true;
        } catch {
            results[testIndex] = false;
        }
        testIndex++;
        
        // Test 8: Mapping access
        try this.testMappingAccess(msg.sender, 1000) {
            results[testIndex] = true;
        } catch {
            results[testIndex] = false;
        }
        testIndex++;
        
        // Test 9: Return data
        try this.testReturnData() {
            results[testIndex] = true;
        } catch {
            results[testIndex] = false;
        }
        
        // Check if all tests passed
        allPassed = true;
        for (uint i = 0; i < results.length; i++) {
            if (!results[i]) {
                allPassed = false;
                break;
            }
        }
        
        emit AssemblyResult("all_assembly_tests", allPassed, abi.encode(results));
        return allPassed;
    }
    
    // Helper function to verify assembly test results externally
    function verifyTestResults() external view returns (
        uint256 slot0Val,
        uint256 slot1Val,
        bytes4 functionSelector,
        uint256 expectedSum
    ) {
        slot0Val = slot0;
        slot1Val = slot1;
        functionSelector = this.testCallDataOperations.selector;
        expectedSum = 55; // Sum of 1 to 10
        
        return (slot0Val, slot1Val, functionSelector, expectedSum);
    }
}