const { ethers } = require('ethers');
const chalk = require('chalk');
const ora = require('ora');
const { TestContext } = require('./test-context');
const { AccountActions } = require('./actions/account-actions');
const { ContractActions } = require('./actions/contract-actions');
const { AssertionActions } = require('./actions/assertion-actions');
const { NetworkActions } = require('./actions/network-actions');
const { TestResult } = require('./test-utils');
const { DataIterator } = require('./data/data-iterator');
const { KeywordManager } = require('./keywords/keyword-manager');
const { ConditionalExecutor } = require('./control/conditional');
const { ParallelExecutor } = require('./control/parallel');
const { WalletManager } = require('./wallet/wallet-manager');

class YAMLTestExecutor {
  constructor(resourcePool, options = {}) {
    this.resourcePool = resourcePool;
    this.context = new TestContext();
    this.options = options;

    // Initialize action handlers
    this.accountActions = new AccountActions(this);
    this.contractActions = new ContractActions(this);
    this.assertionActions = new AssertionActions(this);
    this.networkActions = new NetworkActions(this);

    // Initialize new features
    this.keywordManager = new KeywordManager(this.context);
    this.conditionalExecutor = new ConditionalExecutor(this.context);
    this.parallelExecutor = new ParallelExecutor(this.context, this);
    this.walletManager = null; // Will be initialized with provider

    this.spinner = null;
    this.testResult = null;
  }

  /**
   * Execute a complete test definition
   * @param {Object} testDefinition - Parsed YAML test definition
   * @param {Object} network - Network configuration
   * @param {string} scriptPath - Optional path to the YAML script file for tracking
   * @returns {Object} Test execution results
   */
  async execute(testDefinition, network, scriptPath = null) {
    console.log(chalk.blue(`\n═══ Executing Test: ${testDefinition.test} ═══`));
    console.log(chalk.gray(`Network: ${network.name} (Chain ID: ${network.chainId})`));

    // Initialize test result - pass full network object
    this.testResult = new TestResult(testDefinition.test, network);
    await this.testResult.initializeDatabase();

    // Set up YAML script context for tracking (use only filename, not full path)
    if (scriptPath) {
      const path = require('path');
      const scriptFileName = path.basename(scriptPath); // Extract just the filename
      const scriptContent = JSON.stringify(testDefinition); // Store the test definition as content
      this.testResult.setYamlScript(scriptFileName, scriptContent);
    }

    // Set up context
    this.context.currentNetwork = network.name;
    this.context.provider = await this.resourcePool.getProvider(network);

    // Store network config for actions to use
    this.networkConfig = network;

    // Initialize wallet manager with provider
    this.walletManager = new WalletManager(this.context.provider);

    // Load keywords if defined
    if (testDefinition.keywords) {
      await this.loadKeywords(testDefinition.keywords);
    }

    // Initialize wallets if defined
    if (testDefinition.wallets) {
      await this.walletManager.initialize(testDefinition.wallets);
    }

    // Apply global variables
    if (testDefinition.variables) {
      for (const [key, value] of Object.entries(testDefinition.variables)) {
        this.context.setVariable(key, value);
      }
    }

    try {
      // Execute lifecycle hooks
      await this.executeHooks(testDefinition.hooks?.beforeAll);

      // Run setup phase
      if (testDefinition.setup) {
        await this.runSetup(testDefinition.setup, network);
      }

      // Execute main scenario
      await this.runScenario(testDefinition.scenario, testDefinition);

      // Run cleanup phase
      if (testDefinition.cleanup) {
        await this.runCleanup(testDefinition.cleanup);
      }

      // Execute post-test hooks
      await this.executeHooks(testDefinition.hooks?.afterAll);

      // Mark test as passed
      this.testResult.endTest();
      console.log(chalk.green(`\n✅ Test "${testDefinition.test}" completed successfully!`));

    } catch (error) {
      // Mark test as failed
      this.testResult.addError('Test Execution', error.message);
      this.testResult.endTest();
      console.error(chalk.red(`\n❌ Test "${testDefinition.test}" failed: ${error.message}`));

      if (this.options.verbose) {
        console.error(chalk.gray(error.stack));
      }

      throw error;
    }

    // Generate summary
    const summary = this.generateSummary();
    return {
      testName: testDefinition.test,
      network: network.name,
      passed: this.testResult.summary.passed,
      results: this.context.getResults(),
      metrics: this.context.getMetricsSummary(),
      summary,
      testResult: this.testResult,
      runId: this.testResult.runId
    };
  }

  /**
   * Run setup phase
   * @param {Object} setup - Setup configuration
   * @param {Object} network - Network configuration
   */
  async runSetup(setup, network) {
    console.log(chalk.cyan('\n📋 Setup Phase'));

    // Create accounts
    if (setup.accounts) {
      for (const [name, config] of Object.entries(setup.accounts)) {
        await this.accountActions.createAccount(name, config, network);
      }
    }

    // Deploy contracts
    if (setup.contracts) {
      for (const [name, config] of Object.entries(setup.contracts)) {
        await this.contractActions.deployContract(name, config);
      }
    }

    // Set up network fork if specified
    if (setup.fork) {
      await this.networkActions.setupFork(setup.fork);
    }
  }

  /**
   * Run main scenario
   * @param {Array|Object} scenario - Scenario actions
   * @param {Object} testDefinition - Full test definition
   */
  async runScenario(scenario, testDefinition) {
    console.log(chalk.cyan('\n🎬 Scenario Execution'));

    const actions = Array.isArray(scenario) ? scenario : this.flattenScenario(scenario);

    // Check if we need to run with data
    if (testDefinition.data) {
      await this.runDataDrivenScenario(actions, testDefinition.data);
    } else {
      await this.executeActions(actions);
    }
  }

  /**
   * Run cleanup phase
   * @param {Array} cleanup - Cleanup actions
   */
  async runCleanup(cleanup) {
    console.log(chalk.cyan('\n🧹 Cleanup Phase'));

    try {
      await this.executeActions(cleanup);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Cleanup error: ${error.message}`));
      // Don't fail test on cleanup errors
    }
  }

  /**
   * Execute a list of actions
   * @param {Array} actions - Actions to execute
   */
  async executeActions(actions) {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      // Set YAML instruction context for tracking
      if (this.testResult) {
        // Convert action object to a readable instruction text
        const instructionText = this.getActionInstructionText(action);
        // For now, we don't have line numbers, so we'll use null
        // The step index is i
        this.testResult.setYamlInstruction(i, null, instructionText);
      }

      try {
        await this.executeAction(action);
      } catch (error) {
        throw new Error(`Action ${i + 1} failed: ${error.message}`);
      } finally {
        // Clear the instruction context after execution
        if (this.testResult) {
          this.testResult.clearYamlInstruction();
        }
      }
    }
  }

  /**
   * Convert an action object to a readable instruction text
   * @param {Object} action - Action object
   * @returns {string} Readable instruction text
   */
  getActionInstructionText(action) {
    // Convert the action to a readable format
    if (action.transfer) {
      return `transfer: ${action.transfer}`;
    } else if (action.deploy) {
      return `deploy: ${JSON.stringify(action.deploy)}`;
    } else if (action.call) {
      return `call: ${JSON.stringify(action.call)}`;
    } else if (action.assert) {
      return `assert: ${JSON.stringify(action.assert)}`;
    } else if (action.log) {
      return `log: ${action.log}`;
    } else if (action.delay) {
      return `delay: ${action.delay}`;
    } else if (action.set) {
      return `set: ${JSON.stringify(action.set)}`;
    } else if (action.parallel) {
      return `parallel: [${action.parallel.length} actions]`;
    } else if (action.if) {
      return `if: ${action.if}`;
    } else if (action.wallet) {
      return `wallet: ${JSON.stringify(action.wallet)}`;
    } else if (action.signMessage) {
      return `signMessage: ${JSON.stringify(action.signMessage)}`;
    } else if (action.signTransaction) {
      return `signTransaction: ${JSON.stringify(action.signTransaction)}`;
    } else if (action.run || action.keyword) {
      return `run: ${action.run || action.keyword}`;
    } else {
      // For any other action types, just stringify the first key
      const keys = Object.keys(action);
      if (keys.length > 0) {
        return `${keys[0]}: ${JSON.stringify(action[keys[0]])}`;
      }
      return JSON.stringify(action);
    }
  }

  /**
   * Execute a single action
   * @param {Object} action - Action to execute
   */
  async executeAction(action) {
    // Keyword execution
    if (action.run || action.keyword) {
      const keywordName = action.run || action.keyword;
      const params = action.params || action.arguments || [];
      const result = await this.keywordManager.executeKeyword(keywordName, params, this.context);
      if (action.returns || action.assign) {
        this.context.setVariable(action.returns || action.assign, result);
      }
      return result;
    }

    // Conditional execution (enhanced)
    if (action.if) {
      return await this.conditionalExecutor.execute({
        condition: action.if,
        then: action.then,
        else: action.else
      });
    }

    // Parallel execution (enhanced)
    if (action.parallel) {
      return await this.parallelExecutor.execute({
        actions: action.parallel,
        failFast: action.failFast,
        maxConcurrency: action.maxConcurrency
      });
    }

    // Wallet operations
    if (action.wallet) {
      return await this.executeWalletAction(action.wallet);
    }

    // Sign message
    if (action.signMessage) {
      const { wallet, message } = action.signMessage;
      return await this.walletManager.signMessage(wallet, message);
    }

    // Sign transaction
    if (action.signTransaction) {
      const { wallet, transaction } = action.signTransaction;
      return await this.walletManager.signTransaction(wallet, transaction);
    }

    // Transfer action
    if (action.transfer) {
      await this.accountActions.executeTransfer(action.transfer);
    }

    // Contract call action
    else if (action.call) {
      await this.contractActions.executeCall(action.call);
    }

    // Contract deployment action
    else if (action.deploy) {
      await this.contractActions.executeDeploy(action.deploy);
    }

    // Assertion action
    else if (action.check) {
      await this.assertionActions.executeCheck(action.check, action.message);
    }

    // Wait action
    else if (action.wait) {
      await this.networkActions.executeWait(action.wait);
    }

    // Loop action
    else if (action.loop) {
      await this.executeLoop(action.loop);
    }

    // ForEach action
    else if (action.foreach) {
      await this.executeForEach(action.foreach);
    }

    // While loop action
    else if (action.while) {
      await this.executeWhile(action.while);
    }

    // Repeat action
    else if (action.repeat) {
      await this.executeRepeat(action.repeat);
    }

    // Try/Catch action
    else if (action.try) {
      await this.executeTryCatch(action);
    }

    // Assert action
    else if (action.assert) {
      await this.executeAssert(action.assert, action.message);
    }

    // Run keyword action
    else if (action.run) {
      await this.executeKeywordRun(action.run, action.params, action.returns);
    }

    // Conditional action
    else if (action.if) {
      await this.executeConditional(action.if);
    }

    // Parallel actions
    else if (action.parallel) {
      await this.executeParallel(action.parallel);
    }

    // Set variable action
    else if (action.set) {
      await this.executeSet(action.set);
    }

    // Log action
    else if (action.log !== undefined) {
      const message = action.log || '';
      const resolved = await this.context.resolveReference(message);
      console.log(chalk.gray(`  📝 ${resolved}`));
    }

    // Measure action
    else if (action.measure) {
      await this.executeMeasure(action.measure);
    }

    // Keyword action
    else if (action.keyword) {
      await this.executeKeyword(action.keyword, action.args);
    }

    // Contract action
    else if (action.contract) {
      const result = await this.executeContract(action.contract, action.returns);
      if (action.returns) {
        this.context.setVariable(action.returns, result);
      }
    }

    // Wallet action (for future MetaMask integration)
    else if (action.wallet) {
      console.log(chalk.yellow(`  ⚠️ Wallet actions not yet implemented`));
    }

    else {
      throw new Error(`Unknown action type: ${Object.keys(action).join(', ')}`);
    }
  }

  /**
   * Execute a loop action
   * @param {Object} loop - Loop configuration
   */
  async executeLoop(loop) {
    if (loop.times) {
      // Repeat N times
      for (let i = 0; i < loop.times; i++) {
        this.context.setVariable('_index', i);
        this.context.setVariable('_iteration', i + 1);
        await this.executeActions(loop.actions);
      }
    } else if (loop.over) {
      // Iterate over a collection
      const collection = await this.context.resolveReference(loop.over);

      if (Array.isArray(collection)) {
        for (let i = 0; i < collection.length; i++) {
          this.context.setVariable('_index', i);
          this.context.setVariable('_item', collection[i]);
          await this.executeActions(loop.actions);
        }
      } else if (typeof collection === 'object') {
        const entries = Object.entries(collection);
        for (let i = 0; i < entries.length; i++) {
          const [key, value] = entries[i];
          this.context.setVariable('_index', i);
          this.context.setVariable('_key', key);
          this.context.setVariable('_value', value);
          await this.executeActions(loop.actions);
        }
      }
    }
  }

  /**
   * Execute a conditional action
   * @param {Object} conditional - Conditional configuration
   */
  async executeConditional(conditional) {
    const condition = await this.context.evaluateExpression(conditional.condition);

    if (condition) {
      if (conditional.then) {
        await this.executeActions(conditional.then);
      }
    } else {
      if (conditional.else) {
        await this.executeActions(conditional.else);
      }
    }
  }

  /**
   * Execute actions in parallel
   * @param {Array} actions - Actions to run in parallel
   */
  async executeParallel(actions) {
    console.log(chalk.gray(`  ⚡ Running ${actions.length} actions in parallel`));

    const promises = actions.map(action => this.executeAction(action));
    await Promise.all(promises);
  }

  /**
   * Execute set variable action
   * @param {Object} variables - Variables to set
   */
  async executeSet(variables) {
    for (const [key, value] of Object.entries(variables)) {
      const resolvedValue = await this.context.resolveReference(value);
      this.context.setVariable(key, resolvedValue);
    }
  }

  /**
   * Execute measurement action
   * @param {Object} measure - Measurement configuration
   */
  async executeMeasure(measure) {
    const startTime = Date.now();
    let startValue;

    if (measure.start) {
      // Execute start action or evaluate start condition
      if (typeof measure.start === 'object') {
        await this.executeAction(measure.start);
      }
      startValue = await this.context.resolveReference(measure.start);
    }

    if (measure.end) {
      // Wait for end condition or execute end action
      if (typeof measure.end === 'object') {
        await this.executeAction(measure.end);
      } else {
        // Wait for condition to become true
        const spinner = ora(`Measuring ${measure.name}...`).start();
        while (!(await this.context.evaluateExpression(measure.end))) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        spinner.stop();
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Record metric based on type
    let metricValue;
    switch (measure.metric) {
      case 'time':
        metricValue = duration;
        console.log(chalk.gray(`  ⏱️ ${measure.name}: ${duration}ms`));
        break;
      case 'gas':
        // Get gas used from last transaction
        metricValue = this.context.getVariable('_lastGasUsed') || 0;
        console.log(chalk.gray(`  ⛽ ${measure.name}: ${metricValue} gas`));
        break;
      case 'blocks':
        const currentBlock = await this.context.provider.getBlockNumber();
        metricValue = currentBlock - (startValue || 0);
        console.log(chalk.gray(`  🔲 ${measure.name}: ${metricValue} blocks`));
        break;
      default:
        metricValue = duration;
    }

    this.context.recordMetric(measure.name, metricValue);
  }

  /**
   * Execute lifecycle hooks
   * @param {Array} hooks - Hook actions to execute
   */
  async executeHooks(hooks) {
    if (!hooks || hooks.length === 0) return;

    console.log(chalk.gray('  Running hooks...'));
    await this.executeActions(hooks);
  }

  /**
   * Run data-driven scenario
   * @param {Array} actions - Actions to execute for each data row
   * @param {string|Object} dataConfig - Data configuration
   */
  async runDataDrivenScenario(actions, dataConfig) {
    console.log(chalk.cyan('  📊 Data-driven execution'));

    // Use DataIterator to load and process data
    const dataIterator = new DataIterator(this.options.dataOptions || {});

    try {
      // Run data-driven test
      const results = await dataIterator.runDataDriven(dataConfig, actions, this);

      // Store results summary
      this.context.setVariable('_dataResults', results);

      // Clean up
      dataIterator.cleanup();

      return results;
    } catch (error) {
      dataIterator.cleanup();
      throw error;
    }
  }

  /**
   * Execute a foreach loop
   * @param {Object} foreach - ForEach configuration
   */
  async executeForEach(foreach) {
    const collection = await this.context.resolveReference(foreach.in || foreach.items);
    const itemVar = foreach.item || '_item';
    const indexVar = foreach.index || '_index';

    if (!collection) return;

    // Handle different foreach patterns
    if (foreach.map) {
      // Map operation
      const results = [];
      const items = await this.context.resolveReference(foreach.map);
      for (let i = 0; i < items.length; i++) {
        this.context.setVariable(indexVar, i);
        this.context.setVariable(itemVar, items[i]);
        const result = await this.context.evaluateExpression(foreach.transform);
        results.push(result);
      }
      if (foreach.returns) {
        this.context.setVariable(foreach.returns, results);
      }
      return;
    }

    if (foreach.filter) {
      // Filter operation
      const results = [];
      const items = await this.context.resolveReference(foreach.filter);
      for (let i = 0; i < items.length; i++) {
        this.context.setVariable(indexVar, i);
        this.context.setVariable(itemVar, items[i]);
        const condition = await this.context.evaluateExpression(foreach.condition);
        if (condition) {
          results.push(items[i]);
        }
      }
      if (foreach.returns) {
        this.context.setVariable(foreach.returns, results);
      }
      return;
    }

    // Standard foreach loop
    if (Array.isArray(collection)) {
      for (let i = 0; i < collection.length; i++) {
        this.context.setVariable(indexVar, i);
        this.context.setVariable(itemVar, collection[i]);
        await this.executeActions(foreach.do || foreach.actions);
      }
    } else if (typeof collection === 'object') {
      const entries = Object.entries(collection);
      for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        this.context.setVariable(indexVar, i);
        this.context.setVariable('_key', key);
        this.context.setVariable(itemVar, value);
        await this.executeActions(foreach.do || foreach.actions);
      }
    }
  }

  /**
   * Execute a while loop
   * @param {Object} whileLoop - While loop configuration
   */
  async executeWhile(whileLoop) {
    const condition = typeof whileLoop === 'string' ? whileLoop : whileLoop.condition;
    const actions = whileLoop.do || whileLoop.actions;

    let iterations = 0;
    const maxIterations = 10000; // Safety limit

    while (await this.context.evaluateExpression(condition)) {
      if (iterations++ > maxIterations) {
        throw new Error(`While loop exceeded maximum iterations (${maxIterations})`);
      }
      this.context.setVariable('_iteration', iterations);
      await this.executeActions(actions);
    }
  }

  /**
   * Execute a repeat action
   * @param {Object} repeat - Repeat configuration
   */
  async executeRepeat(repeat) {
    const times = typeof repeat === 'number' ? repeat : repeat.times;
    const actions = repeat.do || repeat.actions;

    for (let i = 0; i < times; i++) {
      this.context.setVariable('_index', i);
      this.context.setVariable('_iteration', i + 1);
      if (actions) {
        await this.executeActions(actions);
      }
    }
  }

  /**
   * Execute a try/catch block
   * @param {Object} tryBlock - Try/catch configuration
   */
  async executeTryCatch(tryBlock) {
    try {
      await this.executeActions(tryBlock.try || tryBlock.actions);
    } catch (error) {
      this.context.setVariable('$error', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      if (tryBlock.catch) {
        await this.executeActions(tryBlock.catch);
      }

      if (tryBlock.finally) {
        await this.executeActions(tryBlock.finally);
      }
    }
  }

  /**
   * Execute an assert statement
   * @param {*} condition - Condition to assert
   * @param {string} message - Error message if assertion fails
   */
  async executeAssert(condition, message) {
    const result = await this.context.evaluateExpression(condition);
    if (!result) {
      throw new Error(`Assertion failed: ${message || condition}`);
    }
    console.log(chalk.green(`  ✓ Assertion passed: ${condition}`));
  }

  /**
   * Execute a keyword run action
   * @param {string} keyword - Keyword name
   * @param {*} params - Keyword parameters
   * @param {string} returns - Variable to store return value
   */
  async executeKeywordRun(keyword, params, returns) {
    // Check if keyword manager has the keyword
    if (this.keywordManager && this.keywordManager.hasKeyword(keyword)) {
      const result = await this.keywordManager.executeKeyword(keyword, params);
      if (returns) {
        this.context.setVariable(returns, result);
      }
    } else {
      console.log(chalk.yellow(`  ⚠️ Keyword not found: ${keyword}`));
    }
  }

  /**
   * Execute a contract action
   * @param {Object} contract - Contract action configuration
   * @param {string} returns - Variable to store return value
   */
  async executeContract(contract, returns) {
    if (contract.deploy) {
      // Deploy a new contract
      const deployment = contract.deploy;
      const result = await this.contractActions.executeDeploy({
        contract: deployment.type,  // Changed from 'type' to 'contract'
        name: deployment.name,
        from: deployment.from,
        args: deployment.args,
        value: deployment.value
      });
      return result;
    } else if (contract.call) {
      // Call a contract method
      const call = contract.call;
      // Resolve the address if it contains template syntax
      const resolvedAddress = await this.context.resolveReference(call.address);
      const result = await this.contractActions.executeCall({
        contract: resolvedAddress,
        method: call.method,
        args: call.args,
        from: call.from,
        value: call.value
      });
      return result;
    } else {
      throw new Error('Contract action must have either deploy or call');
    }
  }

  /**
   * Execute a keyword (for future keyword library support)
   * @param {string} keyword - Keyword name
   * @param {Object} args - Keyword arguments
   */
  async executeKeyword(keyword, args) {
    console.log(chalk.yellow(`  ⚠️ Keywords not yet implemented: ${keyword}`));
    // Future: Load keyword from library and execute
  }

  /**
   * Flatten nested scenario structure
   * @param {Object} scenario - Nested scenario object
   * @returns {Array} Flattened action array
   */
  flattenScenario(scenario) {
    const actions = [];

    for (const [section, sectionActions] of Object.entries(scenario)) {
      actions.push({ log: `Section: ${section}` });
      actions.push(...sectionActions);
    }

    return actions;
  }

  /**
   * Generate test execution summary
   * @returns {Object} Test summary
   */
  generateSummary() {
    const results = this.context.getResults();
    const metrics = this.context.getMetricsSummary();

    return {
      totalActions: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      duration: this.testResult?.duration || 0,
      metrics,
      gasUsed: this.testResult?.gasUsed || 0
    };
  }

  /**
   * Load keywords from definition
   */
  async loadKeywords(keywordsConfig) {
    if (typeof keywordsConfig === 'string') {
      // Load from file
      await this.keywordManager.loadKeywordsFromFile(keywordsConfig);
    } else if (Array.isArray(keywordsConfig)) {
      // Load multiple files
      for (const file of keywordsConfig) {
        await this.keywordManager.loadKeywordsFromFile(file);
      }
    } else if (typeof keywordsConfig === 'object') {
      // Inline keywords
      for (const [name, definition] of Object.entries(keywordsConfig)) {
        this.keywordManager.registerKeyword(name, definition);
      }
    }

    console.log(chalk.gray(`  ✓ Loaded ${this.keywordManager.listKeywords().length} keywords`));
  }

  /**
   * Execute wallet-specific actions
   */
  async executeWalletAction(walletAction) {
    const { action, wallet, ...params } = walletAction;

    switch (action) {
      case 'create':
        return await this.walletManager.createWallet(wallet || params.name, params.config || params);

      case 'sign':
        if (params.message) {
          return await this.walletManager.signMessage(wallet, params.message);
        } else if (params.transaction) {
          return await this.walletManager.signTransaction(wallet, params.transaction);
        }
        break;

      case 'send':
        return await this.walletManager.sendTransaction(wallet, params);

      case 'fund':
        return await this.walletManager.fundWallet(params.from || 'deployer', wallet, params.amount);

      case 'balance':
        return await this.walletManager.getBalance(wallet);

      default:
        throw new Error(`Unknown wallet action: ${action}`);
    }
  }

  /**
   * Make context methods available for control flow
   */
  getContext() {
    // Extend context with executor methods for control flow
    this.context.executeAction = this.executeAction.bind(this);
    this.context.executeActions = this.executeActions.bind(this);
    return this.context;
  }
}

module.exports = { YAMLTestExecutor };