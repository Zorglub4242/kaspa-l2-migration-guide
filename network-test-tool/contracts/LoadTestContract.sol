// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title LoadTestContract
 * @dev Ultra-simple contract designed for blockchain load testing
 * @dev Shows parallel vs sequential transaction processing differences
 */
contract LoadTestContract {
    // Global state
    uint256 public globalCounter;
    uint256 public totalTransactions;
    address public deployer;
    
    // Per-user tracking
    mapping(address => uint256) public userCounters;
    mapping(address => uint256) public userTransactions;
    
    // Events for tracking
    event CounterIncremented(address indexed user, uint256 userCount, uint256 globalCount);
    event BatchProcessed(address indexed user, uint256 batchSize, uint256 newGlobalCount);
    event LoadTestExecuted(address indexed user, string testType, uint256 gasUsed);
    
    constructor() {
        deployer = msg.sender;
        globalCounter = 0;
        totalTransactions = 0;
    }
    
    /**
     * @dev Simple increment - minimal gas usage for load testing
     */
    function increment() external {
        globalCounter++;
        userCounters[msg.sender]++;
        userTransactions[msg.sender]++;
        totalTransactions++;
        
        emit CounterIncremented(msg.sender, userCounters[msg.sender], globalCounter);
    }
    
    /**
     * @dev Batch increment - higher gas usage for testing different load types
     */
    function batchIncrement(uint256 times) external {
        require(times > 0 && times <= 100, "Invalid batch size");
        
        globalCounter += times;
        userCounters[msg.sender] += times;
        userTransactions[msg.sender]++;
        totalTransactions++;
        
        emit BatchProcessed(msg.sender, times, globalCounter);
    }
    
    /**
     * @dev Stress test function - variable gas usage
     */
    function stressTest(uint256 iterations, string memory testType) external {
        require(iterations > 0 && iterations <= 50, "Invalid iterations");
        
        uint256 startGas = gasleft();
        
        for (uint256 i = 0; i < iterations; i++) {
            globalCounter++;
            userCounters[msg.sender]++;
        }
        
        userTransactions[msg.sender]++;
        totalTransactions++;
        
        uint256 gasUsed = startGas - gasleft();
        emit LoadTestExecuted(msg.sender, testType, gasUsed);
    }
    
    /**
     * @dev Get user statistics
     */
    function getUserStats(address user) external view returns (
        uint256 userCount,
        uint256 transactions,
        uint256 averagePerTransaction
    ) {
        userCount = userCounters[user];
        transactions = userTransactions[user];
        averagePerTransaction = transactions > 0 ? userCount / transactions : 0;
    }
    
    /**
     * @dev Get global statistics
     */
    function getGlobalStats() external view returns (
        uint256 totalCount,
        uint256 totalTxs,
        uint256 uniqueUsers
    ) {
        totalCount = globalCounter;
        totalTxs = totalTransactions;
        // Note: Can't efficiently count unique users in Solidity without gas concerns
        uniqueUsers = 0; // Would need separate tracking for this
    }
    
    /**
     * @dev Get current state for load testing analysis
     */
    function getCurrentState() external view returns (
        uint256 globalCount,
        uint256 totalTxs,
        uint256 blockNumber,
        uint256 timestamp
    ) {
        globalCount = globalCounter;
        totalTxs = totalTransactions;
        blockNumber = block.number;
        timestamp = block.timestamp;
    }
    
    /**
     * @dev Reset counter (only deployer - for testing purposes)
     */
    function reset() external {
        require(msg.sender == deployer, "Only deployer can reset");
        globalCounter = 0;
        totalTransactions = 0;
    }
    
    /**
     * @dev Batch transaction simulation - for parallel processing testing
     */
    function simulateParallelLoad(uint256 batchId) external {
        // Each batch creates a unique state change
        globalCounter += batchId;
        userCounters[msg.sender] += batchId;
        userTransactions[msg.sender]++;
        totalTransactions++;
        
        emit CounterIncremented(msg.sender, userCounters[msg.sender], globalCounter);
    }
    
    /**
     * @dev View function to check if contract is responsive (no gas cost)
     */
    function ping() external pure returns (string memory) {
        return "pong";
    }
    
    /**
     * @dev Get contract info for verification
     */
    function getContractInfo() external view returns (
        string memory name,
        string memory version,
        address contractDeployer,
        uint256 deployedAt
    ) {
        name = "LoadTestContract";
        version = "1.0.0";
        contractDeployer = deployer;
        deployedAt = 0; // Could be set in constructor if needed
    }
}