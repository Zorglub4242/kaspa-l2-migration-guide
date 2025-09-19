const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * KeywordLoader - Loads and parses keyword definitions from various sources
 */
class KeywordLoader {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Load keywords from a YAML file
   */
  async loadFromFile(filePath) {
    const absolutePath = path.resolve(filePath);

    // Check cache
    if (this.cache.has(absolutePath)) {
      return this.cache.get(absolutePath);
    }

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Keyword file not found: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const keywords = this.parseYaml(content, absolutePath);

    // Cache the result
    this.cache.set(absolutePath, keywords);

    return keywords;
  }

  /**
   * Parse YAML content into keyword definitions
   */
  parseYaml(content, sourcePath) {
    try {
      const data = yaml.load(content);

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid keyword file format');
      }

      const keywords = {};

      // Handle both root-level keywords and nested under 'keywords' key
      const keywordData = data.keywords || data;

      for (const [name, definition] of Object.entries(keywordData)) {
        keywords[name] = this.normalizeKeywordDefinition(name, definition, sourcePath);
      }

      return keywords;
    } catch (error) {
      throw new Error(`Failed to parse keyword file: ${error.message}`);
    }
  }

  /**
   * Normalize and validate a keyword definition
   */
  normalizeKeywordDefinition(name, definition, sourcePath) {
    // Handle shorthand syntax
    if (Array.isArray(definition)) {
      // Simple steps array
      return {
        name,
        params: [],
        steps: definition,
        description: `Keyword from ${path.basename(sourcePath)}`,
        source: sourcePath
      };
    }

    // Full definition object
    const normalized = {
      name,
      params: definition.params || definition.parameters || [],
      steps: definition.steps || [],
      description: definition.description || definition.doc || '',
      returns: definition.returns || definition.return || null,
      source: sourcePath
    };

    // Validate required fields
    if (!normalized.steps || !Array.isArray(normalized.steps)) {
      throw new Error(`Keyword '${name}' must have a 'steps' array`);
    }

    if (normalized.steps.length === 0) {
      throw new Error(`Keyword '${name}' must have at least one step`);
    }

    // Process steps to ensure consistent format
    normalized.steps = this.normalizeSteps(normalized.steps);

    return normalized;
  }

  /**
   * Normalize step definitions to consistent format
   */
  normalizeSteps(steps) {
    return steps.map(step => {
      // String shorthand: "action: args"
      if (typeof step === 'string') {
        const colonIndex = step.indexOf(':');
        if (colonIndex > 0) {
          return {
            action: step.substring(0, colonIndex).trim(),
            args: [step.substring(colonIndex + 1).trim()]
          };
        }
        return { action: step, args: [] };
      }

      // Object format
      if (typeof step === 'object' && step !== null) {
        // Handle various action formats
        if (step.action) {
          return {
            action: step.action,
            args: step.args || step.params || step.arguments || [],
            ...step
          };
        }

        // Handle single-key actions like { transfer: "alice -> bob, 100" }
        const keys = Object.keys(step);
        if (keys.length === 1) {
          const action = keys[0];
          return {
            action,
            args: Array.isArray(step[action]) ? step[action] : [step[action]]
          };
        }

        return step;
      }

      throw new Error(`Invalid step format: ${JSON.stringify(step)}`);
    });
  }

  /**
   * Load keywords from a JSON file
   */
  async loadFromJson(filePath) {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Keyword file not found: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const data = JSON.parse(content);

    const keywords = {};
    const keywordData = data.keywords || data;

    for (const [name, definition] of Object.entries(keywordData)) {
      keywords[name] = this.normalizeKeywordDefinition(name, definition, absolutePath);
    }

    return keywords;
  }

  /**
   * Load keywords from inline definition in test file
   */
  loadFromInline(definitions) {
    const keywords = {};

    for (const [name, definition] of Object.entries(definitions)) {
      keywords[name] = this.normalizeKeywordDefinition(name, definition, 'inline');
    }

    return keywords;
  }

  /**
   * Merge multiple keyword sources
   */
  mergeKeywords(...sources) {
    const merged = {};

    for (const source of sources) {
      for (const [name, definition] of Object.entries(source)) {
        if (merged[name]) {
          console.warn(`Keyword '${name}' redefined. Using latest definition.`);
        }
        merged[name] = definition;
      }
    }

    return merged;
  }

  /**
   * Validate keyword references (ensure all used keywords exist)
   */
  validateReferences(keywords) {
    const errors = [];
    const availableKeywords = new Set(Object.keys(keywords));

    for (const [name, definition] of Object.entries(keywords)) {
      for (const step of definition.steps) {
        if (step.action === 'run' || step.action === 'run-keyword') {
          const referencedKeyword = step.keyword || step.args[0];
          if (referencedKeyword && !availableKeywords.has(referencedKeyword)) {
            errors.push(`Keyword '${name}' references unknown keyword: ${referencedKeyword}`);
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
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cached keywords
   */
  getCached(filePath) {
    return this.cache.get(path.resolve(filePath));
  }
}

module.exports = { KeywordLoader };