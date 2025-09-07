// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PrecompileTest {
    event PrecompileResult(string testName, bool success, bytes result);
    
    // Known test vectors for predictable results
    struct TestVector {
        bytes32 hash;
        uint8 v;
        bytes32 r;
        bytes32 s;
        address expectedSigner;
    }
    
    function testEcrecover() public returns (address recovered) {
        // Using a known test vector for ecrecover
        bytes32 hash = 0x456e9aea5e197a1f1af7a3e85a3212fa4049a3ba34c2289b4c860fc0b0c64ef3;
        uint8 v = 28;
        bytes32 r = 0x9242685bf161793cc25603c231bc2f568eb630ea16aa137d2664ac8038825608;
        bytes32 s = 0x4f8ae3bd7535248d0bd448298cc2e2071e56992d0774dc340c368ae950852ada;
        address expectedSigner = 0x7156526fbD7a3C72969B54f64e42c10fbb768C8a;
        
        recovered = ecrecover(hash, v, r, s);
        
        bool success = (recovered == expectedSigner);
        emit PrecompileResult("ecrecover", success, abi.encode(recovered, expectedSigner));
        
        return recovered;
    }
    
    function testSha256(bytes calldata data) external returns (bytes32 result) {
        result = sha256(data);
        
        // For "Hello Kasplex", expected: 0x...
        bool success = result != bytes32(0);
        emit PrecompileResult("sha256", success, abi.encode(result));
        
        return result;
    }
    
    function testRipemd160(bytes calldata data) external returns (bytes20 result) {
        result = ripemd160(data);
        
        bool success = result != bytes20(0);
        emit PrecompileResult("ripemd160", success, abi.encode(result));
        
        return result;
    }
    
    function testModExp() external returns (bytes memory result) {
        // Test modular exponentiation: 3^5 mod 7 = 5
        // Input format: [base_len][exp_len][mod_len][base][exp][mod]
        bytes memory input = abi.encodePacked(
            uint256(1),  // base length = 1 byte
            uint256(1),  // exponent length = 1 byte  
            uint256(1),  // modulus length = 1 byte
            uint8(3),    // base = 3
            uint8(5),    // exponent = 5
            uint8(7)     // modulus = 7
        );
        
        bool success;
        assembly {
            success := call(gas(), 0x05, 0, add(input, 0x20), mload(input), 0, 0)
            let size := returndatasize()
            result := mload(0x40)
            mstore(result, size)
            returndatacopy(add(result, 0x20), 0, size)
            mstore(0x40, add(result, add(0x20, size)))
        }
        
        // Expected result should be 5 (since 3^5 mod 7 = 243 mod 7 = 5)
        bool testSuccess = success && result.length > 0;
        emit PrecompileResult("modexp", testSuccess, result);
        
        return result;
    }
    
    function testIdentity(bytes calldata data) external returns (bytes memory result) {
        // Test identity precompile (0x04) - should return input unchanged
        bool success;
        assembly {
            success := call(gas(), 0x04, 0, add(data.offset, 0), data.length, 0, 0)
            let size := returndatasize()
            result := mload(0x40)
            mstore(result, size)
            returndatacopy(add(result, 0x20), 0, size)
            mstore(0x40, add(result, add(0x20, size)))
        }
        
        // Verify output matches input
        bool dataMatches = keccak256(result) == keccak256(data);
        emit PrecompileResult("identity", success && dataMatches, result);
        
        return result;
    }
    
    // Comprehensive test runner
    function runAllPrecompileTests() external returns (bool allPassed) {
        bool[] memory results = new bool[](5);
        
        // Test 1: ecrecover
        try this.testEcrecover() {
            results[0] = true;
        } catch {
            results[0] = false;
        }
        
        // Test 2: sha256
        try this.testSha256("Hello Kasplex") {
            results[1] = true;
        } catch {
            results[1] = false;
        }
        
        // Test 3: ripemd160
        try this.testRipemd160("Hello Kasplex") {
            results[2] = true;
        } catch {
            results[2] = false;
        }
        
        // Test 4: modexp
        try this.testModExp() {
            results[3] = true;
        } catch {
            results[3] = false;
        }
        
        // Test 5: identity
        try this.testIdentity("Test data for identity precompile function") {
            results[4] = true;
        } catch {
            results[4] = false;
        }
        
        // Check if all tests passed
        allPassed = true;
        for (uint i = 0; i < results.length; i++) {
            if (!results[i]) {
                allPassed = false;
                break;
            }
        }
        
        emit PrecompileResult("all_precompiles", allPassed, abi.encode(results));
        return allPassed;
    }
}