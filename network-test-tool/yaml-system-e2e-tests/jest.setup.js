// Jest setup file
const path = require('path');

// Set default test network
process.env.TEST_NETWORK = process.env.NETWORK || 'kasplex';

// Set paths
process.env.TOOL_PATH = path.resolve(__dirname, '..');
process.env.TEST_PATH = __dirname;

// Increase async callback timeout for blockchain operations
jest.setTimeout(60000);

// Global test helpers
global.testHelpers = require('./utils/test-helpers');

// Clean up test artifacts after all tests
afterAll(async () => {
  const { cleanup } = require('./utils/test-helpers');
  await cleanup();
});