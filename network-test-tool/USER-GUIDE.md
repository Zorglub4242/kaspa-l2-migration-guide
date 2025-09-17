# 📚 Network Test Tool - User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Advanced Testing](#advanced-testing)
4. [Contract Management](#contract-management)
5. [Report Generation](#report-generation)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Getting Started

### Prerequisites
- Node.js 16+ installed
- Git installed
- Testnet funds on target networks
- Basic understanding of blockchain testing

### Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd network-test-tool

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your PRIVATE_KEY (without 0x prefix)

# Initialize database
npm run db:init
```

### Network Configuration

#### Pre-configured Networks
The tool comes with 7+ networks pre-configured:
- **Ethereum Sepolia** (Chain ID: 11155111)
- **Kasplex L2** (Chain ID: 167012)
- **Igra L2** (Chain ID: 19416)
- **Avalanche Fuji** (Chain ID: 43113)
- **Fantom Testnet** (Chain ID: 4002)
- **Gnosis Chiado** (Chain ID: 10200)
- **Neon EVM DevNet** (Chain ID: 245022926)

#### Adding Custom Networks
You can easily add any EVM-compatible network:

1. **Create a network configuration file** (`my-network.json`):
```json
{
  "id": "my-network",
  "name": "My Network Name",
  "chainId": 12345,
  "symbol": "MYN",
  "type": "testnet",
  "rpc": {
    "public": [
      "https://rpc.mynetwork.com",
      "https://backup-rpc.mynetwork.com"
    ]
  },
  "gasConfig": {
    "strategy": "dynamic",
    "maxFeePerGas": "30",
    "maxPriorityFeePerGas": "2",
    "fallback": "20"
  },
  "explorer": {
    "url": "https://explorer.mynetwork.com"
  },
  "faucet": {
    "url": "https://faucet.mynetwork.com",
    "amount": "1 MYN",
    "cooldown": "24 hours"
  }
}
```

2. **Add the network to the tool**:
```bash
npm run network:add my-network.json
```

3. **Verify the network was added**:
```bash
npm run network:list
npm run network:show my-network
```

4. **Use the network for testing**:
```bash
npm run test:evm -- --network my-network
```

#### Network Management Commands
```bash
# List all available networks
npm run network:list

# Show details for a specific network
npm run network:show <network-id>

# Add a new network
npm run network:add <config-file>

# Validate a network configuration
npm run network:validate <config-file>

# Export all network configurations
npm run network:export

# Get network statistics
npm run network:stats
```

#### Using Environment Variables
Networks can use environment variables for sensitive data:
```json
{
  "rpc": {
    "public": [
      "https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}",
      "https://sepolia.infura.io/v3/${INFURA_API_KEY}"
    ]
  }
}
```

Set these in your `.env` file:
```bash
ALCHEMY_API_KEY=your_alchemy_key
INFURA_API_KEY=your_infura_key
```

## Basic Usage

### Interactive CLI Mode
The easiest way to use the tool:
```bash
npm start
```
This launches an interactive menu where you can:
- Run tests
- Deploy contracts
- Check network status
- Manage contracts
- Generate reports

### Quick Testing Commands

#### Test All Networks
```bash
npm run test:quick          # Fast parallel testing
npm run test:comprehensive  # Full test suite
```

#### Test Specific Network
```bash
npm run test:kasplex    # Test Kasplex L2
npm run test:igra       # Test Igra L2
npm run test:sepolia    # Test Ethereum Sepolia
```

#### Test Specific Feature
```bash
npm run test:evm        # EVM compatibility tests
npm run test:defi       # DeFi protocol tests
npm run test:load       # Load/stress testing
npm run test:finality   # Finality measurement
```

## Advanced Testing

### Custom Test Configurations

#### Running Tests with Options
```bash
# With retry until success
node cli.js test --networks kasplex,igra --tests evm,defi --retry-until-success

# Parallel execution
node cli.js test --networks all --tests all --parallel

# With custom timeout
node cli.js test --timeout 60000 --max-retries 5
```

### Test Modes

#### Standard Mode
Default testing mode with normal validation:
```bash
npm run test:evm -- --mode standard
```

#### Comprehensive Mode
Extended testing with additional edge cases:
```bash
npm run test:evm -- --mode comprehensive
```

#### Stress Mode
High-volume testing for performance analysis:
```bash
npm run test:load -- --mode stress
```

### Load Testing

#### Basic Load Test
```bash
npm run load:test -- --duration 30 --tps 10
```

#### Stress Test
```bash
npm run load:stress -- --max-tps 100 --duration 60
```

#### Burst Testing
```bash
npm run load:burst -- --burst-size 50 --interval 5000
```

## Contract Management

### Deployment

#### Deploy to All Networks
```bash
npm run deploy:all
```

#### Deploy to Specific Network
```bash
npm run deploy:kasplex
npm run deploy:igra
npm run deploy:sepolia
```

### Contract Health Monitoring

#### Check All Contracts
```bash
npm run contracts:health
```

#### List Deployed Contracts
```bash
npm run contracts:list
```

#### Verify Contract Deployments
```bash
npm run contracts:verify
```

### Database Management

#### View Contract Registry
```bash
node cli.js contracts --action list
```

#### Update Contract Health
```bash
node cli.js contracts --action health --networks all
```

## Gas Pricing & Cost Analysis

### Real-time Gas Prices
Get current gas prices for any network:
```bash
# Get gas prices for a specific network
npm run gas:prices ethereum
npm run gas:prices avalanche

# Get historical gas prices
node scripts/network-cli.js gas ethereum --historical
```

### Transaction Cost Calculation
Calculate costs before running tests:
```bash
# Calculate cost for a specific network
npm run gas:cost ethereum-sepolia 1000000

# Compare costs across all networks
node scripts/network-cli.js cost ethereum-sepolia 1000000 --compare
```

### Cost Comparison
Compare mainnet vs testnet costs:
```bash
# Generate cost comparison report
node scripts/network-cli.js cost kasplex-l2 1000000 --compare
```

Output shows:
- Gas price in gwei
- Cost in native tokens
- Cost in USD
- Network comparison ranking

### Setting Up Gas Price APIs
For accurate real-time pricing, add API keys to `.env`:
```bash
# Ethereum gas prices
ETHERSCAN_API_KEY=your_etherscan_key
BLOCKNATIVE_API_KEY=your_blocknative_key

# Other networks
FTMSCAN_API_KEY=your_ftmscan_key
SNOWTRACE_API_KEY=your_snowtrace_key
```

## Report Generation

### Available Reports

1. **Executive Dashboard** - High-level KPIs and metrics
2. **DeFi Protocol Results** - Detailed DeFi test results
3. **Contract Deployment Summary** - Contract status overview
4. **Load Test Performance** - Performance metrics and bottlenecks
5. **Test Failure Analysis** - Failure categorization and root causes
6. **Finality Measurement** - Block finality and MEV analysis

### JSReport Studio Designer

#### Start the Report Designer
```bash
npm run reports:server
```

This launches **JSReport Studio** at `http://localhost:5488` with:
- **Interactive Template Editor** - Design and customize report templates
- **Live Data Preview** - Preview reports with actual database data
- **Data Dictionary** - All formatters and helpers preconfigured
- **Database Integration** - Direct access to test-results.db
- **Visual Designer** - Drag-and-drop report building
- **Export Options** - Generate reports in PDF, HTML, or Excel

#### Using JSReport Studio

1. **Access the Studio**: Open browser to `http://localhost:5488`
2. **View Templates**: Browse the 6 preconfigured report templates
3. **Edit Templates**: Click any template to open in the editor
4. **Preview with Data**: Use the "Run" button to preview with live data
5. **Create Custom Reports**: Click "+" to create new templates
6. **Query Database**: Use the data helpers to query test results

#### Custom Port
```bash
node scripts/report-cli.js server --port 3000  # Use custom port
```

### Generating Reports

#### Generate All Reports
```bash
npm run reports:generate
```

#### Generate Specific Report
```bash
node cli.js report --type executive-dashboard --format html
node cli.js report --type defi-results --networks kasplex,igra
```

### Report Formats
- **HTML** - Interactive web reports with charts
- **JSON** - Machine-readable data for integration
- **CSV** - Spreadsheet-compatible format
- **PDF** - Professional documents via JSReport Studio

## Troubleshooting

### Common Issues

#### Issue: "Insufficient funds"
**Solution:**
```bash
# Check balance
npm run balance:check

# Get testnet funds from faucets:
# Kasplex: https://faucet.zealousswap.com/
# Sepolia: https://faucet.sepolia.dev/
```

#### Issue: "Contract not found"
**Solution:**
```bash
# Redeploy contracts
npm run deploy:all

# Verify deployment
npm run contracts:verify
```

#### Issue: "Database locked"
**Solution:**
```bash
# Optimize database
npm run db:optimize

# If persists, restart
npm run db:reset
```

#### Issue: "Test timeout"
**Solution:**
```bash
# Increase timeout
node cli.js test --timeout 120000

# Check network status
npm run status:full
```

### Debug Mode

Enable verbose logging:
```bash
DEBUG=* npm run test:evm
```

Check specific component:
```bash
DEBUG=test-runner,database npm run test:comprehensive
```

## Best Practices

### 1. Pre-flight Checks
Always run before testing:
```bash
npm run status:full     # Check system status
npm run contracts:health # Verify contracts
npm run balance:check   # Ensure sufficient funds
```

### 2. Test Isolation
Use sessions for isolated test campaigns:
```bash
node cli.js test --session "feature-x-testing"
```

### 3. Resource Management
For long-running tests:
```bash
# Use resource pooling
node cli.js test --max-concurrent 5 --pool-size 10

# Monitor memory usage
npm run monitor
```

### 4. Data Management
Regular maintenance:
```bash
# Backup before major tests
npm run db:backup

# Clean old data
npm run db:clean --older-than 7d

# Export for analysis
npm run export:json --session latest
```

### 5. Network-Specific Tips

**Kasplex L2:**
- Use dynamic gas pricing
- Allow for network congestion
- Retry on temporary failures

**Igra L2:**
- Always use exactly 2000 gwei gas price
- Monitor for network upgrades
- Use fallback RPC endpoints

**Sepolia:**
- Keep gas prices low (~0.5 gwei)
- Use multiple RPC providers
- Monitor for testnet resets

### 6. Performance Optimization

For faster testing:
```bash
# Parallel execution
npm run test:all -- --parallel

# Skip deployment (use existing)
npm run test:evm -- --skip-deploy

# Selective retry (only failed tests)
npm run test:comprehensive -- --retry-failed-only
```

### 7. Reporting Best Practices

- Generate reports after each test session
- Archive reports with meaningful names
- Use JSON format for automated analysis
- Share HTML reports with stakeholders

## Advanced Configuration

### Custom Networks

#### Method 1: External Configuration (Recommended)
Create a JSON file in `config/networks/`:
```json
{
  "id": "my-custom-network",
  "name": "My Custom Network",
  "chainId": 12345,
  "symbol": "MCN",
  "type": "testnet",
  "rpc": {
    "public": ["https://rpc.mynetwork.com"],
    "websocket": ["wss://ws.mynetwork.com"]
  },
  "gasConfig": {
    "strategy": "dynamic",
    "fallback": "20"
  },
  "explorer": {
    "url": "https://explorer.mynetwork.com"
  },
  "wallet": {
    "metamask": {
      "networkName": "My Custom Network",
      "rpcUrl": "https://rpc.mynetwork.com",
      "chainId": "0x3039",
      "symbol": "MCN",
      "blockExplorerUrl": "https://explorer.mynetwork.com"
    }
  }
}
```

Then add it:
```bash
npm run network:add config/networks/my-custom-network.json
```

#### Method 2: Direct Hardhat Configuration (Legacy)
Add to `hardhat.config.js`:
```javascript
networks: {
  mynetwork: {
    url: "https://rpc.mynetwork.com",
    chainId: 12345,
    accounts: [process.env.PRIVATE_KEY]
  }
}
```

### Custom Test Suites

Create in `scripts/`:
```javascript
// my-custom-test.js
const { TestRunner } = require('../lib/test-runner');

async function runCustomTests() {
  const runner = new TestRunner({
    networks: ['mynetwork'],
    tests: ['custom'],
    // ... options
  });

  await runner.run();
}
```

### Environment Variables

Complete list in `.env`:
```bash
# Required
PRIVATE_KEY=your_key_here

# Optional - RPC Providers (for better reliability)
ALCHEMY_API_KEY=your_alchemy_key
INFURA_API_KEY=your_infura_key

# Optional - Gas Price APIs (for real-time pricing)
ETHERSCAN_API_KEY=your_etherscan_key
BLOCKNATIVE_API_KEY=your_blocknative_key
FTMSCAN_API_KEY=your_ftmscan_key
SNOWTRACE_API_KEY=your_snowtrace_key

# Optional - Testing Configuration
TEST_LABEL=my_test_campaign
MAX_RETRIES=10
TIMEOUT_MS=60000
PARALLEL_EXECUTION=true
```

## Support & Resources

### Getting Help
- Check this guide first
- Review error messages carefully
- Enable debug mode for details
- Check network status pages

### Useful Links
- [Kasplex Explorer](https://explorer.testnet.kasplextest.xyz)
- [Igra Explorer](https://explorer.caravel.igralabs.com/)
- [Sepolia Explorer](https://sepolia.etherscan.io)

### Contributing
- Report issues in GitHub
- Include full error logs
- Specify network and test type
- Provide reproduction steps

---

**Remember:** Always use testnet funds and verify code before running!