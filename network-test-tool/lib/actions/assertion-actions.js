const chalk = require('chalk');

class AssertionActions {
  constructor(executor) {
    this.executor = executor;
    this.context = executor.context;
  }

  /**
   * Execute a check assertion
   * @param {string} expression - Expression to evaluate
   * @param {string} message - Optional failure message
   */
  async executeCheck(expression, message) {
    console.log(chalk.gray(`  ✓ Checking: ${expression}`));

    try {
      const result = await this.context.evaluateExpression(expression);

      if (!result) {
        const errorMsg = message || `Assertion failed: ${expression}`;
        throw new Error(errorMsg);
      }

      console.log(chalk.green(`    ✓ Assertion passed`));

      this.context.addResult({
        action: 'check',
        expression,
        result: true,
        success: true
      });

      return true;

    } catch (error) {
      console.error(chalk.red(`    ✗ ${error.message}`));

      this.context.addResult({
        action: 'check',
        expression,
        error: error.message,
        success: false
      });

      throw error;
    }
  }

  /**
   * Execute an expect assertion
   * @param {any} actual - Actual value
   * @param {string} matcher - Comparison matcher
   * @param {any} expected - Expected value
   */
  async expect(actual, matcher, expected) {
    const actualResolved = await this.context.resolveReference(actual);
    const expectedResolved = await this.context.resolveReference(expected);

    let result = false;

    switch (matcher) {
      case '==':
      case 'equals':
        result = actualResolved == expectedResolved;
        break;

      case '===':
      case 'strictEquals':
        result = actualResolved === expectedResolved;
        break;

      case '!=':
      case 'notEquals':
        result = actualResolved != expectedResolved;
        break;

      case '>':
      case 'greaterThan':
        result = actualResolved > expectedResolved;
        break;

      case '>=':
      case 'greaterOrEqual':
        result = actualResolved >= expectedResolved;
        break;

      case '<':
      case 'lessThan':
        result = actualResolved < expectedResolved;
        break;

      case '<=':
      case 'lessOrEqual':
        result = actualResolved <= expectedResolved;
        break;

      case 'includes':
      case 'contains':
        result = actualResolved.includes(expectedResolved);
        break;

      case 'matches':
        const regex = new RegExp(expectedResolved);
        result = regex.test(actualResolved);
        break;

      case 'REVERT':
      case 'throws':
        // Special case for expecting errors
        result = actualResolved instanceof Error;
        break;

      default:
        throw new Error(`Unknown matcher: ${matcher}`);
    }

    if (!result) {
      throw new Error(`Expected ${actualResolved} ${matcher} ${expectedResolved}`);
    }

    console.log(chalk.green(`    ✓ Expectation met: ${actualResolved} ${matcher} ${expectedResolved}`));

    return result;
  }

  /**
   * Validate multiple conditions
   * @param {Array} conditions - Array of conditions to check
   */
  async validate(conditions) {
    const results = [];

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];

      try {
        if (typeof condition === 'string') {
          await this.executeCheck(condition);
        } else if (condition.check) {
          await this.executeCheck(condition.check, condition.message);
        } else if (condition.expect) {
          await this.expect(condition.actual, condition.matcher || '==', condition.expect);
        }

        results.push({ index: i, success: true });
      } catch (error) {
        results.push({ index: i, success: false, error: error.message });

        if (!condition.continue_on_error) {
          throw error;
        }
      }
    }

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(chalk.blue(`  Validation complete: ${passed} passed, ${failed} failed`));

    return results;
  }

  /**
   * Assert that a value exists
   * @param {string} reference - Reference to check
   */
  async assertExists(reference) {
    const value = await this.context.resolveReference(reference);

    if (value === undefined || value === null) {
      throw new Error(`Value does not exist: ${reference}`);
    }

    console.log(chalk.green(`    ✓ ${reference} exists`));
    return true;
  }

  /**
   * Assert that a value does not exist
   * @param {string} reference - Reference to check
   */
  async assertNotExists(reference) {
    const value = await this.context.resolveReference(reference);

    if (value !== undefined && value !== null) {
      throw new Error(`Value should not exist: ${reference}`);
    }

    console.log(chalk.green(`    ✓ ${reference} does not exist`));
    return true;
  }

  /**
   * Assert that a value is of a specific type
   * @param {string} reference - Reference to check
   * @param {string} type - Expected type
   */
  async assertType(reference, type) {
    const value = await this.context.resolveReference(reference);
    const actualType = typeof value;

    if (actualType !== type) {
      throw new Error(`Expected ${reference} to be ${type}, got ${actualType}`);
    }

    console.log(chalk.green(`    ✓ ${reference} is ${type}`));
    return true;
  }

  /**
   * Assert array length
   * @param {string} reference - Array reference
   * @param {number} length - Expected length
   */
  async assertLength(reference, length) {
    const value = await this.context.resolveReference(reference);

    if (!Array.isArray(value) && typeof value !== 'string') {
      throw new Error(`${reference} is not an array or string`);
    }

    if (value.length !== length) {
      throw new Error(`Expected ${reference} to have length ${length}, got ${value.length}`);
    }

    console.log(chalk.green(`    ✓ ${reference} has length ${length}`));
    return true;
  }

  /**
   * Assert that a transaction reverts
   * @param {Function} action - Action to execute
   * @param {string} expectedMessage - Optional expected revert message
   */
  async assertReverts(action, expectedMessage) {
    try {
      await action();
      throw new Error('Transaction did not revert as expected');
    } catch (error) {
      if (expectedMessage && !error.message.includes(expectedMessage)) {
        throw new Error(`Expected revert message "${expectedMessage}", got "${error.message}"`);
      }

      console.log(chalk.green(`    ✓ Transaction reverted as expected`));
      return true;
    }
  }

  /**
   * Assert events were emitted
   * @param {Object} receipt - Transaction receipt
   * @param {string} eventName - Event name to check
   * @param {Object} args - Optional event arguments to match
   */
  async assertEvent(receipt, eventName, args) {
    if (!receipt.events) {
      throw new Error('No events in transaction receipt');
    }

    const events = receipt.events.filter(e => e.event === eventName);

    if (events.length === 0) {
      throw new Error(`Event ${eventName} was not emitted`);
    }

    if (args) {
      const matchingEvent = events.find(e => {
        for (const [key, value] of Object.entries(args)) {
          if (e.args[key] != value) {
            return false;
          }
        }
        return true;
      });

      if (!matchingEvent) {
        throw new Error(`Event ${eventName} was emitted but arguments don't match`);
      }
    }

    console.log(chalk.green(`    ✓ Event ${eventName} was emitted`));
    return true;
  }

  /**
   * Compare two values with tolerance
   * @param {any} actual - Actual value
   * @param {any} expected - Expected value
   * @param {number} tolerance - Tolerance percentage (0-100)
   */
  async assertApproxEqual(actual, expected, tolerance = 1) {
    const actualResolved = await this.context.resolveReference(actual);
    const expectedResolved = await this.context.resolveReference(expected);

    const actualNum = parseFloat(actualResolved);
    const expectedNum = parseFloat(expectedResolved);

    if (isNaN(actualNum) || isNaN(expectedNum)) {
      throw new Error('Values must be numeric for approximate comparison');
    }

    const diff = Math.abs(actualNum - expectedNum);
    const toleranceAmount = expectedNum * (tolerance / 100);

    if (diff > toleranceAmount) {
      throw new Error(`${actualNum} is not within ${tolerance}% of ${expectedNum}`);
    }

    console.log(chalk.green(`    ✓ ${actualNum} ≈ ${expectedNum} (±${tolerance}%)`));
    return true;
  }
}

module.exports = { AssertionActions };