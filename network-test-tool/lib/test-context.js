const { ethers } = require('ethers');
const chalk = require('chalk');

class TestContext {
  constructor() {
    this.variables = new Map();
    this.accounts = new Map();
    this.contracts = new Map();
    this.transactions = new Map();
    this.metrics = new Map();
    this.results = [];
    this.currentNetwork = null;
    this.provider = null;
    this.dataRow = null; // Current data row for data-driven testing
  }

  /**
   * Set a variable in the context
   * @param {string} name - Variable name
   * @param {any} value - Variable value
   */
  setVariable(name, value) {
    this.variables.set(name, value);
    console.log(chalk.gray(`  Set ${name} = ${JSON.stringify(value)}`));
  }

  /**
   * Get a variable from context
   * @param {string} name - Variable name
   * @returns {any} Variable value
   */
  getVariable(name) {
    if (this.variables.has(name)) {
      return this.variables.get(name);
    }

    // Check if it's a data field reference
    if (this.dataRow && this.dataRow[name] !== undefined) {
      return this.dataRow[name];
    }

    // Check accounts and contracts
    if (this.accounts.has(name)) {
      return this.accounts.get(name);
    }
    if (this.contracts.has(name)) {
      return this.contracts.get(name);
    }

    return undefined;
  }

  /**
   * Register an account
   * @param {string} name - Account name
   * @param {Object} account - Account object (signer or address)
   */
  setAccount(name, account) {
    this.accounts.set(name, account);
  }

  /**
   * Get an account by name
   * @param {string} name - Account name
   * @returns {Object} Account object
   */
  getAccount(name) {
    return this.accounts.get(name);
  }

  /**
   * Register a contract
   * @param {string} name - Contract name
   * @param {Object} contract - Contract instance
   */
  setContract(name, contract) {
    this.contracts.set(name, contract);
  }

  /**
   * Get a contract by name
   * @param {string} name - Contract name
   * @returns {Object} Contract instance
   */
  getContract(name) {
    return this.contracts.get(name);
  }

  /**
   * Store a transaction result
   * @param {string} id - Transaction identifier
   * @param {Object} tx - Transaction object
   */
  setTransaction(id, tx) {
    this.transactions.set(id, tx);
  }

  /**
   * Get a transaction by id
   * @param {string} id - Transaction identifier
   * @returns {Object} Transaction object
   */
  getTransaction(id) {
    return this.transactions.get(id);
  }

  /**
   * Resolve a reference to its value
   * @param {string|any} ref - Reference to resolve
   * @returns {any} Resolved value
   */
  async resolveReference(ref) {
    // Handle undefined or null references
    if (ref === undefined || ref === null) {
      return ref;
    }
    // If not a string, return as-is
    if (typeof ref !== 'string') {
      return ref;
    }

    // Check for template syntax {{variable}} or {variable}
    if (ref && ((ref.includes('{{') && ref.includes('}}')) || (ref.includes('{') && ref.includes('}')))) {
      let resolved = ref;

      // Handle double braces {{variable}}
      const doubleMatches = ref.match(/\{\{([^}]+)\}\}/g);
      if (doubleMatches) {
        for (const match of doubleMatches) {
          const varName = match.slice(2, -2).trim();
          const value = await this.resolveReference(varName);
          resolved = resolved.replace(match, value !== undefined ? value : match);
        }
      }

      // Handle single braces {variable} (but not if already processed by double braces)
      if (!doubleMatches) {
        const singleMatches = ref.match(/\{([^}]+)\}/g);
        if (singleMatches) {
          for (const match of singleMatches) {
            const varName = match.slice(1, -1).trim();
            const value = await this.resolveReference(varName);
            resolved = resolved.replace(match, value !== undefined ? value : match);
          }
        }
      }

      return resolved;
    }

    // Check for environment variables (env:VAR_NAME)
    if (ref.startsWith('env:')) {
      const envVar = ref.substring(4);
      const value = process.env[envVar];
      if (value === undefined) {
        console.warn(`Environment variable ${envVar} not found`);
      }
      return value;
    }

    // Check for literal values
    if (/^\d+(\.\d+)?$/.test(ref)) {
      return parseFloat(ref);
    }
    if (/^0x[0-9a-fA-F]+$/i.test(ref)) {
      return ref; // Return hex as-is
    }
    if (/^["'](.*)["']$/.test(ref)) {
      return ref.slice(1, -1); // Remove quotes
    }
    if (ref === 'true' || ref === 'false') {
      return ref === 'true';
    }

    // Check for property access (e.g., token.address, alice.balance)
    if (ref && ref.includes('.')) {
      const parts = ref.split('.');
      let obj = this.resolveSimpleReference(parts[0]);

      for (let i = 1; i < parts.length; i++) {
        if (obj === undefined) break;

        const prop = parts[i];

        // Handle method calls
        if (prop.endsWith('()')) {
          const methodName = prop.slice(0, -2);
          if (typeof obj[methodName] === 'function') {
            obj = await obj[methodName]();
          } else {
            obj = obj[methodName];
          }
        } else if (prop.includes('(')) {
          // Handle method calls with arguments
          const match = prop.match(/^(\w+)\((.*)\)$/);
          if (match) {
            const [, methodName, argsStr] = match;
            const args = argsStr ? await this.parseArguments(argsStr) : [];
            if (typeof obj[methodName] === 'function') {
              obj = await obj[methodName](...args);
            }
          }
        } else {
          // Simple property access
          obj = obj[prop];
        }
      }

      return obj;
    }

    // Check for function calls (like Account(), timestamp(), etc.)
    if (ref.includes('(') && ref.includes(')')) {
      // Process functions first
      const processed = await this.processFunctions(ref);
      // If the function returned something different, use that
      if (processed !== ref) {
        // If it's a string that looks like JSON or an address, parse/return it
        if (typeof processed === 'string' && processed.startsWith('"') && processed.endsWith('"')) {
          return processed.slice(1, -1);
        }
        return processed;
      }
    }

    // Check for expressions
    if (this.isExpression(ref)) {
      return await this.evaluateExpression(ref);
    }

    // Simple reference
    const resolved = this.resolveSimpleReference(ref);

    // If not found as reference, return the string itself (for log messages etc.)
    if (resolved === undefined) {
      return ref;
    }

    return resolved;
  }

  /**
   * Resolve a simple reference
   * @param {string} ref - Simple reference name
   * @returns {any} Resolved value
   */
  resolveSimpleReference(ref) {
    // Check variables first
    if (this.variables.has(ref)) {
      return this.variables.get(ref);
    }

    // Check accounts
    if (this.accounts.has(ref)) {
      return this.accounts.get(ref);
    }

    // Check contracts
    if (this.contracts.has(ref)) {
      return this.contracts.get(ref);
    }

    // Check data row
    if (this.dataRow && this.dataRow[ref] !== undefined) {
      return this.dataRow[ref];
    }

    // Check for special variables
    if (ref === 'provider') return this.provider;
    if (ref === 'network') return this.currentNetwork;
    if (ref === 'timestamp') return Date.now();
    if (ref === 'block') return this.provider?.getBlockNumber();

    // Return undefined if not found
    return undefined;
  }

  /**
   * Check if a string is an expression
   * @param {string} str - String to check
   * @returns {boolean} Whether it's an expression
   */
  isExpression(str) {
    // Skip simple strings that don't look like expressions
    if (typeof str !== 'string') return false;

    // Skip strings that are clearly text messages (contain common words)
    const commonWords = /\b(the|and|or|is|are|was|were|in|on|at|to|from|for|with|by|this|that|these|those|completed|done|test|transfer|contract|deployment|user|cross|basic|simple|started|finished|success|failed|transfers)\b/i;
    if (commonWords.test(str)) {
      // If it contains common words, only treat as expression if it has mathematical operators not in hyphenated words
      const hasRealMathOps = /\s[+\-*/%]\s|[<>=!]/.test(str);
      if (!hasRealMathOps) {
        return false;
      }
    }

    // Check for mathematical operators (with spaces to avoid hyphenated words)
    if (/\s[+\-*/%]\s/.test(str)) return true;

    // Check for comparison operators
    if (/[<>!=]=?/.test(str)) return true;

    // Check for logical operators with proper word boundaries
    if (/\b(and|or|not)\b/i.test(str) && /[+\-*/%<>=!]/.test(str)) return true;

    // Check for function calls like exists(), avg(), etc.
    if (/\b(exists|avg|sum|min|max|random|randomAddress)\s*\(/.test(str)) return true;

    return false;
  }

  /**
   * Evaluate an expression
   * @param {string} expr - Expression to evaluate
   * @returns {any} Expression result
   */
  async evaluateExpression(expr) {
    // Check for special keywords
    if (expr === 'REVERT' || expr === 'FAIL') {
      return 'REVERT'; // Special value for expecting failures
    }

    // Simple expression evaluator
    // In production, use a proper expression parser like math.js or expr-eval

    let processedExpr = expr;

    // Replace function calls first
    processedExpr = await this.processFunctions(processedExpr);

    // Replace variable references in the expression
    const varPattern = /\b([a-zA-Z_]\w*(?:\.\w+)*)\b/g;
    const matches = expr.match(varPattern) || [];

    for (const match of matches) {
      // Skip JavaScript keywords and our custom functions
      if (['true', 'false', 'null', 'undefined', 'and', 'or', 'not',
           'random', 'randomAddress', 'exists', 'avg', 'sum', 'min', 'max'].includes(match)) {
        continue;
      }

      const value = await this.resolveReference(match);
      if (value !== undefined) {
        // Convert to appropriate string representation
        if (typeof value === 'string') {
          processedExpr = processedExpr.replace(new RegExp(`\\b${match}\\b`, 'g'), `"${value}"`);
        } else if (typeof value === 'object' && value.address) {
          processedExpr = processedExpr.replace(new RegExp(`\\b${match}\\b`, 'g'), `"${value.address}"`);
        } else {
          processedExpr = processedExpr.replace(new RegExp(`\\b${match}\\b`, 'g'), JSON.stringify(value));
        }
      }
    }

    // Replace logical operators
    processedExpr = processedExpr
      .replace(/\band\b/gi, '&&')
      .replace(/\bor\b/gi, '||')
      .replace(/\bnot\b/gi, '!');

    try {
      // Use Function constructor for safer evaluation than eval
      // In production, use a proper sandboxed evaluator
      const result = new Function('return ' + processedExpr)();
      return result;
    } catch (error) {
      throw new Error(`Failed to evaluate expression: ${expr}\n  Processed: ${processedExpr}\n  Error: ${error.message}`);
    }
  }

  /**
   * Process function calls in expression
   * @param {string} expr - Expression with functions
   * @returns {string} Processed expression
   */
  async processFunctions(expr) {
    let processed = expr;

    // Account() function - create new funded account
    processed = await this.processAccountFunction(processed);

    // timestamp() function - returns current Unix timestamp in seconds
    processed = processed.replace(/timestamp\(\)/g, () => {
      return Math.floor(Date.now() / 1000);
    });

    // random(min, max) function
    processed = processed.replace(/random\(([^,]+),\s*([^)]+)\)/g, (match, min, max) => {
      const minVal = parseFloat(min);
      const maxVal = parseFloat(max);
      return Math.random() * (maxVal - minVal) + minVal;
    });

    // randomAddress() function
    processed = processed.replace(/randomAddress\(\)/g, () => {
      return `"0x${[...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}"`;
    });

    // exists(variable) function
    processed = processed.replace(/exists\(([^)]+)\)/g, (match, varName) => {
      const cleanName = varName.replace(/['"]/g, '').trim();
      const value = this.getVariable(cleanName);
      return value !== undefined ? 'true' : 'false';
    });

    // typeof(variable) function - returns the type of a variable
    processed = processed.replace(/typeof\(([^)]+)\)/g, (match, varName) => {
      const cleanName = varName.replace(/['"]/g, '').trim();
      const value = this.getVariable(cleanName);
      if (value === undefined) return '"undefined"';
      if (value === null) return '"null"';
      if (Array.isArray(value)) return '"array"';
      return `"${typeof value}"`;
    });

    // balance(account) function - get ETH balance of an account
    processed = await this.processBalanceFunction(processed);

    // avg(pattern) function
    processed = processed.replace(/avg\(([^)]+)\)/g, (match, pattern) => {
      const values = this.getMatchingValues(pattern);
      if (values.length === 0) return 0;
      const sum = values.reduce((a, b) => a + b, 0);
      return sum / values.length;
    });

    // sum(pattern) function
    processed = processed.replace(/sum\(([^)]+)\)/g, (match, pattern) => {
      const values = this.getMatchingValues(pattern);
      return values.reduce((a, b) => a + b, 0);
    });

    // min(pattern) function
    processed = processed.replace(/min\(([^)]+)\)/g, (match, pattern) => {
      const values = this.getMatchingValues(pattern);
      return values.length > 0 ? Math.min(...values) : 0;
    });

    // max(pattern) function
    processed = processed.replace(/max\(([^)]+)\)/g, (match, pattern) => {
      const values = this.getMatchingValues(pattern);
      return values.length > 0 ? Math.max(...values) : 0;
    });

    return processed;
  }

  /**
   * Get values matching a pattern
   * @param {string} pattern - Pattern to match (e.g., "metric-*")
   * @returns {Array<number>} Matching values
   */
  getMatchingValues(pattern) {
    const cleanPattern = pattern.replace(/['"]/g, '').trim();
    const regex = new RegExp(cleanPattern.replace('*', '.*'));
    const values = [];

    for (const [key, value] of this.metrics) {
      if (regex.test(key)) {
        const nums = value.map(v => typeof v.value === 'number' ? v.value : 0);
        values.push(...nums);
      }
    }

    for (const [key, value] of this.variables) {
      if (regex.test(key) && typeof value === 'number') {
        values.push(value);
      }
    }

    return values;
  }

  /**
   * Generate a random value
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random value
   */
  random(min = 0, max = 1) {
    return Math.random() * (max - min) + min;
  }

  /**
   * Generate a random Ethereum address
   * @returns {string} Random address
   */
  randomAddress() {
    return '0x' + [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  /**
   * Check if a variable exists
   * @param {string} name - Variable name
   * @returns {boolean} Whether variable exists
   */
  exists(name) {
    return this.getVariable(name) !== undefined;
  }

  /**
   * Parse function arguments from a string
   * @param {string} argsStr - Arguments string
   * @returns {Array} Parsed arguments
   */
  async parseArguments(argsStr) {
    const args = [];
    const parts = argsStr.split(',').map(s => s.trim());

    for (const part of parts) {
      args.push(await this.resolveReference(part));
    }

    return args;
  }

  /**
   * Format an amount for display
   * @param {string|number} amount - Amount to format
   * @param {string} unit - Unit (e.g., 'ETH', 'gwei')
   * @returns {string} Formatted amount
   */
  formatAmount(amount, unit = 'ETH') {
    try {
      if (unit.toUpperCase() === 'ETH') {
        return ethers.utils.formatEther(amount);
      } else if (unit.toLowerCase() === 'gwei') {
        return ethers.utils.formatUnits(amount, 'gwei');
      } else {
        return amount.toString();
      }
    } catch {
      return amount.toString();
    }
  }

  /**
   * Parse an amount with unit
   * @param {string} amountStr - Amount string (e.g., '1 ETH', '1000 gwei')
   * @returns {Object} Parsed amount and unit
   */
  parseAmount(amountStr) {
    const match = amountStr.match(/^([\d.]+)\s*(\w+)?$/);
    if (!match) {
      throw new Error(`Invalid amount format: ${amountStr}`);
    }

    const [, value, unit = 'wei'] = match;
    let amount;

    if (unit.toUpperCase() === 'ETH') {
      amount = ethers.utils.parseEther(value);
    } else if (unit.toLowerCase() === 'gwei') {
      amount = ethers.utils.parseUnits(value, 'gwei');
    } else if (unit.toLowerCase() === 'wei') {
      amount = ethers.BigNumber.from(value);
    } else {
      // Assume it's a token amount with decimals
      amount = value;
    }

    return { amount, unit };
  }

  /**
   * Record a metric
   * @param {string} name - Metric name
   * @param {any} value - Metric value
   */
  recordMetric(name, value) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push({
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Get metrics summary
   * @returns {Object} Metrics summary
   */
  getMetricsSummary() {
    const summary = {};

    for (const [name, values] of this.metrics) {
      const nums = values.map(v => typeof v.value === 'number' ? v.value : 0);
      summary[name] = {
        count: values.length,
        min: Math.min(...nums),
        max: Math.max(...nums),
        avg: nums.reduce((a, b) => a + b, 0) / nums.length,
        last: values[values.length - 1]?.value
      };
    }

    return summary;
  }

  /**
   * Add a test result
   * @param {Object} result - Test result object
   */
  addResult(result) {
    this.results.push({
      ...result,
      timestamp: Date.now(),
      network: this.currentNetwork
    });
  }

  /**
   * Get all test results
   * @returns {Array} Test results
   */
  getResults() {
    return this.results;
  }

  /**
   * Process Account() function calls - create new funded accounts
   * @param {string} text - Text containing Account() calls
   * @returns {string} Processed text with new account addresses
   */
  async processAccountFunction(text) {
    const accountRegex = /Account\(([^)]*)\)/g;
    const matches = [...text.matchAll(accountRegex)];

    let processed = text;
    for (const match of matches) {
      const funding = match[1] ? match[1].replace(/['"]/g, '').trim() : '10 ETH';

      try {
        // Create new wallet
        const { ethers } = require('ethers');
        const wallet = ethers.Wallet.createRandom().connect(this.provider);

        // Parse funding amount
        let fundingAmount;
        if (funding.includes('ETH')) {
          const amount = parseFloat(funding.replace('ETH', '').trim()) || 10;
          fundingAmount = ethers.utils.parseEther(amount.toString());
        } else {
          fundingAmount = ethers.BigNumber.from(funding);
        }

        // Fund the new account from the main account
        if (this.signer && fundingAmount.gt(0)) {
          const tx = await this.signer.sendTransaction({
            to: wallet.address,
            value: fundingAmount
          });
          await tx.wait();
          console.log(`Created and funded account ${wallet.address} with ${funding}`);
        }

        // Store the wallet in accounts
        const accountName = `account_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        this.accounts = this.accounts || {};
        this.accounts[accountName] = wallet;

        // Replace the Account() call with the address
        processed = processed.replace(match[0], `"${wallet.address}"`);
      } catch (error) {
        console.error(`Failed to create account: ${error.message}`);
        processed = processed.replace(match[0], 'null');
      }
    }

    return processed;
  }

  /**
   * Process balance() function calls in expressions
   * @param {string} text - Text to process
   * @returns {string} Processed text with balance values
   */
  async processBalanceFunction(text) {
    const balanceRegex = /balance\(([^)]+)\)/g;
    let result = text;
    let match;

    while ((match = balanceRegex.exec(text)) !== null) {
      const accountRef = match[1].trim();

      try {
        // Resolve the account reference
        const account = await this.resolveReference(accountRef);
        let address;

        if (typeof account === 'string') {
          // It's already an address
          address = account;
        } else if (account && account.address) {
          // It's an account object
          address = account.address;
        } else {
          console.warn(`⚠️ Could not resolve account reference: ${accountRef}`);
          continue;
        }

        // Get the balance from the provider
        if (this.provider) {
          const balance = await this.provider.getBalance(address);
          const balanceEth = ethers.utils.formatEther(balance);

          // Replace the balance() call with the actual balance value
          result = result.replace(match[0], balanceEth);

          console.log(`🔍 Resolved balance(${accountRef}) = ${balanceEth} ETH`);
        } else {
          console.warn(`⚠️ No provider available to check balance`);
        }
      } catch (error) {
        console.warn(`⚠️ Error resolving balance for ${accountRef}:`, error.message);
      }
    }

    return result;
  }

  /**
   * Clear the context
   */
  clear() {
    this.variables.clear();
    this.accounts.clear();
    this.contracts.clear();
    this.transactions.clear();
    this.metrics.clear();
    this.results = [];
    this.dataRow = null;
  }

  /**
   * Create a snapshot of current context
   * @returns {Object} Context snapshot
   */
  snapshot() {
    return {
      variables: new Map(this.variables),
      accounts: new Map(this.accounts),
      contracts: new Map(this.contracts),
      transactions: new Map(this.transactions),
      metrics: new Map(this.metrics),
      results: [...this.results],
      currentNetwork: this.currentNetwork,
      dataRow: this.dataRow ? { ...this.dataRow } : null
    };
  }

  /**
   * Restore context from snapshot
   * @param {Object} snapshot - Context snapshot
   */
  restore(snapshot) {
    this.variables = new Map(snapshot.variables);
    this.accounts = new Map(snapshot.accounts);
    this.contracts = new Map(snapshot.contracts);
    this.transactions = new Map(snapshot.transactions);
    this.metrics = new Map(snapshot.metrics);
    this.results = [...snapshot.results];
    this.currentNetwork = snapshot.currentNetwork;
    this.dataRow = snapshot.dataRow ? { ...snapshot.dataRow } : null;
  }
}

module.exports = { TestContext };