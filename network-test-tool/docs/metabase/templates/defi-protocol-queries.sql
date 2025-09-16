-- DeFi Protocol Dashboard SQL Queries
-- For use with Metabase and blockchain test results database

-- =====================================================
-- DEFI PROTOCOL OVERVIEW QUERIES
-- =====================================================

-- 1. DeFi Protocol Health Matrix
SELECT
    network_name,
    test_name as protocol_name,
    COUNT(*) as total_tests,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_tests,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as success_rate,
    ROUND(AVG(gas_used), 0) as avg_gas_used,
    ROUND(SUM(gas_used * gas_price / 1e18), 6) as total_cost_eth
FROM test_results
WHERE test_type = 'defi-protocols'
GROUP BY network_name, test_name
ORDER BY network_name, success_rate DESC;

-- 2. DeFi Protocol Performance Trend
SELECT
    DATE(start_time) as test_date,
    network_name,
    test_name as protocol,
    COUNT(*) as daily_tests,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as daily_success_rate,
    ROUND(AVG(gas_used), 0) as daily_avg_gas
FROM test_results
WHERE test_type = 'defi-protocols'
    AND start_time >= date('now', '-30 days')
GROUP BY DATE(start_time), network_name, test_name
ORDER BY test_date DESC, network_name, protocol;

-- =====================================================
-- ERC20 TOKEN ANALYSIS
-- =====================================================

-- 3. ERC20 Token Operations Performance
SELECT
    network_name,
    CASE
        WHEN test_name LIKE '%TokenA%' THEN 'Token A'
        WHEN test_name LIKE '%TokenB%' THEN 'Token B'
        WHEN test_name LIKE '%Reward%' THEN 'Reward Token'
        ELSE 'Other Token'
    END as token_type,
    COUNT(*) as operations_count,
    ROUND(AVG(gas_used), 0) as avg_gas_per_operation,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as operation_success_rate,
    ROUND(AVG(duration), 2) as avg_duration_ms
FROM test_results
WHERE test_type = 'defi-protocols'
    AND (test_name LIKE '%Token%' OR test_name LIKE '%ERC20%')
GROUP BY network_name, token_type
ORDER BY network_name, avg_gas_per_operation;

-- 4. Token Operation Cost Comparison
SELECT
    network_name,
    test_name as operation_type,
    COUNT(*) as operation_count,
    ROUND(AVG(gas_used), 0) as avg_gas,
    ROUND(MIN(gas_used), 0) as min_gas,
    ROUND(MAX(gas_used), 0) as max_gas,
    ROUND(AVG(gas_used * gas_price / 1e18), 8) as avg_cost_eth
FROM test_results
WHERE test_type = 'defi-protocols'
    AND test_name LIKE '%ERC20%'
    AND success = 1
GROUP BY network_name, test_name
ORDER BY network_name, avg_gas;

-- =====================================================
-- DEX PROTOCOL ANALYSIS
-- =====================================================

-- 5. DEX Operations Performance
SELECT
    network_name,
    test_name as dex_operation,
    COUNT(*) as total_operations,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_operations,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as success_rate,
    ROUND(AVG(gas_used), 0) as avg_gas_cost,
    ROUND(AVG(duration), 2) as avg_execution_time
FROM test_results
WHERE test_type = 'defi-protocols'
    AND test_name LIKE '%DEX%'
GROUP BY network_name, test_name
ORDER BY network_name, success_rate DESC;

-- 6. DEX Liquidity and Trading Analysis
SELECT
    network_name,
    CASE
        WHEN test_name LIKE '%swap%' THEN 'Trading'
        WHEN test_name LIKE '%liquidity%' THEN 'Liquidity Management'
        WHEN test_name LIKE '%pool%' THEN 'Pool Operations'
        ELSE 'Other DEX Operations'
    END as operation_category,
    COUNT(*) as operation_count,
    ROUND(AVG(gas_used), 0) as avg_gas_usage,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as reliability_score
FROM test_results
WHERE test_type = 'defi-protocols'
    AND test_name LIKE '%DEX%'
GROUP BY network_name, operation_category
ORDER BY network_name, reliability_score DESC;

-- =====================================================
-- LENDING PROTOCOL ANALYSIS
-- =====================================================

-- 7. Lending Protocol Operations
SELECT
    network_name,
    CASE
        WHEN test_name LIKE '%borrow%' THEN 'Borrowing'
        WHEN test_name LIKE '%lend%' THEN 'Lending'
        WHEN test_name LIKE '%collateral%' THEN 'Collateral Management'
        WHEN test_name LIKE '%liquidation%' THEN 'Liquidations'
        ELSE 'Other Lending Ops'
    END as lending_operation,
    COUNT(*) as operation_count,
    ROUND(AVG(gas_used), 0) as avg_gas_cost,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as success_rate,
    ROUND(AVG(duration), 2) as avg_processing_time
FROM test_results
WHERE test_type = 'defi-protocols'
    AND (test_name LIKE '%Lending%' OR test_name LIKE '%borrow%' OR test_name LIKE '%lend%')
GROUP BY network_name, lending_operation
ORDER BY network_name, avg_gas_cost;

-- 8. Lending Risk and Performance Metrics
SELECT
    network_name,
    COUNT(*) as total_lending_operations,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_operations,
    ROUND(AVG(gas_used), 0) as avg_gas_per_operation,
    ROUND(SUM(gas_used * gas_price / 1e18), 6) as total_operational_cost,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as protocol_reliability
FROM test_results
WHERE test_type = 'defi-protocols'
    AND test_name LIKE '%Lending%'
GROUP BY network_name
ORDER BY protocol_reliability DESC;

-- =====================================================
-- NFT AND YIELD FARMING ANALYSIS
-- =====================================================

-- 9. NFT Collection Performance
SELECT
    network_name,
    CASE
        WHEN test_name LIKE '%mint%' THEN 'Minting'
        WHEN test_name LIKE '%transfer%' THEN 'Transfers'
        WHEN test_name LIKE '%metadata%' THEN 'Metadata Operations'
        ELSE 'Other NFT Operations'
    END as nft_operation,
    COUNT(*) as operation_count,
    ROUND(AVG(gas_used), 0) as avg_gas_cost,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as success_rate
FROM test_results
WHERE test_type = 'defi-protocols'
    AND (test_name LIKE '%NFT%' OR test_name LIKE '%ERC721%')
GROUP BY network_name, nft_operation
ORDER BY network_name, avg_gas_cost;

-- 10. Yield Farming Performance
SELECT
    network_name,
    test_name as farming_operation,
    COUNT(*) as farming_operations,
    ROUND(AVG(gas_used), 0) as avg_gas_per_farm,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as farming_success_rate,
    ROUND(AVG(duration), 2) as avg_farm_time_ms
FROM test_results
WHERE test_type = 'defi-protocols'
    AND (test_name LIKE '%Yield%' OR test_name LIKE '%Farm%' OR test_name LIKE '%Stake%')
GROUP BY network_name, test_name
ORDER BY network_name, farming_success_rate DESC;

-- =====================================================
-- MULTISIG WALLET ANALYSIS
-- =====================================================

-- 11. MultiSig Wallet Operations
SELECT
    network_name,
    test_name as multisig_operation,
    COUNT(*) as total_operations,
    ROUND(AVG(gas_used), 0) as avg_gas_per_signature,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as operation_reliability,
    ROUND(AVG(duration), 2) as avg_coordination_time
FROM test_results
WHERE test_type = 'defi-protocols'
    AND test_name LIKE '%MultiSig%'
GROUP BY network_name, test_name
ORDER BY network_name, operation_reliability DESC;

-- =====================================================
-- ECONOMIC ANALYSIS
-- =====================================================

-- 12. DeFi Protocol Cost Analysis
SELECT
    network_name,
    test_name as protocol,
    COUNT(*) as operations_count,
    ROUND(SUM(gas_used), 0) as total_gas_consumed,
    ROUND(AVG(gas_used), 0) as avg_gas_per_operation,
    ROUND(SUM(gas_used * gas_price / 1e18), 6) as total_protocol_cost_eth,
    ROUND(AVG(gas_used * gas_price / 1e18), 8) as avg_operation_cost_eth
FROM test_results
WHERE test_type = 'defi-protocols'
    AND success = 1
GROUP BY network_name, test_name
ORDER BY total_protocol_cost_eth DESC;

-- 13. Network DeFi Efficiency Ranking
SELECT
    network_name,
    COUNT(*) as total_defi_operations,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_operations,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as network_reliability,
    ROUND(AVG(gas_used), 0) as avg_gas_efficiency,
    ROUND(SUM(gas_used * gas_price / 1e18), 6) as total_network_cost,
    COUNT(DISTINCT test_name) as protocols_supported,
    -- Composite efficiency score
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) +
        (50000.0 / AVG(gas_used)) * 10 +
        COUNT(DISTINCT test_name) * 5
    , 2) as defi_readiness_score
FROM test_results
WHERE test_type = 'defi-protocols'
GROUP BY network_name
ORDER BY defi_readiness_score DESC;

-- =====================================================
-- ERROR AND FAILURE ANALYSIS
-- =====================================================

-- 14. DeFi Protocol Failure Patterns
SELECT
    network_name,
    test_name as failed_protocol,
    COUNT(*) as failure_count,
    GROUP_CONCAT(DISTINCT error_message) as common_errors,
    ROUND(AVG(gas_used), 0) as avg_gas_on_failure,
    ROUND(
        (COUNT(*) * 100.0 / (
            SELECT COUNT(*)
            FROM test_results tr2
            WHERE tr2.test_type = 'defi-protocols'
                AND tr2.network_name = test_results.network_name
        )), 2
    ) as failure_rate_percent
FROM test_results
WHERE test_type = 'defi-protocols'
    AND success = 0
    AND error_message IS NOT NULL
GROUP BY network_name, test_name
HAVING COUNT(*) > 1
ORDER BY failure_count DESC;

-- 15. Protocol-Specific Error Analysis
SELECT
    CASE
        WHEN test_name LIKE '%ERC20%' THEN 'Token Operations'
        WHEN test_name LIKE '%DEX%' THEN 'DEX Trading'
        WHEN test_name LIKE '%Lending%' THEN 'Lending/Borrowing'
        WHEN test_name LIKE '%NFT%' THEN 'NFT Operations'
        WHEN test_name LIKE '%MultiSig%' THEN 'MultiSig Coordination'
        WHEN test_name LIKE '%Yield%' THEN 'Yield Farming'
        ELSE 'Other Protocol'
    END as protocol_category,
    network_name,
    COUNT(*) as error_count,
    ROUND(AVG(gas_used), 0) as avg_failed_gas,
    GROUP_CONCAT(DISTINCT SUBSTR(error_message, 1, 50)) as error_summary
FROM test_results
WHERE test_type = 'defi-protocols'
    AND success = 0
GROUP BY protocol_category, network_name
ORDER BY protocol_category, error_count DESC;

-- =====================================================
-- PERFORMANCE MONITORING
-- =====================================================

-- 16. DeFi Protocol Performance Regression
SELECT
    network_name,
    test_name as protocol,
    DATE(start_time) as test_date,
    ROUND(AVG(gas_used), 0) as daily_avg_gas,
    ROUND(AVG(duration), 2) as daily_avg_duration,
    COUNT(*) as daily_operations,
    LAG(ROUND(AVG(gas_used), 0)) OVER (
        PARTITION BY network_name, test_name
        ORDER BY DATE(start_time)
    ) as previous_avg_gas
FROM test_results
WHERE test_type = 'defi-protocols'
    AND success = 1
    AND start_time >= date('now', '-14 days')
GROUP BY network_name, test_name, DATE(start_time)
ORDER BY network_name, protocol, test_date DESC;

-- =====================================================
-- DASHBOARD KPI QUERIES
-- =====================================================

-- 17. DeFi Protocol KPI Summary
SELECT
    'Total DeFi Operations' as metric_name,
    COUNT(*) as metric_value,
    'operations' as metric_unit
FROM test_results
WHERE test_type = 'defi-protocols'

UNION ALL

SELECT
    'DeFi Success Rate' as metric_name,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as metric_value,
    '%' as metric_unit
FROM test_results
WHERE test_type = 'defi-protocols'

UNION ALL

SELECT
    'Protocols Tested' as metric_name,
    COUNT(DISTINCT test_name) as metric_value,
    'protocols' as metric_unit
FROM test_results
WHERE test_type = 'defi-protocols'

UNION ALL

SELECT
    'Total Value Locked (Simulated)' as metric_name,
    ROUND(SUM(gas_used * gas_price / 1e18), 2) as metric_value,
    'ETH' as metric_unit
FROM test_results
WHERE test_type = 'defi-protocols'
    AND success = 1;

-- 18. Recent DeFi Activity (last 24 hours)
SELECT
    network_name,
    COUNT(*) as recent_operations,
    COUNT(DISTINCT test_name) as active_protocols,
    ROUND(
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as recent_success_rate,
    ROUND(SUM(gas_used * gas_price / 1e18), 6) as recent_total_cost
FROM test_results
WHERE test_type = 'defi-protocols'
    AND start_time >= datetime('now', '-24 hours')
GROUP BY network_name
ORDER BY recent_success_rate DESC;

-- =====================================================
-- NOTES FOR METABASE DASHBOARD CREATION:
-- =====================================================
/*
Dashboard Structure Recommendation:

1. Executive Summary (Row 1):
   - KPI Cards (query 17)
   - Network DeFi Readiness Ranking (query 13)

2. Protocol Health Matrix (Row 2):
   - Protocol Performance Overview (query 1)
   - Success Rate Trends (query 2)

3. Token Operations (Row 3):
   - ERC20 Performance (query 3)
   - Token Cost Comparison (query 4)

4. DEX Analysis (Row 4):
   - DEX Operations Performance (query 5)
   - Liquidity & Trading Analysis (query 6)

5. Lending & DeFi Services (Row 5):
   - Lending Operations (query 7)
   - Risk Metrics (query 8)

6. Advanced DeFi (Row 6):
   - NFT Performance (query 9)
   - Yield Farming (query 10)
   - MultiSig Operations (query 11)

7. Economic Analysis (Row 7):
   - Cost Analysis (query 12)
   - Efficiency Rankings (query 13)

8. Error Analysis (Row 8):
   - Failure Patterns (query 14)
   - Protocol-Specific Errors (query 15)

Filters to add:
- Network dropdown
- Date range picker
- Protocol type selector
- Success/failure toggle
*/