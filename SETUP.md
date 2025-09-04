# 🔧 Setup Guide - Required User Configuration

This guide covers the **only** things you need to configure to use the examples. Everything else works out of the box!

## ⚡ Quick Setup (2 minutes)

### 1. Get Your Private Key (30 seconds)

**From MetaMask**:
1. Click your account avatar → Account Details
2. Click "Export Private Key"
3. Enter your password
4. Copy the private key (without the 0x prefix)

**Security Note**: Never share this key or commit it to git!

### 2. Configure Your Private Key (30 seconds)

**Option A: Environment Variable (Recommended)**
```bash
# Create .env file in any example directory
echo "PRIVATE_KEY=your_private_key_here" > .env
```

**Option B: Direct in hardhat.config.js**
```javascript
// In hardhat.config.js, uncomment and replace:
accounts: ["your_private_key_here"]  // No 0x prefix needed
```

### 3. Get Testnet Funds (1 minute)

**Kasplex Testnet** (Free, Daily):
- Visit: https://kasplextest.xyz/faucet
- Paste your wallet address
- Get 50 KAS (enough for thousands of transactions!)

**Ethereum Sepolia** (Optional, for comparison):
- Visit: https://sepoliafaucet.com/
- Get 0.5 ETH (enough for a few transactions)

### 4. Deploy! (30 seconds)

```bash
cd examples/01-hello-world
npm install
npm run deploy:kasplex
```

Done! 🎉

## 📋 User-Specific Variables Reference

### Required Variables

| Variable | Where to Set | Example | Purpose |
|----------|-------------|---------|---------|
| `PRIVATE_KEY` | `.env` file | `abcd1234...` | Your wallet private key |
| `your-wallet-address` | Scripts (auto-detected) | `0x742d35...` | Your wallet address |

### Optional Variables (Only if using these networks)

| Variable | Where to Set | Example | Purpose |
|----------|-------------|---------|---------|
| `ALCHEMY_API_KEY` | `hardhat.config.js` | `abc123...` | Ethereum/Polygon RPC |
| `ETHERSCAN_API_KEY` | `hardhat.config.js` | `def456...` | Contract verification |
| `POLYGONSCAN_API_KEY` | `hardhat.config.js` | `ghi789...` | Polygon verification |

### Getting Optional API Keys

**Alchemy** (for Ethereum networks):
1. Visit: https://www.alchemy.com/
2. Create free account
3. Create new app
4. Copy API key

**Etherscan** (for contract verification):
1. Visit: https://etherscan.io/apis
2. Create free account  
3. Create API key
4. Copy API key

## 🌐 Network Configurations (Pre-configured)

All network configurations are **already set up**! You just need to add your private key.

### Kasplex L2 Testnet ✅ Ready to Use
```javascript
kasplex: {
  url: "https://rpc.kasplextest.xyz",      // ✅ Pre-configured
  chainId: 167012,                         // ✅ Pre-configured
  gasPrice: 20000000000,                   // ✅ Pre-configured
  // Only add your private key here! ↓
  accounts: [process.env.PRIVATE_KEY]      // 🔧 Your variable
}
```

### Ethereum Networks ✅ Ready to Use
```javascript
sepolia: {
  url: "https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY", // 🔧 Replace if needed
  chainId: 11155111,                       // ✅ Pre-configured
  gasPrice: 20000000000,                   // ✅ Pre-configured
  accounts: [process.env.PRIVATE_KEY]      // 🔧 Your variable
}
```

## 🚀 Zero-Config Examples

These examples work immediately with just your private key:

### Hello World Contract
```bash
cd examples/01-hello-world
echo "PRIVATE_KEY=your_key_here" > .env
npm install
npm run deploy:kasplex  # Works immediately!
```

### ERC20 Token
```bash  
cd examples/02-erc20-standard
echo "PRIVATE_KEY=your_key_here" > .env
npm install
npm run deploy:kasplex  # Creates your token!
```

## 🔒 Security Best Practices

### ✅ DO:
- Use environment variables for private keys
- Use `.env` files (automatically gitignored)
- Use separate wallets for testnet vs mainnet
- Keep your private key secure and never share it

### ❌ DON'T:
- Commit private keys to git
- Use your main wallet for testing
- Share your private keys in screenshots
- Use real funds on testnets

### Environment Variable Setup
```bash
# Create .env file in any example directory
cat > .env << 'EOF'
# Your wallet private key (without 0x prefix)
PRIVATE_KEY=your_actual_private_key_here

# Optional: API keys for other networks
ALCHEMY_API_KEY=your_alchemy_key_here
ETHERSCAN_API_KEY=your_etherscan_key_here
EOF
```

## 🛠️ Advanced Configuration (Optional)

### Custom Token Configuration
```javascript
// In deploy scripts, modify these values:
const TOKEN_CONFIG = {
  name: "Your Custom Token",           // 🔧 Customize
  symbol: "YCT",                       // 🔧 Customize  
  initialSupply: 1000000,              // 🔧 Customize
};
```

### Gas Configuration
```javascript
// All examples use optimized gas settings:
gasPrice: 20000000000,  // 20 Gwei - perfect for all networks
gas: 4000000,           // 4M gas limit - handles any contract
```

## 📞 Support & Troubleshooting

### Common Issues

**"Insufficient balance" Error**:
- Get testnet funds from faucets listed above
- Make sure you're using the correct network

**"Private key" Error**:
- Check your `.env` file exists
- Remove any `0x` prefix from private key
- Make sure the key is from MetaMask export

**"Network not found" Error**:
- Check MetaMask has Kasplex network added
- Verify RPC URL: https://rpc.kasplextest.xyz
- Confirm Chain ID: 167012

### Get Help
- **Discord**: https://discord.gg/kasplex
- **GitHub Issues**: https://github.com/Zorglub4242/ethereum-to-kasplex-guide/issues
- **Documentation**: https://docs-kasplex.gitbook.io/l2-network

## 🎯 Success Checklist

After setup, you should be able to:
- [ ] Deploy Hello World contract in under 1 minute
- [ ] Create your own ERC20 token
- [ ] See transactions on Kasplex explorer
- [ ] Add your tokens to MetaMask
- [ ] Pay ~$0.001 per transaction instead of $10-50 on Ethereum

**Ready?** Pick an example and start building! 🚀