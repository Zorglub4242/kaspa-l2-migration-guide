/**
 * Conditional Control Flow
 * Implements if/then/else logic for YAML tests
 */

class ConditionalExecutor {
  constructor(context) {
    this.context = context;
  }

  /**
   * Execute conditional statement
   */
  async execute(statement) {
    const { condition, then: thenBranch, else: elseBranch } = statement;

    // Evaluate condition
    const result = await this.evaluateCondition(condition);

    // Execute appropriate branch
    if (result) {
      if (thenBranch) {
        return await this.executeBranch(thenBranch, 'then');
      }
    } else {
      if (elseBranch) {
        return await this.executeBranch(elseBranch, 'else');
      }
    }

    return null;
  }

  /**
   * Evaluate a condition expression
   */
  async evaluateCondition(condition) {
    // Handle different condition formats
    if (typeof condition === 'boolean') {
      return condition;
    }

    if (typeof condition === 'string') {
      // Use context's expression evaluator
      return await this.context.evaluateExpression(condition);
    }

    if (typeof condition === 'object') {
      // Complex condition object
      return await this.evaluateComplexCondition(condition);
    }

    return false;
  }

  /**
   * Evaluate complex condition objects
   */
  async evaluateComplexCondition(condition) {
    // AND conditions
    if (condition.and && Array.isArray(condition.and)) {
      for (const subCondition of condition.and) {
        const result = await this.evaluateCondition(subCondition);
        if (!result) return false;
      }
      return true;
    }

    // OR conditions
    if (condition.or && Array.isArray(condition.or)) {
      for (const subCondition of condition.or) {
        const result = await this.evaluateCondition(subCondition);
        if (result) return true;
      }
      return false;
    }

    // NOT condition
    if (condition.not) {
      const result = await this.evaluateCondition(condition.not);
      return !result;
    }

    // Comparison operators
    if (condition.equals) {
      const [left, right] = await this.resolveValues([condition.equals.left, condition.equals.right]);
      return left === right;
    }

    if (condition.notEquals) {
      const [left, right] = await this.resolveValues([condition.notEquals.left, condition.notEquals.right]);
      return left !== right;
    }

    if (condition.greaterThan) {
      const [left, right] = await this.resolveValues([condition.greaterThan.left, condition.greaterThan.right]);
      return left > right;
    }

    if (condition.lessThan) {
      const [left, right] = await this.resolveValues([condition.lessThan.left, condition.lessThan.right]);
      return left < right;
    }

    if (condition.greaterOrEqual) {
      const [left, right] = await this.resolveValues([condition.greaterOrEqual.left, condition.greaterOrEqual.right]);
      return left >= right;
    }

    if (condition.lessOrEqual) {
      const [left, right] = await this.resolveValues([condition.lessOrEqual.left, condition.lessOrEqual.right]);
      return left <= right;
    }

    // Contains check
    if (condition.contains) {
      const [collection, item] = await this.resolveValues([condition.contains.collection, condition.contains.item]);
      if (Array.isArray(collection)) {
        return collection.includes(item);
      }
      if (typeof collection === 'string') {
        return collection.includes(item);
      }
      return false;
    }

    // Exists check
    if (condition.exists) {
      const value = await this.resolveValue(condition.exists);
      return value !== null && value !== undefined;
    }

    // IsEmpty check
    if (condition.isEmpty) {
      const value = await this.resolveValue(condition.isEmpty);
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'string') return value === '';
      if (typeof value === 'object' && value !== null) return Object.keys(value).length === 0;
      return !value;
    }

    // Default: treat as expression
    return await this.context.evaluateExpression(JSON.stringify(condition));
  }

  /**
   * Resolve values (variables, expressions, etc.)
   */
  async resolveValues(values) {
    const resolved = [];
    for (const value of values) {
      resolved.push(await this.resolveValue(value));
    }
    return resolved;
  }

  /**
   * Resolve a single value
   */
  async resolveValue(value) {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      const varName = value.slice(2, -2).trim();
      return this.context.getVariable(varName);
    }

    if (typeof value === 'string' && (value.includes('+') || value.includes('-') ||
                                      value.includes('*') || value.includes('/') ||
                                      value.includes('(') || value.includes(')'))) {
      // Might be an expression
      try {
        return await this.context.evaluateExpression(value);
      } catch {
        // Not an expression, return as-is
        return value;
      }
    }

    return value;
  }

  /**
   * Execute a branch (then or else)
   */
  async executeBranch(branch, type) {
    const results = [];

    // Branch can be a single action or array of actions
    const actions = Array.isArray(branch) ? branch : [branch];

    for (const action of actions) {
      try {
        // Execute through the main executor
        const result = await this.context.executeAction(action);
        results.push(result);
      } catch (error) {
        console.error(`Error in ${type} branch:`, error.message);
        throw error;
      }
    }

    return results.length === 1 ? results[0] : results;
  }

  /**
   * Execute switch/case statement
   */
  async executeSwitch(statement) {
    const { value, cases, default: defaultCase } = statement;

    // Resolve the switch value
    const switchValue = await this.resolveValue(value);

    // Check each case
    for (const caseItem of cases) {
      const caseValue = await this.resolveValue(caseItem.value);

      if (switchValue === caseValue) {
        return await this.executeBranch(caseItem.do || caseItem.then, 'case');
      }
    }

    // Execute default case if no match
    if (defaultCase) {
      return await this.executeBranch(defaultCase, 'default');
    }

    return null;
  }

  /**
   * Execute while loop
   */
  async executeWhile(statement) {
    const { condition, do: actions, maxIterations = 1000 } = statement;
    const results = [];
    let iterations = 0;

    while (await this.evaluateCondition(condition)) {
      if (iterations >= maxIterations) {
        throw new Error(`While loop exceeded maximum iterations (${maxIterations})`);
      }

      const actionResults = await this.executeBranch(actions, 'while');
      results.push(actionResults);
      iterations++;

      // Check for break condition
      if (this.context.getVariable('$$break')) {
        this.context.setVariable('$$break', false);
        break;
      }

      // Check for continue condition
      if (this.context.getVariable('$$continue')) {
        this.context.setVariable('$$continue', false);
        continue;
      }
    }

    return results;
  }

  /**
   * Execute try/catch block
   */
  async executeTryCatch(statement) {
    const { try: tryBlock, catch: catchBlock, finally: finallyBlock } = statement;

    try {
      // Execute try block
      const result = await this.executeBranch(tryBlock, 'try');

      // Execute finally block if present
      if (finallyBlock) {
        await this.executeBranch(finallyBlock, 'finally');
      }

      return result;
    } catch (error) {
      // Store error in context
      this.context.setVariable('$$error', {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name
      });

      // Execute catch block if present
      if (catchBlock) {
        const result = await this.executeBranch(catchBlock, 'catch');

        // Execute finally block if present
        if (finallyBlock) {
          await this.executeBranch(finallyBlock, 'finally');
        }

        return result;
      }

      // Execute finally block even if no catch
      if (finallyBlock) {
        await this.executeBranch(finallyBlock, 'finally');
      }

      // Re-throw if no catch block
      throw error;
    }
  }
}

module.exports = { ConditionalExecutor };