const axios = require('axios');
const crypto = require('crypto');
const cron = require('node-cron');
const chalk = require('chalk');
const { TestDatabase } = require('./database');

class WebhookNotifier {
  constructor(options = {}) {
    this.options = {
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      timeout: options.timeout || 10000,
      ...options
    };
    
    this.webhooks = new Map(); // webhook_id -> webhook_config
    this.db = new TestDatabase();
    this.scheduledTasks = new Map();
  }

  async initialize() {
    await this.db.initialize();
    console.log(chalk.green('🔗 Webhook notifier initialized'));
  }

  // Register a webhook
  registerWebhook(config) {
    const webhookId = config.id || this.generateWebhookId();
    
    const webhookConfig = {
      id: webhookId,
      url: config.url,
      events: config.events || ['test_completed', 'regression_detected', 'alert_triggered'],
      secret: config.secret,
      headers: config.headers || {},
      enabled: config.enabled !== false,
      filters: config.filters || {},
      rateLimit: config.rateLimit || { maxPerHour: 100 },
      retryConfig: config.retryConfig || this.options,
      ...config
    };
    
    this.webhooks.set(webhookId, webhookConfig);
    
    // Set up scheduled notifications if configured
    if (webhookConfig.schedule) {
      this.scheduleWebhook(webhookId, webhookConfig.schedule);
    }
    
    console.log(chalk.green(`✅ Registered webhook: ${webhookId} -> ${config.url}`));
    return webhookId;
  }

  // Remove a webhook
  unregisterWebhook(webhookId) {
    if (this.webhooks.has(webhookId)) {
      this.webhooks.delete(webhookId);
      
      // Remove scheduled task if exists
      if (this.scheduledTasks.has(webhookId)) {
        this.scheduledTasks.get(webhookId).stop();
        this.scheduledTasks.delete(webhookId);
      }
      
      console.log(chalk.yellow(`🗑️ Unregistered webhook: ${webhookId}`));
      return true;
    }
    return false;
  }

  // Send notification to webhooks
  async notify(event, data) {
    const notifications = [];
    
    for (const [webhookId, config] of this.webhooks) {
      if (!config.enabled) continue;
      if (!config.events.includes(event)) continue;
      
      // Apply filters
      if (!this.matchesFilters(data, config.filters)) continue;
      
      // Check rate limit
      if (!(await this.checkRateLimit(webhookId, config.rateLimit))) {
        console.warn(chalk.yellow(`⚠️ Rate limit exceeded for webhook: ${webhookId}`));
        continue;
      }
      
      const notification = this.sendWebhook(webhookId, event, data, config);
      notifications.push(notification);
    }
    
    return Promise.allSettled(notifications);
  }

  async sendWebhook(webhookId, event, data, config) {
    const payload = this.buildPayload(event, data, config);
    const headers = this.buildHeaders(payload, config);
    
    try {
      const response = await this.executeWebhook(config.url, payload, headers, config.retryConfig);
      
      console.log(chalk.green(`✅ Webhook sent: ${webhookId} (${response.status})`));
      
      // Log successful webhook
      await this.logWebhook(webhookId, event, payload, response.status, null);
      
      return {
        webhookId,
        success: true,
        status: response.status,
        response: response.data
      };
      
    } catch (error) {
      console.error(chalk.red(`❌ Webhook failed: ${webhookId} - ${error.message}`));
      
      // Log failed webhook
      await this.logWebhook(webhookId, event, payload, null, error.message);
      
      return {
        webhookId,
        success: false,
        error: error.message
      };
    }
  }

  async executeWebhook(url, payload, headers, retryConfig) {
    let lastError;
    
    for (let attempt = 1; attempt <= retryConfig.retryAttempts; attempt++) {
      try {
        const response = await axios.post(url, payload, {
          headers,
          timeout: retryConfig.timeout,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        });
        
        return response;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < retryConfig.retryAttempts) {
          const delay = retryConfig.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(chalk.yellow(`⏳ Webhook attempt ${attempt} failed, retrying in ${delay}ms...`));
          await this.delay(delay);
        }
      }
    }
    
    throw lastError;
  }

  buildPayload(event, data, config) {
    const basePayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      source: 'blockchain-test-tool',
      webhook: {
        id: config.id,
        version: '1.0.0'
      }
    };
    
    // Apply payload transformation if configured
    if (config.transform && typeof config.transform === 'function') {
      return config.transform(basePayload, event, data);
    }
    
    return basePayload;
  }

  buildHeaders(payload, config) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'blockchain-test-tool-webhook/1.0.0',
      ...config.headers
    };
    
    // Add signature if secret is provided
    if (config.secret) {
      const signature = this.generateSignature(JSON.stringify(payload), config.secret);
      headers['X-Webhook-Signature'] = signature;
      headers['X-Webhook-Signature-256'] = `sha256=${signature}`;
    }
    
    // Add timestamp
    headers['X-Webhook-Timestamp'] = Date.now().toString();
    
    return headers;
  }

  generateSignature(payload, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  matchesFilters(data, filters) {
    if (!filters || Object.keys(filters).length === 0) return true;
    
    for (const [key, value] of Object.entries(filters)) {
      if (this.getNestedValue(data, key) !== value) {
        return false;
      }
    }
    
    return true;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async checkRateLimit(webhookId, rateLimit) {
    // Simple in-memory rate limiting
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    // This is a simplified implementation
    // In production, you might want to use Redis or a more sophisticated solution
    if (!this.rateLimitCounters) {
      this.rateLimitCounters = new Map();
    }
    
    if (!this.rateLimitCounters.has(webhookId)) {
      this.rateLimitCounters.set(webhookId, []);
    }
    
    const timestamps = this.rateLimitCounters.get(webhookId);
    
    // Remove old timestamps
    const recentTimestamps = timestamps.filter(ts => ts > hourAgo);
    this.rateLimitCounters.set(webhookId, recentTimestamps);
    
    // Check if under limit
    if (recentTimestamps.length >= rateLimit.maxPerHour) {
      return false;
    }
    
    // Add current timestamp
    recentTimestamps.push(now);
    return true;
  }

  async logWebhook(webhookId, event, payload, status, error) {
    try {
      // Store webhook log in database
      const logEntry = {
        webhook_id: webhookId,
        event,
        payload: JSON.stringify(payload),
        status,
        error,
        timestamp: new Date().toISOString()
      };
      
      // Create webhook_logs table if it doesn't exist
      this.db.db.exec(`
        CREATE TABLE IF NOT EXISTS webhook_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          webhook_id TEXT NOT NULL,
          event TEXT NOT NULL,
          payload TEXT,
          status INTEGER,
          error TEXT,
          timestamp DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      const stmt = this.db.db.prepare(`
        INSERT INTO webhook_logs (webhook_id, event, payload, status, error, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(webhookId, event, logEntry.payload, status, error, logEntry.timestamp);
      
    } catch (logError) {
      console.error(chalk.red('Failed to log webhook:'), logError.message);
    }
  }

  // Schedule recurring webhook notifications
  scheduleWebhook(webhookId, schedule) {
    const task = cron.schedule(schedule.cron, async () => {
      try {
        const data = await this.gatherScheduledData(schedule);
        await this.notify(schedule.event || 'scheduled_report', data);
      } catch (error) {
        console.error(chalk.red(`❌ Scheduled webhook failed: ${webhookId}`), error.message);
      }
    }, {
      scheduled: schedule.enabled !== false
    });
    
    this.scheduledTasks.set(webhookId, task);
    console.log(chalk.blue(`⏰ Scheduled webhook: ${webhookId} (${schedule.cron})`));
  }

  async gatherScheduledData(schedule) {
    await this.db.initialize();
    
    const data = {
      type: 'scheduled_report',
      schedule: schedule.cron,
      generatedAt: new Date().toISOString()
    };
    
    // Gather test summary
    if (schedule.includeTestSummary !== false) {
      const recentRuns = this.db.getTestRuns({
        since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
        limit: 50
      });
      
      data.testSummary = {
        totalRuns: recentRuns.length,
        successRate: recentRuns.length > 0 ? 
          recentRuns.reduce((sum, run) => sum + run.success_rate, 0) / recentRuns.length : 0,
        networks: [...new Set(recentRuns.flatMap(run => JSON.parse(run.networks || '[]')))]
      };
    }
    
    // Gather alerts
    if (schedule.includeAlerts !== false) {
      const recentAlerts = this.db.getAlerts({
        resolved: false,
        limit: 20
      });
      
      data.alerts = recentAlerts.map(alert => ({
        id: alert.id,
        type: alert.alert_type,
        severity: alert.severity,
        message: alert.message,
        network: alert.network_name,
        triggered: alert.triggered_at
      }));
    }
    
    return data;
  }

  // Predefined notification methods
  async notifyTestCompleted(runId, results) {
    const data = {
      runId,
      results: {
        totalTests: results.totalTests || 0,
        successfulTests: results.successfulTests || 0,
        failedTests: results.failedTests || 0,
        successRate: results.successRate || 0,
        duration: results.duration || 0,
        networks: results.networks || []
      }
    };
    
    return this.notify('test_completed', data);
  }

  async notifyRegressionDetected(regression) {
    const data = {
      metric: regression.metricName,
      network: regression.networkName,
      severity: regression.severity,
      change: regression.percentageChange,
      trend: regression.trend,
      confidence: regression.confidence,
      detectedAt: regression.detectedAt
    };
    
    return this.notify('regression_detected', data);
  }

  async notifyAlert(alert) {
    const data = {
      alertId: alert.id,
      type: alert.alert_type,
      severity: alert.severity,
      message: alert.message,
      network: alert.network_name,
      testType: alert.test_type,
      triggeredAt: alert.triggered_at,
      details: JSON.parse(alert.details || '{}')
    };
    
    return this.notify('alert_triggered', data);
  }

  async notifyNetworkStatus(networkName, status) {
    const data = {
      network: networkName,
      status: status.online ? 'online' : 'offline',
      blockNumber: status.blockNumber,
      gasPrice: status.gasPrice,
      responseTime: status.responseTime,
      timestamp: status.timestamp,
      error: status.errorMessage
    };
    
    return this.notify('network_status_changed', data);
  }

  // Utility methods
  generateWebhookId() {
    return `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get webhook statistics
  async getWebhookStats(webhookId = null) {
    await this.db.initialize();
    
    let query = 'SELECT * FROM webhook_logs';
    const params = [];
    
    if (webhookId) {
      query += ' WHERE webhook_id = ?';
      params.push(webhookId);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT 1000';
    
    try {
      const stmt = this.db.db.prepare(query);
      const logs = stmt.all(...params);
      
      const stats = {
        totalCalls: logs.length,
        successfulCalls: logs.filter(log => log.status && log.status >= 200 && log.status < 300).length,
        failedCalls: logs.filter(log => !log.status || log.status >= 400).length,
        averageResponseTime: 0, // Would need to track this separately
        lastCall: logs.length > 0 ? logs[0].timestamp : null,
        eventBreakdown: {}
      };
      
      // Event breakdown
      logs.forEach(log => {
        stats.eventBreakdown[log.event] = (stats.eventBreakdown[log.event] || 0) + 1;
      });
      
      stats.successRate = stats.totalCalls > 0 ? 
        (stats.successfulCalls / stats.totalCalls) * 100 : 0;
      
      return stats;
      
    } catch (error) {
      console.error('Failed to get webhook stats:', error.message);
      return null;
    }
  }

  // List all registered webhooks
  listWebhooks() {
    return Array.from(this.webhooks.entries()).map(([id, config]) => ({
      id,
      url: config.url,
      events: config.events,
      enabled: config.enabled,
      hasSecret: !!config.secret,
      hasSchedule: !!config.schedule
    }));
  }

  // Clean up old webhook logs
  async cleanupOldLogs(olderThanDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const stmt = this.db.db.prepare('DELETE FROM webhook_logs WHERE timestamp < ?');
      const result = stmt.run(cutoffDate.toISOString());
      
      console.log(chalk.yellow(`🧹 Cleaned up ${result.changes} old webhook logs`));
      return result.changes;
      
    } catch (error) {
      console.error('Failed to cleanup webhook logs:', error.message);
      return 0;
    }
  }
}

module.exports = { WebhookNotifier };