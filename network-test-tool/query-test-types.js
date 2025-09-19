const Database = require('better-sqlite3');
const db = new Database('data/test-results.db', { readonly: true });

// Query distinct test types and names
const results = db.prepare(`
  SELECT DISTINCT test_type, test_name
  FROM test_results
  ORDER BY test_type, test_name
`).all();

console.log('Unique test operations in database:');
console.log('=====================================');
results.forEach(row => {
  console.log(`Type: ${row.test_type || 'N/A'}, Name: ${row.test_name}`);
});

// Get count for each test name
const counts = db.prepare(`
  SELECT test_name, COUNT(*) as count
  FROM test_results
  GROUP BY test_name
  ORDER BY count DESC
`).all();

console.log('\nTest operation frequencies:');
console.log('============================');
counts.forEach(row => {
  console.log(`${row.test_name}: ${row.count} transactions`);
});

db.close();