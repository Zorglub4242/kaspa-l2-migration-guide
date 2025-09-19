# 🚀 YAML Advanced Features Guide

## Table of Contents
1. [Overview](#overview)
2. [Template Variable System](#template-variable-system)
3. [Expression Evaluation](#expression-evaluation)
4. [Built-in Functions](#built-in-functions)
5. [Control Flow Structures](#control-flow-structures)
6. [Parallel Execution](#parallel-execution)
7. [Error Handling](#error-handling)
8. [Performance Tracking](#performance-tracking)
9. [Data-Driven Testing](#data-driven-testing)
10. [Real-World Examples](#real-world-examples)

## Overview

The Network Test Tool's YAML testing framework provides powerful features for creating comprehensive blockchain tests. This guide covers advanced capabilities that enable complex test scenarios, dynamic behavior, and sophisticated validation.

## Template Variable System

### Flexible Syntax Support

The tool supports both single and double brace syntax for template variables:

```yaml
variables:
  baseAmount: "1000000000000000000"  # 1 ETH in wei

scenario:
  # Both syntaxes work identically
  - transfer: "alice -> bob, {{baseAmount}}"    # Double braces
  - transfer: "bob -> charlie, {baseAmount}"     # Single braces
```

### Variable Resolution Order

Variables are resolved in a specific order:

1. **Dynamic variables** - Set during test execution with `set` actions
2. **Local variables** - Defined in the `variables` section
3. **Setup variables** - Account and contract references
4. **Built-in functions** - balance(), timestamp(), etc.
5. **Expression evaluation** - Mathematical and logical expressions

```yaml
variables:
  staticVar: "100"

scenario:
  - set:
      dynamicVar: "200"  # Takes precedence over staticVar if same name

  - log: "Value: {{dynamicVar}}"  # Uses dynamic value: 200
```

### Nested Variable Resolution

Variables can reference other variables:

```yaml
variables:
  base: "1000000000000000000"
  half: "{{base}} / 2"
  double: "{{half}} * 4"
  complex: "{{base}} + {{half}} - {{double}}"

scenario:
  - log: "Complex calculation: {{complex}}"
```

## Expression Evaluation

### Mathematical Expressions

The system automatically evaluates mathematical expressions:

```yaml
variables:
  wei: "1000000000000000000"

scenario:
  - transfer: "alice -> bob, wei / 2"           # Sends 0.5 ETH
  - transfer: "bob -> charlie, wei * 0.1"       # Sends 0.1 ETH
  - transfer: "charlie -> dave, wei + wei / 4"  # Sends 1.25 ETH
```

### Supported Operators

- **Arithmetic**: `+`, `-`, `*`, `/`, `%`, `**` (exponentiation)
- **Comparison**: `>`, `<`, `>=`, `<=`, `==`, `!=`
- **Logical**: `&&`, `||`, `!`
- **Bitwise**: `&`, `|`, `^`, `<<`, `>>`

### Expression Context

Expressions have access to all variables and functions:

```yaml
scenario:
  - if:
      condition: "balance(alice) > 1000000000000000000 && counter < 10"
      then:
        - transfer: "alice -> bob, balance(alice) * 0.1"
```

## Built-in Functions

### balance(account)

Get the current balance of any account:

```yaml
scenario:
  - set:
      aliceInitial: "balance(alice)"
      bobInitial: "balance(bob)"

  - transfer: "alice -> bob, 1000000000000000000"

  - assert:
      expect: "balance(alice) == aliceInitial - 1000000000000000000"
      message: "Alice balance should decrease by 1 ETH"

  - assert:
      expect: "balance(bob) == bobInitial + 1000000000000000000"
      message: "Bob balance should increase by 1 ETH"
```

### timestamp() (Coming Soon)

Get current Unix timestamp in seconds:

```yaml
scenario:
  - set:
      startTime: "timestamp()"

  - transfer: "alice -> bob, 1 ETH"

  - set:
      endTime: "timestamp()"
      duration: "endTime - startTime"

  - log: "Transaction took {{duration}} seconds"
```

### random(min, max) (Coming Soon)

Generate random numbers for testing:

```yaml
scenario:
  - set:
      randomAmount: "random(100000000000000000, 1000000000000000000)"

  - transfer: "alice -> bob, {{randomAmount}}"
```

### Account() (In Development)

Create new funded accounts dynamically:

```yaml
setup:
  accounts:
    alice: "Account()"      # Creates new account with default funding
    bob: "Account(10 ETH)"  # Creates account with specific funding
```

## Control Flow Structures

### Conditional Execution (if/then/else)

#### Basic Conditional

```yaml
scenario:
  - if:
      condition: "balance(alice) > 5000000000000000000"
      then:
        - transfer: "alice -> bob, 1 ETH"
      else:
        - log: "Insufficient balance"
```

#### Nested Conditionals

```yaml
scenario:
  - if:
      condition: "network == 'kasplex'"
      then:
        - if:
            condition: "balance(alice) > 10 ETH"
            then:
              - transfer: "alice -> bob, 5 ETH"
            else:
              - transfer: "alice -> bob, 1 ETH"
      else:
        - log: "Not on Kasplex network"
```

### Loops (while)

```yaml
scenario:
  - set:
      totalSent: 0
      maxToSend: "10000000000000000000"  # 10 ETH

  - while:
      condition: "totalSent < maxToSend && balance(alice) > 1000000000000000000"
      actions:
        - transfer: "alice -> bob, 1000000000000000000"
        - set:
            totalSent: "totalSent + 1000000000000000000"
        - log: "Sent {{totalSent}} wei total"
```

### Foreach Iteration

#### Array Iteration

```yaml
variables:
  recipients:
    - "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7"
    - "0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed"
    - "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"

scenario:
  - foreach:
      items: "recipients"
      as: "recipient"
      actions:
        - transfer: "alice -> {{recipient}}, 100000000000000000"
        - log: "Sent 0.1 ETH to {{recipient}}"
```

#### Data-Driven Iteration

```yaml
data:
  transactions:
    - { from: "alice", to: "bob", amount: "1 ETH" }
    - { from: "bob", to: "charlie", amount: "0.5 ETH" }
    - { from: "charlie", to: "dave", amount: "0.25 ETH" }

scenario:
  - foreach:
      items: "transactions"
      as: "tx"
      actions:
        - transfer: "{{tx.from}} -> {{tx.to}}, {{tx.amount}}"
```

## Parallel Execution

### Basic Parallel Operations

```yaml
scenario:
  - log: "Starting parallel transfers"

  - parallel:
      - transfer: "alice -> bob, 1 ETH"
      - transfer: "alice -> charlie, 1 ETH"
      - transfer: "alice -> dave, 1 ETH"

  - log: "All parallel transfers completed"
```

### Parallel with Different Operations

```yaml
scenario:
  - parallel:
      - transfer: "alice -> bob, 1 ETH"
      - call:
          contract: "token"
          method: "mint"
          args: ["charlie", "1000000000000000000000"]
      - deploy:
          type: "MockERC20"
          args: ["Test", "TST", 18]
          returns: "newToken"
```

## Error Handling

### Try/Catch/Finally

```yaml
scenario:
  - try:
      actions:
        - transfer: "alice -> bob, 1000 ETH"  # May fail if insufficient balance
        - log: "Transfer successful"
    catch:
      - log: "Transfer failed: {{error}}"
      - set:
          transferSuccess: false
    finally:
      - log: "Transfer attempt completed"
      - assert:
          expect: "balance(alice) >= 0"
          message: "Alice balance should not be negative"
```

### Nested Error Handling

```yaml
scenario:
  - try:
      actions:
        - deploy:
            type: "ComplexContract"
            returns: "contract1"
        - try:
            actions:
              - call:
                  contract: "contract1"
                  method: "riskyOperation"
          catch:
            - log: "Risky operation failed, using fallback"
            - call:
                contract: "contract1"
                method: "safeOperation"
    catch:
      - log: "Deployment failed: {{error}}"
      - set:
          deploymentSuccess: false
```

## Performance Tracking

### Measure Blocks

```yaml
scenario:
  - measure:
      name: "DeFi Operations Performance"
      actions:
        - call:
            contract: "dex"
            method: "swap"
            args: ["token1", "token2", "1000000000000000000"]

        - call:
            contract: "lending"
            method: "deposit"
            args: ["1000000000000000000"]

        - call:
            contract: "yield"
            method: "stake"
            args: ["500000000000000000"]

      metrics:
        - duration
        - gasUsed
        - cost
        - throughput
```

### Custom Metrics

```yaml
scenario:
  - set:
      startBalance: "balance(alice)"
      startTime: "timestamp()"

  - measure:
      name: "Transaction Batch"
      actions:
        # ... multiple transactions
      customMetrics:
        balanceChange: "startBalance - balance(alice)"
        avgTxTime: "(timestamp() - startTime) / transactionCount"
```

## Data-Driven Testing

### CSV Data Source

```yaml
# Load data from CSV file
data:
  source: "test-data.csv"
  columns: ["sender", "recipient", "amount", "token"]

scenario:
  - foreach:
      items: "data"
      as: "row"
      actions:
        - if:
            condition: "row.token == 'ETH'"
            then:
              - transfer: "{{row.sender}} -> {{row.recipient}}, {{row.amount}}"
            else:
              - call:
                  contract: "{{row.token}}"
                  method: "transfer"
                  from: "{{row.sender}}"
                  args: ["{{row.recipient}}", "{{row.amount}}"]
```

### Inline Data

```yaml
data:
  testCases:
    - { amount: "100", expected: "success" }
    - { amount: "0", expected: "failure" }
    - { amount: "-100", expected: "failure" }
    - { amount: "999999999999999999999", expected: "failure" }

scenario:
  - foreach:
      items: "testCases"
      as: "test"
      actions:
        - try:
            actions:
              - transfer: "alice -> bob, {{test.amount}}"
              - set:
                  result: "success"
          catch:
            - set:
                result: "failure"

        - assert:
            expect: "result == test.expected"
            message: "Test case {{test.amount}} should {{test.expected}}"
```

## Real-World Examples

### Complete DeFi Protocol Test

```yaml
name: "DeFi Protocol Integration Test"
description: "Comprehensive test of DeFi protocol interactions"
network: ["kasplex", "igra"]

variables:
  baseAmount: "1000000000000000000"  # 1 ETH
  slippageTolerance: "0.03"           # 3%

setup:
  accounts:
    alice:
      type: "wallet"
      fund: "100 ETH"
    bob:
      type: "wallet"
      fund: "50 ETH"

  contracts:
    token1:
      type: "MockERC20"
      args: ["Token A", "TKA", 18]
    token2:
      type: "MockERC20"
      args: ["Token B", "TKB", 18]
    dex:
      type: "SimpleDEX"
      args: []

scenario:
  # Setup liquidity
  - measure:
      name: "Liquidity Setup"
      actions:
        - call:
            contract: "token1"
            method: "mint"
            args: ["alice", "10000000000000000000000"]  # 10000 tokens

        - call:
            contract: "token2"
            method: "mint"
            args: ["alice", "10000000000000000000000"]

        - call:
            contract: "token1"
            method: "approve"
            from: "alice"
            args: ["{{dex}}", "5000000000000000000000"]

        - call:
            contract: "token2"
            method: "approve"
            from: "alice"
            args: ["{{dex}}", "5000000000000000000000"]

        - call:
            contract: "dex"
            method: "addLiquidity"
            from: "alice"
            args: ["{{token1}}", "{{token2}}", "5000000000000000000000", "5000000000000000000000"]

  # Test swaps with slippage protection
  - set:
      token1BalanceBefore: "balance(bob, token1)"
      token2BalanceBefore: "balance(bob, token2)"

  - call:
      contract: "dex"
      method: "getPrice"
      args: ["{{token1}}", "{{token2}}", "1000000000000000000000"]
      returns: "expectedOutput"

  - set:
      minOutput: "expectedOutput * (1 - slippageTolerance)"

  - call:
      contract: "dex"
      method: "swap"
      from: "bob"
      args: ["{{token1}}", "{{token2}}", "1000000000000000000000", "{{minOutput}}"]
      returns: "actualOutput"

  - assert:
      expect: "actualOutput >= minOutput"
      message: "Swap output should meet minimum requirement"

  # Verify balances
  - assert:
      expect: "balance(bob, token2) == token2BalanceBefore + actualOutput"
      message: "Bob should receive correct token2 amount"

cleanup:
  - log: "DeFi test completed successfully"
```

### Stress Test with Dynamic Scaling

```yaml
name: "Dynamic Stress Test"
description: "Scales transaction load based on network performance"

variables:
  targetTPS: 100
  duration: 60  # seconds
  adjustmentFactor: 1.2

scenario:
  - set:
      currentTPS: 10
      successRate: 1.0
      startTime: "timestamp()"

  - while:
      condition: "timestamp() - startTime < duration"
      actions:
        - measure:
            name: "TPS Batch {{currentTPS}}"
            actions:
              - parallel:
                  # Dynamically generate parallel transactions based on currentTPS
                  - foreach:
                      items: "range(0, currentTPS)"
                      as: "i"
                      actions:
                        - transfer: "alice -> bob, 1000000000000"  # Small amount
            metrics:
              - successRate
              - avgLatency

        # Adjust TPS based on success rate
        - if:
            condition: "successRate > 0.95 && currentTPS < targetTPS"
            then:
              - set:
                  currentTPS: "min(currentTPS * adjustmentFactor, targetTPS)"
              - log: "Increasing TPS to {{currentTPS}}"
            else:
              - if:
                  condition: "successRate < 0.90"
                  then:
                    - set:
                        currentTPS: "max(currentTPS / adjustmentFactor, 1)"
                    - log: "Decreasing TPS to {{currentTPS}}"

        - wait: "1s"

  - log: "Stress test completed. Final TPS: {{currentTPS}}, Success Rate: {{successRate}}"
```

## Best Practices

1. **Use Variables Extensively**: Avoid hardcoding values
2. **Add Meaningful Assertions**: Verify state changes after operations
3. **Handle Errors Gracefully**: Use try/catch for potentially failing operations
4. **Measure Performance**: Track metrics for important operations
5. **Document Complex Logic**: Add comments to explain non-obvious behavior
6. **Test Edge Cases**: Include boundary conditions and error scenarios
7. **Leverage Parallel Execution**: Speed up tests with concurrent operations
8. **Use Data-Driven Approaches**: Test multiple scenarios efficiently

## Troubleshooting

### Common Issues and Solutions

#### Variable Not Resolved
```yaml
# Problem: {{myVar}} appears literally in output
# Solution: Ensure variable is defined before use
variables:
  myVar: "value"  # Define first
scenario:
  - log: "{{myVar}}"  # Then use
```

#### Expression Not Evaluated
```yaml
# Problem: "1 + 1" appears as string instead of 2
# Solution: Ensure it's recognized as expression
scenario:
  - set:
      result: "1 + 1"  # Will evaluate to 2
  # Avoid natural language that looks like math
  - log: "The sum is {{result}}"  # Not "One plus one equals {{result}}"
```

#### Parallel Operations Failing
```yaml
# Problem: Parallel transfers fail due to nonce conflicts
# Solution: Use different sender accounts
parallel:
  - transfer: "alice -> bob, 1 ETH"
  - transfer: "charlie -> dave, 1 ETH"  # Different sender
```

## Performance Tips

1. **Batch Operations**: Use parallel execution for independent operations
2. **Reuse Connections**: The tool maintains persistent connections
3. **Optimize Gas**: Use appropriate gas limits based on operation complexity
4. **Cache Results**: Store frequently used values in variables
5. **Minimize Network Calls**: Batch reads where possible

## Conclusion

The advanced YAML features in the Network Test Tool provide a powerful, flexible framework for comprehensive blockchain testing. By leveraging these capabilities, you can create sophisticated test scenarios that thoroughly validate your blockchain applications across multiple networks.

For questions or contributions, please refer to the main repository documentation.