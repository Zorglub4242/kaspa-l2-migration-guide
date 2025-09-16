
// Format timestamp to locale string
function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString();
}

// Format number with thousands separator
function formatNumber(num) {
  if (!num) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Convert wei to gwei
function formatGwei(wei) {
  if (!wei) return '0';
  return (wei / 1e9).toFixed(2);
}

// Convert wei to ether
function formatEther(wei) {
  if (!wei) return '0';
  return (wei / 1e18).toFixed(6);
}

// Get network name from chain ID
function networkName(chainId) {
  const names = {
    11155111: 'Sepolia',
    167012: 'Kasplex L2',
    19416: 'Igra L2'
  };
  return names[chainId] || 'Chain ' + chainId;
}

// Get network icon
function networkIcon(chainId) {
  const icons = {
    11155111: '🔷', // Sepolia
    167012: '🟢',   // Kasplex
    19416: '🟣'     // Igra
  };
  return icons[chainId] || '⚪';
}

// Get network token symbol
function networkToken(chainId) {
  const tokens = {
    11155111: 'ETH',
    167012: 'KAS',
    19416: 'IKAS'
  };
  return tokens[chainId] || 'TOKEN';
}

// Calculate percentage
function percentage(value, total) {
  if (!total || total === 0) return '0%';
  return ((value / total) * 100).toFixed(2) + '%';
}

// Status badge formatter
function statusBadge(success) {
  return success ? '✅ PASSED' : '❌ FAILED';
}

// Status CSS class
function statusClass(success) {
  return success ? 'success' : 'failure';
}

// JSON stringify helper
function json(obj) {
  return JSON.stringify(obj, null, 2);
}

// Comparison helpers
function eq(a, b) { return a === b; }
function ne(a, b) { return a !== b; }
function lt(a, b) { return a < b; }
function gt(a, b) { return a > b; }

// Math helpers
function add(a, b) { return Number(a) + Number(b); }
function subtract(a, b) { return Number(a) - Number(b); }
function multiply(a, b) { return Number(a) * Number(b); }
function divide(a, b) { return Number(b) !== 0 ? Number(a) / Number(b) : 0; }

// Additional helpers for reports
function calculateSuccessRate(results) {
  if (!results || results.length === 0) return 0;
  const successful = results.filter(r => r.success).length;
  return ((successful / results.length) * 100).toFixed(2);
}

function totalGas(results) {
  if (!results) return 0;
  return results.reduce((sum, r) => sum + (r.gas_used || 0), 0);
}

function avgExecutionTime(results) {
  if (!results || results.length === 0) return 0;
  const total = results.reduce((sum, r) => sum + (r.duration_ms || 0), 0);
  return (total / results.length).toFixed(2);
}

// DeFi specific helpers
function groupByProtocol(results) {
  if (!results) return [];
  const grouped = {};
  results.forEach(r => {
    if (!grouped[r.test_category]) {
      grouped[r.test_category] = { protocol: r.test_category, tests: [] };
    }
    grouped[r.test_category].tests.push(r);
  });
  return Object.values(grouped);
}

function sortByGas(results) {
  if (!results) return [];
  return [...results].sort((a, b) => (b.gas_used || 0) - (a.gas_used || 0));
}

function calculateProtocolCost(results, protocol) {
  if (!results) return '0';
  const protocolResults = results.filter(r => r.test_category === protocol);
  const totalWei = protocolResults.reduce((sum, r) =>
    sum + ((r.gas_used || 0) * (r.gas_price || 0)), 0);
  return (totalWei / 1e18).toFixed(6);
}

function calculateTotalCost(results) {
  if (!results) return '0';
  const totalWei = results.reduce((sum, r) =>
    sum + ((r.gas_used || 0) * (r.gas_price || 0)), 0);
  return (totalWei / 1e18).toFixed(6);
}

function getNetworkMetric(chainId, metric, results) {
  // Placeholder - would need real data
  return '0';
}

function isBest(chainId, metric, results) {
  // Placeholder - would need real comparison logic
  return false;
}

// Contract deployment specific helpers
function countHealthy(deployments) {
  if (!deployments) return 0;
  return deployments.filter(d => d.is_healthy).length;
}

function totalGasUsed(deployments) {
  if (!deployments) return 0;
  return deployments.reduce((sum, d) => sum + (d.gas_used || 0), 0);
}

function totalContracts(deployments) {
  if (!deployments) return 0;
  return deployments.length;
}

function avgDeploymentCost(deployments) {
  if (!deployments || deployments.length === 0) return '0';
  const totalCost = deployments.reduce((sum, d) =>
    sum + parseFloat(d.deployment_cost || 0), 0);
  return (totalCost / deployments.length).toFixed(6);
}

function countByType(deployments, type) {
  if (!deployments) return 0;
  if (type === 'evm') {
    return deployments.filter(d =>
      d.contract_type && ['SimpleStorage', 'CREATE2Factory', 'ModExpTest'].includes(d.contract_type)
    ).length;
  } else if (type === 'defi') {
    return deployments.filter(d =>
      d.contract_type && ['ERC20', 'DEX', 'Lending', 'NFT', 'MultiSig'].includes(d.contract_type)
    ).length;
  }
  return deployments.filter(d => d.contract_type === type).length;
}

function groupByNetwork(deployments) {
  if (!deployments) return [];
  const grouped = {};
  deployments.forEach(d => {
    const netName = networkName(d.chain_id);
    if (!grouped[netName]) {
      grouped[netName] = {
        network: netName,
        chainId: d.chain_id,
        contracts: []
      };
    }
    grouped[netName].contracts.push(d);
  });
  return Object.values(grouped);
}

function countByStatus(deployments, status) {
  if (!deployments) return 0;
  return deployments.filter(d => d.is_healthy === status).length;
}

// Test failure helpers
function groupByError(failures) {
  if (!failures) return [];
  const grouped = {};
  failures.forEach(f => {
    const errorType = f.error_message ? f.error_message.split(':')[0] : 'Unknown Error';
    if (!grouped[errorType]) {
      grouped[errorType] = {
        error: errorType,
        failures: []
      };
    }
    grouped[errorType].failures.push(f);
  });
  return Object.values(grouped);
}

function failureRate(results) {
  if (!results || results.length === 0) return 0;
  const failures = results.filter(r => !r.success).length;
  return ((failures / results.length) * 100).toFixed(2);
}

// Load test helpers
function calculateTPS(results) {
  if (!results || results.length === 0) return 0;
  const totalTime = results.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / 1000;
  return totalTime > 0 ? (results.length / totalTime).toFixed(2) : 0;
}

function avgResponseTime(results) {
  if (!results || results.length === 0) return 0;
  const total = results.reduce((sum, r) => sum + (r.duration_ms || 0), 0);
  return (total / results.length).toFixed(0);
}

function percentile(results, pct) {
  if (!results || results.length === 0) return 0;
  const sorted = [...results].sort((a, b) => (a.duration_ms || 0) - (b.duration_ms || 0));
  const index = Math.floor(sorted.length * pct / 100);
  return sorted[index] ? sorted[index].duration_ms : 0;
}

// Finality helpers
function avgFinality(measurements) {
  if (!measurements || measurements.length === 0) return 0;
  const total = measurements.reduce((sum, m) => sum + (m.finality_time || 0), 0);
  return (total / measurements.length).toFixed(2);
}

function mevOpportunities(measurements) {
  if (!measurements) return 0;
  return measurements.filter(m => m.mev_detected).length;
}

// Additional missing helpers
function averageGasPrice(deployments) {
  if (!deployments || deployments.length === 0) return '0';
  const total = deployments.reduce((sum, d) => sum + (d.gas_price || 0), 0);
  return (total / deployments.length / 1e9).toFixed(2); // Convert to Gwei
}

function getTestCategories(results) {
  if (!results) return [];
  const categories = [...new Set(results.map(r => r.test_category))];
  return categories.filter(c => c);
}

function getErrorTypes(results) {
  if (!results) return [];
  const errors = results.filter(r => r.error_message)
    .map(r => r.error_message.split(':')[0]);
  return [...new Set(errors)];
}

function successCount(results) {
  if (!results) return 0;
  return results.filter(r => r.success).length;
}

function failureCount(results) {
  if (!results) return 0;
  return results.filter(r => !r.success).length;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString();
}

function formatDateTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

function round(num, decimals) {
  if (typeof num !== 'number') return 0;
  return Number(num.toFixed(decimals || 2));
}

function isEmpty(arr) {
  return !arr || arr.length === 0;
}

function isNotEmpty(arr) {
  return arr && arr.length > 0;
}

function length(arr) {
  return arr ? arr.length : 0;
}

function first(arr) {
  return arr && arr.length > 0 ? arr[0] : null;
}

function last(arr) {
  return arr && arr.length > 0 ? arr[arr.length - 1] : null;
}

function sum(arr, prop) {
  if (!arr) return 0;
  if (prop) {
    return arr.reduce((sum, item) => sum + (item[prop] || 0), 0);
  }
  return arr.reduce((sum, item) => sum + (item || 0), 0);
}

function avg(arr, prop) {
  if (!arr || arr.length === 0) return 0;
  const total = sum(arr, prop);
  return total / arr.length;
}

function min(arr, prop) {
  if (!arr || arr.length === 0) return 0;
  if (prop) {
    return Math.min(...arr.map(item => item[prop] || 0));
  }
  return Math.min(...arr);
}

function max(arr, prop) {
  if (!arr || arr.length === 0) return 0;
  if (prop) {
    return Math.max(...arr.map(item => item[prop] || 0));
  }
  return Math.max(...arr);
}

function includes(arr, value) {
  return arr && arr.includes(value);
}

function formatPercent(value) {
  if (typeof value !== 'number') return '0%';
  return value.toFixed(2) + '%';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toLowerCase(str) {
  return str ? str.toLowerCase() : '';
}

function toUpperCase(str) {
  return str ? str.toUpperCase() : '';
}

// Calculate overall average gas usage across all deployments
function averageGasOverall(deployments) {
  if (!deployments || deployments.length === 0) return 0;
  const totalGas = deployments.reduce((sum, d) => sum + (d.gas_used || 0), 0);
  return Math.round(totalGas / deployments.length);
}

// Find the deployment with the highest cost
function mostExpensive(deployments) {
  if (!deployments || deployments.length === 0) return null;
  return deployments.reduce((max, d) => {
    const currentCost = parseFloat(d.deployment_cost || 0);
    const maxCost = parseFloat(max.deployment_cost || 0);
    return currentCost > maxCost ? d : max;
  }, deployments[0]);
}
