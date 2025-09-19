module.exports = {
  testEnvironment: 'node',
  testTimeout: 60000, // 60 seconds for blockchain operations
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'utils/**/*.js',
    '!**/node_modules/**'
  ],
  reporters: [
    'default',
    ['jest-html-reporter', {
      pageTitle: 'YAML System E2E Test Report',
      outputPath: 'test-results/test-report.html',
      includeFailureMsg: true,
      includeConsoleLog: true,
      theme: 'darkTheme',
      dateFormat: 'yyyy-mm-dd HH:MM:ss'
    }]
  ],
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  verbose: true,
  bail: false,
  maxWorkers: 1, // Sequential execution for blockchain tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};