const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { KeywordLoader } = require('./keyword-loader');
const { KeywordExecutor } = require('./keyword-executor');

/**
 * KeywordManager - Core engine for managing reusable test keywords
 *
 * Enables defining reusable test components that can be parameterized,
 * chained, and imported across test files.
 */
class KeywordManager {
  constructor(context) {
    this.context = context;
    this.keywords = new Map();
    this.loader = new KeywordLoader();
    this.executor = new KeywordExecutor(context, this);
    this.builtInKeywords = new Map();

    // Initialize built-in keywords
    this.registerBuiltInKeywords();
  }

  /**
   * Register built-in keywords that are always available
   */
  registerBuiltInKeywords() {
    // Setup keywords
    this.registerKeyword('setup-account', {
      params: ['name', 'balance'],
      steps: [
        { action: 'create-account', args: ['{{name}}', '{{balance}}'] }
      ],
      description: 'Create an account with initial balance'
    });

    // Assertion keywords
    this.registerKeyword('check-balance', {
      params: ['account', 'expected'],
      steps: [
        { action: 'get', args: ['balance', '{{account}}.balance'] },
        { action: 'assert', args: ['balance == {{expected}}'] }
      ],
      description: 'Check account balance'
    });

    // Token keywords
    this.registerKeyword('setup-token', {
      params: ['name', 'symbol', 'supply'],
      steps: [
        { action: 'deploy', args: ['token', 'ERC20', ['{{name}}', '{{symbol}}', '{{supply}}']] },
        { action: 'return', args: ['token'] }
      ],
      description: 'Deploy a standard ERC20 token'
    });

    // Transfer keywords
    this.registerKeyword('batch-transfer', {
      params: ['from', 'recipients', 'amount'],
      steps: [
        {
          action: 'foreach',
          args: ['recipient', '{{recipients}}'],
          do: [
            { action: 'transfer', args: ['{{from}}', '{{recipient}}', '{{amount}}'] }
          ]
        }
      ],
      description: 'Transfer to multiple recipients'
    });
  }

  /**
   * Register a new keyword
   */
  registerKeyword(name, definition) {
    // Validate keyword definition
    if (!definition.steps || !Array.isArray(definition.steps)) {
      throw new Error(`Keyword '${name}' must have a 'steps' array`);
    }

    // Store keyword
    this.keywords.set(name, {
      name,
      params: definition.params || [],
      steps: definition.steps,
      description: definition.description || '',
      returns: definition.returns || null
    });

    return true;
  }

  /**
   * Load keywords from YAML file
   */
  async loadKeywordsFromFile(filePath) {
    const keywords = await this.loader.loadFromFile(filePath);

    for (const [name, definition] of Object.entries(keywords)) {
      this.registerKeyword(name, definition);
    }

    return Object.keys(keywords).length;
  }

  /**
   * Load all keywords from a directory
   */
  async loadKeywordsFromDirectory(dirPath) {
    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    let totalLoaded = 0;
    for (const file of files) {
      const loaded = await this.loadKeywordsFromFile(path.join(dirPath, file));
      totalLoaded += loaded;
    }

    return totalLoaded;
  }

  /**
   * Execute a keyword with given parameters
   */
  async executeKeyword(name, params = [], testContext = null) {
    const keyword = this.keywords.get(name);

    if (!keyword) {
      // Try to load from standard library
      await this.tryLoadStandardKeyword(name);

      if (!this.keywords.has(name)) {
        throw new Error(`Unknown keyword: ${name}`);
      }
    }

    // Use provided context or create temporary one
    const ctx = testContext || this.context;

    // Execute keyword
    return await this.executor.execute(keyword, params, ctx);
  }

  /**
   * Try to load a keyword from standard library
   */
  async tryLoadStandardKeyword(name) {
    const standardPaths = [
      path.join(__dirname, '../../templates/keywords/common.yaml'),
      path.join(__dirname, '../../templates/keywords/defi.yaml'),
      path.join(__dirname, '../../templates/keywords/testing.yaml')
    ];

    for (const libPath of standardPaths) {
      if (fs.existsSync(libPath)) {
        try {
          const content = fs.readFileSync(libPath, 'utf8');
          const keywords = yaml.load(content);

          if (keywords[name]) {
            this.registerKeyword(name, keywords[name]);
            return true;
          }
        } catch (error) {
          // Continue to next library
        }
      }
    }

    return false;
  }

  /**
   * Get keyword definition
   */
  getKeyword(name) {
    return this.keywords.get(name);
  }

  /**
   * List all available keywords
   */
  listKeywords() {
    return Array.from(this.keywords.keys()).sort();
  }

  /**
   * Get keyword documentation
   */
  getKeywordDocs(name) {
    const keyword = this.keywords.get(name);
    if (!keyword) return null;

    return {
      name: keyword.name,
      description: keyword.description,
      params: keyword.params,
      returns: keyword.returns,
      steps: keyword.steps.length
    };
  }

  /**
   * Validate keyword syntax
   */
  validateKeyword(definition) {
    const errors = [];

    if (!definition.steps || !Array.isArray(definition.steps)) {
      errors.push('Keyword must have a steps array');
    }

    if (definition.params && !Array.isArray(definition.params)) {
      errors.push('Params must be an array');
    }

    // Validate parameter references in steps
    if (definition.params && definition.steps) {
      for (const step of definition.steps) {
        const stepStr = JSON.stringify(step);
        for (const param of definition.params) {
          const pattern = `{{${param}}}`;
          if (!stepStr.includes(pattern) && definition.params.length > 0) {
            // Warning, not error - param might be optional
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Chain multiple keywords together
   */
  async chainKeywords(keywordCalls, context) {
    const results = [];
    let lastResult = null;

    for (const call of keywordCalls) {
      const { keyword, params } = call;

      // Replace $last with previous result
      const processedParams = params.map(p =>
        p === '$last' ? lastResult : p
      );

      const result = await this.executeKeyword(keyword, processedParams, context);
      results.push(result);
      lastResult = result;
    }

    return results;
  }

  /**
   * Create a new composite keyword from existing ones
   */
  composeKeyword(name, keywordCalls, description = '') {
    const steps = keywordCalls.map(call => ({
      action: 'run-keyword',
      keyword: call.keyword,
      params: call.params
    }));

    this.registerKeyword(name, {
      steps,
      description: description || `Composite keyword: ${keywordCalls.map(c => c.keyword).join(' -> ')}`
    });
  }

  /**
   * Export keywords to file
   */
  exportKeywords(filePath, keywordNames = null) {
    const toExport = {};
    const names = keywordNames || Array.from(this.keywords.keys());

    for (const name of names) {
      const keyword = this.keywords.get(name);
      if (keyword && !this.builtInKeywords.has(name)) {
        toExport[name] = {
          params: keyword.params,
          steps: keyword.steps,
          description: keyword.description,
          returns: keyword.returns
        };
      }
    }

    fs.writeFileSync(filePath, yaml.dump(toExport), 'utf8');
    return Object.keys(toExport).length;
  }

  /**
   * Clear all custom keywords (keep built-in)
   */
  clearCustomKeywords() {
    for (const name of this.keywords.keys()) {
      if (!this.builtInKeywords.has(name)) {
        this.keywords.delete(name);
      }
    }
  }
}

module.exports = { KeywordManager };