-- EVM Compatibility Dashboard SQL Queries
-- For use with Metabase and blockchain test results database

-- =====================================================
-- EVM COMPATIBILITY OVERVIEW QUERIES
-- =====================================================

-- 1. Overall EVM Compatibility Score by Network
SELECT
    network_name,
    COUNT(*) as total_tests,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_tests,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as success_rate_percent,
    AVG(gas_used) as avg_gas_used,
    AVG(duration) as avg_duration_ms
FROM test_results
WHERE test_type = 'evm-compatibility'
GROUP BY network_name
ORDER BY success_rate_percent DESC;

-- 2. EVM Test Trend Over Time
SELECT
    DATE(start_time) as test_date,
    network_name,
    COUNT(*) as daily_tests,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as daily_successes,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as daily_success_rate
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND start_time >= date('now', '-30 days')
GROUP BY DATE(start_time), network_name
ORDER BY test_date DESC, network_name;

-- =====================================================
-- PRECOMPILE TESTS BREAKDOWN
-- =====================================================

-- 3. Precompile Test Performance by Network
SELECT
    network_name,
    test_name,
    COUNT(*) as test_count,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
    ROUND(AVG(gas_used), 0) as avg_gas_used,
    ROUND(AVG(duration), 2) as avg_duration_ms,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as success_rate
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND test_name IN ('ecrecover', 'sha256', 'ripemd160', 'modexp', 'identity')
GROUP BY network_name, test_name
ORDER BY network_name, test_name;

-- 4. Precompile Gas Usage Comparison
SELECT
    test_name as precompile_name,
    network_name,
    MIN(gas_used) as min_gas,
    MAX(gas_used) as max_gas,
    ROUND(AVG(gas_used), 0) as avg_gas,
    COUNT(*) as sample_size
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND test_name IN ('ecrecover', 'sha256', 'ripemd160', 'modexp', 'identity')
    AND success = 1
GROUP BY test_name, network_name
ORDER BY precompile_name, avg_gas;

-- =====================================================
-- ASSEMBLY OPERATIONS ANALYSIS
-- =====================================================

-- 5. Assembly Operation Success Rates
SELECT
    network_name,
    test_name,
    COUNT(*) as total_attempts,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_ops,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as success_rate,
    ROUND(AVG(gas_used), 0) as avg_gas_used
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND test_name LIKE '%assembly%'
GROUP BY network_name, test_name
ORDER BY network_name, success_rate DESC;

-- 6. Assembly vs High-level Gas Efficiency
SELECT
    network_name,
    CASE
        WHEN test_name LIKE '%assembly%' THEN 'Assembly'
        ELSE 'High-level'
    END as operation_type,
    COUNT(*) as operation_count,
    ROUND(AVG(gas_used), 0) as avg_gas_used,
    ROUND(AVG(duration), 2) as avg_duration_ms
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND success = 1
GROUP BY network_name, operation_type
ORDER BY network_name, operation_type;

-- =====================================================
-- CREATE2 FACTORY ANALYSIS
-- =====================================================

-- 7. CREATE2 Factory Deployment Success
SELECT
    network_name,
    COUNT(*) as total_deployments,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_deployments,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as deployment_success_rate,
    ROUND(AVG(gas_used), 0) as avg_deployment_gas
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND test_name LIKE '%CREATE2%'
GROUP BY network_name
ORDER BY deployment_success_rate DESC;

-- 8. CREATE2 vs Standard Deployment Cost Comparison
SELECT
    network_name,
    CASE
        WHEN test_name LIKE '%CREATE2%' THEN 'CREATE2'
        WHEN test_name LIKE '%deployment%' THEN 'Standard'
        ELSE 'Other'
    END as deployment_type,
    COUNT(*) as deployment_count,
    ROUND(AVG(gas_used), 0) as avg_gas_cost,
    ROUND(AVG(duration), 2) as avg_deployment_time
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND success = 1
    AND (test_name LIKE '%CREATE2%' OR test_name LIKE '%deployment%')
GROUP BY network_name, deployment_type
ORDER BY network_name, deployment_type;

-- =====================================================
-- ERROR ANALYSIS
-- =====================================================

-- 9. Common EVM Compatibility Errors
SELECT
    network_name,
    error_message,
    COUNT(*) as error_count,
    ROUND(
        (COUNT(*) * 100.0 / (
            SELECT COUNT(*)
            FROM test_results tr2
            WHERE tr2.test_type = 'evm-compatibility'
                AND tr2.network_name = test_results.network_name
        )), 2
    ) as error_percentage
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND success = 0
    AND error_message IS NOT NULL
GROUP BY network_name, error_message
HAVING COUNT(*) > 1
ORDER BY network_name, error_count DESC;

-- 10. EVM Test Failure Patterns
SELECT
    test_name,
    network_name,
    COUNT(*) as failure_count,
    GROUP_CONCAT(DISTINCT error_message) as common_errors,
    ROUND(AVG(gas_used), 0) as avg_gas_when_failed
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND success = 0
GROUP BY test_name, network_name
ORDER BY failure_count DESC;

-- =====================================================
-- PERFORMANCE METRICS
-- =====================================================

-- 11. EVM Performance Regression Detection
SELECT
    network_name,
    test_name,
    DATE(start_time) as test_date,
    ROUND(AVG(gas_used), 0) as daily_avg_gas,
    ROUND(AVG(duration), 2) as daily_avg_duration,
    LAG(ROUND(AVG(gas_used), 0)) OVER (
        PARTITION BY network_name, test_name
        ORDER BY DATE(start_time)
    ) as previous_avg_gas
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND success = 1
    AND start_time >= date('now', '-7 days')
GROUP BY network_name, test_name, DATE(start_time)
ORDER BY network_name, test_name, test_date DESC;

-- 12. Cross-Network EVM Compatibility Ranking
SELECT
    network_name,
    COUNT(*) as total_evm_tests,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as passed_tests,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as compatibility_score,
    ROUND(AVG(gas_used), 0) as avg_gas_efficiency,
    ROUND(AVG(duration), 2) as avg_performance_ms,
    -- Composite score: success rate + gas efficiency + performance
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) +
        (10000.0 / AVG(gas_used)) * 10 +
        (1000.0 / AVG(duration)) * 10
    , 2) as composite_score
FROM test_results
WHERE test_type = 'evm-compatibility'
GROUP BY network_name
ORDER BY composite_score DESC;

-- =====================================================
-- DASHBOARD KPI QUERIES
-- =====================================================

-- 13. Key EVM Compatibility Metrics (for KPI cards)
SELECT
    'Total EVM Tests' as metric_name,
    COUNT(*) as metric_value,
    'tests' as metric_unit
FROM test_results
WHERE test_type = 'evm-compatibility'

UNION ALL

SELECT
    'Overall Success Rate' as metric_name,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as metric_value,
    '%' as metric_unit
FROM test_results
WHERE test_type = 'evm-compatibility'

UNION ALL

SELECT
    'Networks Tested' as metric_name,
    COUNT(DISTINCT network_name) as metric_value,
    'networks' as metric_unit
FROM test_results
WHERE test_type = 'evm-compatibility'

UNION ALL

SELECT
    'Average Gas Used' as metric_name,
    ROUND(AVG(gas_used), 0) as metric_value,
    'gas' as metric_unit
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND success = 1;

-- 14. Recent EVM Test Activity (last 24 hours)
SELECT
    network_name,
    COUNT(*) as recent_tests,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as recent_successes,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as recent_success_rate
FROM test_results
WHERE test_type = 'evm-compatibility'
    AND start_time >= datetime('now', '-24 hours')
GROUP BY network_name
ORDER BY recent_success_rate DESC;

-- =====================================================
-- NOTES FOR METABASE DASHBOARD CREATION:
-- =====================================================
/*
1. Use queries 1, 2, 13 for overview cards and trend charts
2. Use queries 3, 4 for precompile analysis sections
3. Use queries 5, 6 for assembly operation analysis
4. Use queries 7, 8 for CREATE2 factory analysis
5. Use queries 9, 10 for error analysis drill-downs
6. Use queries 11, 12 for performance monitoring
7. Use query 14 for real-time monitoring section

Dashboard Structure Recommendation:
- Row 1: KPI Cards (query 13)
- Row 2: Success Rate Trend (query 2)
- Row 3: Network Comparison (query 1)
- Row 4: Precompile Performance (queries 3, 4)
- Row 5: Assembly Analysis (queries 5, 6)
- Row 6: CREATE2 Analysis (queries 7, 8)
- Row 7: Error Analysis (queries 9, 10)
*/