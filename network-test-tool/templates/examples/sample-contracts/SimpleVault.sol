// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleVault
 * @dev Example contract that users can bring to test
 * This demonstrates a simple vault with deposits and withdrawals
 */
contract SimpleVault {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public lockTime;

    uint256 public totalDeposits;
    uint256 public constant LOCK_DURATION = 1 days;

    address public owner;
    bool public paused;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event EmergencyWithdrawal(address indexed user, uint256 amount, uint256 penalty);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Deposit ETH into the vault with time lock
     */
    function deposit() public payable notPaused {
        require(msg.value > 0, "Must deposit something");

        balances[msg.sender] += msg.value;
        lockTime[msg.sender] = block.timestamp + LOCK_DURATION;
        totalDeposits += msg.value;

        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw ETH after lock period
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) public notPaused {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(block.timestamp >= lockTime[msg.sender], "Still locked");

        balances[msg.sender] -= amount;
        totalDeposits -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(msg.sender, amount);
    }

    /**
     * @dev Emergency withdrawal with 10% penalty
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        uint256 penalty = amount / 10; // 10% penalty
        uint256 withdrawAmount = amount - penalty;

        balances[msg.sender] -= amount;
        totalDeposits -= amount;

        (bool success, ) = msg.sender.call{value: withdrawAmount}("");
        require(success, "Transfer failed");

        emit EmergencyWithdrawal(msg.sender, withdrawAmount, penalty);
    }

    /**
     * @dev Get time remaining until unlock
     * @param user Address to check
     * @return Time in seconds until unlock (0 if unlocked)
     */
    function timeUntilUnlock(address user) public view returns (uint256) {
        if (block.timestamp >= lockTime[user]) {
            return 0;
        }
        return lockTime[user] - block.timestamp;
    }

    /**
     * @dev Pause the contract (only owner)
     */
    function pause() public onlyOwner {
        paused = true;
    }

    /**
     * @dev Unpause the contract (only owner)
     */
    function unpause() public onlyOwner {
        paused = false;
    }

    /**
     * @dev Collect penalties (only owner)
     */
    function collectPenalties() public onlyOwner {
        uint256 contractBalance = address(this).balance;
        uint256 penalties = contractBalance - totalDeposits;

        require(penalties > 0, "No penalties to collect");

        (bool success, ) = owner.call{value: penalties}("");
        require(success, "Transfer failed");
    }

    /**
     * @dev Get contract statistics
     */
    function getStats() public view returns (
        uint256 totalDeposited,
        uint256 contractBalance,
        uint256 penalties,
        bool isPaused
    ) {
        contractBalance = address(this).balance;
        penalties = contractBalance > totalDeposits ? contractBalance - totalDeposits : 0;

        return (totalDeposits, contractBalance, penalties, paused);
    }
}