const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const chalk = require('chalk');

class CSVAdapter {
  constructor(options = {}) {
    this.options = {
      headers: options.headers !== false,
      delimiter: options.delimiter || ',',
      skipLines: options.skipLines || 0,
      ...options
    };
  }

  /**
   * Load data from CSV file
   * @param {string} source - Path to CSV file
   * @returns {Promise<Array>} Parsed CSV data
   */
  async load(source) {
    const filePath = path.resolve(source);

    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }

    console.log(chalk.gray(`  📄 Loading CSV: ${source}`));

    return new Promise((resolve, reject) => {
      const results = [];
      let lineCount = 0;

      fs.createReadStream(filePath)
        .pipe(csvParser({
          separator: this.options.delimiter,
          headers: this.options.headers,
          skipLines: this.options.skipLines
        }))
        .on('data', (row) => {
          // Convert numeric strings to numbers
          const processedRow = this.processRow(row);
          results.push(processedRow);
          lineCount++;
        })
        .on('end', () => {
          console.log(chalk.gray(`    ✓ Loaded ${lineCount} rows from CSV`));
          resolve(results);
        })
        .on('error', (error) => {
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        });
    });
  }

  /**
   * Process a CSV row
   * @param {Object} row - Raw CSV row
   * @returns {Object} Processed row
   */
  processRow(row) {
    const processed = {};

    for (const [key, value] of Object.entries(row)) {
      // Try to parse as number
      if (/^\d+(\.\d+)?$/.test(value)) {
        processed[key] = parseFloat(value);
      }
      // Try to parse as boolean
      else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
        processed[key] = value.toLowerCase() === 'true';
      }
      // Keep as string
      else {
        processed[key] = value;
      }
    }

    return processed;
  }

  /**
   * Iterate over CSV data
   * @param {string} source - CSV file path
   * @param {Function} callback - Callback for each row
   */
  async iterate(source, callback) {
    const data = await this.load(source);

    for (let i = 0; i < data.length; i++) {
      await callback(data[i], i);
    }
  }

  /**
   * Load and filter CSV data
   * @param {string} source - CSV file path
   * @param {Function} filter - Filter function
   * @returns {Promise<Array>} Filtered data
   */
  async loadFiltered(source, filter) {
    const data = await this.load(source);
    return data.filter(filter);
  }

  /**
   * Load CSV with column mapping
   * @param {string} source - CSV file path
   * @param {Object} columnMap - Column name mapping
   * @returns {Promise<Array>} Mapped data
   */
  async loadWithMapping(source, columnMap) {
    const data = await this.load(source);

    return data.map(row => {
      const mapped = {};

      for (const [oldName, newName] of Object.entries(columnMap)) {
        if (row.hasOwnProperty(oldName)) {
          mapped[newName] = row[oldName];
        }
      }

      // Include unmapped columns
      for (const [key, value] of Object.entries(row)) {
        if (!columnMap[key]) {
          mapped[key] = value;
        }
      }

      return mapped;
    });
  }

  /**
   * Stream large CSV files
   * @param {string} source - CSV file path
   * @param {Function} processor - Row processor function
   * @param {number} batchSize - Batch size for processing
   */
  async stream(source, processor, batchSize = 100) {
    const filePath = path.resolve(source);

    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      let batch = [];
      let totalProcessed = 0;

      fs.createReadStream(filePath)
        .pipe(csvParser({
          separator: this.options.delimiter,
          headers: this.options.headers
        }))
        .on('data', async (row) => {
          batch.push(this.processRow(row));

          if (batch.length >= batchSize) {
            await processor(batch);
            totalProcessed += batch.length;
            batch = [];
          }
        })
        .on('end', async () => {
          // Process remaining batch
          if (batch.length > 0) {
            await processor(batch);
            totalProcessed += batch.length;
          }

          console.log(chalk.gray(`    ✓ Processed ${totalProcessed} rows`));
          resolve(totalProcessed);
        })
        .on('error', reject);
    });
  }
}

module.exports = { CSVAdapter };