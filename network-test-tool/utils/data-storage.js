const fs = require('fs').promises;
const path = require('path');
const { ethers } = require('ethers');
const { logger } = require('./logger');

/**
 * Comprehensive Data Storage System for Load Testing Analytics
 * Stores all test operations, metrics, and results in structured JSON format
 */

class DataStorage {
  constructor(options = {}) {
    // Base data directory
    this.baseDataDir = path.join(__dirname, '..', 'data');
    
    // Storage mode options
    this.storageMode = options.storageMode || 'mixed'; // 'isolated', 'global', 'mixed'
    this.sessionName = options.sessionName || null; // Custom session name for isolation
    this.autoArchive = options.autoArchive !== false; // Auto-archive old sessions
    this.retentionDays = options.retentionDays || 30; // Default retention period
    
    // Directory structure setup
    this.setupDirectoryStructure();
    
    this.currentSession = null;
    this.operations = [];
    this.deployments = [];
    this.transactions = [];
  }

  setupDirectoryStructure() {
    if (this.storageMode === 'isolated' && this.sessionName) {
      // Isolated mode: separate directory for this session
      this.dataDir = path.join(this.baseDataDir, 'isolated', this.sessionName);
      this.sessionsDir = path.join(this.dataDir, 'sessions');
      this.contractsDir = path.join(this.dataDir, 'contracts');
      this.metricsDir = path.join(this.dataDir, 'metrics');
      this.analyticsDir = path.join(this.dataDir, 'analytics');
    } else if (this.storageMode === 'global') {
      // Global mode: all data in global directory
      this.dataDir = path.join(this.baseDataDir, 'global');
      this.sessionsDir = path.join(this.dataDir, 'sessions');
      this.contractsDir = path.join(this.dataDir, 'contracts');
      this.metricsDir = path.join(this.dataDir, 'metrics');
      this.analyticsDir = path.join(this.dataDir, 'analytics');
    } else {
      // Mixed mode: default behavior with both global and isolated options
      this.dataDir = path.join(this.baseDataDir, 'mixed');
      this.globalDir = path.join(this.baseDataDir, 'global');
      this.isolatedBaseDir = path.join(this.baseDataDir, 'isolated');
      
      this.sessionsDir = path.join(this.dataDir, 'sessions');
      this.contractsDir = path.join(this.dataDir, 'contracts');
      this.metricsDir = path.join(this.dataDir, 'metrics');
      this.analyticsDir = path.join(this.dataDir, 'analytics');
      
      // Global directories for aggregated data
      this.globalSessionsDir = path.join(this.globalDir, 'sessions');
      this.globalMetricsDir = path.join(this.globalDir, 'metrics');
      this.globalAnalyticsDir = path.join(this.globalDir, 'analytics');
    }
  }

  async init() {
    // Create data directories
    await this.ensureDirectories();
    
    // Start new session
    this.currentSession = {
      sessionId: this.generateSessionId(),
      startTime: new Date().toISOString(),
      endTime: null,
      testType: null,
      networks: [],
      configuration: {},
      summary: {},
      operations: [],
      deployments: [],
      transactions: [],
      metrics: {},
      errors: [],
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        timestamp: Date.now()
      }
    };
    
    logger.info(`📊 Started data collection session: ${this.currentSession.sessionId}`);
    return this.currentSession.sessionId;
  }

  async ensureDirectories() {
    let dirs = [this.dataDir, this.sessionsDir, this.contractsDir, this.metricsDir, this.analyticsDir];
    
    // Add global directories if in mixed mode
    if (this.storageMode === 'mixed') {
      dirs.push(
        this.globalDir, 
        this.globalSessionsDir, 
        this.globalMetricsDir, 
        this.globalAnalyticsDir,
        this.isolatedBaseDir
      );
    }
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        logger.warning(`Failed to create directory ${dir}: ${error.message}`);
      }
    }
  }

  generateSessionId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `session-${timestamp}-${random}`;
  }

  // Set test configuration
  setTestConfiguration(testType, config) {
    if (!this.currentSession) return;
    
    this.currentSession.testType = testType;
    this.currentSession.configuration = {
      ...config,
      timestamp: new Date().toISOString()
    };
  }

  // Record contract deployment
  async recordDeployment(networkName, contractName, deploymentData) {
    const deployment = {
      deploymentId: this.generateOperationId(),
      timestamp: new Date().toISOString(),
      network: networkName,
      contractName,
      contractAddress: deploymentData.address,
      deployerAddress: deploymentData.deployer,
      transactionHash: deploymentData.transactionHash,
      blockNumber: deploymentData.blockNumber,
      gasUsed: deploymentData.gasUsed ? parseInt(deploymentData.gasUsed.toString()) : null,
      gasPrice: deploymentData.gasPrice ? parseFloat(ethers.utils.formatUnits(deploymentData.gasPrice, 'gwei')) : null,
      deploymentCost: deploymentData.cost ? parseFloat(ethers.utils.formatEther(deploymentData.cost)) : null,
      constructorArgs: deploymentData.constructorArgs || [],
      compilationMetadata: deploymentData.compilationMetadata || {},
      verification: deploymentData.verification || null
    };

    this.currentSession.deployments.push(deployment);
    
    // Save individual deployment record
    const deploymentFile = path.join(this.contractsDir, `deployment-${deployment.deploymentId}.json`);
    await this.saveJSON(deploymentFile, deployment);
    
    logger.info(`📄 Recorded deployment: ${contractName} at ${deploymentData.address}`);
    return deployment.deploymentId;
  }

  // Record individual transaction
  async recordTransaction(networkName, operationType, transactionData) {
    const transaction = {
      transactionId: this.generateOperationId(),
      timestamp: new Date().toISOString(),
      network: networkName,
      operationType,
      transactionHash: transactionData.hash,
      blockNumber: transactionData.blockNumber,
      blockHash: transactionData.blockHash,
      from: transactionData.from,
      to: transactionData.to,
      value: transactionData.value ? ethers.utils.formatEther(transactionData.value) : '0',
      gasUsed: transactionData.gasUsed ? parseInt(transactionData.gasUsed.toString()) : null,
      gasLimit: transactionData.gasLimit ? parseInt(transactionData.gasLimit.toString()) : null,
      gasPrice: transactionData.gasPrice ? parseFloat(ethers.utils.formatUnits(transactionData.gasPrice, 'gwei')) : null,
      nonce: transactionData.nonce,
      status: transactionData.status || 1,
      logs: transactionData.logs || [],
      events: this.parseEvents(transactionData.events || []),
      executionTime: transactionData.executionTime || null,
      confirmationTime: transactionData.confirmationTime || null,
      revertReason: transactionData.revertReason || null,
      effectiveGasPrice: transactionData.effectiveGasPrice ? 
        parseFloat(ethers.utils.formatUnits(transactionData.effectiveGasPrice, 'gwei')) : null
    };

    this.currentSession.transactions.push(transaction);
    return transaction.transactionId;
  }

  // Record operation (group of transactions)
  async recordOperation(networkName, operationType, operationData) {
    const operation = {
      operationId: this.generateOperationId(),
      timestamp: new Date().toISOString(),
      network: networkName,
      operationType,
      startTime: operationData.startTime,
      endTime: operationData.endTime,
      executionTime: operationData.endTime - operationData.startTime,
      success: operationData.success,
      transactionIds: operationData.transactionIds || [],
      gasMetrics: {
        totalGasUsed: operationData.totalGasUsed || 0,
        averageGasPrice: operationData.averageGasPrice || 0,
        totalCost: operationData.totalCost || 0
      },
      operationSpecific: operationData.operationSpecific || {},
      errors: operationData.errors || [],
      warnings: operationData.warnings || []
    };

    this.currentSession.operations.push(operation);
    return operation.operationId;
  }

  // Record detailed metrics
  async recordMetrics(networkName, metricsData) {
    if (!this.currentSession.metrics[networkName]) {
      this.currentSession.metrics[networkName] = {};
    }

    const networkMetrics = {
      timestamp: new Date().toISOString(),
      gasAnalysis: metricsData.gasAnalysis || {},
      performanceMetrics: metricsData.performanceMetrics || {},
      slippageData: metricsData.slippageData || [],
      successRates: metricsData.successRates || {},
      throughput: metricsData.throughput || {},
      costAnalysis: metricsData.costAnalysis || {},
      customMetrics: metricsData.customMetrics || {}
    };

    this.currentSession.metrics[networkName] = {
      ...this.currentSession.metrics[networkName],
      ...networkMetrics
    };
  }

  // Record error or failure
  recordError(networkName, operationType, errorData) {
    const error = {
      errorId: this.generateOperationId(),
      timestamp: new Date().toISOString(),
      network: networkName,
      operationType,
      errorMessage: errorData.message,
      errorCode: errorData.code || null,
      stackTrace: errorData.stack || null,
      transactionHash: errorData.transactionHash || null,
      gasUsed: errorData.gasUsed || null,
      revertReason: errorData.revertReason || null,
      context: errorData.context || {}
    };

    this.currentSession.errors.push(error);
  }

  // Add network to session
  addNetwork(networkName, networkConfig) {
    if (!this.currentSession.networks.find(n => n.name === networkName)) {
      this.currentSession.networks.push({
        name: networkName,
        chainId: networkConfig.chainId,
        rpcUrl: networkConfig.rpcUrl,
        currency: networkConfig.currency || 'ETH',
        explorerUrl: networkConfig.explorerUrl,
        addedAt: new Date().toISOString()
      });
    }
  }

  // Generate operation ID
  generateOperationId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `op-${timestamp}-${random}`;
  }

  // Parse events from transaction receipt
  parseEvents(events) {
    return events.map(event => ({
      eventName: event.event || 'Unknown',
      signature: event.eventSignature || null,
      args: event.args ? Object.keys(event.args).reduce((acc, key) => {
        if (isNaN(key)) {
          acc[key] = event.args[key].toString();
        }
        return acc;
      }, {}) : {},
      topics: event.topics || [],
      data: event.data || null
    }));
  }

  // Finalize session and save all data
  async finalizeSession(summary = {}) {
    if (!this.currentSession) return null;

    this.currentSession.endTime = new Date().toISOString();
    this.currentSession.duration = new Date(this.currentSession.endTime) - new Date(this.currentSession.startTime);
    this.currentSession.summary = {
      totalOperations: this.currentSession.operations.length,
      totalTransactions: this.currentSession.transactions.length,
      totalDeployments: this.currentSession.deployments.length,
      totalErrors: this.currentSession.errors.length,
      networksCount: this.currentSession.networks.length,
      ...summary
    };

    // Save complete session data
    const sessionFile = path.join(this.sessionsDir, `${this.currentSession.sessionId}.json`);
    await this.saveJSON(sessionFile, this.currentSession);

    // Save metrics summary
    const metricsFile = path.join(this.metricsDir, `metrics-${this.currentSession.sessionId}.json`);
    await this.saveJSON(metricsFile, {
      sessionId: this.currentSession.sessionId,
      networks: this.currentSession.networks.map(n => n.name),
      metrics: this.currentSession.metrics,
      summary: this.currentSession.summary
    });

    // Create analytics-friendly export
    await this.createAnalyticsExport();

    // Save to global if in mixed mode
    if (this.storageMode === 'mixed') {
      await this.saveToGlobal();
    }

    // Auto-archive if enabled
    if (this.autoArchive) {
      await this.autoArchiveOldSessions();
    }

    logger.success(`📊 Session finalized: ${this.currentSession.sessionId}`);
    logger.info(`📁 Data saved in: ${this.dataDir}`);
    
    const sessionId = this.currentSession.sessionId;
    this.currentSession = null;
    return sessionId;
  }

  // Create analytics-friendly data export
  async createAnalyticsExport() {
    if (!this.currentSession) return;

    const analyticsData = {
      sessionInfo: {
        id: this.currentSession.sessionId,
        testType: this.currentSession.testType,
        startTime: this.currentSession.startTime,
        endTime: this.currentSession.endTime,
        duration: this.currentSession.duration,
        networks: this.currentSession.networks.map(n => n.name)
      },
      networkComparison: this.buildNetworkComparison(),
      transactionAnalysis: this.buildTransactionAnalysis(),
      gasAnalysis: this.buildGasAnalysis(),
      performanceAnalysis: this.buildPerformanceAnalysis(),
      costAnalysis: this.buildCostAnalysis(),
      timeSeriesData: this.buildTimeSeriesData(),
      errorAnalysis: this.buildErrorAnalysis()
    };

    const analyticsFile = path.join(this.dataDir, `analytics-${this.currentSession.sessionId}.json`);
    await this.saveJSON(analyticsFile, analyticsData);
  }

  // Build network comparison data
  buildNetworkComparison() {
    const comparison = {};
    
    for (const network of this.currentSession.networks) {
      const networkTransactions = this.currentSession.transactions.filter(t => t.network === network.name);
      const networkOperations = this.currentSession.operations.filter(o => o.network === network.name);
      const networkDeployments = this.currentSession.deployments.filter(d => d.network === network.name);
      
      comparison[network.name] = {
        transactionCount: networkTransactions.length,
        operationCount: networkOperations.length,
        deploymentCount: networkDeployments.length,
        averageGasPrice: this.calculateAverage(networkTransactions, 'gasPrice'),
        averageGasUsed: this.calculateAverage(networkTransactions, 'gasUsed'),
        totalCost: networkTransactions.reduce((sum, t) => {
          return sum + (t.gasUsed * t.gasPrice * 1e-18);
        }, 0),
        successRate: networkTransactions.filter(t => t.status === 1).length / Math.max(networkTransactions.length, 1),
        averageExecutionTime: this.calculateAverage(networkTransactions, 'executionTime'),
        metrics: this.currentSession.metrics[network.name] || {}
      };
    }
    
    return comparison;
  }

  buildTransactionAnalysis() {
    const analysis = {
      totalTransactions: this.currentSession.transactions.length,
      byNetwork: {},
      byOperationType: {},
      gasDistribution: [],
      executionTimeDistribution: [],
      statusDistribution: {}
    };

    // Group by network and operation type
    this.currentSession.transactions.forEach(tx => {
      // By network
      if (!analysis.byNetwork[tx.network]) {
        analysis.byNetwork[tx.network] = [];
      }
      analysis.byNetwork[tx.network].push({
        hash: tx.transactionHash,
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        executionTime: tx.executionTime,
        status: tx.status
      });

      // By operation type
      if (!analysis.byOperationType[tx.operationType]) {
        analysis.byOperationType[tx.operationType] = [];
      }
      analysis.byOperationType[tx.operationType].push(tx.transactionId);

      // Gas and time distributions
      if (tx.gasUsed) analysis.gasDistribution.push(tx.gasUsed);
      if (tx.executionTime) analysis.executionTimeDistribution.push(tx.executionTime);

      // Status distribution
      const status = tx.status === 1 ? 'success' : 'failed';
      analysis.statusDistribution[status] = (analysis.statusDistribution[status] || 0) + 1;
    });

    return analysis;
  }

  buildGasAnalysis() {
    const transactions = this.currentSession.transactions.filter(t => t.gasUsed);
    
    return {
      totalGasUsed: transactions.reduce((sum, t) => sum + t.gasUsed, 0),
      averageGasUsed: this.calculateAverage(transactions, 'gasUsed'),
      medianGasUsed: this.calculateMedian(transactions.map(t => t.gasUsed)),
      averageGasPrice: this.calculateAverage(transactions, 'gasPrice'),
      maxGasUsed: Math.max(...transactions.map(t => t.gasUsed)),
      minGasUsed: Math.min(...transactions.map(t => t.gasUsed)),
      gasEfficiencyByNetwork: this.calculateGasEfficiencyByNetwork()
    };
  }

  buildPerformanceAnalysis() {
    const operations = this.currentSession.operations;
    
    return {
      totalOperations: operations.length,
      averageExecutionTime: this.calculateAverage(operations, 'executionTime'),
      throughputByNetwork: this.calculateThroughputByNetwork(),
      operationSuccessRate: operations.filter(o => o.success).length / Math.max(operations.length, 1),
      performanceByOperationType: this.calculatePerformanceByOperationType()
    };
  }

  buildCostAnalysis() {
    const analysis = {};
    
    this.currentSession.networks.forEach(network => {
      const networkTx = this.currentSession.transactions.filter(t => t.network === network.name);
      const totalCost = networkTx.reduce((sum, t) => {
        return sum + ((t.gasUsed || 0) * (t.gasPrice || 0) * 1e-9); // Convert to ETH equivalent
      }, 0);
      
      analysis[network.name] = {
        totalCost,
        averageCostPerTransaction: totalCost / Math.max(networkTx.length, 1),
        costByOperationType: this.calculateCostByOperationType(network.name)
      };
    });
    
    return analysis;
  }

  buildTimeSeriesData() {
    const timeSeries = {
      transactions: [],
      gasUsage: [],
      executionTimes: []
    };

    // Sort transactions by timestamp
    const sortedTransactions = [...this.currentSession.transactions].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    sortedTransactions.forEach(tx => {
      const timestamp = new Date(tx.timestamp).getTime();
      
      timeSeries.transactions.push({
        timestamp,
        network: tx.network,
        operationType: tx.operationType,
        success: tx.status === 1
      });

      if (tx.gasUsed) {
        timeSeries.gasUsage.push({
          timestamp,
          network: tx.network,
          gasUsed: tx.gasUsed,
          gasPrice: tx.gasPrice
        });
      }

      if (tx.executionTime) {
        timeSeries.executionTimes.push({
          timestamp,
          network: tx.network,
          executionTime: tx.executionTime
        });
      }
    });

    return timeSeries;
  }

  buildErrorAnalysis() {
    return {
      totalErrors: this.currentSession.errors.length,
      errorsByNetwork: this.currentSession.errors.reduce((acc, error) => {
        acc[error.network] = (acc[error.network] || 0) + 1;
        return acc;
      }, {}),
      errorsByType: this.currentSession.errors.reduce((acc, error) => {
        acc[error.operationType] = (acc[error.operationType] || 0) + 1;
        return acc;
      }, {}),
      commonErrors: this.findCommonErrors()
    };
  }

  // Helper methods
  calculateAverage(array, property) {
    const values = array.map(item => item[property]).filter(v => v != null && !isNaN(v));
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  calculateMedian(values) {
    const sorted = values.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  calculateGasEfficiencyByNetwork() {
    const efficiency = {};
    
    this.currentSession.networks.forEach(network => {
      const networkTx = this.currentSession.transactions.filter(t => 
        t.network === network.name && t.gasUsed
      );
      
      if (networkTx.length > 0) {
        efficiency[network.name] = {
          averageGasUsed: this.calculateAverage(networkTx, 'gasUsed'),
          gasUsedVariance: this.calculateVariance(networkTx.map(t => t.gasUsed)),
          totalTransactions: networkTx.length
        };
      }
    });
    
    return efficiency;
  }

  calculateThroughputByNetwork() {
    const throughput = {};
    
    this.currentSession.networks.forEach(network => {
      const networkOps = this.currentSession.operations.filter(o => o.network === network.name);
      const totalTime = networkOps.reduce((sum, op) => sum + op.executionTime, 0);
      
      throughput[network.name] = totalTime > 0 ? (networkOps.length * 1000) / totalTime : 0;
    });
    
    return throughput;
  }

  calculatePerformanceByOperationType() {
    const performance = {};
    
    const operationTypes = [...new Set(this.currentSession.operations.map(o => o.operationType))];
    
    operationTypes.forEach(type => {
      const operations = this.currentSession.operations.filter(o => o.operationType === type);
      performance[type] = {
        count: operations.length,
        averageExecutionTime: this.calculateAverage(operations, 'executionTime'),
        successRate: operations.filter(o => o.success).length / Math.max(operations.length, 1)
      };
    });
    
    return performance;
  }

  calculateCostByOperationType(networkName) {
    const costs = {};
    
    const networkTx = this.currentSession.transactions.filter(t => t.network === networkName);
    const operationTypes = [...new Set(networkTx.map(t => t.operationType))];
    
    operationTypes.forEach(type => {
      const typeTx = networkTx.filter(t => t.operationType === type);
      costs[type] = typeTx.reduce((sum, t) => {
        return sum + ((t.gasUsed || 0) * (t.gasPrice || 0) * 1e-9);
      }, 0);
    });
    
    return costs;
  }

  calculateVariance(values) {
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  findCommonErrors() {
    const errorMessages = this.currentSession.errors.map(e => e.errorMessage).filter(msg => msg);
    const errorCounts = {};
    
    errorMessages.forEach(msg => {
      // Extract error type (first few words)
      const errorType = msg && msg.split ? msg.split(' ').slice(0, 3).join(' ') : 'Unknown Error';
      errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
    });
    
    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
  }

  // Save JSON file with error handling
  async saveJSON(filePath, data) {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      logger.error(`Failed to save JSON file ${filePath}: ${error.message}`);
      return false;
    }
  }

  // Get current session data
  getCurrentSession() {
    return this.currentSession;
  }

  // List all sessions
  async listSessions() {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionData = JSON.parse(await fs.readFile(path.join(this.sessionsDir, file), 'utf8'));
          sessions.push({
            sessionId: sessionData.sessionId,
            testType: sessionData.testType,
            startTime: sessionData.startTime,
            endTime: sessionData.endTime,
            networks: sessionData.networks.map(n => n.name),
            operationCount: sessionData.operations.length,
            transactionCount: sessionData.transactions.length
          });
        }
      }
      
      return sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    } catch (error) {
      logger.error(`Failed to list sessions: ${error.message}`);
      return [];
    }
  }

  // Load session data
  async loadSession(sessionId) {
    try {
      const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
      const sessionData = JSON.parse(await fs.readFile(sessionFile, 'utf8'));
      return sessionData;
    } catch (error) {
      logger.error(`Failed to load session ${sessionId}: ${error.message}`);
      return null;
    }
  }

  // Save session data to global directory (mixed mode)
  async saveToGlobal() {
    if (!this.currentSession || this.storageMode !== 'mixed') return;
    
    try {
      // Copy session to global
      const globalSessionFile = path.join(this.globalSessionsDir, `${this.currentSession.sessionId}.json`);
      await this.saveJSON(globalSessionFile, this.currentSession);
      
      // Copy metrics to global
      const globalMetricsFile = path.join(this.globalMetricsDir, `metrics-${this.currentSession.sessionId}.json`);
      const metricsData = {
        sessionId: this.currentSession.sessionId,
        networks: this.currentSession.networks.map(n => n.name),
        metrics: this.currentSession.metrics,
        summary: this.currentSession.summary
      };
      await this.saveJSON(globalMetricsFile, metricsData);
      
      // Copy analytics to global
      const analyticsFile = path.join(this.analyticsDir, `analytics-${this.currentSession.sessionId}.json`);
      const globalAnalyticsFile = path.join(this.globalAnalyticsDir, `analytics-${this.currentSession.sessionId}.json`);
      
      try {
        const analyticsData = JSON.parse(await fs.readFile(analyticsFile, 'utf8'));
        await this.saveJSON(globalAnalyticsFile, analyticsData);
      } catch (error) {
        logger.warning(`Failed to copy analytics to global: ${error.message}`);
      }
      
      logger.info('📊 Session data copied to global repository');
    } catch (error) {
      logger.error(`Failed to save to global: ${error.message}`);
    }
  }

  // Auto-archive old sessions
  async autoArchiveOldSessions() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      const sessions = await this.listSessions();
      const sessionsToArchive = sessions.filter(session => 
        new Date(session.startTime) < cutoffDate
      );
      
      if (sessionsToArchive.length > 0) {
        const archiveDir = path.join(this.dataDir, 'archive', cutoffDate.toISOString().split('T')[0]);
        await fs.mkdir(archiveDir, { recursive: true });
        
        for (const session of sessionsToArchive) {
          await this.archiveSession(session.sessionId, archiveDir);
        }
        
        logger.info(`📦 Auto-archived ${sessionsToArchive.length} old sessions`);
      }
    } catch (error) {
      logger.error(`Auto-archive failed: ${error.message}`);
    }
  }

  // Archive a specific session
  async archiveSession(sessionId, archiveDir = null) {
    try {
      if (!archiveDir) {
        archiveDir = path.join(this.dataDir, 'archive', new Date().toISOString().split('T')[0]);
        await fs.mkdir(archiveDir, { recursive: true });
      }
      
      // Move session files
      const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
      const metricsFile = path.join(this.metricsDir, `metrics-${sessionId}.json`);
      const analyticsFile = path.join(this.analyticsDir, `analytics-${sessionId}.json`);
      
      const archiveSessionFile = path.join(archiveDir, `${sessionId}.json`);
      const archiveMetricsFile = path.join(archiveDir, `metrics-${sessionId}.json`);
      const archiveAnalyticsFile = path.join(archiveDir, `analytics-${sessionId}.json`);
      
      // Move files to archive
      try {
        await fs.rename(sessionFile, archiveSessionFile);
        await fs.rename(metricsFile, archiveMetricsFile);
        await fs.rename(analyticsFile, archiveAnalyticsFile);
      } catch (error) {
        // Files might not exist, that's okay
        logger.warning(`Some files missing during archive of ${sessionId}: ${error.message}`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to archive session ${sessionId}: ${error.message}`);
      return false;
    }
  }

  // Purge data older than specified date
  async purgeDataBefore(cutoffDate, options = {}) {
    const {
      dryRun = false,
      preserveArchive = true,
      purgeContracts = true,
      purgeMetrics = true,
      purgeAnalytics = true
    } = options;
    
    const results = {
      sessionsDeleted: 0,
      contractsDeleted: 0,
      metricsDeleted: 0,
      analyticsDeleted: 0,
      errors: []
    };
    
    try {
      logger.info(`🧹 ${dryRun ? 'Dry run: ' : ''}Purging data before ${cutoffDate.toISOString()}`);
      
      // Purge sessions
      const sessions = await this.listSessions();
      const sessionsToPurge = sessions.filter(session => 
        new Date(session.startTime) < cutoffDate
      );
      
      for (const session of sessionsToPurge) {
        try {
          if (!dryRun) {
            // Archive before deleting if not preserving archive
            if (!preserveArchive) {
              await this.archiveSession(session.sessionId);
            }
            
            // Delete session files
            await this.deleteSessionFiles(session.sessionId);
          }
          results.sessionsDeleted++;
        } catch (error) {
          results.errors.push(`Session ${session.sessionId}: ${error.message}`);
        }
      }
      
      // Purge contracts by date
      if (purgeContracts) {
        const contractFiles = await this.getFilesByDate(this.contractsDir, cutoffDate);
        for (const file of contractFiles) {
          try {
            if (!dryRun) {
              await fs.unlink(path.join(this.contractsDir, file));
            }
            results.contractsDeleted++;
          } catch (error) {
            results.errors.push(`Contract ${file}: ${error.message}`);
          }
        }
      }
      
      // Purge metrics by date
      if (purgeMetrics) {
        const metricsFiles = await this.getFilesByDate(this.metricsDir, cutoffDate);
        for (const file of metricsFiles) {
          try {
            if (!dryRun) {
              await fs.unlink(path.join(this.metricsDir, file));
            }
            results.metricsDeleted++;
          } catch (error) {
            results.errors.push(`Metrics ${file}: ${error.message}`);
          }
        }
      }
      
      // Purge analytics by date
      if (purgeAnalytics) {
        const analyticsFiles = await this.getFilesByDate(this.analyticsDir, cutoffDate);
        for (const file of analyticsFiles) {
          try {
            if (!dryRun) {
              await fs.unlink(path.join(this.analyticsDir, file));
            }
            results.analyticsDeleted++;
          } catch (error) {
            results.errors.push(`Analytics ${file}: ${error.message}`);
          }
        }
      }
      
      logger.success(`🧹 Purge ${dryRun ? 'simulation ' : ''}completed:`);
      logger.info(`  Sessions: ${results.sessionsDeleted}`);
      logger.info(`  Contracts: ${results.contractsDeleted}`);
      logger.info(`  Metrics: ${results.metricsDeleted}`);
      logger.info(`  Analytics: ${results.analyticsDeleted}`);
      
      if (results.errors.length > 0) {
        logger.warning(`  Errors: ${results.errors.length}`);
        results.errors.forEach(error => logger.warning(`    ${error}`));
      }
      
    } catch (error) {
      logger.error(`Purge operation failed: ${error.message}`);
      results.errors.push(error.message);
    }
    
    return results;
  }

  // Delete session files
  async deleteSessionFiles(sessionId) {
    const filesToDelete = [
      path.join(this.sessionsDir, `${sessionId}.json`),
      path.join(this.metricsDir, `metrics-${sessionId}.json`),
      path.join(this.analyticsDir, `analytics-${sessionId}.json`)
    ];
    
    for (const filePath of filesToDelete) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist, continue
      }
    }
  }

  // Get files older than cutoff date
  async getFilesByDate(directory, cutoffDate) {
    try {
      const files = await fs.readdir(directory);
      const oldFiles = [];
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          oldFiles.push(file);
        }
      }
      
      return oldFiles;
    } catch (error) {
      logger.error(`Failed to scan directory ${directory}: ${error.message}`);
      return [];
    }
  }

  // Create isolated session storage
  static createIsolated(sessionName, options = {}) {
    return new DataStorage({
      storageMode: 'isolated',
      sessionName: sessionName,
      ...options
    });
  }

  // Create global session storage
  static createGlobal(options = {}) {
    return new DataStorage({
      storageMode: 'global',
      ...options
    });
  }

  // Get storage stats
  async getStorageStats() {
    const stats = {
      storageMode: this.storageMode,
      dataDirectory: this.dataDir,
      totalSessions: 0,
      totalSize: 0,
      oldestSession: null,
      newestSession: null,
      networkCoverage: new Set(),
      testTypes: new Set()
    };
    
    try {
      const sessions = await this.listSessions();
      stats.totalSessions = sessions.length;
      
      if (sessions.length > 0) {
        stats.oldestSession = sessions[sessions.length - 1].startTime;
        stats.newestSession = sessions[0].startTime;
        
        // Collect network and test type info
        for (const session of sessions) {
          session.networks?.forEach(network => stats.networkCoverage.add(network));
          if (session.testType) stats.testTypes.add(session.testType);
        }
      }
      
      stats.networkCoverage = Array.from(stats.networkCoverage);
      stats.testTypes = Array.from(stats.testTypes);
      
      // Calculate total size
      stats.totalSize = await this.calculateDirectorySize(this.dataDir);
      
    } catch (error) {
      logger.error(`Failed to get storage stats: ${error.message}`);
    }
    
    return stats;
  }

  // Calculate directory size
  async calculateDirectorySize(directory) {
    let totalSize = 0;
    
    try {
      const files = await fs.readdir(directory, { withFileTypes: true });
      
      for (const file of files) {
        const filePath = path.join(directory, file.name);
        
        if (file.isDirectory()) {
          totalSize += await this.calculateDirectorySize(filePath);
        } else {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }
    
    return totalSize;
  }

  // Export data for external analytics tools
  async exportForAnalytics(format = 'json', options = {}) {
    const {
      sessionIds = null, // null for all sessions
      networks = null,   // null for all networks
      dateRange = null,  // { start, end }
      includeRawData = true,
      includeAggregated = true
    } = options;
    
    try {
      const sessions = await this.listSessions();
      let filteredSessions = sessions;
      
      // Apply filters
      if (sessionIds) {
        filteredSessions = sessions.filter(s => sessionIds.includes(s.sessionId));
      }
      
      if (dateRange) {
        filteredSessions = filteredSessions.filter(s => {
          const sessionDate = new Date(s.startTime);
          return sessionDate >= dateRange.start && sessionDate <= dateRange.end;
        });
      }
      
      const exportData = {
        exportMetadata: {
          timestamp: new Date().toISOString(),
          format: format,
          sessionsIncluded: filteredSessions.length,
          options: options
        },
        sessions: []
      };
      
      // Load and process each session
      for (const sessionInfo of filteredSessions) {
        const sessionData = await this.loadSession(sessionInfo.sessionId);
        if (!sessionData) continue;
        
        // Apply network filter
        if (networks) {
          sessionData.networks = sessionData.networks.filter(n => networks.includes(n.name));
          sessionData.transactions = sessionData.transactions.filter(t => networks.includes(t.network));
          sessionData.operations = sessionData.operations.filter(o => networks.includes(o.network));
        }
        
        const processedSession = {
          sessionInfo: {
            id: sessionData.sessionId,
            testType: sessionData.testType,
            startTime: sessionData.startTime,
            endTime: sessionData.endTime,
            duration: sessionData.duration,
            networks: sessionData.networks.map(n => n.name)
          }
        };
        
        if (includeRawData) {
          processedSession.rawData = {
            operations: sessionData.operations,
            transactions: sessionData.transactions,
            deployments: sessionData.deployments,
            errors: sessionData.errors
          };
        }
        
        if (includeAggregated) {
          processedSession.aggregated = {
            networkComparison: this.buildNetworkComparisonFromSession(sessionData),
            performanceMetrics: this.buildPerformanceFromSession(sessionData),
            costAnalysis: this.buildCostAnalysisFromSession(sessionData)
          };
        }
        
        exportData.sessions.push(processedSession);
      }
      
      // Save export file
      const exportFileName = `export-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
      const exportPath = path.join(this.analyticsDir, exportFileName);
      
      if (format === 'json') {
        await this.saveJSON(exportPath, exportData);
      } else if (format === 'csv') {
        // Convert to CSV format (simplified)
        const csvData = this.convertToCSV(exportData);
        await fs.writeFile(exportPath, csvData, 'utf8');
      }
      
      logger.success(`📊 Export completed: ${exportPath}`);
      return exportPath;
      
    } catch (error) {
      logger.error(`Export failed: ${error.message}`);
      throw error;
    }
  }

  // Build network comparison from session data
  buildNetworkComparisonFromSession(sessionData) {
    const comparison = {};
    
    for (const network of sessionData.networks) {
      const networkTransactions = sessionData.transactions.filter(t => t.network === network.name);
      
      comparison[network.name] = {
        transactionCount: networkTransactions.length,
        averageGasPrice: this.calculateAverage(networkTransactions, 'gasPrice'),
        averageGasUsed: this.calculateAverage(networkTransactions, 'gasUsed'),
        successRate: networkTransactions.filter(t => t.status === 1).length / Math.max(networkTransactions.length, 1),
        averageExecutionTime: this.calculateAverage(networkTransactions, 'executionTime')
      };
    }
    
    return comparison;
  }

  buildPerformanceFromSession(sessionData) {
    return {
      totalOperations: sessionData.operations.length,
      totalTransactions: sessionData.transactions.length,
      overallSuccessRate: sessionData.operations.filter(o => o.success).length / Math.max(sessionData.operations.length, 1),
      averageExecutionTime: this.calculateAverage(sessionData.operations, 'executionTime')
    };
  }

  buildCostAnalysisFromSession(sessionData) {
    const analysis = {};
    
    for (const network of sessionData.networks) {
      const networkTx = sessionData.transactions.filter(t => t.network === network.name);
      const totalCost = networkTx.reduce((sum, t) => {
        return sum + ((t.gasUsed || 0) * (t.gasPrice || 0) * 1e-9);
      }, 0);
      
      analysis[network.name] = {
        totalCost,
        transactionCount: networkTx.length,
        averageCostPerTransaction: totalCost / Math.max(networkTx.length, 1)
      };
    }
    
    return analysis;
  }

  // Convert data to CSV format (simplified)
  convertToCSV(data) {
    // This is a simplified CSV conversion - in practice you might want a more robust solution
    const headers = ['Session ID', 'Test Type', 'Start Time', 'Network', 'Transaction Count', 'Average Gas Price', 'Success Rate'];
    const rows = [headers.join(',')];
    
    for (const session of data.sessions) {
      if (session.aggregated && session.aggregated.networkComparison) {
        for (const [network, metrics] of Object.entries(session.aggregated.networkComparison)) {
          rows.push([
            session.sessionInfo.id,
            session.sessionInfo.testType,
            session.sessionInfo.startTime,
            network,
            metrics.transactionCount,
            metrics.averageGasPrice,
            metrics.successRate
          ].join(','));
        }
      }
    }
    
    return rows.join('\n');
  }
}

// Export singleton instance and class
const dataStorage = new DataStorage();
module.exports = { dataStorage, DataStorage };