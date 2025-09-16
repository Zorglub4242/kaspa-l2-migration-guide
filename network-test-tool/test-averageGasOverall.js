#!/usr/bin/env node

/**
 * Simple test to verify the averageGasOverall helper works
 */

// Test data
const testDeployments = [
  { gas_used: 100000, deployment_cost: '0.01' },
  { gas_used: 200000, deployment_cost: '0.05' },
  { gas_used: 300000, deployment_cost: '0.03' }
];

// Copy the helper functions for testing
function averageGasOverall(deployments) {
  if (!deployments || deployments.length === 0) return 0;
  const totalGas = deployments.reduce((sum, d) => sum + (d.gas_used || 0), 0);
  return Math.round(totalGas / deployments.length);
}

function mostExpensive(deployments) {
  if (!deployments || deployments.length === 0) return null;
  return deployments.reduce((max, d) => {
    const currentCost = parseFloat(d.deployment_cost || 0);
    const maxCost = parseFloat(max.deployment_cost || 0);
    return currentCost > maxCost ? d : max;
  }, deployments[0]);
}

console.log('🧪 Testing averageGasOverall helper...');

const result = averageGasOverall(testDeployments);
console.log(`✅ Result: ${result}`);
console.log(`   Expected: ${Math.round((100000 + 200000 +300000) / 3)}`);

if (result === Math.round((100000 + 200000 + 300000) / 3)) {
  console.log('✅ Helper function works correctly!');
} else {
  console.log('❌ Helper function failed!');
}

console.log('\n🧪 Testing mostExpensive helper...');

const expensive = mostExpensive(testDeployments);
console.log(`✅ Most expensive: ${JSON.stringify(expensive)}`);
console.log(`   Expected cost: 0.05`);

if (expensive && expensive.deployment_cost === '0.05') {
  console.log('✅ mostExpensive helper works correctly!');
} else {
  console.log('❌ mostExpensive helper failed!');
}

// Test edge cases
console.log('\n🧪 Testing edge cases...');

console.log(`averageGasOverall empty array: ${averageGasOverall([])}`);
console.log(`averageGasOverall null input: ${averageGasOverall(null)}`);
console.log(`averageGasOverall undefined input: ${averageGasOverall(undefined)}`);

console.log(`mostExpensive empty array: ${mostExpensive([])}`);
console.log(`mostExpensive null input: ${mostExpensive(null)}`);
console.log(`mostExpensive undefined input: ${mostExpensive(undefined)}`);

console.log('\n✅ All tests completed!');