# ⚒️ Foundry - Ethereum Setup

Modern Ethereum development toolkit written in Rust. Fast compilation, testing, and deployment with excellent gas optimization.

## 🚀 Quick Setup

1. **Install Foundry**:
   ```bash
   # Install foundryup
   curl -L https://foundry.paradigm.xyz | bash
   
   # Install Foundry
   foundryup
   ```

2. **Initialize project**:
   ```bash
   mkdir my-ethereum-project
   cd my-ethereum-project
   forge init --force
   ```

## 📁 Project Structure

```
my-ethereum-project/
├── src/
│   └── MyContract.sol
├── test/
│   └── MyContract.t.sol
├── script/
│   └── Deploy.s.sol
├── foundry.toml
├── .env
└── README.md
```

## ⚙️ Configuration

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
mainnet = "https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}"
sepolia = "https://eth-sepolia.alchemyapi.io/v2/${ALCHEMY_API_KEY}"
polygon = "https://polygon-rpc.com/"
mumbai = "https://rpc-mumbai.maticvigil.com/"

[etherscan]
mainnet = { key = "${ETHERSCAN_API_KEY}" }
sepolia = { key = "${ETHERSCAN_API_KEY}" }
polygon = { key = "${POLYGONSCAN_API_KEY}" }
mumbai = { key = "${POLYGONSCAN_API_KEY}" }
```

### .env Template
```env
# Private key (without 0x prefix) - USE TEST ACCOUNT ONLY!
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# API Keys
ALCHEMY_API_KEY=your_alchemy_api_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here
```

## 📝 Sample Contract

### src/MyContract.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/Ownable.sol";

contract MyContract is Ownable {
    uint256 public value;
    
    event ValueChanged(uint256 indexed oldValue, uint256 indexed newValue);
    
    constructor(uint256 _initialValue) Ownable(msg.sender) {
        value = _initialValue;
    }
    
    function setValue(uint256 _newValue) external onlyOwner {
        uint256 oldValue = value;
        value = _newValue;
        emit ValueChanged(oldValue, _newValue);
    }
    
    function getValue() external view returns (uint256) {
        return value;
    }
}
```

## 🧪 Testing

### test/MyContract.t.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MyContract.sol";

contract MyContractTest is Test {
    MyContract public myContract;
    address public owner = address(0x1);
    
    function setUp() public {
        vm.prank(owner);
        myContract = new MyContract(100);
    }
    
    function test_InitialValue() public {
        assertEq(myContract.value(), 100);
    }
    
    function test_SetValue() public {
        vm.prank(owner);
        myContract.setValue(200);
        assertEq(myContract.value(), 200);
    }
    
    function test_OnlyOwnerCanSetValue() public {
        vm.expectRevert();
        vm.prank(address(0x2));
        myContract.setValue(300);
    }
    
    function test_ValueChangedEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit MyContract.ValueChanged(100, 200);
        myContract.setValue(200);
    }
    
    function testFuzz_SetValue(uint256 _value) public {
        vm.prank(owner);
        myContract.setValue(_value);
        assertEq(myContract.value(), _value);
    }
}
```

## 📜 Deployment Script

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
        
        // Deploy contract
        MyContract myContract = new MyContract(100);
        
        console.log("Contract deployed to:", address(myContract));
        console.log("Initial value:", myContract.value());
        
        vm.stopBroadcast();
    }
}
```

## 🔨 Common Commands

### Compilation
```bash
# Compile contracts
forge build

# Clean build artifacts
forge clean
```

### Testing
```bash
# Run all tests
forge test

# Run tests with gas reports
forge test --gas-report

# Run specific test
forge test --match-test test_SetValue

# Run fuzz tests with more runs
forge test --fuzz-runs 10000

# Test with coverage
forge coverage
```

### Deployment
```bash
# Deploy to Ethereum Mainnet (EXPENSIVE!)
forge script script/Deploy.s.sol:DeployScript --rpc-url mainnet --broadcast --verify

# Deploy to Sepolia testnet
forge script script/Deploy.s.sol:DeployScript --rpc-url sepolia --broadcast --verify

# Deploy to Polygon
forge script script/Deploy.s.sol:DeployScript --rpc-url polygon --broadcast --verify

# Simulate deployment (dry run)
forge script script/Deploy.s.sol:DeployScript --rpc-url mainnet
```

## 💰 Gas Optimization

Foundry excels at gas optimization:

```bash
# Gas report for all functions
forge test --gas-report

# Optimize specific function
forge test --match-test test_SetValue --gas-report

# Profile gas usage
forge test --gas-report | grep "MyContract"
```

### Gas Snapshot
```bash
# Create gas snapshot
forge snapshot

# Compare gas changes
forge snapshot --diff
```

## 🔍 Contract Verification

```bash
# Verify on Etherscan
forge verify-contract \
    --chain-id 1 \
    --num-of-optimizations 200 \
    --watch \
    --constructor-args $(cast abi-encode "constructor(uint256)" 100) \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    <contract_address> \
    src/MyContract.sol:MyContract

# Verify on Polygonscan
forge verify-contract \
    --chain-id 137 \
    --num-of-optimizations 200 \
    --watch \
    --constructor-args $(cast abi-encode "constructor(uint256)" 100) \
    --etherscan-api-key $POLYGONSCAN_API_KEY \
    <contract_address> \
    src/MyContract.sol:MyContract
```

## 📊 Gas Analysis

### Sample Gas Report
```
╭─────────────────────────────────────────────────────────────╮
│                         Gas Report                          │
├─────────────────────────────────────────────────────────────┤
│ Contract            ┆ Method     ┆ Min  ┆ Max   ┆ Avg      │
├─────────────────────────────────────────────────────────────┤
│ MyContract          ┆ setValue   ┆ 2841 ┆ 29841 ┆ 23841    │
│ MyContract          ┆ getValue   ┆ 2451 ┆ 2451  ┆ 2451     │
╰─────────────────────────────────────────────────────────────╯
```

## 💸 Cost Analysis

### Ethereum Mainnet Costs (at 50 Gwei)
```bash
# Deployment: ~1,200,000 gas
# Cost: 1,200,000 * 50 * 10^-9 * $2000 = $120

# Function call: ~30,000 gas  
# Cost: 30,000 * 50 * 10^-9 * $2000 = $3

# Transfer: ~21,000 gas
# Cost: 21,000 * 50 * 10^-9 * $2000 = $2.10
```

## 🛠️ Advanced Features

### Fuzzing
```solidity
function testFuzz_SetValue(uint256 _value) public {
    vm.assume(_value > 0 && _value < type(uint256).max);
    vm.prank(owner);
    myContract.setValue(_value);
    assertEq(myContract.value(), _value);
}
```

### Invariant Testing
```solidity
contract MyContractInvariant is Test {
    MyContract public myContract;
    
    function setUp() public {
        myContract = new MyContract(100);
    }
    
    function invariant_ValueNeverZero() public {
        assertGt(myContract.value(), 0);
    }
}
```

### Cheat Codes
```solidity
// Time manipulation
vm.warp(block.timestamp + 1 days);

// Balance manipulation  
deal(address(myContract), 1 ether);

// Prank calls
vm.prank(owner);
myContract.setValue(200);

// Expect reverts
vm.expectRevert("Only owner");
```

## 📦 Dependencies

### Installing OpenZeppelin
```bash
forge install openzeppelin/openzeppelin-contracts
```

### Remappings (foundry.toml)
```toml
remappings = [
    "@openzeppelin/=lib/openzeppelin-contracts/",
    "ds-test/=lib/ds-test/src/",
    "forge-std/=lib/forge-std/src/"
]
```

## 🚨 Security Best Practices

1. **Fuzz Testing**: Use extensive fuzzing for edge cases
2. **Invariant Testing**: Define and test contract invariants  
3. **Static Analysis**: Use `slither` for vulnerability scanning
4. **Gas Optimization**: Profile and optimize gas usage
5. **Formal Verification**: Consider formal verification for critical contracts

## 🔗 Useful Links

- **Foundry Book**: https://book.getfoundry.sh/
- **Forge Template**: https://github.com/foundry-rs/forge-template
- **OpenZeppelin**: https://github.com/OpenZeppelin/openzeppelin-contracts
- **Awesome Foundry**: https://github.com/crisgarner/awesome-foundry

## 🔗 Next Steps

- **Deploy to Ethereum**: Battle-tested but expensive
- **Consider Layer 2**: Polygon, Arbitrum for lower costs  
- **Try Kasplex**: Same code, 99% lower costs! → [Kasplex Setup](../foundry-kasplex/README.md)

## ❓ Troubleshooting

**Compilation errors?**
- Check Solidity version in foundry.toml
- Update dependencies: `forge update`
- Clear cache: `forge clean && forge build`

**Test failures?**
- Use `-vvvv` flag for detailed output
- Check assertions and test logic
- Verify contract state in setUp()

**Deployment issues?**
- Check private key and RPC endpoint
- Ensure sufficient ETH balance
- Verify network configuration