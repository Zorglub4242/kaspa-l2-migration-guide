# 🧪 Comprehensive Blockchain Test Suite

A complete testing framework for blockchain networks including EVM compatibility, DeFi protocols, and finality measurements.

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18+)
- **npm** or **yarn**
- **PowerShell** (Windows) or **pwsh** (cross-platform)
- **.env file** with `PRIVATE_KEY` configured

### Basic Usage

```bash
# Run full test suite on all networks
npm run test:full

# Quick test (skip deployment & finality)  
npm run test:quick

# Test specific network
npm run test:single kasplex
```

## 📋 PowerShell Script Options

### `run-full-test-suite.ps1`

```powershell
# Full test suite (default: sepolia,kasplex,igra)
.\run-full-test-suite.ps1

# Test specific networks
.\run-full-test-suite.ps1 -Networks "sepolia,kasplex"

# Skip deployment (use existing contracts)
.\run-full-test-suite.ps1 -SkipDeployment

# Skip finality measurements (faster)
.\run-full-test-suite.ps1 -SkipFinality

# Custom report output
.\run-full-test-suite.ps1 -OutputReport "my-results.html"

# Combined options
.\run-full-test-suite.ps1 -Networks "kasplex" -SkipDeployment -SkipFinality
```

## 🧪 Test Phases

### Phase 1: EVM Compatibility Deployment
- Deploys test contracts for precompiles, CREATE2, assembly
- **Skip with**: `-SkipDeployment`
- **Scripts**: `deploy-evm-compatibility.js`

### Phase 2: EVM Compatibility Tests  
- Tests 18 EVM compatibility features
- Precompiles: ecrecover, sha256, ripemd160, modexp, identity
- Assembly operations and CREATE2 functionality
- **Scripts**: `run-evm-compatibility-tests.js`

### Phase 3: DeFi Protocol Suite
- Complete DeFi ecosystem testing
- ERC20 tokens, DEX, lending, yield farming, NFTs, MultiSig
- **Scripts**: `complete-defi-suite.js`

### Phase 4: Finality Measurements
- Block finality timing analysis
- Network performance metrics
- **Skip with**: `-SkipFinality` 
- **Scripts**: `finality-measurement.js`

### Phase 5: Report Generation
- Automatic HTML report with charts
- Performance comparisons across networks
- **Output**: `blockchain-analysis-report.html`

## 🌐 Supported Networks

| Network | Chain ID | Token | RPC Endpoint |
|---------|----------|-------|--------------|
| **Ethereum Sepolia** | 11155111 | ETH | https://rpc.sepolia.org |
| **Kasplex L2** | 167012 | KAS | https://rpc.kasplextest.xyz |
| **Igra L2** | 19416 | iKAS | https://caravel.igralabs.com:8545 |

## 📊 Output Files

### Logs
- **Test Log**: `test-suite-log-YYYY-MM-DD-HH-mm-ss.txt`
- **Detailed logging** with timestamps and color coding

### Reports  
- **HTML Report**: `blockchain-analysis-report.html` (default)
- **Interactive charts** with Chart.js
- **Network comparison** tables and graphs

### Test Results
- **EVM Results**: `test-results/evm-compatibility-{chainId}-{timestamp}.json`
- **DeFi Results**: `test-results/COMPLETE-DEFI-ANALYSIS.json`
- **Finality Results**: `real-finality-results-session-{timestamp}-{id}.json`

## ⚙️ Configuration

### Environment Variables (`.env`)
```bash
PRIVATE_KEY=your-private-key-here

# Contract addresses (auto-populated after deployment)
SEPOLIA_PRECOMPILE_TEST=0x...
SEPOLIA_CREATE2_FACTORY=0x...
SEPOLIA_ASSEMBLY_TEST=0x...

KASPLEX_PRECOMPILE_TEST=0x...
KASPLEX_CREATE2_FACTORY=0x...
KASPLEX_ASSEMBLY_TEST=0x...

IGRA_PRECOMPILE_TEST=0x...
IGRA_CREATE2_FACTORY=0x...
IGRA_ASSEMBLY_TEST=0x...
```

### Network Configuration (`hardhat.config.js`)
- **Gas prices** optimized per network
- **Timeouts** configured for reliability  
- **RPC endpoints** for all supported networks

## 🔧 Advanced Usage

### Manual Script Execution
```bash
# Deploy EVM contracts
npx hardhat run scripts/deploy-evm-compatibility.js --network kasplex

# Run EVM tests only
npx hardhat run scripts/run-evm-compatibility-tests.js --network kasplex

# Run DeFi suite
npx hardhat run scripts/complete-defi-suite.js --network kasplex

# Generate report manually
node generate-report.js --latest
```

### Error Handling
- **Automatic failure detection** - stops on first error
- **Detailed error logging** with command output
- **Network-specific diagnostics**

### Performance Optimization
- **Sequential execution** prevents nonce conflicts
- **Network-specific gas prices** for reliability
- **Extended timeouts** for network compatibility

## 📈 Success Metrics

### 100% Success Criteria
- ✅ **18/18 EVM Compatibility** tests pass
- ✅ **Complete DeFi Suite** deployment and operations
- ✅ **Finality measurements** complete successfully
- ✅ **Report generation** successful

### Typical Results
- **Ethereum Sepolia**: ~0.5 gwei, fast finality
- **Kasplex L2**: ~2000 gwei, good throughput  
- **Igra L2**: 2000 gwei (required), fast L2 performance

## 🛠️ Troubleshooting

### Common Issues

**PowerShell Execution Policy**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Missing Dependencies**
```bash
cd network-test-tool
npm install
```

**Network Connection Issues**
- Check RPC endpoints in `hardhat.config.js`
- Verify private key has sufficient balance
- Try with increased timeouts

**Contract Deployment Failures**  
- Ensure correct gas price settings
- Check network-specific requirements (e.g., Igra needs exactly 2000 gwei)

### Debug Mode
```powershell
# Enable verbose logging
$VerbosePreference = "Continue"
.\run-full-test-suite.ps1 -Verbose
```

## 📝 Contributing

### Adding New Networks
1. Add network config to `hardhat.config.js`
2. Update `networkNames` in PowerShell script
3. Add explorer URL mapping
4. Test with small transactions first

### Adding New Tests
1. Create test script in `scripts/` directory
2. Add to appropriate phase in PowerShell script
3. Update report generator to include results
4. Document in this README

## 🔗 Related Tools

- **Report Generator**: `generate-report.js`
- **Finality CLI**: `cli-finality.js` 
- **Individual Test Scripts**: `scripts/` directory
- **Network Configuration**: `hardhat.config.js`

---

## 🎯 Example Workflows

### Development Testing
```bash
# Quick test of changes on single network
npm run test:single kasplex -- -SkipFinality
```

### Full Production Validation
```bash
# Complete test suite with full report
npm run test:full
```

### Custom Network Testing  
```powershell
# Test only Kasplex and Igra L2s
.\run-full-test-suite.ps1 -Networks "kasplex,igra" -OutputReport "l2-comparison.html"
```

For detailed test protocol documentation, see the generated HTML report's documentation link.