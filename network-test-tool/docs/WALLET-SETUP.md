# Wallet Setup Guide for Blockchain Testing

This guide will help you set up MetaMask and other wallets to connect to various EVM-compatible networks for testing.

## Table of Contents
- [MetaMask Installation](#metamask-installation)
- [Creating Test Wallets](#creating-test-wallets)
- [Network Configuration](#network-configuration)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## MetaMask Installation

### Step 1: Install MetaMask
1. Visit [metamask.io](https://metamask.io/)
2. Click "Download" and choose your browser
3. Add the extension to your browser
4. Click the MetaMask icon in your browser toolbar

### Step 2: Create or Import Wallet
**For New Users:**
1. Click "Create a new wallet"
2. Create a strong password
3. **IMPORTANT**: Write down your 12-word recovery phrase
4. Store it securely offline (never digitally)
5. Confirm your recovery phrase

**For Existing Users:**
1. Click "Import wallet"
2. Enter your recovery phrase
3. Create a new password

## Creating Test Wallets

### Best Practice: Separate Test Wallets
Create dedicated wallets for testing to avoid mixing test and mainnet funds:

1. Click the account icon (circle) in MetaMask
2. Select "Create Account"
3. Name it clearly (e.g., "Sepolia Test", "Avalanche Test")
4. Use different accounts for different networks

### Exporting Private Keys (for .env file)
1. Click the three dots next to your account
2. Select "Account details"
3. Click "Export Private Key"
4. Enter your password
5. Copy the private key
6. Add to your `.env` file:
   ```
   PRIVATE_KEY=your_private_key_here_without_0x_prefix
   ```

## Network Configuration

### Quick Add Networks

#### Ethereum Sepolia Testnet
1. Open MetaMask
2. Click network dropdown (top center)
3. Click "Add network"
4. Enter:
   - **Network Name**: Sepolia Test Network
   - **RPC URL**: https://sepolia.infura.io/v3/YOUR-PROJECT-ID
   - **Chain ID**: 11155111
   - **Symbol**: ETH
   - **Explorer**: https://sepolia.etherscan.io

#### Avalanche Fuji C-Chain
1. Click "Add network" in MetaMask
2. Enter:
   - **Network Name**: Avalanche Fuji C-Chain
   - **RPC URL**: https://api.avax-test.network/ext/bc/C/rpc
   - **Chain ID**: 43113
   - **Symbol**: AVAX
   - **Explorer**: https://testnet.snowtrace.io

#### Fantom Testnet
1. Click "Add network" in MetaMask
2. Enter:
   - **Network Name**: Fantom Testnet
   - **RPC URL**: https://rpc.testnet.fantom.network
   - **Chain ID**: 4002
   - **Symbol**: FTM
   - **Explorer**: https://testnet.ftmscan.com

#### Gnosis Chiado Testnet
1. Click "Add network" in MetaMask
2. Enter:
   - **Network Name**: Chiado Testnet
   - **RPC URL**: https://rpc.chiadochain.net
   - **Chain ID**: 10200
   - **Symbol**: xDAI
   - **Explorer**: https://blockscout.chiadochain.net

#### Neon EVM DevNet (Solana)
1. Click "Add network" in MetaMask
2. Enter:
   - **Network Name**: Neon EVM DevNet
   - **RPC URL**: https://devnet.neonevm.org
   - **Chain ID**: 245022926
   - **Symbol**: NEON
   - **Explorer**: https://devnet.neonscan.org

#### Kasplex L2
1. Click "Add network" in MetaMask
2. Enter:
   - **Network Name**: Kasplex L2
   - **RPC URL**: https://user:pass@kasplex.org
   - **Chain ID**: 167012
   - **Symbol**: KAS
   - **Explorer**: https://scan.kasplex.org

#### Igra L2
1. Click "Add network" in MetaMask
2. Enter:
   - **Network Name**: Igra L2
   - **RPC URL**: https://rpc.igra.services
   - **Chain ID**: 19416
   - **Symbol**: IKAS
   - **Explorer**: https://scan.igra.services

### Using ChainList (Alternative Method)
1. Visit [chainlist.org](https://chainlist.org/)
2. Search for your desired network
3. Click "Connect Wallet"
4. Click "Add to MetaMask"

## Adding Custom Networks from Config Files

If you have a network configuration file:

```javascript
// Example: Load network from config
const config = require('./config/networks/avalanche-fuji.json');

// MetaMask parameters
const params = {
  chainId: '0x' + config.chainId.toString(16),
  chainName: config.name,
  nativeCurrency: {
    name: config.symbol,
    symbol: config.symbol,
    decimals: 18
  },
  rpcUrls: config.rpc.public,
  blockExplorerUrls: [config.explorer.url]
};

// Add programmatically (in dApp)
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [params]
});
```

## Switching Between Networks

### Manual Switching
1. Click the network name at the top of MetaMask
2. Select your desired network from the list
3. MetaMask will switch immediately

### Programmatic Switching (for developers)
```javascript
// Switch to Sepolia
await window.ethereum.request({
  method: 'wallet_switchEthereumChain',
  params: [{ chainId: '0xAA36A7' }], // 11155111 in hex
});
```

## Managing Multiple Accounts

### Account Organization Tips
1. **Name accounts clearly**: "Sepolia Dev", "Avalanche Test", etc.
2. **Use different accounts for different purposes**:
   - Development testing
   - Load testing
   - Manual testing
3. **Color-code accounts** (MetaMask feature)
4. **Keep a spreadsheet** of accounts and their purposes

### Importing Accounts
1. Click account selector
2. Choose "Import Account"
3. Paste private key
4. Name the account appropriately

## Security Best Practices

### DO's
✅ Use separate wallets for testing and mainnet
✅ Store recovery phrases offline in multiple secure locations
✅ Use hardware wallets for mainnet operations
✅ Regularly backup your accounts
✅ Use strong, unique passwords
✅ Enable 2FA where available
✅ Verify URLs before entering sensitive data

### DON'Ts
❌ Never share your private keys or recovery phrases
❌ Don't store keys in plain text files
❌ Avoid using test wallets for mainnet
❌ Don't ignore transaction confirmations
❌ Never approve unlimited token spending
❌ Don't click suspicious links

## Environment Variables Setup

Create a `.env` file in your project root:

```bash
# Private Keys (without 0x prefix)
PRIVATE_KEY=your_private_key_here
DEPLOYER_KEY=separate_deployer_key_here

# RPC Endpoints (optional - for custom nodes)
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_KEY
AVALANCHE_RPC=https://api.avax-test.network/ext/bc/C/rpc

# API Keys for enhanced features
INFURA_API_KEY=your_infura_key
ALCHEMY_API_KEY=your_alchemy_key
ETHERSCAN_API_KEY=your_etherscan_key
```

## Troubleshooting

### Common Issues and Solutions

#### "Insufficient funds" error
- **Solution**: Get test tokens from faucet
- Check you're on the correct network
- Verify account balance

#### "Network not found"
- **Solution**: Add the network manually
- Check RPC endpoint is correct
- Verify chain ID matches

#### "Transaction stuck/pending"
- **Solution**:
  1. Click "Speed Up" in MetaMask
  2. Increase gas price
  3. Or click "Cancel" and retry

#### "Invalid RPC response"
- **Solution**:
  - Try alternative RPC endpoints
  - Check network status
  - Clear MetaMask cache (Settings → Advanced → Clear activity tab data)

#### "Cannot connect to network"
- **Solution**:
  1. Check internet connection
  2. Try different RPC endpoint
  3. Disable VPN if using one
  4. Update MetaMask

### MetaMask Reset (Last Resort)
If experiencing persistent issues:
1. Settings → Advanced → Reset Account
2. This clears transaction history but keeps accounts
3. Re-import accounts if needed

## Advanced Tips

### Using Multiple Wallets
- **MetaMask**: Primary testing
- **Rainbow**: Modern UI, mobile-friendly
- **Coinbase Wallet**: Good for beginners
- **WalletConnect**: For mobile testing

### Browser Profiles
Create separate browser profiles for different testing environments:
1. Chrome: Settings → Manage Profile → Add
2. Firefox: about:profiles → Create New Profile
3. Install MetaMask in each profile
4. Use different accounts/networks per profile

### Hardware Wallet Integration (for mainnet)
1. Connect Ledger/Trezor to computer
2. In MetaMask: Connect Hardware Wallet
3. Select device type
4. Follow on-screen instructions
5. Never use hardware wallets for testnet (waste of time)

## Resources

### Official Documentation
- [MetaMask Docs](https://docs.metamask.io/)
- [Ethereum Docs](https://ethereum.org/en/developers/docs/)
- [Avalanche Docs](https://docs.avax.network/)

### Network Status Pages
- [Ethereum Status](https://ethstats.net/)
- [Avalanche Status](https://status.avax.network/)
- [Chainlist](https://chainlist.org/)

### Support Channels
- [MetaMask Support](https://metamask.zendesk.com/)
- [Discord Communities](https://discord.com/) (search for specific networks)
- [Stack Exchange](https://ethereum.stackexchange.com/)

## Next Steps

After setting up your wallet:
1. Get test tokens from [FAUCETS.md](./FAUCETS.md)
2. Configure your testing environment
3. Run test suites with proper network selection
4. Monitor transactions on block explorers

---

**Remember**: This guide is for testing purposes. Always use separate wallets and keys for mainnet operations!