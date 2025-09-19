# YAML System E2E Test Suite

Comprehensive end-to-end test suite for validating the YAML testing system functionality on Kasplex and IGRA networks.

## ⚠️ IMPORTANT: Test Requirements

**Every change to the codebase MUST have corresponding test coverage.** See [TEST_DEVELOPMENT_GUIDE.md](../TEST_DEVELOPMENT_GUIDE.md) for detailed instructions on how to write tests.

## Overview

This test suite is a standalone Jest-based testing framework that validates all features of the YAML testing system through CLI-only interaction. It requires no code dependencies on the main project and operates entirely through the command-line interface.

## Features Tested

### 1. Core Functionality
- Basic test execution
- Account creation and management
- Contract deployment
- Contract interactions
- Assertions and expressions
- Variables and context
- Error handling

### 2. Bring Your Own Contract
- Solidity file compilation
- Custom contract deployment
- Constructor arguments
- Multi-contract scenarios
- Event validation
- Compiler options

### 3. Keyword System
- Basic keyword usage
- Nested keywords
- Parameter validation
- Multiple libraries
- Inline keywords
- Complex logic in keywords

### 4. Control Flow
- Conditional execution (if/then/else)
- Loops (foreach, while, repeat)
- Parallel execution
- Try/catch error handling
- Complex combinations

### 5. Wallet Operations
- Wallet creation (private key, mnemonic, generate)
- Message and transaction signing
- EIP-712 typed data
- Wallet transactions
- Import/export
- Batch operations

### 6. Data-Driven Testing
- CSV data source
- JSON/JSONL data source
- Database queries
- API data fetching
- Data transformations
- Parameterized testing

### 7. Integration
- Complete E2E workflows
- Performance testing
- Error recovery
- Multi-network validation
- Test reporting

### 8. Migrated Tests (NEW)
- JavaScript to YAML migration validation
- DeFi suite migration tests
- Load test migration tests
- Backwards compatibility verification
- Performance comparisons

## Installation

```bash
cd yaml-system-e2e-tests
npm install
```

## Running Tests

### Run all tests on default network (Kasplex):
```bash
npm test
```

### Run specific test category:
```bash
npm run test:core      # Core functionality
npm run test:contracts # Bring your own contract
npm run test:keywords  # Keyword system
npm run test:control   # Control flow
npm run test:wallets   # Wallet operations
npm run test:data      # Data-driven testing
```

### Run tests on specific network:
```bash
npm run test:kasplex   # Test on Kasplex
npm run test:igra      # Test on IGRA
NETWORK=sepolia npm test  # Test on Sepolia
```

### Using the test runner:
```bash
node run-tests.js [category] [network]

# Examples:
node run-tests.js all kasplex       # All tests on Kasplex
node run-tests.js core igra         # Core tests on IGRA
node run-tests.js integration kasplex # Integration tests on Kasplex
```

## Test Structure

```
yaml-system-e2e-tests/
├── __tests__/                      # Test files
│   ├── core-functionality.test.js  # Core YAML features
│   ├── bring-your-own-contract.test.js # Custom Solidity contracts
│   ├── keyword-system.test.js      # Keyword library system
│   ├── control-flow.test.js        # Conditionals and loops
│   ├── wallet-operations.test.js   # Wallet management
│   ├── data-driven.test.js         # Data-driven testing
│   ├── integration.test.js         # Full integration tests
│   └── migrated-tests.test.js      # Migration validation tests (NEW)
├── contracts/                       # Sample Solidity contracts
│   ├── Calculator.sol              # Simple calculator contract
│   └── TokenVault.sol              # Token vault contract
├── utils/                          # Test utilities
│   └── test-helpers.js             # Helper functions
├── yaml-tests/                     # Generated YAML test files
├── test-data/                      # Generated test data
├── test-results/                   # Test results and reports
├── jest.config.js                  # Jest configuration
├── jest.setup.js                   # Jest setup
├── package.json                    # Dependencies
├── run-tests.js                    # Main test runner
└── README.md                       # This file
```

## Test Helpers

The `test-helpers.js` utility provides:
- `executeYamlTest()` - Execute YAML test files
- `deployContract()` - Deploy contracts for testing
- `checkOutputPatterns()` - Validate test output
- `parseTestResults()` - Parse test results
- `createTempYaml()` - Create temporary YAML files
- `waitForCondition()` - Wait for conditions
- `executeCommand()` - Execute CLI commands
- `getNetworkConfig()` - Get network configuration

## Network Requirements

### Kasplex (Chain ID: 167012)
- RPC: Configure in main project
- Gas Price: Dynamic (typically ~2001 gwei)
- Block Time: 1-2 seconds

### IGRA (Chain ID: 19416)
- RPC: Configure in main project
- Gas Price: Fixed at 2000 gwei
- Block Time: 1-2 seconds

### Sepolia (Chain ID: 11155111)
- RPC: Configure in main project
- Gas Price: Dynamic (~0.5 gwei)
- Block Time: ~12 seconds

## Test Timeout

All tests have a 60-second timeout by default to accommodate blockchain operations. This can be adjusted in `jest.config.js`.

## Coverage

Generate test coverage report:
```bash
npm run test:coverage
```

View HTML coverage report:
```bash
npm run report
# Open test-results/test-report.html in browser
```

## CI/CD Integration

For continuous integration:

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        network: [kasplex, igra]
        category: [core, contracts, keywords, control, wallets, data, integration]

    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '18'

    - name: Install dependencies
      run: |
        cd yaml-system-e2e-tests
        npm install

    - name: Run tests
      run: |
        cd yaml-system-e2e-tests
        node run-tests.js ${{ matrix.category }} ${{ matrix.network }}

    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v2
      with:
        name: test-results-${{ matrix.network }}-${{ matrix.category }}
        path: yaml-system-e2e-tests/test-results/
```

## Troubleshooting

### Tests failing with network errors
- Ensure the main network-test-tool is running
- Check network configuration in the main project
- Verify RPC endpoints are accessible

### Timeout errors
- Increase timeout in `jest.config.js`
- Check network latency
- Ensure sufficient gas prices

### Contract compilation errors
- Verify Solidity compiler version
- Check contract syntax
- Ensure all dependencies are available

### Data source errors
- Verify file paths are correct
- Check data file formats
- Ensure database connections are valid

## Writing Tests for New Features

### Required Test Coverage

Every new feature or change MUST include:

1. **Unit Tests**: Test individual functions/modules
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Test complete workflows via CLI
4. **YAML Examples**: Provide example YAML files

### Adding a New Test

1. **Create test file**:
```javascript
// __tests__/my-feature.test.js
describe('My New Feature', () => {
  test('should perform expected behavior', async () => {
    const yamlTest = {
      test: 'My Feature Test',
      network: 'kasplex',
      scenario: [
        // Your test scenario
      ]
    };

    const yamlFile = await testHelpers.createTempYaml(yamlTest);
    const result = await testHelpers.executeYamlTest(yamlFile);

    expect(result.success).toBe(true);
    expect(result.stdout).toContain('expected output');
  });
});
```

2. **Run your test**:
```bash
npm test -- my-feature
```

3. **Verify coverage**:
```bash
npm run test:coverage
```

### Test Checklist

Before submitting changes:
- [ ] All existing tests pass
- [ ] New tests added for your feature
- [ ] Test coverage >= 80%
- [ ] Tests run on both Kasplex and IGRA
- [ ] No hardcoded values
- [ ] Proper cleanup in afterAll

## Contributing

When adding new tests:
1. Follow existing test structure
2. Use descriptive test names
3. Include both positive and negative test cases
4. Clean up resources in afterAll hooks
5. Document any special requirements
6. **MANDATORY**: Include tests for ALL code changes

## License

MIT