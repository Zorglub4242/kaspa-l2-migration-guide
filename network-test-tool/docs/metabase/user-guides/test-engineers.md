# Metabase Guide for Test Engineers
## Debugging and Performance Analysis with Blockchain Analytics

### 🎯 Your Role & Goals

As a test engineer, you need to:
- **Debug failed tests** quickly and efficiently
- **Monitor performance regressions** across blockchain networks
- **Identify optimization opportunities** for gas usage and execution time
- **Track test coverage** and reliability metrics

---

## 🔍 Essential Dashboards for Test Engineers

### 1. Test Failure Analysis Dashboard

#### **Quick Failure Investigation**
```sql
-- Find recent test failures
SELECT
    network_name,
    test_name,
    start_time,
    error_message,
    gas_used,
    transaction_hash
FROM test_results
WHERE success = 0
    AND start_time >= datetime('now', '-24 hours')
ORDER BY start_time DESC;
```

**Use this to:**
- Identify patterns in recent failures
- Get transaction hashes for blockchain explorer investigation
- Compare gas usage of failed vs successful tests

#### **Error Pattern Recognition**
```sql
-- Group similar errors for pattern analysis
SELECT
    error_message,
    COUNT(*) as occurrence_count,
    GROUP_CONCAT(DISTINCT network_name) as affected_networks,
    GROUP_CONCAT(DISTINCT test_name) as affected_tests
FROM test_results
WHERE success = 0
    AND start_time >= date('now', '-7 days')
GROUP BY error_message
ORDER BY occurrence_count DESC;
```

**Use this to:**
- Spot systematic issues across networks
- Prioritize bug fixes by impact
- Identify network-specific vs universal problems

### 2. Performance Regression Detection

#### **Gas Usage Trends**
```sql
-- Track gas usage over time for regression detection
SELECT
    DATE(start_time) as test_date,
    network_name,
    test_name,
    AVG(gas_used) as daily_avg_gas,
    COUNT(*) as daily_test_count
FROM test_results
WHERE success = 1
    AND start_time >= date('now', '-30 days')
GROUP BY DATE(start_time), network_name, test_name
ORDER BY test_date DESC, network_name, test_name;
```

**Use this to:**
- Detect gas usage increases over time
- Compare performance across networks
- Validate optimization changes

#### **Execution Time Analysis**
```sql
-- Monitor test execution performance
SELECT
    network_name,
    test_type,
    AVG(duration) as avg_duration_ms,
    MIN(duration) as fastest_ms,
    MAX(duration) as slowest_ms,
    COUNT(*) as sample_size
FROM test_results
WHERE success = 1
    AND start_time >= date('now', '-7 days')
GROUP BY network_name, test_type
ORDER BY avg_duration_ms DESC;
```

**Use this to:**
- Identify slow-performing networks or test types
- Set performance baselines and alerts
- Optimize test execution strategies

### 3. EVM Compatibility Deep Dive

#### **Precompile Performance Analysis**
```sql
-- Analyze specific precompile performance
SELECT
    network_name,
    test_name as precompile,
    COUNT(*) as test_runs,
    ROUND(AVG(gas_used), 0) as avg_gas,
    ROUND(AVG(duration), 2) as avg_duration_ms,
    MIN(gas_used) as min_gas,
    MAX(gas_used) as max_gas
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND test_name IN ('ecrecover', 'sha256', 'ripemd160', 'modexp', 'identity')
    AND success = 1
GROUP BY network_name, test_name
ORDER BY network_name, avg_gas;
```

**Use this to:**
- Compare precompile efficiency across networks
- Identify gas optimization opportunities
- Validate EVM compatibility implementations

#### **CREATE2 Factory Testing**
```sql
-- Analyze CREATE2 deployment patterns
SELECT
    network_name,
    COUNT(*) as total_deployments,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_deployments,
    ROUND(AVG(gas_used), 0) as avg_deployment_gas,
    COUNT(DISTINCT transaction_hash) as unique_transactions
FROM test_results
WHERE test_name LIKE '%CREATE2%'
GROUP BY network_name
ORDER BY successful_deployments DESC;
```

**Use this to:**
- Validate deterministic deployment functionality
- Compare CREATE2 costs across networks
- Debug deployment failures

### 4. DeFi Protocol Testing

#### **Protocol Success Matrix**
```sql
-- Monitor DeFi protocol reliability
SELECT
    network_name,
    CASE
        WHEN test_name LIKE '%ERC20%' THEN 'Token Operations'
        WHEN test_name LIKE '%DEX%' THEN 'DEX Trading'
        WHEN test_name LIKE '%Lending%' THEN 'Lending/Borrowing'
        WHEN test_name LIKE '%NFT%' THEN 'NFT Operations'
        WHEN test_name LIKE '%MultiSig%' THEN 'MultiSig'
        ELSE 'Other'
    END as protocol_category,
    COUNT(*) as total_tests,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as passed_tests,
    ROUND((SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as success_rate
FROM test_results
WHERE test_type = 'defi-protocols'
GROUP BY network_name, protocol_category
ORDER BY network_name, success_rate DESC;
```

**Use this to:**
- Track DeFi protocol compatibility
- Identify problematic protocol categories
- Validate network DeFi readiness

---

## 🛠️ Debugging Workflows

### Workflow 1: Investigating Test Failures

1. **Identify Recent Failures**
   - Use the failure analysis dashboard
   - Filter by time range (last 24h, 7 days)
   - Sort by frequency to prioritize

2. **Analyze Error Patterns**
   - Group by error message
   - Check if network-specific or universal
   - Look for correlation with gas usage

3. **Deep Dive Investigation**
   - Get transaction hash from failed test
   - Use blockchain explorer for detailed trace
   - Compare with successful runs of same test

4. **Root Cause Analysis**
   - Check if related to recent code changes
   - Verify network conditions during failure
   - Validate test parameters and assumptions

### Workflow 2: Performance Regression Detection

1. **Baseline Establishment**
   - Query historical gas usage averages
   - Set acceptable variance thresholds
   - Document expected performance ranges

2. **Trend Monitoring**
   - Daily/weekly gas usage trends
   - Execution time patterns
   - Success rate degradation

3. **Regression Investigation**
   - Compare current vs historical performance
   - Identify when regression started
   - Correlate with deployment/configuration changes

4. **Optimization Validation**
   - A/B test performance improvements
   - Measure impact of optimizations
   - Document performance gains

### Workflow 3: Network Comparison Analysis

1. **Multi-Network Testing**
   - Run identical tests across all networks
   - Compare success rates and performance
   - Identify network-specific limitations

2. **Cost-Benefit Analysis**
   - Calculate gas costs across networks
   - Factor in native token prices
   - Recommend optimal networks for specific operations

3. **Compatibility Assessment**
   - EVM feature support comparison
   - DeFi protocol compatibility matrix
   - Migration feasibility analysis

---

## 📊 Key Metrics to Monitor

### Daily Monitoring
- **Overall Success Rate**: Target >95%
- **New Failure Types**: Zero tolerance for new error patterns
- **Performance Baseline**: Gas usage within ±10% of baseline
- **Test Coverage**: All test types executed daily

### Weekly Analysis
- **Trend Analysis**: Performance improvements/degradations
- **Network Comparison**: Relative performance rankings
- **Error Pattern Evolution**: Recurring vs one-off issues
- **Optimization Opportunities**: High-cost operations identification

### Monthly Review
- **Long-term Trends**: Performance evolution over time
- **Network Roadmap**: Compatibility improvements tracking
- **Test Suite Enhancement**: Coverage gaps and additions
- **ROI Analysis**: Testing investment vs quality improvements

---

## 🔧 Customizing Dashboards

### Creating Custom Questions

1. **Go to Browse Data** → Select your database
2. **Pick a table** (test_results, contract_deployments, etc.)
3. **Add filters** relevant to your investigation
4. **Summarize data** using grouping and aggregation
5. **Visualize results** with appropriate chart types

### Useful Filter Combinations

#### For Debugging
- **Time Range**: Last 24 hours or specific date
- **Success Status**: Failed tests only
- **Network**: Specific blockchain for targeted analysis
- **Test Type**: EVM compatibility or DeFi protocols

#### For Performance Analysis
- **Success Status**: Successful tests only
- **Time Range**: Last 30 days for trend analysis
- **Test Name**: Specific operations for detailed analysis
- **Gas Usage Range**: Above/below certain thresholds

### Setting Up Alerts

1. **Create Question** with your monitoring query
2. **Set up Alert** in question settings
3. **Define Conditions**:
   - Success rate drops below 90%
   - Average gas usage increases >20%
   - New error types appear
4. **Configure Notifications**: Email, Slack, etc.

---

## 💡 Pro Tips for Test Engineers

### Efficient Debugging
- **Use transaction hashes** to trace failures on blockchain explorers
- **Compare gas usage** between successful and failed tests
- **Group similar errors** to identify systematic issues
- **Monitor trends** rather than individual test results

### Performance Optimization
- **Establish baselines** before making changes
- **A/B test optimizations** across different networks
- **Document performance impacts** of code changes
- **Use gas profiling** for detailed optimization guidance

### Quality Assurance
- **Set up automated alerts** for critical metrics
- **Create regression test suites** for performance
- **Maintain test result history** for trend analysis
- **Regular network comparison** reviews

### Collaboration
- **Share dashboard links** with development team
- **Export reports** for stakeholder meetings
- **Document investigation findings** in dashboard comments
- **Create team-specific views** for different roles

---

## 🚨 Critical Alerts to Set Up

### Immediate Action Required
- **Success rate < 85%**: System-wide issues
- **Zero successful tests**: Network connectivity problems
- **New error types**: Potential breaking changes
- **Gas usage spike >50%**: Performance regression

### Weekly Review Required
- **Success rate < 95%**: Quality degradation
- **Performance regression >20%**: Optimization needed
- **Test coverage gaps**: Missing test scenarios
- **Network-specific issues**: Compatibility problems

---

*Use Metabase to transform your blockchain test data into actionable insights for better testing and debugging!*