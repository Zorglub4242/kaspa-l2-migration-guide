/**
 * Parallel Execution Control
 * Implements parallel execution of multiple operations
 */

class ParallelExecutor {
  constructor(context, executor = null) {
    this.context = context;
    this.executor = executor; // Reference to YAMLTestExecutor
    this.maxConcurrency = 10; // Default max concurrent operations
  }

  setExecutor(executor) {
    this.executor = executor;
  }

  /**
   * Execute operations in parallel
   */
  async execute(statement) {
    const {
      actions,
      do: doActions,
      steps,
      maxConcurrency = this.maxConcurrency,
      failFast = false,
      timeout = 60000
    } = statement;

    // Get actions array
    const operations = actions || doActions || steps || [];

    if (!Array.isArray(operations) || operations.length === 0) {
      return [];
    }

    // Handle different execution modes
    if (statement.batch) {
      return await this.executeBatch(operations, statement.batch);
    }

    if (statement.race) {
      return await this.executeRace(operations, timeout);
    }

    if (statement.forEach) {
      return await this.executeForEachParallel(statement);
    }

    // Default parallel execution
    return await this.executeParallel(operations, maxConcurrency, failFast, timeout);
  }

  /**
   * Execute actions in parallel with concurrency limit
   */
  async executeParallel(operations, maxConcurrency, failFast, timeout) {
    const results = [];
    const errors = [];
    const executing = [];

    // Create promises for all operations
    const promises = operations.map((operation, index) => {
      return this.createOperation(operation, index, timeout);
    });

    // Execute with concurrency limit
    for (const [index, promise] of promises.entries()) {
      const executingPromise = promise.then(
        result => {
          results[index] = { success: true, result, index };
          return result;
        },
        error => {
          errors[index] = { success: false, error: error.message, index };

          if (failFast) {
            throw new Error(`Operation ${index} failed: ${error.message}`);
          }

          return null;
        }
      ).finally(() => {
        // Remove from executing list
        const idx = executing.indexOf(executingPromise);
        if (idx !== -1) {
          executing.splice(idx, 1);
        }
      });

      executing.push(executingPromise);

      // Wait if we've reached concurrency limit
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    // Wait for remaining operations
    await Promise.all(executing);

    // Log summary
    const successCount = results.filter(r => r && r.success).length;
    const errorCount = errors.filter(e => e).length;
    console.log(`Parallel execution complete: ${successCount} succeeded, ${errorCount} failed`);

    // Return combined results
    return {
      results: results.filter(r => r),
      errors: errors.filter(e => e),
      summary: {
        total: operations.length,
        succeeded: successCount,
        failed: errorCount
      }
    };
  }

  /**
   * Create a promise for an operation with timeout
   */
  createOperation(operation, index, timeout) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation ${index} timed out after ${timeout}ms`));
      }, timeout);

      try {
        // Clone context for isolated execution
        const isolatedContext = this.cloneContext();

        // Execute the operation
        let result;
        if (this.executor && typeof this.executor.executeAction === 'function') {
          result = await this.executor.executeAction(operation);
        } else if (this.context && typeof this.context.executeAction === 'function') {
          result = await this.context.executeAction(operation, isolatedContext);
        } else {
          throw new Error('No executor available for parallel operation');
        }

        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Execute operations in batches
   */
  async executeBatch(operations, batchConfig) {
    const {
      size = 5,
      delay = 0,
      maxRetries = 0
    } = typeof batchConfig === 'object' ? batchConfig : { size: batchConfig };

    const results = [];

    // Process in batches
    for (let i = 0; i < operations.length; i += size) {
      const batch = operations.slice(i, i + size);
      console.log(`Executing batch ${Math.floor(i / size) + 1} of ${Math.ceil(operations.length / size)}`);

      // Execute batch
      const batchResults = await Promise.allSettled(
        batch.map(op => this.executeWithRetry(op, maxRetries))
      );

      results.push(...batchResults);

      // Delay between batches
      if (delay > 0 && i + size < operations.length) {
        await this.sleep(delay);
      }
    }

    return this.processSettledResults(results);
  }

  /**
   * Execute operations and return first to complete
   */
  async executeRace(operations, timeout) {
    const promises = operations.map((operation, index) => {
      return this.createOperation(operation, index, timeout).then(result => ({
        winner: index,
        result,
        operation
      }));
    });

    try {
      const winner = await Promise.race(promises);
      console.log(`Race won by operation ${winner.winner}`);
      return winner;
    } catch (error) {
      throw new Error(`All operations failed in race: ${error.message}`);
    }
  }

  /**
   * Execute forEach loop in parallel
   */
  async executeForEachParallel(statement) {
    const { forEach, do: actions, maxConcurrency = this.maxConcurrency } = statement;
    const { item, in: collection } = forEach;

    // Resolve collection
    let items = collection;
    if (typeof collection === 'string') {
      items = this.context.getVariable(collection) || collection;
    }

    if (!Array.isArray(items)) {
      items = [items];
    }

    // Create operations for each item
    const operations = items.map(itemValue => {
      // Create isolated context with item variable
      return {
        action: 'withVariable',
        variable: item,
        value: itemValue,
        do: actions
      };
    });

    return await this.executeParallel(operations, maxConcurrency, false, 60000);
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry(operation, maxRetries) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.context.executeAction(operation);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          console.log(`Retry ${attempt + 1}/${maxRetries} for operation`);
          await this.sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  /**
   * Process settled promise results
   */
  processSettledResults(results) {
    const processed = {
      succeeded: [],
      failed: [],
      summary: {
        total: results.length,
        succeeded: 0,
        failed: 0
      }
    };

    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        processed.succeeded.push({
          index,
          value: result.value
        });
        processed.summary.succeeded++;
      } else {
        processed.failed.push({
          index,
          error: result.reason.message
        });
        processed.summary.failed++;
      }
    }

    return processed;
  }

  /**
   * Clone context for isolated execution
   */
  cloneContext() {
    // Create a shallow clone with isolated variables
    const cloned = Object.create(Object.getPrototypeOf(this.context));
    cloned.variables = new Map(this.context.variables);
    cloned.contracts = this.context.contracts;
    cloned.accounts = this.context.accounts;
    cloned.provider = this.context.provider;
    return cloned;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute map operation in parallel
   */
  async executeMap(statement) {
    const { collection, transform, maxConcurrency = this.maxConcurrency } = statement;

    // Resolve collection
    let items = collection;
    if (typeof collection === 'string') {
      items = this.context.getVariable(collection);
    }

    if (!Array.isArray(items)) {
      throw new Error('Map operation requires an array');
    }

    // Create transform operations
    const operations = items.map(item => ({
      action: 'evaluate',
      expression: transform,
      context: { item }
    }));

    const results = await this.executeParallel(operations, maxConcurrency, false, 60000);
    return results.results.map(r => r.result);
  }

  /**
   * Execute filter operation in parallel
   */
  async executeFilter(statement) {
    const { collection, condition, maxConcurrency = this.maxConcurrency } = statement;

    // Resolve collection
    let items = collection;
    if (typeof collection === 'string') {
      items = this.context.getVariable(collection);
    }

    if (!Array.isArray(items)) {
      throw new Error('Filter operation requires an array');
    }

    // Create filter operations
    const operations = items.map((item, index) => ({
      action: 'evaluate',
      expression: condition,
      context: { item, index }
    }));

    const results = await this.executeParallel(operations, maxConcurrency, false, 60000);

    // Filter items based on condition results
    return items.filter((item, index) => {
      const result = results.results.find(r => r.index === index);
      return result && result.result;
    });
  }

  /**
   * Execute reduce operation (sequential, not parallel)
   */
  async executeReduce(statement) {
    const { collection, reducer, initialValue } = statement;

    // Resolve collection
    let items = collection;
    if (typeof collection === 'string') {
      items = this.context.getVariable(collection);
    }

    if (!Array.isArray(items)) {
      throw new Error('Reduce operation requires an array');
    }

    let accumulator = initialValue;

    for (const item of items) {
      accumulator = await this.context.evaluateExpression(reducer, {
        accumulator,
        item
      });
    }

    return accumulator;
  }
}

module.exports = { ParallelExecutor };