const axios = require('axios');
const chalk = require('chalk');

class APIAdapter {
  constructor(options = {}) {
    this.options = {
      baseURL: options.baseURL || '',
      headers: options.headers || {},
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      retryDelay: options.retryDelay || 1000,
      ...options
    };

    // Create axios instance with defaults
    this.client = axios.create({
      baseURL: this.options.baseURL,
      headers: this.options.headers,
      timeout: this.options.timeout
    });
  }

  /**
   * Load data from API endpoint
   * @param {string} source - API endpoint or full URL
   * @returns {Promise<Array>} API response data
   */
  async load(source) {
    const url = source.startsWith('http') ? source : `${this.options.baseURL}${source}`;
    console.log(chalk.gray(`  🌐 Loading from API: ${url}`));

    let lastError;
    let attempt = 0;

    while (attempt < this.options.retries) {
      attempt++;

      try {
        const response = await this.client.get(source, {
          params: this.options.params,
          headers: {
            ...this.options.headers,
            ...(this.options.auth ? { Authorization: `Bearer ${this.options.auth}` } : {})
          }
        });

        let data = response.data;

        // Extract data from nested path if specified
        if (this.options.dataPath) {
          data = this.extractNestedData(data, this.options.dataPath);
        }

        // Ensure data is an array
        if (!Array.isArray(data)) {
          if (typeof data === 'object' && data !== null) {
            // Check for common API patterns
            if (data.data && Array.isArray(data.data)) {
              data = data.data;
            } else if (data.results && Array.isArray(data.results)) {
              data = data.results;
            } else if (data.items && Array.isArray(data.items)) {
              data = data.items;
            } else {
              // Convert object to array
              data = [data];
            }
          } else {
            data = [data];
          }
        }

        console.log(chalk.gray(`    ✓ Loaded ${data.length} items from API`));
        return data;

      } catch (error) {
        lastError = error;
        console.warn(chalk.yellow(`    ⚠️ Attempt ${attempt} failed: ${error.message}`));

        if (attempt < this.options.retries) {
          console.log(chalk.gray(`    ⏳ Retrying in ${this.options.retryDelay}ms...`));
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
        }
      }
    }

    throw new Error(`Failed to load from API after ${this.options.retries} attempts: ${lastError.message}`);
  }

  /**
   * Extract nested data from response
   * @param {Object} data - Response data
   * @param {string} path - Dot-notation path
   * @returns {any} Nested data
   */
  extractNestedData(data, path) {
    const keys = path.split('.');
    let current = data;

    for (const key of keys) {
      if (current[key] === undefined) {
        throw new Error(`Path "${path}" not found in API response`);
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Iterate over API data
   * @param {string} source - API endpoint
   * @param {Function} callback - Callback for each item
   */
  async iterate(source, callback) {
    const data = await this.load(source);

    for (let i = 0; i < data.length; i++) {
      await callback(data[i], i);
    }
  }

  /**
   * Load paginated API data
   * @param {string} source - API endpoint
   * @param {Object} paginationConfig - Pagination configuration
   * @returns {Promise<Array>} All paginated data
   */
  async loadPaginated(source, paginationConfig = {}) {
    const {
      pageParam = 'page',
      limitParam = 'limit',
      pageSize = 100,
      maxPages = 10,
      offsetBased = false
    } = paginationConfig;

    console.log(chalk.gray(`  📄 Loading paginated data from API: ${source}`));

    const allData = [];
    let currentPage = offsetBased ? 0 : 1;
    let hasMore = true;

    while (hasMore && currentPage <= maxPages) {
      const params = {
        ...this.options.params
      };

      if (offsetBased) {
        params[pageParam] = (currentPage - 1) * pageSize;
        params[limitParam] = pageSize;
      } else {
        params[pageParam] = currentPage;
        params[limitParam] = pageSize;
      }

      try {
        const response = await this.client.get(source, { params });
        let pageData = response.data;

        // Extract data array from response
        if (this.options.dataPath) {
          pageData = this.extractNestedData(pageData, this.options.dataPath);
        } else if (pageData.data && Array.isArray(pageData.data)) {
          pageData = pageData.data;
        } else if (pageData.results && Array.isArray(pageData.results)) {
          pageData = pageData.results;
        }

        if (!Array.isArray(pageData)) {
          pageData = [pageData];
        }

        allData.push(...pageData);

        console.log(chalk.gray(`    ✓ Loaded page ${currentPage} (${pageData.length} items)`));

        // Check if there are more pages
        hasMore = pageData.length === pageSize;
        currentPage++;

      } catch (error) {
        console.error(chalk.red(`    ✗ Failed to load page ${currentPage}: ${error.message}`));
        hasMore = false;
      }
    }

    console.log(chalk.gray(`    ✓ Total items loaded: ${allData.length}`));
    return allData;
  }

  /**
   * Post data to API
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Data to post
   * @returns {Promise<Object>} API response
   */
  async post(endpoint, data) {
    console.log(chalk.gray(`  📤 Posting to API: ${endpoint}`));

    try {
      const response = await this.client.post(endpoint, data);
      console.log(chalk.gray(`    ✓ Posted successfully`));
      return response.data;
    } catch (error) {
      throw new Error(`API POST failed: ${error.message}`);
    }
  }

  /**
   * Load data with authentication
   * @param {string} source - API endpoint
   * @param {Object} authConfig - Authentication configuration
   * @returns {Promise<Array>} Authenticated API data
   */
  async loadWithAuth(source, authConfig) {
    const { type = 'bearer', token, apiKey, username, password } = authConfig;

    const headers = { ...this.options.headers };

    switch (type.toLowerCase()) {
      case 'bearer':
        headers.Authorization = `Bearer ${token}`;
        break;

      case 'apikey':
        headers['X-API-Key'] = apiKey;
        break;

      case 'basic':
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        headers.Authorization = `Basic ${auth}`;
        break;

      default:
        throw new Error(`Unknown auth type: ${type}`);
    }

    // Create new client with auth headers
    const authClient = axios.create({
      baseURL: this.options.baseURL,
      headers,
      timeout: this.options.timeout
    });

    const tempClient = this.client;
    this.client = authClient;

    try {
      const data = await this.load(source);
      return data;
    } finally {
      this.client = tempClient;
    }
  }

  /**
   * Load data with GraphQL query
   * @param {string} endpoint - GraphQL endpoint
   * @param {string} query - GraphQL query
   * @param {Object} variables - Query variables
   * @returns {Promise<any>} GraphQL response data
   */
  async loadGraphQL(endpoint, query, variables = {}) {
    console.log(chalk.gray(`  🔮 Executing GraphQL query`));

    try {
      const response = await this.client.post(endpoint, {
        query,
        variables
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      const data = response.data.data;
      console.log(chalk.gray(`    ✓ GraphQL query successful`));

      return data;
    } catch (error) {
      throw new Error(`GraphQL query failed: ${error.message}`);
    }
  }
}

module.exports = { APIAdapter };