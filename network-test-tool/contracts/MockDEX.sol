// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MockDEX
 * @dev Simplified DEX for cross-network performance testing
 * Simulates Uniswap-like functionality with fixed pricing for consistent testing
 */
contract MockDEX {
    struct Pool {
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        uint256 totalLiquidity;
        mapping(address => uint256) liquidity;
    }

    mapping(bytes32 => Pool) public pools;
    mapping(address => mapping(address => bytes32)) public getPoolId;
    
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 slippage
    );
    
    event AddLiquidity(
        address indexed user,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

    event RemoveLiquidity(
        address indexed user,
        address indexed tokenA,
        address indexed tokenB,
        uint256 liquidity,
        uint256 amountA,
        uint256 amountB
    );

    // Create or get pool ID for token pair
    function _getPoolId(address tokenA, address tokenB) internal pure returns (bytes32) {
        return tokenA < tokenB 
            ? keccak256(abi.encodePacked(tokenA, tokenB))
            : keccak256(abi.encodePacked(tokenB, tokenA));
    }

    // Initialize a trading pair
    function createPair(address tokenA, address tokenB) external returns (bytes32 poolId) {
        require(tokenA != tokenB, "Identical tokens");
        require(tokenA != address(0) && tokenB != address(0), "Zero address");
        
        poolId = _getPoolId(tokenA, tokenB);
        require(pools[poolId].tokenA == address(0), "Pool already exists");
        
        // Ensure consistent token ordering
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        
        pools[poolId].tokenA = token0;
        pools[poolId].tokenB = token1;
        
        getPoolId[token0][token1] = poolId;
        getPoolId[token1][token0] = poolId;
    }

    // Add liquidity to a pool (simplified, no minimum amounts)
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external returns (uint256 liquidity) {
        bytes32 poolId = _getPoolId(tokenA, tokenB);
        Pool storage pool = pools[poolId];
        require(pool.tokenA != address(0), "Pool doesn't exist");
        
        // Transfer tokens from user
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);
        
        // Calculate liquidity (simplified formula)
        if (pool.totalLiquidity == 0) {
            liquidity = amountA + amountB; // Initial liquidity
        } else {
            // Proportional liquidity based on existing reserves
            uint256 liquidityA = (amountA * pool.totalLiquidity) / pool.reserveA;
            uint256 liquidityB = (amountB * pool.totalLiquidity) / pool.reserveB;
            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
        }
        
        pool.reserveA += amountA;
        pool.reserveB += amountB;
        pool.totalLiquidity += liquidity;
        pool.liquidity[msg.sender] += liquidity;
        
        emit AddLiquidity(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
    }

    // Swap tokens with simulated slippage
    function swapTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut) {
        bytes32 poolId = _getPoolId(tokenIn, tokenOut);
        Pool storage pool = pools[poolId];
        require(pool.tokenA != address(0), "Pool doesn't exist");
        
        // Calculate output amount with constant product formula (simplified)
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == pool.tokenA 
            ? (pool.reserveA, pool.reserveB) 
            : (pool.reserveB, pool.reserveA);
            
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        
        // Simplified AMM formula: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
        // Apply 0.3% fee
        uint256 amountInWithFee = (amountIn * 997) / 1000;
        amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
        
        require(amountOut >= minAmountOut, "Slippage too high");
        require(amountOut > 0 && amountOut < reserveOut, "Invalid output amount");
        
        // Update reserves
        if (tokenIn == pool.tokenA) {
            pool.reserveA += amountIn;
            pool.reserveB -= amountOut;
        } else {
            pool.reserveB += amountIn;
            pool.reserveA -= amountOut;
        }
        
        // Transfer tokens
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(msg.sender, amountOut);
        
        // Calculate slippage for metrics
        uint256 theoreticalPrice = (amountOut * 10000) / amountIn;
        uint256 slippage = theoreticalPrice > 10000 ? 0 : 10000 - theoreticalPrice;
        
        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut, slippage);
    }

    // Get current price for a token pair
    function getCurrentPrice(address tokenA, address tokenB) external view returns (uint256 price) {
        bytes32 poolId = _getPoolId(tokenA, tokenB);
        Pool storage pool = pools[poolId];
        require(pool.tokenA != address(0), "Pool doesn't exist");
        
        (uint256 reserveA, uint256 reserveB) = tokenA == pool.tokenA 
            ? (pool.reserveA, pool.reserveB) 
            : (pool.reserveB, pool.reserveA);
            
        if (reserveA == 0) return 0;
        return (reserveB * 1e18) / reserveA;
    }

    // Get estimated output amount for a swap
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        bytes32 poolId = _getPoolId(tokenIn, tokenOut);
        Pool storage pool = pools[poolId];
        require(pool.tokenA != address(0), "Pool doesn't exist");
        
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == pool.tokenA 
            ? (pool.reserveA, pool.reserveB) 
            : (pool.reserveB, pool.reserveA);
            
        if (reserveIn == 0 || reserveOut == 0) return 0;
        
        uint256 amountInWithFee = (amountIn * 997) / 1000;
        amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
    }

    // Batch swap for load testing
    function batchSwap(
        address[] calldata tokensIn,
        address[] calldata tokensOut,
        uint256[] calldata amountsIn,
        uint256[] calldata minAmountsOut
    ) external returns (uint256[] memory amountsOut) {
        require(
            tokensIn.length == tokensOut.length &&
            tokensOut.length == amountsIn.length &&
            amountsIn.length == minAmountsOut.length,
            "Array length mismatch"
        );
        
        amountsOut = new uint256[](tokensIn.length);
        
        for (uint256 i = 0; i < tokensIn.length; i++) {
            amountsOut[i] = this.swapTokens(tokensIn[i], tokensOut[i], amountsIn[i], minAmountsOut[i]);
        }
    }

    // Remove liquidity
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity
    ) external returns (uint256 amountA, uint256 amountB) {
        bytes32 poolId = _getPoolId(tokenA, tokenB);
        Pool storage pool = pools[poolId];
        require(pool.liquidity[msg.sender] >= liquidity, "Insufficient liquidity");
        
        // Calculate proportional amounts
        amountA = (liquidity * pool.reserveA) / pool.totalLiquidity;
        amountB = (liquidity * pool.reserveB) / pool.totalLiquidity;
        
        // Update state
        pool.liquidity[msg.sender] -= liquidity;
        pool.totalLiquidity -= liquidity;
        pool.reserveA -= amountA;
        pool.reserveB -= amountB;
        
        // Transfer tokens
        IERC20(tokenA).transfer(msg.sender, amountA);
        IERC20(tokenB).transfer(msg.sender, amountB);
        
        emit RemoveLiquidity(msg.sender, tokenA, tokenB, liquidity, amountA, amountB);
    }

    // View functions for testing metrics
    function getPoolReserves(address tokenA, address tokenB) 
        external 
        view 
        returns (uint256 reserveA, uint256 reserveB, uint256 totalLiquidity) 
    {
        bytes32 poolId = _getPoolId(tokenA, tokenB);
        Pool storage pool = pools[poolId];
        return (pool.reserveA, pool.reserveB, pool.totalLiquidity);
    }

    function getUserLiquidity(address user, address tokenA, address tokenB) 
        external 
        view 
        returns (uint256) 
    {
        bytes32 poolId = _getPoolId(tokenA, tokenB);
        return pools[poolId].liquidity[user];
    }
}