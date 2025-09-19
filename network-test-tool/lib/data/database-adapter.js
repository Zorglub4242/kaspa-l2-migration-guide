const Database = require('better-sqlite3');
const path = require('path');
const chalk = require('chalk');

class DatabaseAdapter {
  constructor(options = {}) {
    this.options = {
      database: options.database || './data/test-data.db',
      readonly: options.readonly !== false,
      ...options
    };

    this.db = null;
  }

  /**
   * Connect to database
   */
  connect() {
    if (this.db) return;

    const dbPath = path.resolve(this.options.database);
    console.log(chalk.gray(`  🗄️ Connecting to database: ${dbPath}`));

    this.db = new Database(dbPath, {
      readonly: this.options.readonly,
      fileMustExist: this.options.readonly
    });

    console.log(chalk.gray(`    ✓ Database connected`));
  }

  /**
   * Load data from database query
   * @param {string} source - SQL query or table name
   * @returns {Promise<Array>} Query results
   */
  async load(source) {
    this.connect();

    let query;
    let params = [];

    // Check if source is a simple table name or full query
    if (source.toLowerCase().includes('select')) {
      query = source;
    } else {
      // Assume it's a table name
      query = `SELECT * FROM ${source}`;
    }

    // Extract parameters if provided
    if (this.options.params) {
      params = Array.isArray(this.options.params) ? this.options.params : [this.options.params];
    }

    console.log(chalk.gray(`  📊 Executing query: ${query.substring(0, 100)}...`));

    try {
      const stmt = this.db.prepare(query);
      const results = params.length > 0 ? stmt.all(...params) : stmt.all();

      console.log(chalk.gray(`    ✓ Loaded ${results.length} rows from database`));
      return results;
    } catch (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * Iterate over query results
   * @param {string} source - SQL query or table name
   * @param {Function} callback - Callback for each row
   */
  async iterate(source, callback) {
    this.connect();

    let query;
    if (source.toLowerCase().includes('select')) {
      query = source;
    } else {
      query = `SELECT * FROM ${source}`;
    }

    const stmt = this.db.prepare(query);
    const params = this.options.params || [];

    let index = 0;
    for (const row of stmt.iterate(...params)) {
      await callback(row, index++);
    }

    console.log(chalk.gray(`    ✓ Processed ${index} rows`));
  }

  /**
   * Load data with pagination
   * @param {string} source - SQL query or table name
   * @param {number} limit - Number of rows per page
   * @param {number} offset - Starting row
   * @returns {Promise<Array>} Paginated results
   */
  async loadPaginated(source, limit = 100, offset = 0) {
    this.connect();

    let query;
    if (source.toLowerCase().includes('select')) {
      // Add pagination to existing query
      query = `${source} LIMIT ${limit} OFFSET ${offset}`;
    } else {
      query = `SELECT * FROM ${source} LIMIT ${limit} OFFSET ${offset}`;
    }

    const stmt = this.db.prepare(query);
    const results = stmt.all();

    console.log(chalk.gray(`    ✓ Loaded ${results.length} rows (limit: ${limit}, offset: ${offset})`));
    return results;
  }

  /**
   * Execute a write query (insert, update, delete)
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Object} Execution result
   */
  async execute(query, params = []) {
    if (this.options.readonly) {
      throw new Error('Cannot execute write queries in readonly mode');
    }

    this.connect();

    console.log(chalk.gray(`  ✏️ Executing: ${query.substring(0, 100)}...`));

    try {
      const stmt = this.db.prepare(query);
      const result = params.length > 0 ? stmt.run(...params) : stmt.run();

      console.log(chalk.gray(`    ✓ Affected ${result.changes} rows`));
      return result;
    } catch (error) {
      throw new Error(`Database execution failed: ${error.message}`);
    }
  }

  /**
   * Insert multiple rows
   * @param {string} table - Table name
   * @param {Array<Object>} data - Data to insert
   */
  async insertBatch(table, data) {
    if (this.options.readonly) {
      throw new Error('Cannot insert in readonly mode');
    }

    this.connect();

    if (data.length === 0) return;

    // Build insert statement from first row
    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    console.log(chalk.gray(`  ✏️ Inserting ${data.length} rows into ${table}`));

    const stmt = this.db.prepare(query);

    // Use transaction for batch insert
    const insertMany = this.db.transaction((rows) => {
      for (const row of rows) {
        const values = columns.map(col => row[col]);
        stmt.run(...values);
      }
    });

    insertMany(data);

    console.log(chalk.gray(`    ✓ Inserted ${data.length} rows`));
  }

  /**
   * Get table schema
   * @param {string} table - Table name
   * @returns {Array} Table columns
   */
  async getSchema(table) {
    this.connect();

    const query = `PRAGMA table_info(${table})`;
    const columns = this.db.prepare(query).all();

    return columns.map(col => ({
      name: col.name,
      type: col.type,
      required: col.notnull === 1,
      primaryKey: col.pk === 1,
      defaultValue: col.dflt_value
    }));
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log(chalk.gray(`    ✓ Database connection closed`));
    }
  }

  /**
   * Create a test data table
   * @param {string} tableName - Table name
   * @param {Object} schema - Table schema
   */
  async createTable(tableName, schema) {
    if (this.options.readonly) {
      throw new Error('Cannot create table in readonly mode');
    }

    this.connect();

    const columns = Object.entries(schema).map(([name, type]) => `${name} ${type}`);
    const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(', ')})`;

    this.db.prepare(query).run();
    console.log(chalk.gray(`    ✓ Created table ${tableName}`));
  }
}

module.exports = { DatabaseAdapter };