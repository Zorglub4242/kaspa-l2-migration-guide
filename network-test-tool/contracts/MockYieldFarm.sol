// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20Yield {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MockYieldFarm
 * @dev Simplified yield farming protocol for DeFi load testing
 * Supports staking, rewards distribution, and compound farming
 */
contract MockYieldFarm {
    struct Pool {
        address stakingToken;
        address rewardToken;
        uint256 totalStaked;
        uint256 rewardRate; // Rewards per second
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
        bool active;
    }

    struct UserInfo {
        uint256 staked;
        uint256 userRewardPerTokenPaid;
        uint256 rewards;
        uint256 lastStakeTime;
    }

    mapping(uint256 => Pool) public pools;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    mapping(address => uint256[]) public userPools; // Track which pools user participates in
    
    uint256 public poolCount;
    uint256 public constant BONUS_MULTIPLIER = 2; // 2x rewards for early stakers
    uint256 public constant EARLY_STAKE_PERIOD = 1 hours; // Early staker bonus period

    event PoolCreated(uint256 indexed poolId, address stakingToken, address rewardToken);
    event Staked(address indexed user, uint256 indexed poolId, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed poolId, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 indexed poolId, uint256 amount);
    event CompoundFarming(address indexed user, uint256 indexed poolId, uint256 amount);

    constructor() {}

    // Create a new yield farming pool
    function createPool(
        address _stakingToken,
        address _rewardToken,
        uint256 _rewardRate
    ) external returns (uint256) {
        uint256 poolId = poolCount++;
        
        pools[poolId] = Pool({
            stakingToken: _stakingToken,
            rewardToken: _rewardToken,
            totalStaked: 0,
            rewardRate: _rewardRate,
            lastUpdateTime: block.timestamp,
            rewardPerTokenStored: 0,
            active: true
        });

        emit PoolCreated(poolId, _stakingToken, _rewardToken);
        return poolId;
    }

    // Stake tokens in a pool
    function stake(uint256 poolId, uint256 amount) external {
        require(pools[poolId].active, "Pool not active");
        require(amount > 0, "Amount must be greater than 0");

        updateReward(poolId, msg.sender);

        Pool storage pool = pools[poolId];
        UserInfo storage user = userInfo[poolId][msg.sender];

        // Transfer staking tokens
        IERC20Yield(pool.stakingToken).transferFrom(msg.sender, address(this), amount);

        // Update user info
        if (user.staked == 0) {
            userPools[msg.sender].push(poolId);
        }
        
        user.staked += amount;
        user.lastStakeTime = block.timestamp;
        pool.totalStaked += amount;

        emit Staked(msg.sender, poolId, amount);
    }

    // Withdraw staked tokens
    function withdraw(uint256 poolId, uint256 amount) external {
        UserInfo storage user = userInfo[poolId][msg.sender];
        require(user.staked >= amount, "Insufficient staked amount");
        require(amount > 0, "Amount must be greater than 0");

        updateReward(poolId, msg.sender);

        Pool storage pool = pools[poolId];

        user.staked -= amount;
        pool.totalStaked -= amount;

        IERC20Yield(pool.stakingToken).transfer(msg.sender, amount);

        emit Withdrawn(msg.sender, poolId, amount);
    }

    // Claim accumulated rewards
    function claimRewards(uint256 poolId) external {
        updateReward(poolId, msg.sender);

        UserInfo storage user = userInfo[poolId][msg.sender];
        uint256 reward = user.rewards;

        if (reward > 0) {
            user.rewards = 0;
            Pool storage pool = pools[poolId];
            
            // Apply early staker bonus
            if (block.timestamp - user.lastStakeTime <= EARLY_STAKE_PERIOD) {
                reward = reward * BONUS_MULTIPLIER;
            }

            IERC20Yield(pool.rewardToken).transfer(msg.sender, reward);
            emit RewardsClaimed(msg.sender, poolId, reward);
        }
    }

    // Compound farming - claim rewards and restake them
    function compound(uint256 poolId) external {
        require(pools[poolId].stakingToken == pools[poolId].rewardToken, "Cannot compound different tokens");
        
        updateReward(poolId, msg.sender);

        UserInfo storage user = userInfo[poolId][msg.sender];
        Pool storage pool = pools[poolId];
        
        uint256 reward = user.rewards;
        require(reward > 0, "No rewards to compound");

        // Apply early staker bonus
        if (block.timestamp - user.lastStakeTime <= EARLY_STAKE_PERIOD) {
            reward = reward * BONUS_MULTIPLIER;
        }

        user.rewards = 0;
        user.staked += reward;
        pool.totalStaked += reward;

        emit CompoundFarming(msg.sender, poolId, reward);
    }

    // Emergency withdraw (forfeit rewards)
    function emergencyWithdraw(uint256 poolId) external {
        UserInfo storage user = userInfo[poolId][msg.sender];
        Pool storage pool = pools[poolId];
        
        uint256 amount = user.staked;
        require(amount > 0, "No tokens staked");

        user.staked = 0;
        user.rewards = 0;
        user.userRewardPerTokenPaid = 0;
        pool.totalStaked -= amount;

        IERC20Yield(pool.stakingToken).transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, poolId, amount);
    }

    // Update reward calculations for a user
    function updateReward(uint256 poolId, address account) public {
        Pool storage pool = pools[poolId];
        pool.rewardPerTokenStored = rewardPerToken(poolId);
        pool.lastUpdateTime = block.timestamp;

        if (account != address(0)) {
            UserInfo storage user = userInfo[poolId][account];
            user.rewards = earned(poolId, account);
            user.userRewardPerTokenPaid = pool.rewardPerTokenStored;
        }
    }

    // Calculate reward per token
    function rewardPerToken(uint256 poolId) public view returns (uint256) {
        Pool storage pool = pools[poolId];
        
        if (pool.totalStaked == 0) {
            return pool.rewardPerTokenStored;
        }

        return pool.rewardPerTokenStored + 
            ((block.timestamp - pool.lastUpdateTime) * pool.rewardRate * 1e18) / pool.totalStaked;
    }

    // Calculate earned rewards for a user
    function earned(uint256 poolId, address account) public view returns (uint256) {
        UserInfo storage user = userInfo[poolId][account];
        
        return (user.staked * (rewardPerToken(poolId) - user.userRewardPerTokenPaid)) / 1e18 + user.rewards;
    }

    // Get user's total value locked across all pools
    function getUserTVL(address user) external view returns (uint256) {
        uint256 totalValue = 0;
        uint256[] memory userPoolIds = userPools[user];
        
        for (uint256 i = 0; i < userPoolIds.length; i++) {
            UserInfo storage info = userInfo[userPoolIds[i]][user];
            totalValue += info.staked;
        }
        
        return totalValue;
    }

    // Get pool information
    function getPoolInfo(uint256 poolId) external view returns (Pool memory) {
        return pools[poolId];
    }

    // Get user information for a pool
    function getUserInfo(uint256 poolId, address user) external view returns (UserInfo memory) {
        return userInfo[poolId][user];
    }

    // Batch operations for load testing
    function batchStake(uint256[] calldata poolIds, uint256[] calldata amounts) external {
        require(poolIds.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < poolIds.length; i++) {
            if (amounts[i] > 0 && pools[poolIds[i]].active) {
                // Inline stake logic
                updateReward(poolIds[i], msg.sender);
                
                Pool storage pool = pools[poolIds[i]];
                UserInfo storage user = userInfo[poolIds[i]][msg.sender];
                
                IERC20Yield(pool.stakingToken).transferFrom(msg.sender, address(this), amounts[i]);
                
                if (user.staked == 0) {
                    userPools[msg.sender].push(poolIds[i]);
                }
                
                user.staked += amounts[i];
                user.lastStakeTime = block.timestamp;
                pool.totalStaked += amounts[i];
                
                emit Staked(msg.sender, poolIds[i], amounts[i]);
            }
        }
    }

    function batchClaim(uint256[] calldata poolIds) external {
        for (uint256 i = 0; i < poolIds.length; i++) {
            if (pools[poolIds[i]].active) {
                // Inline claim logic
                updateReward(poolIds[i], msg.sender);
                
                UserInfo storage user = userInfo[poolIds[i]][msg.sender];
                uint256 reward = user.rewards;
                
                if (reward > 0) {
                    user.rewards = 0;
                    Pool storage pool = pools[poolIds[i]];
                    
                    // Apply early staker bonus
                    if (block.timestamp - user.lastStakeTime <= EARLY_STAKE_PERIOD) {
                        reward = reward * BONUS_MULTIPLIER;
                    }
                    
                    IERC20Yield(pool.rewardToken).transfer(msg.sender, reward);
                    emit RewardsClaimed(msg.sender, poolIds[i], reward);
                }
            }
        }
    }

    function batchWithdraw(uint256[] calldata poolIds, uint256[] calldata amounts) external {
        require(poolIds.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < poolIds.length; i++) {
            UserInfo storage user = userInfo[poolIds[i]][msg.sender];
            if (amounts[i] > 0 && user.staked >= amounts[i]) {
                // Inline withdraw logic
                updateReward(poolIds[i], msg.sender);
                
                Pool storage pool = pools[poolIds[i]];
                
                user.staked -= amounts[i];
                pool.totalStaked -= amounts[i];
                
                IERC20Yield(pool.stakingToken).transfer(msg.sender, amounts[i]);
                
                emit Withdrawn(msg.sender, poolIds[i], amounts[i]);
            }
        }
    }

    // Admin functions for load testing
    function setPoolRewardRate(uint256 poolId, uint256 newRate) external {
        updateReward(poolId, address(0));
        pools[poolId].rewardRate = newRate;
    }

    function togglePool(uint256 poolId) external {
        pools[poolId].active = !pools[poolId].active;
    }

    // View function to get all active pools
    function getActivePools() external view returns (uint256[] memory) {
        uint256[] memory activePools = new uint256[](poolCount);
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < poolCount; i++) {
            if (pools[i].active) {
                activePools[activeCount] = i;
                activeCount++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activePools[i];
        }
        
        return result;
    }

    // Get total value locked in all pools
    function getTotalTVL() external view returns (uint256) {
        uint256 totalTVL = 0;
        for (uint256 i = 0; i < poolCount; i++) {
            totalTVL += pools[i].totalStaked;
        }
        return totalTVL;
    }
}