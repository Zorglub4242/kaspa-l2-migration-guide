#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

console.log(chalk.cyan('🔍 BLOCKCHAIN TEST TOOL STATUS\n'));

// Check test results directory
const testResultsDir = path.join(__dirname, 'test-results');
if (!fs.existsSync(testResultsDir)) {
  console.log(chalk.yellow('⚠️  No test-results directory found'));
  process.exit(0);
}

const files = fs.readdirSync(testResultsDir).filter(f => f.endsWith('.json'));

if (files.length === 0) {
  console.log(chalk.yellow('⚠️  No test result files found'));
  process.exit(0);
}

console.log(chalk.green(`📊 Found ${files.length} test result files:\n`));

// Categorize files
const evmFiles = files.filter(f => f.includes('evm-compatibility'));
const defiFiles = files.filter(f => f.includes('defi-complete'));
const finalityFiles = files.filter(f => f.includes('finality'));

console.log(chalk.blue('🔬 EVM Compatibility Tests:'));
evmFiles.forEach(file => {
  const chainId = file.match(/(\d+)/)?.[1];
  const network = chainId === '11155111' ? 'Sepolia' : 
                 chainId === '167012' ? 'Kasplex' : 
                 chainId === '19416' ? 'Igra' : 
                 `Chain ${chainId}`;
  console.log(`  ✅ ${network} (${file})`);
});

console.log(chalk.green('\n🏦 DeFi Protocol Tests:'));
defiFiles.forEach(file => {
  const chainId = file.match(/(\d+)/)?.[1];
  const network = chainId === '11155111' ? 'Sepolia' : 
                 chainId === '167012' ? 'Kasplex' : 
                 chainId === '19416' ? 'Igra' : 
                 `Chain ${chainId}`;
  console.log(`  ✅ ${network} (${file})`);
});

if (finalityFiles.length > 0) {
  console.log(chalk.purple('\n⏱️  Finality Tests:'));
  finalityFiles.forEach(file => {
    console.log(`  ✅ ${file}`);
  });
}

// Show recent files
console.log(chalk.yellow('\n📈 Most Recent Results:'));
const sortedFiles = files
  .map(file => ({
    name: file,
    stat: fs.statSync(path.join(testResultsDir, file)),
    path: path.join(testResultsDir, file)
  }))
  .sort((a, b) => b.stat.mtime - a.stat.mtime)
  .slice(0, 5);

sortedFiles.forEach((file, i) => {
  const age = Math.round((Date.now() - file.stat.mtime) / 1000 / 60);
  console.log(`  ${i + 1}. ${file.name} (${age} minutes ago)`);
});

// Check for HTML reports
const htmlFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.html'));
if (htmlFiles.length > 0) {
  console.log(chalk.green('\n🌐 HTML Reports Available:'));
  htmlFiles.forEach(file => {
    console.log(`  📄 ${file}`);
  });
  
  console.log(chalk.cyan('\n💡 To view comprehensive report:'));
  console.log(`   Open: ${path.join(__dirname, 'blockchain-analysis-report.html')}`);
}

console.log(chalk.green('\n✅ Status check complete!'));