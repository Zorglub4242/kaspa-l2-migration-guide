const { CSVAdapter } = require('./csv-adapter');
const { JSONAdapter } = require('./json-adapter');
const { DatabaseAdapter } = require('./database-adapter');
const { APIAdapter } = require('./api-adapter');
const chalk = require('chalk');

class DataIterator {
  constructor(options = {}) {
    this.options = options;
    this.adapters = {
      csv: new CSVAdapter(options.csv || {}),
      json: new JSONAdapter(options.json || {}),
      database: new DatabaseAdapter(options.database || {}),
      api: new APIAdapter(options.api || {})
    };
  }

  /**
   * Load data from any source
   * @param {string|Object} dataConfig - Data source configuration
   * @returns {Promise<Array>} Loaded data
   */
  async load(dataConfig) {
    let source, type, options;

    if (typeof dataConfig === 'string') {
      // Simple string format - infer type from extension or protocol
      source = dataConfig;
      type = this.inferType(source);
      options = {};
    } else {
      // Object format with detailed config
      source = dataConfig.source;
      type = dataConfig.type || this.inferType(source);
      options = dataConfig.options || {};
    }

    console.log(chalk.cyan(`  📊 Loading ${type} data source`));

    const adapter = this.getAdapter(type, options);

    if (!adapter) {
      throw new Error(`Unknown data source type: ${type}`);
    }

    return await adapter.load(source);
  }

  /**
   * Iterate over data from any source
   * @param {string|Object} dataConfig - Data source configuration
   * @param {Function} callback - Callback for each data item
   */
  async iterate(dataConfig, callback) {
    const data = await this.load(dataConfig);

    console.log(chalk.cyan(`  🔄 Iterating over ${data.length} items`));

    for (let i = 0; i < data.length; i++) {
      // Add index and total to data item for reference
      const item = {
        ...data[i],
        _index: i,
        _total: data.length
      };

      await callback(item, i);
    }
  }

  /**
   * Run test scenario for each data item
   * @param {string|Object} dataConfig - Data source configuration
   * @param {Array} scenario - Test scenario actions
   * @param {Object} executor - Test executor instance
   */
  async runDataDriven(dataConfig, scenario, executor) {
    const data = await this.load(dataConfig);

    console.log(chalk.cyan(`  🧪 Running data-driven test with ${data.length} data sets`));

    const results = [];

    for (let i = 0; i < data.length; i++) {
      const dataRow = data[i];

      console.log(chalk.blue(`\n  Dataset ${i + 1}/${data.length}:`));
      console.log(chalk.gray(`    ${JSON.stringify(dataRow)}`));

      // Set data row in context
      executor.context.dataRow = dataRow;
      executor.context.setVariable('_dataIndex', i);
      executor.context.setVariable('_dataTotal', data.length);

      try {
        // Execute scenario with this data
        await executor.executeActions(scenario);

        results.push({
          index: i,
          data: dataRow,
          success: true
        });

        console.log(chalk.green(`    ✓ Dataset ${i + 1} passed`));

      } catch (error) {
        results.push({
          index: i,
          data: dataRow,
          success: false,
          error: error.message
        });

        console.error(chalk.red(`    ✗ Dataset ${i + 1} failed: ${error.message}`));

        if (!executor.options.continueOnError) {
          throw error;
        }
      }

      // Clear data row
      executor.context.dataRow = null;
    }

    // Summary
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(chalk.cyan(`\n  📊 Data-driven test summary:`));
    console.log(chalk.green(`    ✓ Passed: ${passed}/${data.length}`));

    if (failed > 0) {
      console.log(chalk.red(`    ✗ Failed: ${failed}/${data.length}`));
    }

    return results;
  }

  /**
   * Infer data source type from source string
   * @param {string} source - Data source string
   * @returns {string} Inferred type
   */
  inferType(source) {
    if (!source) return 'unknown';

    const lowerSource = source.toLowerCase();

    // Check for file extensions
    if (lowerSource.endsWith('.csv')) {
      return 'csv';
    }
    if (lowerSource.endsWith('.json')) {
      return 'json';
    }

    // Check for protocols
    if (lowerSource.startsWith('http://') || lowerSource.startsWith('https://')) {
      // Could be API or JSON URL
      if (lowerSource.includes('.json')) {
        return 'json';
      }
      return 'api';
    }

    // Check for SQL queries
    if (lowerSource.includes('select ') || lowerSource.includes('from ')) {
      return 'database';
    }

    // Check for database file extensions
    if (lowerSource.endsWith('.db') || lowerSource.endsWith('.sqlite')) {
      return 'database';
    }

    return 'unknown';
  }

  /**
   * Get adapter instance
   * @param {string} type - Adapter type
   * @param {Object} options - Adapter options
   * @returns {Object} Adapter instance
   */
  getAdapter(type, options = {}) {
    switch (type.toLowerCase()) {
      case 'csv':
        return options ? new CSVAdapter(options) : this.adapters.csv;

      case 'json':
        return options ? new JSONAdapter(options) : this.adapters.json;

      case 'database':
      case 'db':
      case 'sql':
        return options ? new DatabaseAdapter(options) : this.adapters.database;

      case 'api':
      case 'rest':
      case 'http':
        return options ? new APIAdapter(options) : this.adapters.api;

      default:
        return null;
    }
  }

  /**
   * Transform data with mapping function
   * @param {Array} data - Source data
   * @param {Function|Object} transformer - Transform function or mapping
   * @returns {Array} Transformed data
   */
  transform(data, transformer) {
    if (typeof transformer === 'function') {
      return data.map(transformer);
    }

    if (typeof transformer === 'object') {
      // Object mapping
      return data.map(item => {
        const transformed = {};

        for (const [newKey, oldKey] of Object.entries(transformer)) {
          if (typeof oldKey === 'function') {
            transformed[newKey] = oldKey(item);
          } else {
            transformed[newKey] = item[oldKey];
          }
        }

        return transformed;
      });
    }

    return data;
  }

  /**
   * Filter data
   * @param {Array} data - Source data
   * @param {Function|Object} filter - Filter function or criteria
   * @returns {Array} Filtered data
   */
  filter(data, filter) {
    if (typeof filter === 'function') {
      return data.filter(filter);
    }

    if (typeof filter === 'object') {
      // Object criteria filter
      return data.filter(item => {
        for (const [key, value] of Object.entries(filter)) {
          if (item[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return data;
  }

  /**
   * Combine multiple data sources
   * @param {Array<string|Object>} sources - Array of data sources
   * @returns {Promise<Array>} Combined data
   */
  async combine(sources) {
    console.log(chalk.cyan(`  🔗 Combining ${sources.length} data sources`));

    const allData = [];

    for (const source of sources) {
      const data = await this.load(source);
      allData.push(...data);
    }

    console.log(chalk.gray(`    ✓ Combined ${allData.length} total items`));
    return allData;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Close database connections
    if (this.adapters.database.db) {
      this.adapters.database.close();
    }
  }
}

module.exports = { DataIterator };