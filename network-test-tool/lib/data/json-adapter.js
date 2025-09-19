const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

class JSONAdapter {
  constructor(options = {}) {
    this.options = {
      dataPath: options.dataPath || null, // Path to data array in JSON
      ...options
    };
  }

  /**
   * Load data from JSON file or URL
   * @param {string} source - Path to JSON file or URL
   * @returns {Promise<Array>} Parsed JSON data
   */
  async load(source) {
    let data;

    if (source.startsWith('http://') || source.startsWith('https://')) {
      // Load from URL
      console.log(chalk.gray(`  🌐 Loading JSON from URL: ${source}`));

      try {
        const response = await axios.get(source, {
          timeout: this.options.timeout || 30000
        });
        data = response.data;
      } catch (error) {
        throw new Error(`Failed to fetch JSON from URL: ${error.message}`);
      }
    } else {
      // Load from file
      const filePath = path.resolve(source);

      if (!fs.existsSync(filePath)) {
        throw new Error(`JSON file not found: ${filePath}`);
      }

      console.log(chalk.gray(`  📄 Loading JSON: ${source}`));

      const fileContent = fs.readFileSync(filePath, 'utf8');

      try {
        data = JSON.parse(fileContent);
      } catch (error) {
        throw new Error(`Failed to parse JSON: ${error.message}`);
      }
    }

    // Extract array from nested path if specified
    if (this.options.dataPath) {
      data = this.extractNestedData(data, this.options.dataPath);
    }

    // Ensure data is an array
    if (!Array.isArray(data)) {
      // If it's an object, convert to array of key-value pairs
      if (typeof data === 'object' && data !== null) {
        data = Object.entries(data).map(([key, value]) => ({
          key,
          ...((typeof value === 'object' && !Array.isArray(value)) ? value : { value })
        }));
      } else {
        data = [data]; // Wrap single value in array
      }
    }

    console.log(chalk.gray(`    ✓ Loaded ${data.length} items from JSON`));
    return data;
  }

  /**
   * Extract nested data from object
   * @param {Object} data - Source data
   * @param {string} path - Dot-notation path
   * @returns {any} Nested data
   */
  extractNestedData(data, path) {
    const keys = path.split('.');
    let current = data;

    for (const key of keys) {
      if (current[key] === undefined) {
        throw new Error(`Path "${path}" not found in JSON data`);
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Iterate over JSON data
   * @param {string} source - JSON file path or URL
   * @param {Function} callback - Callback for each item
   */
  async iterate(source, callback) {
    const data = await this.load(source);

    for (let i = 0; i < data.length; i++) {
      await callback(data[i], i);
    }
  }

  /**
   * Load and transform JSON data
   * @param {string} source - JSON file path or URL
   * @param {Function} transformer - Transform function
   * @returns {Promise<Array>} Transformed data
   */
  async loadTransformed(source, transformer) {
    const data = await this.load(source);
    return data.map(transformer);
  }

  /**
   * Load JSON with schema validation
   * @param {string} source - JSON file path or URL
   * @param {Object} schema - JSON schema for validation
   * @returns {Promise<Array>} Validated data
   */
  async loadWithSchema(source, schema) {
    const data = await this.load(source);

    // Simple schema validation (in production, use ajv)
    for (const item of data) {
      for (const [key, type] of Object.entries(schema)) {
        if (typeof item[key] !== type) {
          throw new Error(`Schema validation failed: ${key} should be ${type}`);
        }
      }
    }

    return data;
  }

  /**
   * Load and merge multiple JSON sources
   * @param {Array<string>} sources - Array of JSON sources
   * @returns {Promise<Array>} Merged data
   */
  async loadMultiple(sources) {
    const allData = [];

    for (const source of sources) {
      const data = await this.load(source);
      allData.push(...data);
    }

    console.log(chalk.gray(`    ✓ Loaded ${allData.length} total items from ${sources.length} sources`));
    return allData;
  }

  /**
   * Save data to JSON file
   * @param {Array} data - Data to save
   * @param {string} destination - Output file path
   */
  async save(data, destination) {
    const filePath = path.resolve(destination);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const jsonContent = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonContent, 'utf8');

    console.log(chalk.gray(`    ✓ Saved ${data.length} items to ${destination}`));
  }
}

module.exports = { JSONAdapter };