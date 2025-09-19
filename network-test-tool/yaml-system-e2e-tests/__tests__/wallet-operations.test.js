const testHelpers = require('../utils/test-helpers');
const path = require('path');

describe('Wallet Operations Tests', () => {
  const network = process.env.TEST_NETWORK || 'kasplex';

  describe('Wallet Creation', () => {
    test('should create wallets from private keys', async () => {
      const yamlTest = {
        test: 'Private Key Wallet Test',
        network: network,
        wallets: {
          alice: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          bob: 'generate'  // Generate random wallet
        },
        scenario: [
          { assert: 'exists(wallets.alice.address)' },
          { assert: 'exists(wallets.bob.address)' },
          { log: 'Alice address: {{wallets.alice.address}}' },
          { log: 'Bob address: {{wallets.bob.address}}' },
          // Verify addresses are different
          { assert: 'wallets.alice.address != wallets.bob.address' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Alice address: 0x');
      expect(result.stdout).toContain('Bob address: 0x');
    });

    test('should create wallets from mnemonic phrases', async () => {
      const yamlTest = {
        test: 'Mnemonic Wallet Test',
        network: network,
        wallets: {
          alice: {
            mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
            path: "m/44'/60'/0'/0/0"
          },
          bob: {
            mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
            path: "m/44'/60'/0'/0/1"  // Different derivation path
          }
        },
        scenario: [
          { assert: 'exists(wallets.alice.address)' },
          { assert: 'exists(wallets.bob.address)' },
          { assert: 'wallets.alice.address != wallets.bob.address' },
          { log: 'Wallet A: {{wallets.alice.address}}' },
          { log: 'Wallet B: {{wallets.bob.address}}' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      const parsed = testHelpers.parseTestResults(result.stdout);
      expect(parsed.passed).toBeGreaterThan(0);
    });

    test('should create wallets dynamically in scenario', async () => {
      const yamlTest = {
        test: 'Dynamic Wallet Creation Test',
        network: network,
        scenario: [
          // Create wallet dynamically
          {
            wallet: {
              action: 'create',
              name: 'dynamicWallet',
              config: 'generate'
            }
          },
          { assert: 'exists(wallets.dynamicWallet)' },

          // Create multiple wallets
          {
            wallet: {
              action: 'generateHD',
              mnemonic: 'test test test test test test test test test test test junk',
              count: 3
            },
            returns: 'hdWallets'
          },
          { assert: 'hdWallets.length == 3' },
          {
            foreach: {
              item: 'wallet',
              in: '{{hdWallets}}'
            },
            do: [
              { log: 'HD Wallet {{wallet.index}}: {{wallet.address}}' }
            ]
          }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('HD Wallet');
    });
  });

  describe('Message and Transaction Signing', () => {
    test('should sign messages', async () => {
      const yamlTest = {
        test: 'Message Signing Test',
        network: network,
        wallets: {
          alice: 'generate'
        },
        scenario: [
          {
            signMessage: {
              wallet: 'alice',
              message: 'Hello, Blockchain!'
            },
            returns: 'signature'
          },
          { assert: 'exists(signature.signature)' },
          { assert: 'signature.signer == wallets.alice.address' },
          { log: 'Message signed by {{signature.signer}}' },
          { log: 'Signature: {{signature.signature}}' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Message signed by');
      expect(result.stdout).toContain('Signature: 0x');
    });

    test('should sign typed data (EIP-712)', async () => {
      const yamlTest = {
        test: 'Typed Data Signing Test',
        network: network,
        wallets: {
          alice: 'generate'
        },
        scenario: [
          {
            wallet: {
              action: 'sign',
              wallet: 'alice',
              typedData: {
                domain: {
                  name: 'Test App',
                  version: '1',
                  chainId: network === 'kasplex' ? 167012 : 19416
                },
                types: {
                  Message: [
                    { name: 'content', type: 'string' },
                    { name: 'timestamp', type: 'uint256' }
                  ]
                },
                value: {
                  content: 'Test message',
                  timestamp: 1234567890
                }
              }
            },
            returns: 'typedSig'
          },
          { assert: 'exists(typedSig.signature)' },
          { log: 'Typed data signed: {{typedSig.signature}}' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Typed data signed');
    });

    test('should sign transactions', async () => {
      const yamlTest = {
        test: 'Transaction Signing Test',
        network: network,
        wallets: {
          alice: 'generate',
          bob: 'generate'
        },
        setup: {
          funder: '10 ETH'
        },
        scenario: [
          // Fund Alice wallet
          { transfer: 'funder -> {{wallets.alice.address}}, 5 ETH' },

          // Sign transaction
          {
            signTransaction: {
              wallet: 'alice',
              transaction: {
                to: '{{wallets.bob.address}}',
                value: '0.1 ETH',
                data: '0x'
              }
            },
            returns: 'signedTx'
          },
          { assert: 'exists(signedTx.hash)' },
          { assert: 'exists(signedTx.rawTransaction)' },
          { log: 'Transaction signed: {{signedTx.hash}}' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Transaction signed');
    });
  });

  describe('Wallet Transactions', () => {
    test('should send transactions from wallets', async () => {
      const yamlTest = {
        test: 'Wallet Send Test',
        network: network,
        wallets: {
          alice: 'generate',
          bob: 'generate'
        },
        setup: {
          funder: '10 ETH'
        },
        scenario: [
          // Fund Alice
          { transfer: 'funder -> {{wallets.alice.address}}, 3 ETH' },

          // Send from Alice to Bob
          {
            wallet: {
              action: 'send',
              wallet: 'alice',
              to: 'bob',
              value: '0.5 ETH',
              wait: true
            },
            returns: 'txReceipt'
          },
          { assert: 'exists(txReceipt.blockNumber)' },
          { assert: 'txReceipt.status == 1' },
          { log: 'Transaction confirmed in block {{txReceipt.blockNumber}}' },

          // Check balances
          {
            wallet: {
              action: 'balance',
              wallet: 'bob'
            },
            returns: 'bobBalance'
          },
          { assert: 'bobBalance >= 0.5 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Transaction confirmed in block');
    });

    test('should fund wallets from other wallets', async () => {
      const yamlTest = {
        test: 'Wallet Funding Test',
        network: network,
        wallets: {
          alice: 'generate',
          bob: 'generate',
          charlie: 'generate'
        },
        setup: {
          funder: '20 ETH'
        },
        scenario: [
          // Initial funding
          { transfer: 'funder -> {{wallets.alice.address}}, 10 ETH' },

          // Fund Bob from Alice
          {
            wallet: {
              action: 'fund',
              wallet: 'bob',
              from: 'alice',
              amount: '2 ETH'
            }
          },

          // Fund Charlie from Alice
          {
            wallet: {
              action: 'fund',
              wallet: 'charlie',
              from: 'alice',
              amount: '1.5 ETH'
            }
          },

          // Check all balances
          {
            parallel: [
              {
                wallet: {
                  action: 'balance',
                  wallet: 'alice'
                },
                returns: 'aliceBalance'
              },
              {
                wallet: {
                  action: 'balance',
                  wallet: 'bob'
                },
                returns: 'bobBalance'
              },
              {
                wallet: {
                  action: 'balance',
                  wallet: 'charlie'
                },
                returns: 'charlieBalance'
              }
            ]
          },
          { assert: 'bobBalance >= 2 ETH' },
          { assert: 'charlieBalance >= 1.5 ETH' },
          { assert: 'aliceBalance < 7 ETH' }  // Less due to gas fees
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
    });
  });

  describe('Wallet Import/Export', () => {
    test('should export and import wallets', async () => {
      const yamlTest = {
        test: 'Wallet Export/Import Test',
        network: network,
        wallets: {
          original: 'generate'
        },
        scenario: [
          // Export wallet
          {
            wallet: {
              action: 'export',
              wallet: 'original',
              password: 'testPassword123'
            },
            returns: 'encryptedJson'
          },
          { assert: 'exists(encryptedJson)' },
          { log: 'Wallet exported successfully' },

          // Import wallet with new name
          {
            wallet: {
              action: 'import',
              name: 'imported',
              json: '{{encryptedJson}}',
              password: 'testPassword123'
            }
          },
          { assert: 'exists(wallets.imported)' },
          { assert: 'wallets.imported.address == wallets.original.address' },
          { log: 'Wallet imported: {{wallets.imported.address}}' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Wallet exported successfully');
      expect(result.stdout).toContain('Wallet imported');
    });
  });

  describe('Batch Wallet Operations', () => {
    test('should perform batch operations on wallets', async () => {
      const yamlTest = {
        test: 'Batch Wallet Operations Test',
        network: network,
        wallets: {
          alice: 'generate',
          bob: 'generate',
          charlie: 'generate',
          dave: 'generate'
        },
        setup: {
          funder: '40 ETH'
        },
        scenario: [
          // Batch funding
          {
            parallel: {
              forEach: {
                item: 'wallet',
                in: ['alice', 'bob', 'charlie', 'dave']
              },
              do: [
                { transfer: 'funder -> {{wallets[wallet].address}}, 2 ETH' }
              ]
            }
          },

          // Batch balance check
          {
            parallel: {
              forEach: {
                item: 'wallet',
                in: ['alice', 'bob', 'charlie', 'dave']
              },
              do: [
                {
                  wallet: {
                    action: 'balance',
                    wallet: '{{wallet}}'
                  },
                  returns: 'balance_{{wallet}}'
                },
                { log: '{{wallet}} balance: {{balance_{{wallet}}}}' }
              ]
            }
          },

          // Verify all have funds
          { assert: 'balance_alice >= 2 ETH' },
          { assert: 'balance_bob >= 2 ETH' },
          { assert: 'balance_charlie >= 2 ETH' },
          { assert: 'balance_dave >= 2 ETH' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('alice balance');
      expect(result.stdout).toContain('bob balance');
    });

    test('should handle multi-signature simulation', async () => {
      const yamlTest = {
        test: 'Multi-Signature Simulation Test',
        network: network,
        wallets: {
          signer1: 'generate',
          signer2: 'generate',
          signer3: 'generate',
          recipient: 'generate'
        },
        setup: {
          funder: '20 ETH'
        },
        scenario: [
          // Fund signers
          { transfer: 'funder -> {{wallets.signer1.address}}, 5 ETH' },

          // Define transaction
          {
            set: {
              multiSigTx: {
                to: '{{wallets.recipient.address}}',
                value: '1 ETH',
                data: '0x'
              }
            }
          },

          // Collect signatures in parallel
          {
            parallel: [
              {
                signTransaction: {
                  wallet: 'signer1',
                  transaction: '{{multiSigTx}}'
                },
                returns: 'sig1'
              },
              {
                signTransaction: {
                  wallet: 'signer2',
                  transaction: '{{multiSigTx}}'
                },
                returns: 'sig2'
              },
              {
                signTransaction: {
                  wallet: 'signer3',
                  transaction: '{{multiSigTx}}'
                },
                returns: 'sig3'
              }
            ]
          },

          { assert: 'exists(sig1.signature)' },
          { assert: 'exists(sig2.signature)' },
          { assert: 'exists(sig3.signature)' },
          { log: 'Collected 3 signatures for multi-sig transaction' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Collected 3 signatures');
    });
  });

  describe('Wallet Error Handling', () => {
    test('should handle invalid private keys', async () => {
      const yamlTest = {
        test: 'Invalid Private Key Test',
        network: network,
        wallets: {
          invalid: '0xinvalidkey'
        },
        scenario: [
          { assert: '!exists(wallets.invalid)' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      // Should fail or handle gracefully
      expect(result.stderr || result.stdout).toContain('invalid');
    });

    test('should handle insufficient balance for transactions', async () => {
      const yamlTest = {
        test: 'Insufficient Balance Test',
        network: network,
        wallets: {
          alice: 'generate',
          bob: 'generate'
        },
        setup: {
          funder: '1 ETH'
        },
        scenario: [
          // Fund Alice with minimal amount
          { transfer: 'funder -> {{wallets.alice.address}}, 0.01 ETH' },

          // Try to send more than balance
          {
            try: [
              {
                wallet: {
                  action: 'send',
                  wallet: 'alice',
                  to: 'bob',
                  value: '1 ETH',
                  wait: true
                }
              }
            ],
            catch: [
              { log: 'Transaction failed as expected: {{$$error.message}}' },
              { set: { errorCaught: true } }
            ]
          },
          { assert: 'errorCaught == true' }
        ]
      };

      const yamlFile = await testHelpers.createTempYaml(yamlTest);
      const result = await testHelpers.executeYamlTest(yamlFile);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Transaction failed as expected');
    });
  });
});