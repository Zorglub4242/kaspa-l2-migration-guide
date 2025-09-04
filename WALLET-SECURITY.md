# 🔐 Wallet Security Guide - CRITICAL READ BEFORE SETUP

**⚠️ WARNING: NEVER USE YOUR MAIN WALLET FOR TESTING!**

This guide ensures you protect your real funds while testing on Kasplex.

## 🚨 Critical Security Rules

### ❌ **NEVER DO THIS:**
- ❌ Use your main MetaMask account with real ETH/tokens
- ❌ Use a wallet that has ever held significant funds
- ❌ Export private keys from wallets with real money
- ❌ Share private keys in screenshots, Discord, or anywhere
- ❌ Commit private keys to git repositories

### ✅ **ALWAYS DO THIS:**
- ✅ Create a dedicated TEST-ONLY wallet
- ✅ Ensure the test wallet has ZERO real funds
- ✅ Label it clearly as "Test Only" in MetaMask
- ✅ Use environment variables for private keys
- ✅ Double-check you're using the test wallet

## 🛡️ Safe Setup Process

### Step 1: Create Dedicated Test Wallet

1. **Open MetaMask**
2. **Click account avatar** (top right)
3. **Add Account** → **Create Account**
4. **Name it clearly**: "Kasplex Test - NO REAL FUNDS"
5. **Verify it's empty** (0 ETH, 0 tokens)

### Step 2: Verify Test Wallet Safety

**Before exporting private key, confirm:**
- [ ] Account balance is 0.000 ETH
- [ ] No valuable tokens in this account
- [ ] Account is clearly labeled as test-only
- [ ] You're on the correct test account (check account name)

### Step 3: Export Private Key Safely

1. **Double-check account name** - should be your test account
2. **Account Details** → **Export Private Key**
3. **Enter MetaMask password**
4. **Copy private key** (without 0x prefix)
5. **Close the private key display immediately**

### Step 4: Add to Environment File

```bash
# In your project directory
echo "PRIVATE_KEY=your_test_private_key_here" > .env

# Verify the file was created
cat .env
```

### Step 5: Network Safety Check

**Add Kasplex network to MetaMask:**
- Network Name: `Kasplex Network Testnet`
- RPC URL: `https://rpc.kasplextest.xyz`
- Chain ID: `167012`
- Currency: `KAS`
- Explorer: `https://frontend.kasplextest.xyz`

**Switch to Kasplex network and verify:**
- [ ] You're on Kasplex testnet (not Ethereum mainnet!)
- [ ] Account shows 0.000 KAS (expected for new account)
- [ ] Account name shows your test wallet

## 💰 Getting Test Funds Safely

### Use Official Faucets Only

**Trusted Kasplex Faucets:**
- **Zealous Swap**: https://faucet.zealousswap.com/
- **Kaspa Finance**: https://app.kaspafinance.io/faucets

**Faucet Safety:**
1. **Verify you're on test wallet** before entering address
2. **Copy your test wallet address** from MetaMask
3. **Paste into faucet** and claim test KAS
4. **Verify tokens arrive** in your test wallet only

## 🔍 Double-Check Deployment Safety

### Before Every Deployment

**Pre-deployment checklist:**
- [ ] MetaMask shows TEST wallet name
- [ ] Connected to Kasplex testnet (not mainnet!)
- [ ] Using test funds only (KAS, not real ETH)
- [ ] Private key in .env is from test wallet
- [ ] No real funds visible in current account

### During Deployment

**Watch for these safety indicators:**
```bash
# Good - using test funds
Account balance: 45.0 KAS
Network: kasplex-testnet

# BAD - stop immediately if you see:
Account balance: 1.2 ETH  # ← REAL ETHEREUM!
Network: ethereum        # ← MAINNET!
```

## 🚨 Emergency Procedures

### If You Accidentally Used Real Wallet

1. **STOP all deployments immediately**
2. **Do not deploy to mainnet**
3. **Switch to test wallet in MetaMask**
4. **Update .env with test private key**
5. **Verify test setup before continuing**

### If You Exposed Private Key

1. **Create new test wallet immediately**
2. **Never use exposed wallet again**
3. **Update .env with new test private key**
4. **If exposed wallet had real funds, transfer them to secure wallet**

## 📋 Security Verification Checklist

### Before Starting Any Example

- [ ] Created dedicated test-only MetaMask account
- [ ] Account labeled clearly (e.g., "Kasplex Test")
- [ ] Account has ZERO real funds (0 ETH, 0 valuable tokens)
- [ ] Exported private key from correct test account
- [ ] Added private key to .env file securely
- [ ] Added Kasplex network to MetaMask
- [ ] Verified connection to testnet (not mainnet)
- [ ] Got test KAS from official faucets only
- [ ] Double-checked all steps above

### During Development

- [ ] Always verify current account before transactions
- [ ] Confirm network is Kasplex testnet
- [ ] Check gas fees are in KAS (not ETH)
- [ ] Monitor for any mainnet connection warnings
- [ ] Keep test and main wallets clearly separated

### After Development

- [ ] Test wallet remains isolated from main funds
- [ ] Private keys stored securely (environment variables)
- [ ] No private keys committed to git
- [ ] Test wallet can be safely discarded if needed

## 💡 Pro Security Tips

### Wallet Organization
```
MetaMask Accounts:
├── Account 1: "Main - REAL FUNDS" ← Never export this key!
├── Account 2: "Trading - REAL FUNDS" ← Never export this key!
├── Account 3: "Kasplex Test - NO FUNDS" ← Export this one only
└── Account 4: "Development Test" ← Export this one only
```

### Environment Variables
```bash
# .env file (never commit to git)
PRIVATE_KEY=test_wallet_key_here  # Test wallet only!

# Optional: Comment to remember
# This key is from "Kasplex Test" account with NO real funds
```

### Git Security
```bash
# .gitignore should include (already done in examples):
.env
.env.local
*.key
private-key.txt
```

## ❓ Security FAQ

**Q: Can I use my main MetaMask account?**
A: NO! Always create a separate test account with no real funds.

**Q: What if I accidentally use my main wallet?**
A: Stop immediately, switch to test wallet, update .env file.

**Q: Is it safe to export private keys?**
A: Only from test wallets with no real funds. Never from your main wallet.

**Q: Can someone steal my test funds?**
A: Test funds have no real value, but keep good security habits anyway.

**Q: What if I lose my test wallet?**
A: No problem! Test funds are free. Create a new test wallet.

**Q: How do I know if I'm on testnet?**
A: MetaMask shows "Kasplex Network Testnet" and balances are in KAS.

## 🎯 Remember

> **The whole point of Kasplex is that your existing Ethereum code works with 99% lower costs. But ONLY test with test wallets first!**

**Start safe, stay safe, enjoy the 99% gas savings! 🚀**