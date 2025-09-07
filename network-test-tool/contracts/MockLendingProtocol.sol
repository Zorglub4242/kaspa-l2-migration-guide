// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20Lending {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MockLendingProtocol
 * @dev Simplified lending protocol for DeFi load testing
 * Supports deposit, borrow, repay, and liquidation operations
 */
contract MockLendingProtocol {
    struct UserAccount {
        uint256 collateralDeposited;
        uint256 borrowed;
        uint256 interestAccumulated;
        uint256 lastUpdateTime;
    }

    struct Market {
        address token;
        uint256 totalDeposits;
        uint256 totalBorrows;
        uint256 borrowRate; // Annual rate in basis points (e.g., 500 = 5%)
        uint256 collateralFactor; // Max borrow ratio (e.g., 7500 = 75%)
    }

    mapping(address => UserAccount) public userAccounts;
    mapping(address => Market) public markets;
    mapping(address => mapping(address => uint256)) public userDeposits; // user => token => amount
    
    address[] public supportedTokens;
    uint256 public constant LIQUIDATION_THRESHOLD = 8000; // 80%
    uint256 public constant LIQUIDATION_PENALTY = 500; // 5%

    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Borrow(address indexed user, address indexed token, uint256 amount);
    event Repay(address indexed user, address indexed token, uint256 amount);
    event Liquidation(address indexed liquidator, address indexed user, uint256 amount);

    constructor() {}

    // Initialize a lending market for a token
    function initializeMarket(
        address token, 
        uint256 borrowRate, 
        uint256 collateralFactor
    ) external {
        require(markets[token].token == address(0), "Market already exists");
        
        markets[token] = Market({
            token: token,
            totalDeposits: 0,
            totalBorrows: 0,
            borrowRate: borrowRate,
            collateralFactor: collateralFactor
        });
        
        supportedTokens.push(token);
    }

    // Deposit tokens as collateral
    function deposit(address token, uint256 amount) external {
        require(markets[token].token != address(0), "Market not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        IERC20Lending(token).transferFrom(msg.sender, address(this), amount);
        
        userDeposits[msg.sender][token] += amount;
        userAccounts[msg.sender].collateralDeposited += amount;
        markets[token].totalDeposits += amount;
        
        emit Deposit(msg.sender, token, amount);
    }

    // Borrow against collateral
    function borrow(address token, uint256 amount) external {
        require(markets[token].token != address(0), "Market not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        UserAccount storage account = userAccounts[msg.sender];
        Market storage market = markets[token];
        
        // Update interest
        _updateUserInterest(msg.sender);
        
        // Check collateral ratio
        uint256 maxBorrow = (account.collateralDeposited * market.collateralFactor) / 10000;
        require(account.borrowed + amount <= maxBorrow, "Insufficient collateral");
        
        account.borrowed += amount;
        market.totalBorrows += amount;
        
        IERC20Lending(token).transfer(msg.sender, amount);
        
        emit Borrow(msg.sender, token, amount);
    }

    // Repay borrowed amount
    function repay(address token, uint256 amount) external {
        require(markets[token].token != address(0), "Market not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        UserAccount storage account = userAccounts[msg.sender];
        _updateUserInterest(msg.sender);
        
        uint256 totalOwed = account.borrowed + account.interestAccumulated;
        require(amount <= totalOwed, "Repaying more than owed");
        
        IERC20Lending(token).transferFrom(msg.sender, address(this), amount);
        
        if (amount >= account.interestAccumulated) {
            amount -= account.interestAccumulated;
            account.interestAccumulated = 0;
            account.borrowed -= amount;
        } else {
            account.interestAccumulated -= amount;
        }
        
        markets[token].totalBorrows -= amount;
        
        emit Repay(msg.sender, token, amount);
    }

    // Liquidate undercollateralized position
    function liquidate(address user, address token, uint256 amount) external {
        require(markets[token].token != address(0), "Market not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        UserAccount storage account = userAccounts[user];
        _updateUserInterest(user);
        
        // Check if liquidatable
        uint256 totalOwed = account.borrowed + account.interestAccumulated;
        uint256 liquidationThreshold = (account.collateralDeposited * LIQUIDATION_THRESHOLD) / 10000;
        require(totalOwed > liquidationThreshold, "Position not liquidatable");
        
        require(amount <= totalOwed, "Liquidating more than owed");
        
        // Calculate liquidation bonus
        uint256 collateralToSeize = (amount * (10000 + LIQUIDATION_PENALTY)) / 10000;
        require(collateralToSeize <= account.collateralDeposited, "Insufficient collateral");
        
        // Transfer repayment from liquidator
        IERC20Lending(token).transferFrom(msg.sender, address(this), amount);
        
        // Transfer collateral to liquidator
        IERC20Lending(token).transfer(msg.sender, collateralToSeize);
        
        // Update user account
        if (amount >= account.interestAccumulated) {
            amount -= account.interestAccumulated;
            account.interestAccumulated = 0;
            account.borrowed -= amount;
        } else {
            account.interestAccumulated -= amount;
        }
        
        account.collateralDeposited -= collateralToSeize;
        userDeposits[user][token] -= collateralToSeize;
        
        emit Liquidation(msg.sender, user, amount);
    }

    // Withdraw collateral (if not borrowed against)
    function withdraw(address token, uint256 amount) external {
        require(markets[token].token != address(0), "Market not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        UserAccount storage account = userAccounts[msg.sender];
        _updateUserInterest(msg.sender);
        
        require(userDeposits[msg.sender][token] >= amount, "Insufficient deposits");
        
        // Check if withdrawal leaves sufficient collateral
        if (account.borrowed > 0) {
            uint256 remainingCollateral = account.collateralDeposited - amount;
            uint256 maxBorrow = (remainingCollateral * markets[token].collateralFactor) / 10000;
            require(account.borrowed <= maxBorrow, "Would leave insufficient collateral");
        }
        
        userDeposits[msg.sender][token] -= amount;
        account.collateralDeposited -= amount;
        markets[token].totalDeposits -= amount;
        
        IERC20Lending(token).transfer(msg.sender, amount);
    }

    // Update user interest based on time elapsed
    function _updateUserInterest(address user) internal {
        UserAccount storage account = userAccounts[user];
        
        if (account.borrowed == 0 || account.lastUpdateTime == 0) {
            account.lastUpdateTime = block.timestamp;
            return;
        }
        
        uint256 timeElapsed = block.timestamp - account.lastUpdateTime;
        if (timeElapsed > 0) {
            // Simple interest calculation (for testing purposes)
            uint256 interestRate = markets[supportedTokens[0]].borrowRate; // Simplified
            uint256 interest = (account.borrowed * interestRate * timeElapsed) / (365 days * 10000);
            account.interestAccumulated += interest;
            account.lastUpdateTime = block.timestamp;
        }
    }

    // View functions for testing
    function getUserCollateral(address user) external view returns (uint256) {
        return userAccounts[user].collateralDeposited;
    }

    function getUserBorrowed(address user) external view returns (uint256) {
        return userAccounts[user].borrowed;
    }

    function getUserDeposit(address user, address token) external view returns (uint256) {
        return userDeposits[user][token];
    }

    function getMarketInfo(address token) external view returns (Market memory) {
        return markets[token];
    }

    function isLiquidatable(address user) external view returns (bool) {
        UserAccount storage account = userAccounts[user];
        uint256 totalOwed = account.borrowed + account.interestAccumulated;
        uint256 liquidationThreshold = (account.collateralDeposited * LIQUIDATION_THRESHOLD) / 10000;
        return totalOwed > liquidationThreshold;
    }

    // Batch operations for load testing
    function batchDeposit(address[] calldata tokens, uint256[] calldata amounts) external {
        require(tokens.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (amounts[i] > 0 && markets[tokens[i]].token != address(0)) {
                // Inline deposit logic
                IERC20Lending(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
                userDeposits[msg.sender][tokens[i]] += amounts[i];
                userAccounts[msg.sender].collateralDeposited += amounts[i];
                markets[tokens[i]].totalDeposits += amounts[i];
                emit Deposit(msg.sender, tokens[i], amounts[i]);
            }
        }
    }

    function batchBorrow(address[] calldata tokens, uint256[] calldata amounts) external {
        require(tokens.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (amounts[i] > 0 && markets[tokens[i]].token != address(0)) {
                UserAccount storage account = userAccounts[msg.sender];
                Market storage market = markets[tokens[i]];
                
                // Update interest
                _updateUserInterest(msg.sender);
                
                // Check collateral ratio
                uint256 maxBorrow = (account.collateralDeposited * market.collateralFactor) / 10000;
                if (account.borrowed + amounts[i] <= maxBorrow) {
                    account.borrowed += amounts[i];
                    market.totalBorrows += amounts[i];
                    IERC20Lending(tokens[i]).transfer(msg.sender, amounts[i]);
                    emit Borrow(msg.sender, tokens[i], amounts[i]);
                }
            }
        }
    }
}