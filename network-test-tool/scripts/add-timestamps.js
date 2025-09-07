const fs = require('fs');
const path = require('path');

// Files to update (focusing on load test scripts)
const filesToUpdate = [
  'load-test-simple.js',
  'load-test-stress.js', 
  'load-test-max-tps.js',
  'load-test-burst.js',
  'load-test-diagnostic.js',
  'load-test-reliable.js',
  'load-test-compare.js',
  'load-test-auto-reliable.js'
];

// Logger import to add at the top
const loggerImport = `const { logger } = require('../utils/logger');`;

// Function to update a file
function updateFile(filename) {
  const filePath = path.join(__dirname, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ File not found: ${filename}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already updated
  if (content.includes('../utils/logger')) {
    console.log(`✅ ${filename} - Already updated`);
    return;
  }
  
  // Add logger import after the require statements
  const requireRegex = /(const .+ = require\(.+\);\n)+/;
  const match = content.match(requireRegex);
  
  if (match) {
    const insertIndex = match.index + match[0].length;
    content = content.slice(0, insertIndex) + '\n' + loggerImport + '\n' + content.slice(insertIndex);
  } else {
    // Fallback: add at the top
    content = loggerImport + '\n' + content;
  }
  
  // Replace common console.log patterns with logger calls
  const replacements = [
    // Header messages
    { from: /console\.log\(chalk\.cyan\((.+?)\)\);/g, to: 'logger.cyan($1);' },
    { from: /console\.log\(chalk\.red\((.+?)\)\);/g, to: 'logger.error($1);' },
    { from: /console\.log\(chalk\.green\((.+?)\)\);/g, to: 'logger.success($1);' },
    { from: /console\.log\(chalk\.yellow\((.+?)\)\);/g, to: 'logger.warning($1);' },
    { from: /console\.log\(chalk\.blue\((.+?)\)\);/g, to: 'logger.info($1);' },
    { from: /console\.log\(chalk\.gray\((.+?)\)\);/g, to: 'logger.gray($1);' },
    
    // Simple string messages
    { from: /console\.log\("(.+?)"\);/g, to: 'logger.log("$1");' },
    { from: /console\.log\('(.+?)'\);/g, to: 'logger.log(\'$1\');' },
    { from: /console\.log\(`(.+?)`\);/g, to: 'logger.log(`$1`);' },
    
    // Template literals with variables
    { from: /console\.log\((.+?)\);/g, to: 'logger.log($1);' }
  ];
  
  replacements.forEach(({ from, to }) => {
    content = content.replace(from, to);
  });
  
  // Special handling for table output
  content = content.replace(
    /console\.log\(([a-zA-Z_]+Table)\.toString\(\)\);/g, 
    'logger.table($1.toString());'
  );
  
  // Write the updated content
  fs.writeFileSync(filePath, content);
  console.log(`✅ ${filename} - Updated with timestamps`);
}

// Update all files
console.log('🔄 Adding timestamps to load test scripts...\n');

filesToUpdate.forEach(updateFile);

console.log('\n✅ Timestamp update complete!');
console.log('📁 Created utils/logger.js for shared logging functionality');
console.log('🎯 All load test scripts now include timestamps on every line');