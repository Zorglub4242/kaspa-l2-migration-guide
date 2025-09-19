// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TokenVault {
    mapping(address => mapping(address => uint256)) public deposits;
    mapping(address => uint256) public totalDeposited;

    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint256 amount);

    function deposit(address token, uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        deposits[msg.sender][token] += amount;
        totalDeposited[token] += amount;

        emit Deposit(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external {
        require(deposits[msg.sender][token] >= amount, "Insufficient balance");

        deposits[msg.sender][token] -= amount;
        totalDeposited[token] -= amount;

        IERC20(token).transfer(msg.sender, amount);

        emit Withdraw(msg.sender, token, amount);
    }

    function getBalance(address user, address token) external view returns (uint256) {
        return deposits[user][token];
    }

    function emergencyWithdraw(address token) external {
        uint256 balance = deposits[msg.sender][token];
        require(balance > 0, "No balance to withdraw");

        deposits[msg.sender][token] = 0;
        totalDeposited[token] -= balance;

        IERC20(token).transfer(msg.sender, balance);

        emit Withdraw(msg.sender, token, balance);
    }
}