const express = require('express');
const cors = require('cors');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs').promises;
const path = require('path');
const { TestDatabase } = require('./database');
const { AnalyticsEngine } = require('./analytics');
const { TimeSeriesTracker } = require('./time-series');

class ExportAPI {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3001,
      host: options.host || 'localhost',
      exportDir: options.exportDir || path.join(process.cwd(), 'exports'),
      ...options
    };
    
    this.app = express();
    this.db = new TestDatabase();
    this.analytics = new AnalyticsEngine(this.db);
    this.timeSeries = new TimeSeriesTracker(this.db);
    this.server = null;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Logging middleware
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
    
    // Error handling middleware
    this.app.use((err, req, res, next) => {
      console.error('API Error:', err);
      res.status(500).json({ 
        error: 'Internal server error', 
        message: err.message 
      });
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: require('../package.json').version 
      });
    });

    // API information
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Blockchain Test Export API',
        version: '1.0.0',
        endpoints: [
          'GET /api/test-runs',
          'GET /api/test-runs/:runId',
          'GET /api/networks/:networkName/results',
          'GET /api/metrics',
          'GET /api/analytics',
          'GET /api/export/:format',
          'POST /api/export/custom'
        ]
      });
    });

    // Test runs endpoints
    this.app.get('/api/test-runs', async (req, res) => {
      try {
        await this.db.initialize();
        
        const options = {
          since: req.query.since,
          mode: req.query.mode,
          network: req.query.network,
          limit: parseInt(req.query.limit) || 50
        };
        
        const testRuns = this.db.getTestRuns(options);
        
        res.json({
          data: testRuns,
          count: testRuns.length,
          query: options
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/test-runs/:runId', async (req, res) => {
      try {
        await this.db.initialize();
        
        const runId = req.params.runId;
        const testRuns = this.db.getTestRuns({ limit: 1000 });
        const testRun = testRuns.find(run => run.run_id === runId);
        
        if (!testRun) {
          return res.status(404).json({ error: 'Test run not found' });
        }
        
        const networkResults = this.db.getNetworkResults(runId);
        const testResults = this.db.getTestResults(runId);
        
        res.json({
          testRun,
          networkResults,
          testResults,
          summary: {
            totalNetworks: networkResults.length,
            totalTests: testResults.length,
            successRate: testResults.filter(r => r.success).length / testResults.length
          }
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Network-specific results
    this.app.get('/api/networks/:networkName/results', async (req, res) => {
      try {
        await this.db.initialize();
        
        const networkName = req.params.networkName;
        const since = req.query.since;
        const limit = parseInt(req.query.limit) || 100;
        
        // Get network results
        const networkResults = this.db.getNetworkResults()
          .filter(result => {
            if (result.network_name !== networkName) return false;
            if (since && new Date(result.start_time) < new Date(since)) return false;
            return true;
          })
          .slice(0, limit);
        
        // Get test results for this network
        const testResults = [];
        for (const networkResult of networkResults) {
          const tests = this.db.getTestResults(networkResult.run_id, networkName);
          testResults.push(...tests);
        }
        
        res.json({
          networkName,
          networkResults,
          testResults,
          summary: {
            totalRuns: networkResults.length,
            totalTests: testResults.length,
            averageSuccessRate: networkResults.length > 0 ? 
              networkResults.reduce((sum, r) => sum + r.success_rate, 0) / networkResults.length : 0,
            totalGasUsed: networkResults.reduce((sum, r) => sum + r.total_gas_used, 0)
          }
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Performance metrics
    this.app.get('/api/metrics', async (req, res) => {
      try {
        await this.timeSeries.initialize();
        
        const options = {
          networkName: req.query.network,
          metricName: req.query.metric,
          since: req.query.since,
          testType: req.query.testType,
          limit: parseInt(req.query.limit) || 200
        };
        
        const metrics = this.db.getPerformanceMetrics(options);
        
        // Group by metric name if no specific metric requested
        const groupedMetrics = {};
        metrics.forEach(metric => {
          if (!groupedMetrics[metric.metric_name]) {
            groupedMetrics[metric.metric_name] = [];
          }
          groupedMetrics[metric.metric_name].push({
            timestamp: metric.timestamp,
            value: metric.metric_value,
            unit: metric.metric_unit,
            networkName: metric.network_name,
            testType: metric.test_type
          });
        });
        
        res.json({
          data: req.query.metric ? metrics : groupedMetrics,
          count: metrics.length,
          query: options
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Time series data
    this.app.get('/api/timeseries/:metricName', async (req, res) => {
      try {
        await this.timeSeries.initialize();
        
        const metricName = req.params.metricName;
        const options = {
          networkName: req.query.network,
          since: req.query.since,
          until: req.query.until,
          limit: parseInt(req.query.limit) || 500
        };
        
        const timeSeries = await this.timeSeries.getTimeSeries(metricName, options);
        
        // Optionally aggregate data
        if (req.query.aggregate) {
          const aggregated = await this.timeSeries.getAggregatedTimeSeries(
            metricName, 
            req.query.aggregate, 
            options
          );
          
          res.json({
            metricName,
            aggregation: req.query.aggregate,
            data: aggregated,
            count: aggregated.length,
            query: options
          });
        } else {
          res.json({
            metricName,
            data: timeSeries,
            count: timeSeries.length,
            query: options
          });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Analytics endpoint
    this.app.get('/api/analytics', async (req, res) => {
      try {
        await this.analytics.initialize();
        
        const options = {
          networks: req.query.networks ? req.query.networks.split(',') : undefined,
          since: req.query.since,
          until: req.query.until
        };
        
        const analysis = await this.analytics.analyzeNetworkPerformance(options);
        
        res.json({
          analysis,
          generated: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Export endpoints
    this.app.get('/api/export/:format', async (req, res) => {
      try {
        const format = req.params.format.toLowerCase();
        const exportData = await this.generateExport(format, req.query);
        
        res.set({
          'Content-Type': this.getContentType(format),
          'Content-Disposition': `attachment; filename="test-results-${Date.now()}.${format}"`
        });
        
        if (format === 'json') {
          res.json(exportData);
        } else {
          res.send(exportData);
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Custom export with POST
    this.app.post('/api/export/custom', async (req, res) => {
      try {
        const { format, query, fields } = req.body;
        
        if (!format) {
          return res.status(400).json({ error: 'Format is required' });
        }
        
        const exportData = await this.generateCustomExport(format, query || {}, fields);
        
        res.set({
          'Content-Type': this.getContentType(format),
          'Content-Disposition': `attachment; filename="custom-export-${Date.now()}.${format}"`
        });
        
        if (format === 'json') {
          res.json(exportData);
        } else {
          res.send(exportData);
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Bulk export to file
    this.app.post('/api/export/file', async (req, res) => {
      try {
        const { format, query, filename } = req.body;
        
        const exportData = await this.generateExport(format, query || {});
        const filePath = await this.saveExportToFile(exportData, format, filename);
        
        res.json({
          success: true,
          filePath,
          size: (await fs.stat(filePath)).size,
          downloadUrl: `/api/download/${path.basename(filePath)}`
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Download exported files
    this.app.get('/api/download/:filename', async (req, res) => {
      try {
        const filename = req.params.filename;
        const filePath = path.join(this.options.exportDir, filename);
        
        // Security check - ensure file is in export directory
        const resolvedPath = path.resolve(filePath);
        const exportDirResolved = path.resolve(this.options.exportDir);
        
        if (!resolvedPath.startsWith(exportDirResolved)) {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        // Check if file exists
        try {
          await fs.access(filePath);
        } catch {
          return res.status(404).json({ error: 'File not found' });
        }
        
        res.download(filePath);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // List available exports
    this.app.get('/api/exports', async (req, res) => {
      try {
        const files = await fs.readdir(this.options.exportDir);
        const exports = [];
        
        for (const file of files) {
          const filePath = path.join(this.options.exportDir, file);
          const stats = await fs.stat(filePath);
          
          exports.push({
            filename: file,
            size: stats.size,
            created: stats.mtime,
            downloadUrl: `/api/download/${file}`
          });
        }
        
        res.json({
          exports: exports.sort((a, b) => b.created - a.created),
          count: exports.length
        });
      } catch (error) {
        if (error.code === 'ENOENT') {
          res.json({ exports: [], count: 0 });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    });

    // Database stats
    this.app.get('/api/stats', async (req, res) => {
      try {
        await this.db.initialize();
        
        const stats = this.db.getStats();
        const dbSize = this.db.getDatabaseSize();
        
        res.json({
          database: {
            size: dbSize,
            tables: stats
          },
          api: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: require('../package.json').version
          }
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async generateExport(format, query) {
    await this.db.initialize();
    
    // Get data based on query parameters
    const testRuns = this.db.getTestRuns({
      since: query.since,
      mode: query.mode,
      network: query.network,
      limit: parseInt(query.limit) || 1000
    });
    
    const networkResults = [];
    const testResults = [];
    
    for (const run of testRuns) {
      const networks = this.db.getNetworkResults(run.run_id);
      const tests = this.db.getTestResults(run.run_id);
      
      networkResults.push(...networks);
      testResults.push(...tests);
    }
    
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        format,
        query,
        counts: {
          testRuns: testRuns.length,
          networkResults: networkResults.length,
          testResults: testResults.length
        }
      },
      testRuns,
      networkResults,
      testResults
    };
    
    return this.convertToFormat(exportData, format);
  }

  async generateCustomExport(format, query, fields) {
    await this.db.initialize();
    
    // Build custom query based on fields requested
    let data = {};
    
    if (!fields || fields.includes('testRuns')) {
      data.testRuns = this.db.getTestRuns(query);
    }
    
    if (!fields || fields.includes('networkResults')) {
      data.networkResults = this.db.getNetworkResults();
      if (query.network) {
        data.networkResults = data.networkResults.filter(r => r.network_name === query.network);
      }
    }
    
    if (!fields || fields.includes('testResults')) {
      data.testResults = this.db.getTestResults();
      if (query.network) {
        data.testResults = data.testResults.filter(r => r.network_name === query.network);
      }
    }
    
    if (!fields || fields.includes('performanceMetrics')) {
      data.performanceMetrics = this.db.getPerformanceMetrics(query);
    }
    
    if (!fields || fields.includes('analytics')) {
      await this.analytics.initialize();
      data.analytics = await this.analytics.analyzeNetworkPerformance(query);
    }
    
    return this.convertToFormat(data, format);
  }

  convertToFormat(data, format) {
    switch (format.toLowerCase()) {
      case 'json':
        return data;
      
      case 'csv':
        return this.convertToCSV(data);
      
      case 'xml':
        return this.convertToXML(data);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  convertToCSV(data) {
    // Convert complex nested data to flattened CSV
    let csv = '';
    
    // Test runs CSV
    if (data.testRuns && data.testRuns.length > 0) {
      csv += 'TEST RUNS\\n';
      csv += 'run_id,start_time,end_time,mode,networks,success_rate,total_gas_used\\n';
      
      data.testRuns.forEach(run => {
        csv += `${run.run_id},${run.start_time},${run.end_time || ''},${run.mode},"${run.networks}",${run.success_rate},${run.total_gas_used}\\n`;
      });
      
      csv += '\\n';
    }
    
    // Network results CSV
    if (data.networkResults && data.networkResults.length > 0) {
      csv += 'NETWORK RESULTS\\n';
      csv += 'run_id,network_name,success_rate,duration,total_tests,total_gas_used\\n';
      
      data.networkResults.forEach(result => {
        csv += `${result.run_id},${result.network_name},${result.success_rate},${result.duration},${result.total_tests},${result.total_gas_used}\\n`;
      });
      
      csv += '\\n';
    }
    
    // Test results CSV
    if (data.testResults && data.testResults.length > 0) {
      csv += 'TEST RESULTS\\n';
      csv += 'run_id,network_name,test_type,test_name,success,duration,gas_used\\n';
      
      data.testResults.forEach(result => {
        csv += `${result.run_id},${result.network_name},${result.test_type},${result.test_name},${result.success},${result.duration || 0},${result.gas_used || 0}\\n`;
      });
    }
    
    return csv;
  }

  convertToXML(data) {
    // Simple XML conversion
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\\n';
    xml += '<testResults>\\n';
    xml += `  <metadata>\\n`;
    xml += `    <exportedAt>${new Date().toISOString()}</exportedAt>\\n`;
    xml += `  </metadata>\\n`;
    
    if (data.testRuns) {
      xml += '  <testRuns>\\n';
      data.testRuns.forEach(run => {
        xml += '    <testRun>\\n';
        xml += `      <runId>${run.run_id}</runId>\\n`;
        xml += `      <startTime>${run.start_time}</startTime>\\n`;
        xml += `      <mode>${run.mode}</mode>\\n`;
        xml += `      <successRate>${run.success_rate}</successRate>\\n`;
        xml += '    </testRun>\\n';
      });
      xml += '  </testRuns>\\n';
    }
    
    xml += '</testResults>';
    return xml;
  }

  async saveExportToFile(data, format, filename) {
    // Ensure export directory exists
    await fs.mkdir(this.options.exportDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalFilename = filename || `export-${timestamp}.${format}`;
    const filePath = path.join(this.options.exportDir, finalFilename);
    
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf8');
    
    return filePath;
  }

  getContentType(format) {
    const contentTypes = {
      'json': 'application/json',
      'csv': 'text/csv',
      'xml': 'application/xml',
      'txt': 'text/plain'
    };
    
    return contentTypes[format.toLowerCase()] || 'application/octet-stream';
  }

  async start() {
    await this.db.initialize();
    
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.options.port, this.options.host, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🚀 Export API server running on http://${this.options.host}:${this.options.port}`);
          console.log(`📊 API documentation: http://${this.options.host}:${this.options.port}/api`);
          resolve();
        }
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 Export API server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = { ExportAPI };