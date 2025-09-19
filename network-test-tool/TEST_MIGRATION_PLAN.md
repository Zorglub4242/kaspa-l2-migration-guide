# Test Migration & Validation Plan

## Overview
Migrate all test scripts to a unified `test-scripts/` directory with network-agnostic design and validate each test works 100% on Igra network.

## Phase 1: Migration & Testing (PRIORITY)

### Directory Structure to Create
```
test-scripts/
├── basic/
├── defi/
├── load/
├── contracts/
├── evm/
└── advanced/
```

### Migration Tracking Sheet

#### Basic Tests
| Original Location | New Location | Migrated | Tested on Igra | Status | Notes |
|-------------------|--------------|----------|----------------|--------|-------|
| test-igra-simple.yaml | test-scripts/basic/simple-transfer.yaml | ❌ | ❌ | Pending | Remove `network: igra` |
| test-defi-igra-simple.yaml | test-scripts/basic/funded-transfers.yaml | ❌ | ❌ | Pending | Remove `network: igra`, uses env:PRIVATE_KEY |
| templates/examples/wallet-operations.yaml | test-scripts/basic/wallet-operations.yaml | ❌ | ❌ | Pending | Remove `network: kasplex` |

#### DeFi Tests
| Original Location | New Location | Migrated | Tested on Igra | Status | Notes |
|-------------------|--------------|----------|----------------|--------|-------|
| test-defi-igra.yaml | test-scripts/defi/basic-defi.yaml | ❌ | ❌ | Pending | Remove `network: igra` |
| test-complete-defi-igra.yaml | test-scripts/defi/complete-suite.yaml | ❌ | ❌ | Pending | Remove `network: igra` |
| test-comprehensive-defi-basic-igra.yaml | test-scripts/defi/comprehensive-basic.yaml | ❌ | ❌ | Pending | Remove `network: igra` |
| test-simple-comprehensive-defi-igra.yaml | test-scripts/defi/simple-comprehensive.yaml | ❌ | ❌ | Pending | Remove `network: igra` |
| migrations/defi/defi-complete.yaml | test-scripts/defi/defi-complete.yaml | ❌ | ❌ | Pending | Already network-agnostic |
| migrations/defi/defi-deploy.yaml | test-scripts/defi/defi-deploy.yaml | ❌ | ❌ | Pending | Check network array |
| migrations/defi/defi-enhanced.yaml | test-scripts/defi/defi-enhanced.yaml | ❌ | ❌ | Pending | |
| migrations/defi/nft-test.yaml | test-scripts/defi/nft-operations.yaml | ❌ | ❌ | Pending | |
| migrations/defi/operations-test.yaml | test-scripts/defi/operations.yaml | ❌ | ❌ | Pending | |
| migrations/defi/complete-defi-suite.yaml | test-scripts/defi/suite-complete.yaml | ❌ | ❌ | Pending | |
| migrations/defi/complete-defi-suite-fixed.yaml | test-scripts/defi/suite-fixed.yaml | ❌ | ❌ | Pending | |
| migrations/defi/simple-defi-test.yaml | test-scripts/defi/simple.yaml | ❌ | ❌ | Pending | Remove `network: igra` |
| templates/examples/defi-complete-test.yaml | test-scripts/defi/template-complete.yaml | ❌ | ❌ | Pending | Has `network: [kasplex, igra, sepolia]` |

#### Load Tests
| Original Location | New Location | Migrated | Tested on Igra | Status | Notes |
|-------------------|--------------|----------|----------------|--------|-------|
| migrations/load/load-test-simple.yaml | test-scripts/load/simple.yaml | ❌ | ❌ | Pending | |
| migrations/load/load-test-reliable.yaml | test-scripts/load/reliable.yaml | ❌ | ❌ | Pending | |
| migrations/load/load-test-stress.yaml | test-scripts/load/stress.yaml | ❌ | ❌ | Pending | |
| migrations/load/load-test-burst.yaml | test-scripts/load/burst.yaml | ❌ | ❌ | Pending | |
| migrations/load/load-test-max-tps.yaml | test-scripts/load/max-tps.yaml | ❌ | ❌ | Pending | |
| migrations/load/load-test-defi-suite.yaml | test-scripts/load/defi-suite.yaml | ❌ | ❌ | Pending | |
| migrations/load/load-test-defi-dex.yaml | test-scripts/load/defi-dex.yaml | ❌ | ❌ | Pending | |
| migrations/load/load-test-defi-tokens.yaml | test-scripts/load/defi-tokens.yaml | ❌ | ❌ | Pending | |
| migrations/load/load-test-diagnostic.yaml | test-scripts/load/diagnostic.yaml | ❌ | ❌ | Pending | |
| migrations/load/load-test-compare.yaml | test-scripts/load/compare.yaml | ❌ | ❌ | Pending | |
| migrations/load/simple-load-test.yaml | test-scripts/load/simple-alt.yaml | ❌ | ❌ | Pending | |
| templates/examples/load-test-simple.yaml | test-scripts/load/template-simple.yaml | ❌ | ❌ | Pending | |

#### Contract Tests
| Original Location | New Location | Migrated | Tested on Igra | Status | Notes |
|-------------------|--------------|----------|----------------|--------|-------|
| test-contract-deployment.yaml | test-scripts/contracts/deployment.yaml | ❌ | ❌ | Pending | Created during testing |
| templates/examples/custom-contract-test.yaml | test-scripts/contracts/custom.yaml | ❌ | ❌ | Pending | |
| templates/examples/solidity-contract-test.yaml | test-scripts/contracts/solidity.yaml | ❌ | ❌ | Pending | |
| templates/examples/bring-your-own-sol.yaml | test-scripts/contracts/bring-your-own.yaml | ❌ | ❌ | Pending | |
| templates/examples/test-simplevault.yaml | test-scripts/contracts/simplevault.yaml | ❌ | ❌ | Pending | |
| templates/examples/user-contract-simple.yaml | test-scripts/contracts/user-simple.yaml | ❌ | ❌ | Pending | |

#### Advanced Tests
| Original Location | New Location | Migrated | Tested on Igra | Status | Notes |
|-------------------|--------------|----------|----------------|--------|-------|
| templates/examples/data-driven-testing.yaml | test-scripts/advanced/data-driven.yaml | ❌ | ❌ | Pending | |
| templates/examples/conditional-flow.yaml | test-scripts/advanced/conditional-flow.yaml | ❌ | ❌ | Pending | |
| templates/examples/parallel-execution.yaml | test-scripts/advanced/parallel-execution.yaml | ❌ | ❌ | Pending | |
| templates/examples/finality-measurement.yaml | test-scripts/advanced/finality.yaml | ❌ | ❌ | Pending | |
| templates/examples/pandora-batch-operations.yaml | test-scripts/advanced/pandora-batch.yaml | ❌ | ❌ | Pending | |
| templates/examples/pandora-complete-suite.yaml | test-scripts/advanced/pandora-suite.yaml | ❌ | ❌ | Pending | |
| templates/examples/keyword-usage.yaml | test-scripts/advanced/keyword-usage.yaml | ❌ | ❌ | Pending | |

### Migration Rules
1. **Remove ALL hardcoded networks** - Delete any `network:` field with specific network
2. **Keep network arrays for examples** - `network: [kasplex, igra, sepolia]` can stay as documentation
3. **Use env:PRIVATE_KEY** - For funded deployer accounts
4. **No network-specific logic** - All tests must work on any network

### Testing Process for Each File
```bash
# 1. Move file to new location
mv <old-file> test-scripts/<category>/<new-name>

# 2. Edit to remove network hardcoding
# Remove: network: igra
# Keep: network: [array] (for documentation)

# 3. Test on Igra
node cli.js yaml test-scripts/<category>/<test> -n igra -v

# 4. Fix any issues:
#    - Gas price errors -> Use dynamic config
#    - Funding errors -> Use env:PRIVATE_KEY
#    - Timeout errors -> Adjust timeouts
#    - Contract errors -> Fix references

# 5. Re-test until passes
# 6. Mark as complete in tracking sheet
```

### Common Fixes Required

#### Gas Price Issues
```yaml
# BAD - Hardcoded
gasPrice: 2000 gwei

# GOOD - Dynamic (removed, uses network config)
# (no gasPrice field)
```

#### Account Funding
```yaml
# BAD - Assumes funding
accounts:
  alice: 10 ETH

# GOOD - Uses funded account
accounts:
  deployer:
    privateKey: env:PRIVATE_KEY
  alice: 0.1 ETH  # Will be funded by deployer
```

#### Network References
```yaml
# BAD
network: igra

# GOOD - Removed entirely
# (no network field)

# ALSO GOOD - Array for multi-network
network: [kasplex, igra, sepolia]
```

## Phase 2: Interactive CLI Development

### CLI Features (After Migration Complete)
1. **Test Discovery**
   - Scan test-scripts/ directory
   - Build catalog of available tests
   - Extract metadata from YAML files

2. **Interactive Selection**
   ```
   Select test categories:
   ❯◉ Basic
    ◯ DeFi
    ◯ Load Testing
    ◯ Contracts
    ◯ Advanced

   Select specific tests:
   ❯◉ simple-transfer.yaml
    ◉ funded-transfers.yaml
    ◯ wallet-operations.yaml

   Select networks:
   ❯◉ igra (Igra L2)
    ◯ kasplex (Kasplex L2)
    ◯ sepolia (Ethereum Sepolia)
   ```

3. **Dynamic Network Loading**
   - Read from config/networks/*.json
   - No hardcoded network lists
   - Easy to add new networks

### Implementation Files
- `cli-test-interactive.js` - Interactive test runner
- `lib/test-catalog.js` - Test discovery and metadata
- `lib/test-validator.js` - Validation and reporting

## Phase 3: Cleanup (After 100% Tests Pass)

### Files/Directories to Delete
- [ ] All *.yaml files in root directory
- [ ] templates/ directory entirely
- [ ] migrations/ directory entirely
- [ ] Network-specific test files

### Documentation Updates
- [ ] Update CLAUDE.md with new test structure
- [ ] Create test-scripts/README.md with catalog
- [ ] Update package.json scripts

## Success Metrics
- Total Tests Migrated: 0/41
- Tests Passing on Igra: 0/41
- Success Rate: 0%

## Current Status
🔴 **Phase 1: Migration & Testing** - Not Started
⚫ Phase 2: CLI Development - Pending
⚫ Phase 3: Cleanup - Pending

## Next Steps
1. Create test-scripts/ directory structure
2. Start migrating basic/ category tests
3. Test each on Igra and fix issues
4. Update tracking sheet after each test
5. Continue until 100% pass rate