# Test Development Guide

## 🚨 IMPORTANT: Every Change Requires a Test

**ALL changes to the codebase MUST include corresponding test cases.** This is mandatory for maintaining code quality and preventing regressions.

## Table of Contents
1. [Test Requirements](#test-requirements)
2. [Types of Tests](#types-of-tests)
3. [How to Write Tests](#how-to-write-tests)
4. [Test Examples](#test-examples)
5. [Running Tests](#running-tests)
6. [CI/CD Integration](#cicd-integration)

## Test Requirements

### When to Write Tests
- ✅ **New Features**: Every new feature needs comprehensive test coverage
- ✅ **Bug Fixes**: Include a test that reproduces the bug and verifies the fix
- ✅ **Refactoring**: Ensure existing tests pass and add new ones if behavior changes
- ✅ **Configuration Changes**: Test that new configurations work correctly
- ✅ **YAML Templates**: Every new YAML template needs an E2E test

### Test Coverage Standards
- Minimum 80% code coverage for new code
- Critical paths must have 100% coverage
- All public APIs must be tested
- Edge cases and error conditions must be covered

## Types of Tests

### 1. Unit Tests (JavaScript)
For testing individual functions and modules.

**Location**: `__tests__/unit/`

**Example**:
```javascript
// __tests__/unit/yaml-parser.test.js
describe('YAML Parser', () => {
  test('should parse valid YAML', () => {
    const yaml = 'test: Example\nnetwork: kasplex';
    const result = parser.parse(yaml);
    expect(result.test).toBe('Example');
  });
});
```

### 2. Integration Tests (JavaScript)
For testing component interactions.

**Location**: `__tests__/integration/`

**Example**:
```javascript
// __tests__/integration/contract-deployment.test.js
describe('Contract Deployment', () => {
  test('should deploy and interact with contract', async () => {
    const result = await deployContract('ERC20', ['Token', 'TKN', 1000]);
    expect(result.address).toBeDefined();

    const balance = await contract.balanceOf(deployer);
    expect(balance).toBe(1000);
  });
});
```

### 3. E2E Tests (Jest)
For testing complete workflows through CLI.

**Location**: `yaml-system-e2e-tests/__tests__/`

**Example**:
```javascript
// yaml-system-e2e-tests/__tests__/new-feature.test.js
describe('New Feature E2E Tests', () => {
  test('should execute new feature via CLI', async () => {
    const yamlTest = {
      test: 'New Feature Test',
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

### 4. YAML Test Cases
For testing blockchain functionality.

**Location**: `templates/tests/` or `migrations/tests/`

**Example**:
```yaml
# templates/tests/new-feature-test.yaml
test: New Feature Test
network: kasplex
description: Tests the new feature functionality

setup:
  alice: 10 ETH

scenario:
  - log: "Testing new feature"
  # Your test steps
  - assert: "condition == expected"

cleanup:
  - log: "Test completed"
```

## How to Write Tests

### Step 1: Identify What to Test

For a new feature or change, identify:
1. **Happy Path**: Normal, expected usage
2. **Edge Cases**: Boundary conditions, limits
3. **Error Cases**: Invalid inputs, failures
4. **Integration Points**: How it interacts with other components

### Step 2: Choose Test Type

| Change Type | Required Tests |
|------------|---------------|
| New YAML action | E2E test + Unit test for executor |
| New CLI command | E2E test + Integration test |
| Bug fix | E2E test reproducing bug + Unit test |
| New contract | YAML test + Integration test |
| Performance improvement | Load test + Benchmark |
| Configuration change | E2E test with new config |

### Step 3: Write the Test

#### For JavaScript Code Changes:

1. **Create test file**:
```bash
# For unit tests
touch __tests__/unit/my-feature.test.js

# For E2E tests
touch yaml-system-e2e-tests/__tests__/my-feature.test.js
```

2. **Write test structure**:
```javascript
const { MyFeature } = require('../lib/my-feature');

describe('MyFeature', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  test('should do expected behavior', () => {
    const result = MyFeature.doSomething();
    expect(result).toBe(expected);
  });

  test('should handle errors', () => {
    expect(() => {
      MyFeature.doInvalid();
    }).toThrow('Expected error');
  });
});
```

#### For YAML Features:

1. **Create YAML test**:
```yaml
# templates/tests/my-feature-test.yaml
test: My Feature Test
network: kasplex

scenario:
  # Setup
  - log: "Setting up test"

  # Execute feature
  - myNewAction:
      param1: value1
      param2: value2
    returns: result

  # Verify
  - assert: result == expected
  - assert: exists(result.property)
```

2. **Add E2E test**:
```javascript
// yaml-system-e2e-tests/__tests__/my-feature.test.js
test('should execute my new YAML feature', async () => {
  const yamlPath = 'templates/tests/my-feature-test.yaml';
  const result = await testHelpers.executeYamlTest(yamlPath);

  expect(result.success).toBe(true);
  expect(result.stdout).toContain('expected output');
});
```

### Step 4: Verify Test Coverage

```bash
# Run tests with coverage
npm test -- --coverage

# Check coverage report
open coverage/lcov-report/index.html
```

## Test Examples

### Example 1: Testing a New YAML Action

**Feature**: Add a new `calculate` action for YAML tests

**Implementation**: `lib/actions/calculate-action.js`
```javascript
class CalculateAction {
  async execute(params, context) {
    const { operation, a, b } = params;

    switch(operation) {
      case 'add': return a + b;
      case 'multiply': return a * b;
      default: throw new Error(`Unknown operation: ${operation}`);
    }
  }
}
```

**Required Tests**:

1. **Unit Test** (`__tests__/unit/calculate-action.test.js`):
```javascript
describe('CalculateAction', () => {
  test('should add numbers', async () => {
    const action = new CalculateAction();
    const result = await action.execute({
      operation: 'add',
      a: 5,
      b: 3
    });
    expect(result).toBe(8);
  });

  test('should multiply numbers', async () => {
    const action = new CalculateAction();
    const result = await action.execute({
      operation: 'multiply',
      a: 4,
      b: 7
    });
    expect(result).toBe(28);
  });

  test('should throw on unknown operation', async () => {
    const action = new CalculateAction();
    await expect(action.execute({
      operation: 'divide',
      a: 10,
      b: 2
    })).rejects.toThrow('Unknown operation: divide');
  });
});
```

2. **YAML Test** (`templates/tests/calculate-test.yaml`):
```yaml
test: Calculate Action Test
network: kasplex

scenario:
  - calculate:
      operation: add
      a: 10
      b: 20
    returns: sum

  - assert: sum == 30

  - calculate:
      operation: multiply
      a: 5
      b: 6
    returns: product

  - assert: product == 30
```

3. **E2E Test** (`yaml-system-e2e-tests/__tests__/calculate.test.js`):
```javascript
test('should execute calculate action in YAML', async () => {
  const yamlTest = {
    test: 'Calculate E2E Test',
    network: 'kasplex',
    scenario: [
      {
        calculate: {
          operation: 'add',
          a: 15,
          b: 25
        },
        returns: 'result'
      },
      { assert: 'result == 40' }
    ]
  };

  const yamlFile = await testHelpers.createTempYaml(yamlTest);
  const result = await testHelpers.executeYamlTest(yamlFile);

  expect(result.success).toBe(true);
});
```

### Example 2: Testing a Bug Fix

**Bug**: Wallet creation fails with mnemonic containing apostrophes

**Fix**: Escape apostrophes in mnemonic processing

**Required Test**:
```javascript
// __tests__/unit/wallet-creation.test.js
test('should handle mnemonic with apostrophes', () => {
  const mnemonic = "don't can't won't shouldn't";
  const wallet = createWallet({ mnemonic });

  expect(wallet).toBeDefined();
  expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
});

// yaml-system-e2e-tests/__tests__/wallet-bug-fix.test.js
test('should create wallet from mnemonic with special characters', async () => {
  const yamlTest = {
    test: 'Wallet Special Characters Test',
    network: 'kasplex',
    wallets: {
      test: {
        mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
      }
    },
    scenario: [
      { assert: 'exists(wallets.test.address)' }
    ]
  };

  const yamlFile = await testHelpers.createTempYaml(yamlTest);
  const result = await testHelpers.executeYamlTest(yamlFile);

  expect(result.success).toBe(true);
});
```

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run specific test file
npm test -- __tests__/unit/my-feature.test.js

# Run E2E tests
cd yaml-system-e2e-tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode (reruns on file changes)
npm test -- --watch

# Run specific test suite
npm test -- --testNamePattern="MyFeature"
```

### Test Specific Networks

```bash
# Test on Kasplex
NETWORK=kasplex npm test

# Test on IGRA
NETWORK=igra npm test

# Test on multiple networks
npm run test:all-networks
```

### Debug Tests

```bash
# Run with verbose output
npm test -- --verbose

# Debug specific test
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

## CI/CD Integration

### GitHub Actions Configuration

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        network: [kasplex, igra]
        test-suite: [unit, integration, e2e]

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run ${{ matrix.test-suite }} tests
      env:
        NETWORK: ${{ matrix.network }}
      run: |
        if [ "${{ matrix.test-suite }}" = "e2e" ]; then
          cd yaml-system-e2e-tests
          npm ci
          npm test
        else
          npm run test:${{ matrix.test-suite }}
        fi

    - name: Upload coverage
      if: matrix.test-suite == 'unit'
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

    - name: Check coverage threshold
      if: matrix.test-suite == 'unit'
      run: |
        coverage=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
        if (( $(echo "$coverage < 80" | bc -l) )); then
          echo "Coverage is below 80%: $coverage%"
          exit 1
        fi
```

### Pre-commit Hook

Install pre-commit hook to ensure tests pass before committing:

```bash
# Install husky
npm install --save-dev husky

# Initialize husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm test"
```

### Test Checklist for PRs

Before submitting a PR, ensure:

- [ ] All existing tests pass
- [ ] New tests added for your changes
- [ ] Test coverage >= 80% for new code
- [ ] E2E tests for user-facing features
- [ ] Tests run on all target networks
- [ ] No console.log statements in tests
- [ ] Tests are deterministic (no random failures)
- [ ] Test names clearly describe what they test

## Best Practices

### DO:
- ✅ Write tests BEFORE implementing features (TDD)
- ✅ Keep tests focused and atomic
- ✅ Use descriptive test names
- ✅ Clean up resources in afterEach/afterAll
- ✅ Test both success and failure cases
- ✅ Use test data generators for complex scenarios
- ✅ Mock external dependencies
- ✅ Test edge cases and boundaries

### DON'T:
- ❌ Write tests that depend on test order
- ❌ Use real network calls in unit tests
- ❌ Hardcode values that might change
- ❌ Leave commented-out test code
- ❌ Write tests that take > 60 seconds
- ❌ Test implementation details
- ❌ Ignore flaky tests

## Getting Help

- Review existing tests for examples
- Check `yaml-system-e2e-tests/README.md` for E2E test details
- Run `npm test -- --help` for Jest options
- Ask in development chat for test review

## Quick Reference

```bash
# Create new test file
touch __tests__/unit/my-feature.test.js

# Run specific test
npm test -- my-feature

# Update snapshots
npm test -- -u

# Coverage report
npm test -- --coverage --coverageReporters=html
open coverage/index.html

# Debug test
node --inspect-brk ./node_modules/.bin/jest my-feature --runInBand

# Watch mode
npm test -- --watch my-feature
```

---

**Remember**: No code without tests! Every PR must include tests or it will be rejected.