const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const chalk = require('chalk');

class YAMLTestParser {
  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    this.schema = require('./yaml-schema.json');
    this.validate = this.ajv.compile(this.schema);
  }

  /**
   * Parse YAML file and validate against schema
   * @param {string} filePath - Path to YAML test file
   * @returns {Object} Parsed and validated test definition
   */
  async parseFile(filePath) {
    try {
      const absolutePath = path.resolve(filePath);

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Test file not found: ${absolutePath}`);
      }

      const fileContent = fs.readFileSync(absolutePath, 'utf8');
      return await this.parse(fileContent, absolutePath);
    } catch (error) {
      throw new Error(`Failed to parse YAML file: ${error.message}`);
    }
  }

  /**
   * Parse YAML content and validate
   * @param {string} content - YAML content
   * @param {string} sourcePath - Source file path for error reporting
   * @returns {Object} Parsed and validated test definition
   */
  async parse(content, sourcePath = 'inline') {
    let testDefinition;

    try {
      // Parse YAML to JavaScript object
      testDefinition = yaml.load(content);
    } catch (error) {
      const line = error.mark ? error.mark.line : 'unknown';
      throw new Error(`YAML syntax error at line ${line}: ${error.message}`);
    }

    // Validate against schema
    const valid = this.validate(testDefinition);

    if (!valid) {
      const errors = this.formatValidationErrors(this.validate.errors);
      throw new Error(`YAML validation failed:\n${errors}`);
    }

    // Normalize and enhance test definition
    testDefinition = this.normalizeTestDefinition(testDefinition, sourcePath);

    // Perform semantic validation
    this.validateSemantics(testDefinition);

    return testDefinition;
  }

  /**
   * Format validation errors for clear reporting
   * @param {Array} errors - AJV validation errors
   * @returns {string} Formatted error message
   */
  formatValidationErrors(errors) {
    return errors.map(err => {
      const path = err.instancePath || '/';
      const message = err.message;
      const params = err.params ? JSON.stringify(err.params) : '';
      return `  ${chalk.red('✗')} ${path}: ${message} ${params}`;
    }).join('\n');
  }

  /**
   * Normalize test definition with defaults and enhancements
   * @param {Object} definition - Raw test definition
   * @param {string} sourcePath - Source file path
   * @returns {Object} Normalized test definition
   */
  normalizeTestDefinition(definition, sourcePath) {
    const normalized = { ...definition };

    // Set defaults
    normalized.config = {
      timeout: 300000, // 5 minutes default
      retries: 0,
      parallel: false,
      ...definition.config
    };

    // Normalize network to array
    if (typeof normalized.network === 'string') {
      normalized.network = [normalized.network];
    }

    // Add metadata
    normalized._meta = {
      sourcePath,
      parseTime: Date.now(),
      version: '1.0.0'
    };

    // Ensure scenario is an array
    if (!Array.isArray(normalized.scenario)) {
      // Convert named scenarios to array with section markers
      const sections = [];
      for (const [name, actions] of Object.entries(normalized.scenario)) {
        sections.push({ log: `Starting scenario: ${name}` });
        sections.push(...actions);
      }
      normalized.scenario = sections;
    }

    // Initialize empty arrays for optional sections
    normalized.setup = normalized.setup || {};
    normalized.cleanup = normalized.cleanup || [];
    normalized.variables = normalized.variables || {};
    normalized.hooks = normalized.hooks || {};

    return normalized;
  }

  /**
   * Perform semantic validation beyond schema
   * @param {Object} definition - Test definition
   */
  validateSemantics(definition) {
    const errors = [];

    // Check for undefined variable references
    const variables = new Set(Object.keys(definition.variables || {}));
    const accounts = new Set(Object.keys(definition.setup?.accounts || {}));
    const contracts = new Set(Object.keys(definition.setup?.contracts || {}));

    // Collect all available names
    const availableNames = new Set([...variables, ...accounts, ...contracts]);

    // Check scenario actions for undefined references
    this.validateActionReferences(definition.scenario, availableNames, errors);

    // Check cleanup actions
    if (definition.cleanup) {
      this.validateActionReferences(definition.cleanup, availableNames, errors);
    }

    // Check data source if specified
    if (definition.data) {
      const dataPath = typeof definition.data === 'string'
        ? definition.data
        : definition.data.source;

      if (dataPath && !dataPath.startsWith('http') && !fs.existsSync(path.resolve(dataPath))) {
        errors.push(`Data file not found: ${dataPath}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Semantic validation failed:\n${errors.map(e => `  ${chalk.red('✗')} ${e}`).join('\n')}`);
    }
  }

  /**
   * Validate action references
   * @param {Array} actions - Actions to validate
   * @param {Set} availableNames - Available variable/account/contract names
   * @param {Array} errors - Error collector
   */
  validateActionReferences(actions, availableNames, errors) {
    for (const action of actions) {
      // Handle 'set' actions - they create new variables
      if (action.set) {
        for (const varName of Object.keys(action.set)) {
          availableNames.add(varName);
        }
      }

      if (action.transfer) {
        const match = action.transfer.match(/^(.+?)\s*->\s*(.+?),\s*(.+)$/);
        if (match) {
          const [, from, to] = match;
          if (!this.isValidReference(from, availableNames)) {
            errors.push(`Unknown account reference in transfer: ${from}`);
          }
          if (!this.isValidReference(to, availableNames)) {
            errors.push(`Unknown account reference in transfer: ${to}`);
          }
        }
      }

      if (action.call) {
        const { contract, from } = action.call;
        if (!this.isValidReference(contract, availableNames)) {
          errors.push(`Unknown contract reference: ${contract}`);
        }
        if (from && !this.isValidReference(from, availableNames)) {
          errors.push(`Unknown account reference: ${from}`);
        }
      }

      if (action.loop?.actions) {
        this.validateActionReferences(action.loop.actions, availableNames, errors);
      }

      if (action.if) {
        if (action.if.then) {
          this.validateActionReferences(action.if.then, availableNames, errors);
        }
        if (action.if.else) {
          this.validateActionReferences(action.if.else, availableNames, errors);
        }
      }

      if (action.parallel) {
        this.validateActionReferences(action.parallel, availableNames, errors);
      }
    }
  }

  /**
   * Check if a reference is valid (exists or is a literal)
   * @param {string} ref - Reference to check
   * @param {Set} availableNames - Available names
   * @returns {boolean} Whether reference is valid
   */
  isValidReference(ref, availableNames) {
    // Handle non-string references
    if (typeof ref !== 'string') return true;

    // Check if it's a literal (number or quoted string)
    if (/^\d+(\.\d+)?$/.test(ref)) return true;
    if (/^["'].*["']$/.test(ref)) return true;
    if (/^0x[0-9a-fA-F]+$/.test(ref)) return true;

    // Check if it's an expression
    if (ref.includes('+') || ref.includes('-') || ref.includes('*') || ref.includes('/')) {
      // Simple expression validation - would need more sophisticated parsing
      return true;
    }

    // Check if it's a known reference
    const baseName = ref.split('.')[0];
    return availableNames.has(baseName);
  }

  /**
   * Load and merge multiple YAML files
   * @param {Array<string>} filePaths - Paths to YAML files
   * @returns {Array<Object>} Array of parsed test definitions
   */
  async parseMultiple(filePaths) {
    const results = [];

    for (const filePath of filePaths) {
      try {
        const definition = await this.parseFile(filePath);
        results.push(definition);
      } catch (error) {
        console.error(chalk.red(`Failed to parse ${filePath}: ${error.message}`));
      }
    }

    return results;
  }

  /**
   * Parse YAML with template substitution
   * @param {string} filePath - Path to YAML file
   * @param {Object} variables - Variables to substitute
   * @returns {Object} Parsed test definition with substitutions
   */
  async parseWithVariables(filePath, variables = {}) {
    let content = fs.readFileSync(path.resolve(filePath), 'utf8');

    // Substitute variables in format ${VAR_NAME}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      content = content.replace(regex, value);
    }

    return await this.parse(content, filePath);
  }
}

module.exports = { YAMLTestParser };