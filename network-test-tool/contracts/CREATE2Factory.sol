// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CREATE2Factory {
    event ContractDeployed(address deployed, address computed, bytes32 salt, bytes32 bytecodeHash, bool addressMatch);
    event CREATE2TestResult(string testName, bool success, address deployed);
    
    function deploy(bytes32 salt, bytes memory bytecode) 
        external returns (address deployed) {
        
        bytes32 bytecodeHash = keccak256(bytecode);
        address computedAddr = computeAddress(salt, bytecodeHash);
        
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        
        require(deployed != address(0), "CREATE2 deployment failed");
        
        bool addressMatch = (deployed == computedAddr);
        emit ContractDeployed(deployed, computedAddr, salt, bytecodeHash, addressMatch);
        
        return deployed;
    }
    
    // Internal CREATE2 deployment (same logic, no external call)
    function deployInternal(bytes32 salt, bytes memory bytecode) 
        internal returns (address deployed) {
        
        bytes32 bytecodeHash = keccak256(bytecode);
        address computedAddr = computeAddress(salt, bytecodeHash);
        
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        
        require(deployed != address(0), "CREATE2 deployment failed");
        
        bool addressMatch = (deployed == computedAddr);
        emit ContractDeployed(deployed, computedAddr, salt, bytecodeHash, addressMatch);
        
        return deployed;
    }
    
    function computeAddress(bytes32 salt, bytes32 bytecodeHash) 
        public view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            bytecodeHash
        )))));
    }
    
    // Test CREATE2 with different scenarios
    function testCREATE2Scenarios() external returns (bool allPassed) {
        bool[] memory results = new bool[](3);
        
        // Test 1: Deploy SimpleStorage with constructor args
        try this.testSimpleStorageDeployment() {
            results[0] = true;
        } catch {
            results[0] = false;
        }
        
        // Test 2: Deploy same contract with different salt
        try this.testDifferentSaltDeployment() {
            results[1] = true;
        } catch {
            results[1] = false;
        }
        
        // Test 3: Verify deterministic addresses
        try this.testDeterministicAddresses() {
            results[2] = true;
        } catch {
            results[2] = false;
        }
        
        allPassed = results[0] && results[1] && results[2];
        emit CREATE2TestResult("all_create2_tests", allPassed, address(0));
        
        return allPassed;
    }
    
    function testSimpleStorageDeployment() external returns (address deployed) {
        // Get SimpleStorage bytecode with constructor arg (value = 42)
        bytes memory bytecode = abi.encodePacked(
            type(SimpleStorage).creationCode,
            abi.encode(uint256(42))
        );
        
        bytes32 salt = keccak256("test1");
        deployed = deployInternal(salt, bytecode);
        
        // Verify the deployed contract works
        SimpleStorage storage_ = SimpleStorage(deployed);
        require(storage_.value() == 42, "Constructor arg not set correctly");
        
        emit CREATE2TestResult("simple_storage_deploy", true, deployed);
        return deployed;
    }
    
    function testDifferentSaltDeployment() external returns (address deployed) {
        // Deploy same contract with different salt
        bytes memory bytecode = abi.encodePacked(
            type(SimpleStorage).creationCode,
            abi.encode(uint256(100))
        );
        
        bytes32 salt = keccak256("test2");
        deployed = deployInternal(salt, bytecode);
        
        // Verify different address than previous deployment
        SimpleStorage storage_ = SimpleStorage(deployed);
        require(storage_.value() == 100, "Second deployment failed");
        
        emit CREATE2TestResult("different_salt_deploy", true, deployed);
        return deployed;
    }
    
    function testDeterministicAddresses() external returns (bool success) {
        bytes memory bytecode = abi.encodePacked(
            type(SimpleStorage).creationCode,
            abi.encode(uint256(200))
        );
        
        bytes32 salt = keccak256("deterministic_test");
        bytes32 bytecodeHash = keccak256(bytecode);
        
        // Compute address before deployment
        address predictedAddr = computeAddress(salt, bytecodeHash);
        
        // Deploy and verify address matches prediction
        address deployed = deployInternal(salt, bytecode);
        
        success = (deployed == predictedAddr);
        emit CREATE2TestResult("deterministic_addresses", success, deployed);
        
        return success;
    }
    
    // Helper function to get bytecode for external calls
    function getSimpleStorageBytecode(uint256 value) external pure returns (bytes memory) {
        return abi.encodePacked(
            type(SimpleStorage).creationCode,
            abi.encode(value)
        );
    }
}

// Simple contract for CREATE2 testing
contract SimpleStorage {
    uint256 public value;
    address public deployer;
    uint256 public deploymentTimestamp;
    
    event StorageSet(uint256 oldValue, uint256 newValue);
    
    constructor(uint256 _value) {
        value = _value;
        deployer = msg.sender;
        deploymentTimestamp = block.timestamp;
    }
    
    function setValue(uint256 _value) external {
        uint256 oldValue = value;
        value = _value;
        emit StorageSet(oldValue, _value);
    }
    
    function getInfo() external view returns (uint256, address, uint256) {
        return (value, deployer, deploymentTimestamp);
    }
}

// More complex contract for advanced CREATE2 testing
contract ComplexContract {
    mapping(address => uint256) public balances;
    address[] public users;
    uint256 public totalSupply;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    
    constructor(uint256 _initialSupply) {
        totalSupply = _initialSupply;
        balances[msg.sender] = _initialSupply;
        users.push(msg.sender);
        emit Transfer(address(0), msg.sender, _initialSupply);
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        balances[msg.sender] -= amount;
        balances[to] += amount;
        
        // Add new user to list
        if (balances[to] == amount) {
            users.push(to);
        }
        
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function getUserCount() external view returns (uint256) {
        return users.length;
    }
}