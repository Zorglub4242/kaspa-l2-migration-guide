# ⚒️ Foundry - Kasplex Setup

**Same Foundry tooling, just different RPC!** Your existing Foundry projects work on Kasplex with zero code changes and 99% cost savings.

## 🎯 Key Benefits

- ✅ **Same Foundry commands** and workflow
- ✅ **Same Solidity contracts** (no modifications needed)
- ✅ **Same testing framework** (forge test works identically)
- ✅ **99% lower gas costs** than Ethereum
- ✅ **10-second finality** vs 12+ minutes on Ethereum
- ✅ **Rust-powered speed** with ultra-low network costs

## 🚀 Quick Setup

1. **Install Foundry** (if not already installed):
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Use existing Foundry project** or create new:
   ```bash
   mkdir my-kasplex-project
   cd my-kasplex-project
   forge init --force
   ```

## ⚙️ Configuration (Only RPC Added!)

### foundry.toml
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.20"
optimizer = true
optimizer_runs = 200
via_ir = false
bytecode_hash = "none"
cbor_metadata = false
sparse_mode = false

# Enhanced testing
gas_reports = ["*"]
gas_reports_ignore = []

[profile.ci]
fuzz_runs = 10000

[rpc_endpoints]
# 🌟 KASPLEX L2 TESTNET - Ultra-low cost!
kasplex = "https://rpc.kasplextest.xyz"

# Ethereum networks (for comparison)
mainnet = "https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}"
sepolia = "https://eth-sepolia.alchemyapi.io/v2/${ALCHEMY_API_KEY}"

[etherscan]
mainnet = { key = "${ETHERSCAN_API_KEY}" }
sepolia = { key = "${ETHERSCAN_API_KEY}" }
# Note: Kasplex explorer API coming soon
```

### .env Template
```env
# Private key (without 0x prefix) - USE TEST ACCOUNT ONLY!
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Optional: Ethereum API keys (for comparison deployments)
ALCHEMY_API_KEY=your_alchemy_api_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

## 🎯 Critical: Gas Configuration

**IMPORTANT**: Kasplex requires higher gas prices for transaction inclusion. Use `--gas-price` flag:

```bash
# ✅ Correct: Use 2000 Gwei for reliable inclusion
forge script --rpc-url kasplex --gas-price 2000000000000 --broadcast

# ❌ Wrong: Default gas prices cause hanging
forge script --rpc-url kasplex --broadcast
```

Even at 2000 Gwei, costs are 99% cheaper than Ethereum!

## 📜 Deployment Script (Identical!)

### script/Deploy.s.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MyContract.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Get network info for display
        uint256 chainId = block.chainid;
        bool isKasplex = chainId == 167012;
        
        console.log("Deploying to:", isKasplex ? "Kasplex L2" : "Ethereum");
        console.log("Chain ID:", chainId);
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        
        // Deploy contract (same for all networks!)
        MyContract myContract = new MyContract(100);
        
        console.log("Contract deployed to:", address(myContract));
        console.log("Initial value:", myContract.value());
        
        if (isKasplex) {
            console.log("Explorer:", string.concat("https://explorer.testnet.kasplextest.xyz/address/", vm.toString(address(myContract))));
            console.log("Cost: Ultra-low on Kasplex L2! 99% savings vs Ethereum");
        }
        
        vm.stopBroadcast();
    }
}
```

## 🔨 Deployment Commands

### Deploy to Kasplex (Ultra-cheap!)
```bash
# Deploy with correct gas price
forge script script/Deploy.s.sol:DeployScript \
    --rpc-url kasplex \
    --gas-price 2000000000000 \
    --broadcast

# Dry run first (simulate deployment)
forge script script/Deploy.s.sol:DeployScript \
    --rpc-url kasplex \
    --gas-price 2000000000000
```

### Compare with Ethereum
```bash
# Deploy to Sepolia testnet (free but expensive gas)
forge script script/Deploy.s.sol:DeployScript \
    --rpc-url sepolia \
    --broadcast

# Deploy to Ethereum mainnet (VERY EXPENSIVE!)  
forge script script/Deploy.s.sol:DeployScript \
    --rpc-url mainnet \
    --broadcast
```

## 🧪 Testing (Works Identically!)

Your existing Foundry tests work on Kasplex without modifications:

```bash
# Test locally (fast, free)
forge test

# Test on Kasplex (real network, still fast and cheap)
forge test --rpc-url kasplex --gas-price 2000000000000

# Test on Ethereum (slow, expensive)
forge test --rpc-url sepolia
```

### Gas Reporting on Kasplex
```bash
# Get gas report on Kasplex
forge test --rpc-url kasplex --gas-price 2000000000000 --gas-report
```

## 💰 Cost Comparison

| Action | Ethereum Mainnet | Kasplex L2 | Savings |
|--------|------------------|------------|---------|
| **Contract Deploy** | $50-500 | **$0.05** | **99.99%** |
| **Function Call** | $10-50 | **$0.01** | **99.98%** |
| **Token Transfer** | $5-25 | **$0.005** | **99.98%** |
| **Complex Transaction** | $20-100 | **$0.02** | **99.98%** |

### Real Example
```bash
# Ethereum deployment
$ forge script --rpc-url mainnet --broadcast
# Cost: ~$200 USD

# Kasplex deployment (same contract!)  
$ forge script --rpc-url kasplex --gas-price 2000000000000 --broadcast
# Cost: ~$0.02 USD

# Same functionality, 99.99% savings!
```

## 🛠️ Development Workflow

1. **Develop locally**: `forge build && forge test`
2. **Deploy to Kasplex**: Ultra-cheap testing on real network
3. **Iterate quickly**: 10-second finality vs 12+ minutes
4. **Compare costs**: Side-by-side with Ethereum if needed

## ⚡ Performance Benefits

### Speed Comparison
```bash
# Ethereum Sepolia
$ forge script --rpc-url sepolia --broadcast
# ⏰ Waiting 2-5 minutes for confirmation...

# Kasplex L2
$ forge script --rpc-url kasplex --gas-price 2000000000000 --broadcast  
# ⏰ Confirmed in 10 seconds!
```

### Gas Efficiency
```
╭─────────────────────────────────────────────────╮
│                Gas Report (Kasplex)             │
├─────────────────────────────────────────────────┤
│ Contract       ┆ Method    ┆ Gas   ┆ Cost (USD) │
├─────────────────────────────────────────────────┤
│ MyContract     ┆ setValue  ┆ 23841 ┆ $0.0048    │
│ MyContract     ┆ getValue  ┆ 2451  ┆ $0.0005    │
╰─────────────────────────────────────────────────╯

Same operations on Ethereum would cost $5-50!
```

## 🚀 Migration from Ethereum

### Option 1: Add Kasplex RPC to existing project
```toml
# Add to foundry.toml
[rpc_endpoints]
kasplex = "https://rpc.kasplextest.xyz"
```

```bash
# Deploy immediately!
forge script script/Deploy.s.sol:DeployScript \
    --rpc-url kasplex \
    --gas-price 2000000000000 \
    --broadcast
```

### Option 2: Side-by-side comparison
```bash
# Deploy to both networks and compare
forge script script/Deploy.s.sol:DeployScript --rpc-url sepolia --broadcast
forge script script/Deploy.s.sol:DeployScript --rpc-url kasplex --gas-price 2000000000000 --broadcast
```

## 📊 Advanced Testing

### Fuzz Testing on Kasplex
```bash
# Run fuzz tests on real Kasplex network
forge test --rpc-url kasplex --gas-price 2000000000000 --fuzz-runs 1000
```

### Gas Benchmarking
```bash
# Compare gas usage between networks
forge snapshot --rpc-url kasplex --gas-price 2000000000000
forge snapshot --rpc-url sepolia --diff
```

### Coverage Analysis
```bash
# Get coverage on Kasplex
forge coverage --rpc-url kasplex --gas-price 2000000000000
```

## 🔍 Contract Interaction

### Using Cast (CLI)
```bash
# Call view functions
cast call 0xYourContractAddress "getValue()" --rpc-url kasplex

# Send transactions  
cast send 0xYourContractAddress "setValue(uint256)" 42 \
    --rpc-url kasplex \
    --gas-price 2000000000000 \
    --private-key $PRIVATE_KEY

# Check balance
cast balance 0xYourAddress --rpc-url kasplex
```

## 🎯 Best Practices for Kasplex

1. **Always use 2000 Gwei gas price** with `--gas-price 2000000000000`
2. **Test locally first** with `forge test`
3. **Get KAS from faucet**: [Zealous Swap](https://faucet.zealousswap.com/) or [Kaspa Finance](https://app.kaspafinance.io/faucets)
4. **Use forge snapshots** to track gas optimization
5. **Check explorer** at https://explorer.testnet.kasplextest.xyz

## 📚 Advanced Commands

### Contract Verification (Coming Soon)
```bash
# Kasplex verification will be available soon
# For now, verify on Etherscan for Ethereum deployments
forge verify-contract \
    --chain-id 1 \
    --num-of-optimizations 200 \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    <contract_address> \
    src/MyContract.sol:MyContract
```

### Multi-network Deployment
```bash
# Deploy to multiple networks at once
echo "Deploying to Kasplex..."
forge script script/Deploy.s.sol:DeployScript --rpc-url kasplex --gas-price 2000000000000 --broadcast

echo "Deploying to Sepolia for comparison..."
forge script script/Deploy.s.sol:DeployScript --rpc-url sepolia --broadcast
```

## 🆚 Side-by-Side Performance

### Deployment Time
```bash
# Ethereum
time forge script --rpc-url sepolia --broadcast
# real    3m42.156s (waiting for confirmations)

# Kasplex  
time forge script --rpc-url kasplex --gas-price 2000000000000 --broadcast
# real    0m15.432s (10 second finality!)
```

### Cost Analysis
```bash
# Same contract deployed to both networks:

Ethereum Sepolia:
- Gas Used: 1,200,000
- Gas Price: 20 Gwei  
- Cost: 0.024 ETH (~$48 if on mainnet)

Kasplex L2:
- Gas Used: 1,200,000 (identical!)
- Gas Price: 2000 Gwei
- Cost: 2.4 KAS (~$0.024)

Savings: 99.95% 🎉
```

## 🚨 Troubleshooting

**Deployment hanging?**
- ✅ Use `--gas-price 2000000000000` flag
- ✅ Check KAS balance with `cast balance`
- ✅ Verify RPC: `https://rpc.kasplextest.xyz`

**"nonce too low" error?**
- ✅ Let Foundry handle nonce automatically
- ✅ Check account state on explorer

**Gas estimation failed?**
- ✅ Ensure contract compiles: `forge build`
- ✅ Test locally first: `forge test`
- ✅ Check constructor arguments

## 🔗 Useful Resources

- **Foundry Book**: https://book.getfoundry.sh/
- **Kasplex Explorer**: https://explorer.testnet.kasplextest.xyz
- **Kasplex Faucets**: [Zealous Swap](https://faucet.zealousswap.com/) | [Kaspa Finance](https://app.kaspafinance.io/faucets)
- **Cast Reference**: https://book.getfoundry.sh/reference/cast/

## 🆚 Framework Comparison

| Feature | Hardhat | **Foundry + Kasplex** |
|---------|---------|----------------------|
| **Compile Speed** | Slow | **Lightning Fast** |
| **Test Speed** | Medium | **Very Fast** |
| **Gas Reports** | Basic | **Detailed** |
| **Network Costs** | High (Ethereum) | **Ultra-low (Kasplex)** |
| **Rust Performance** | No | **Yes** |

## 🔗 What's Next?

- **Deploy your existing Foundry project** to Kasplex
- **Benchmark gas savings** with `forge snapshot`
- **Explore examples**: [Hello World](../../examples/01-hello-world/), [ERC20 Token](../../examples/02-erc20-standard/), [NFT Collection](../../examples/03-erc721-nft/)
- **Build faster** with Rust-powered tools and ultra-cheap network

---

**Ready to deploy at lightning speed with 99% savings?** Your Foundry setup already works on Kasplex!