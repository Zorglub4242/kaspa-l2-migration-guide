// Jest setup file for global test configuration

// Set test environment
process.env.NODE_ENV = 'test';
process.env.TEST_NETWORK = process.env.TEST_NETWORK || 'kasplex';

// Increase timeout for blockchain operations
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

global.console = {
  ...console,
  log: jest.fn((...args) => {
    // Only log if VERBOSE is set
    if (process.env.VERBOSE) {
      originalConsoleLog(...args);
    }
  }),
  error: jest.fn((...args) => {
    // Always show errors
    originalConsoleError(...args);
  }),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Global test helpers
global.testHelpers = {
  // Wait for a condition to be true
  waitFor: async (condition, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  },

  // Create a test wallet
  createTestWallet: () => {
    const { ethers } = require('ethers');
    return ethers.Wallet.createRandom();
  },

  // Get test network config
  getTestNetwork: () => {
    return {
      kasplex: {
        rpc: process.env.KASPLEX_RPC || 'http://localhost:8545',
        chainId: 167012
      },
      igra: {
        rpc: process.env.IGRA_RPC || 'http://localhost:8546',
        chainId: 19416
      }
    }[process.env.TEST_NETWORK || 'kasplex'];
  }
};

// Clean up after tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});