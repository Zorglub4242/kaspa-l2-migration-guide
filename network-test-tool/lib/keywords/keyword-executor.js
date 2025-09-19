const { TestContext } = require('../test-context');

/**
 * KeywordExecutor - Executes keyword steps with parameter substitution
 */
class KeywordExecutor {
  constructor(context, keywordManager) {
    this.context = context;
    this.keywordManager = keywordManager;
    this.recursionDepth = 0;
    this.maxRecursion = 10;
  }

  /**
   * Execute a keyword with given parameters
   */
  async execute(keyword, params = [], context = null) {
    // Check recursion depth
    if (this.recursionDepth >= this.maxRecursion) {
      throw new Error(`Maximum keyword recursion depth (${this.maxRecursion}) exceeded`);
    }

    this.recursionDepth++;

    try {
      // Use provided context or default
      const ctx = context || this.context;

      // Create parameter mapping
      const paramMap = this.createParameterMap(keyword.params, params);

      // Create local scope for keyword execution
      const localScope = new Map();
      for (const [key, value] of paramMap) {
        localScope.set(key, value);
      }

      // Store original context state
      const originalScope = ctx.localScope;
      ctx.localScope = localScope;

      // Execute steps
      let result = null;
      for (const step of keyword.steps) {
        result = await this.executeStep(step, ctx, paramMap);

        // Handle return statement
        if (step.action === 'return') {
          ctx.localScope = originalScope;
          this.recursionDepth--;
          return result;
        }
      }

      // Restore context
      ctx.localScope = originalScope;
      this.recursionDepth--;

      return result;
    } catch (error) {
      this.recursionDepth--;
      throw new Error(`Error in keyword '${keyword.name}': ${error.message}`);
    }
  }

  /**
   * Create parameter mapping from names to values
   */
  createParameterMap(paramNames = [], paramValues = []) {
    const map = new Map();

    // Handle positional parameters
    for (let i = 0; i < paramNames.length; i++) {
      const name = paramNames[i];
      const value = i < paramValues.length ? paramValues[i] : null;
      map.set(name, value);
    }

    // Handle named parameters (object format)
    if (paramValues.length === 1 && typeof paramValues[0] === 'object' && !Array.isArray(paramValues[0])) {
      const namedParams = paramValues[0];
      for (const [name, value] of Object.entries(namedParams)) {
        map.set(name, value);
      }
    }

    return map;
  }

  /**
   * Execute a single step
   */
  async executeStep(step, context, paramMap) {
    // Substitute parameters in step
    const processedStep = this.substituteParameters(step, paramMap, context);

    // Handle different action types
    switch (processedStep.action) {
      case 'run':
      case 'run-keyword':
        return await this.executeKeywordCall(processedStep, context);

      case 'foreach':
        return await this.executeForeach(processedStep, context, paramMap);

      case 'if':
        return await this.executeConditional(processedStep, context, paramMap);

      case 'parallel':
        return await this.executeParallel(processedStep, context, paramMap);

      case 'return':
        return this.evaluateReturn(processedStep, context);

      case 'set':
      case 'let':
        return await this.executeAssignment(processedStep, context);

      case 'log':
        console.log(...processedStep.args);
        return null;

      default:
        // Delegate to context's action execution
        return await this.executeContextAction(processedStep, context);
    }
  }

  /**
   * Substitute parameters in a step
   */
  substituteParameters(step, paramMap, context) {
    const processed = JSON.parse(JSON.stringify(step)); // Deep clone

    // Substitute in all string values
    const substitute = (obj) => {
      if (typeof obj === 'string') {
        return this.substituteString(obj, paramMap, context);
      } else if (Array.isArray(obj)) {
        return obj.map(item => substitute(item));
      } else if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = substitute(value);
        }
        return result;
      }
      return obj;
    };

    return substitute(processed);
  }

  /**
   * Substitute parameters in a string
   */
  substituteString(str, paramMap, context) {
    let result = str;

    // Replace {{param}} with parameter values
    for (const [name, value] of paramMap) {
      const pattern = new RegExp(`{{\\s*${name}\\s*}}`, 'g');
      result = result.replace(pattern, value);
    }

    // Replace context variables
    if (context && context.variables) {
      for (const [name, value] of context.variables) {
        const pattern = new RegExp(`{{\\s*${name}\\s*}}`, 'g');
        result = result.replace(pattern, value);
      }
    }

    // Replace local scope variables
    if (context && context.localScope) {
      for (const [name, value] of context.localScope) {
        const pattern = new RegExp(`{{\\s*${name}\\s*}}`, 'g');
        result = result.replace(pattern, value);
      }
    }

    return result;
  }

  /**
   * Execute a keyword call
   */
  async executeKeywordCall(step, context) {
    const keywordName = step.keyword || step.args[0];
    const params = step.params || step.args.slice(1);

    // Handle return value assignment
    let result;
    if (step.returns || step.assign) {
      result = await this.keywordManager.executeKeyword(keywordName, params, context);
      const varName = step.returns || step.assign;
      context.setVariable(varName, result);
    } else {
      result = await this.keywordManager.executeKeyword(keywordName, params, context);
    }

    return result;
  }

  /**
   * Execute foreach loop
   */
  async executeForeach(step, context, paramMap) {
    const itemName = step.item || step.args[0];
    const collection = step.collection || step.in || step.args[1];
    const actions = step.do || step.steps || [];

    // Resolve collection
    let items;
    if (typeof collection === 'string') {
      // Could be a variable or parameter
      items = paramMap.get(collection) || context.getVariable(collection) || collection;
    } else {
      items = collection;
    }

    if (!Array.isArray(items)) {
      items = [items];
    }

    const results = [];
    for (const item of items) {
      // Set loop variable
      context.setVariable(itemName, item);

      // Execute loop body
      for (const action of actions) {
        const result = await this.executeStep(action, context, paramMap);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Execute conditional
   */
  async executeConditional(step, context, paramMap) {
    const condition = step.condition || step.args[0];
    const thenActions = step.then || step.do || [];
    const elseActions = step.else || [];

    // Evaluate condition
    const conditionResult = await context.evaluateExpression(condition);

    if (conditionResult) {
      // Execute then branch
      const results = [];
      for (const action of thenActions) {
        results.push(await this.executeStep(action, context, paramMap));
      }
      return results;
    } else if (elseActions.length > 0) {
      // Execute else branch
      const results = [];
      for (const action of elseActions) {
        results.push(await this.executeStep(action, context, paramMap));
      }
      return results;
    }

    return null;
  }

  /**
   * Execute parallel actions
   */
  async executeParallel(step, context, paramMap) {
    const actions = step.actions || step.do || step.steps || [];

    // Execute all actions in parallel
    const promises = actions.map(action =>
      this.executeStep(action, context, paramMap)
    );

    return await Promise.all(promises);
  }

  /**
   * Evaluate return statement
   */
  evaluateReturn(step, context) {
    const value = step.value || step.args[0];

    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      const varName = value.slice(2, -2).trim();
      return context.getVariable(varName);
    }

    return value;
  }

  /**
   * Execute assignment
   */
  async executeAssignment(step, context) {
    const varName = step.variable || step.name || step.args[0];
    const value = step.value || step.args[1];

    // Evaluate expression if needed
    let resolvedValue = value;
    if (typeof value === 'string' && value.includes('{{')) {
      resolvedValue = await context.evaluateExpression(value);
    }

    context.setVariable(varName, resolvedValue);
    return resolvedValue;
  }

  /**
   * Execute action through context (for built-in actions)
   */
  async executeContextAction(step, context) {
    // This would integrate with existing action system
    // For now, just log
    console.log(`Executing action: ${step.action}`, step.args);
    return null;
  }
}

module.exports = { KeywordExecutor };