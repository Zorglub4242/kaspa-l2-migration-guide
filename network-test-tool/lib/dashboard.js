const blessed = require('blessed');
const chalk = require('chalk');
const { EventEmitter } = require('events');

class DashboardManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      refreshRate: options.refreshRate || 1000,
      port: options.port || 3000,
      ...options
    };
    
    this.screen = null;
    this.widgets = {};
    this.isActive = false;
    this.data = {
      networks: new Map(),
      tests: new Map(),
      metrics: {
        totalTests: 0,
        completedTests: 0,
        successfulTests: 0,
        startTime: Date.now(),
        currentTPS: 0,
        avgGasUsed: 0
      }
    };
    
    this.refreshInterval = null;
  }

  async start() {
    if (this.isActive) return;
    
    this.createScreen();
    this.createWidgets();
    this.setupEventHandlers();
    this.startRefreshTimer();
    
    this.isActive = true;
    this.render();
    
    console.log(chalk.cyan('📊 Live dashboard started. Press q to quit.'));
  }

  createScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Blockchain Test Dashboard',
      dockBorders: false,
      fullUnicode: true,
      autoPadding: true
    });

    // Handle quit
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.stop();
      process.exit(0);
    });
  }

  createWidgets() {
    // Header
    this.widgets.header = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: this.getHeaderContent(),
      style: {
        fg: 'cyan',
        bold: true
      },
      border: {
        type: 'line',
        fg: 'cyan'
      }
    });

    // Network Status Panel
    this.widgets.networkStatus = blessed.box({
      top: 3,
      left: 0,
      width: '50%',
      height: '40%',
      label: ' Network Status ',
      content: '',
      scrollable: true,
      alwaysScroll: true,
      style: {
        fg: 'white'
      },
      border: {
        type: 'line',
        fg: 'blue'
      }
    });

    // Test Progress Panel
    this.widgets.testProgress = blessed.box({
      top: 3,
      left: '50%',
      width: '50%',
      height: '40%',
      label: ' Test Progress ',
      content: '',
      scrollable: true,
      alwaysScroll: true,
      style: {
        fg: 'white'
      },
      border: {
        type: 'line',
        fg: 'green'
      }
    });

    // Metrics Panel
    this.widgets.metrics = blessed.box({
      top: '43%',
      left: 0,
      width: '100%',
      height: '30%',
      label: ' Live Metrics ',
      content: '',
      style: {
        fg: 'white'
      },
      border: {
        type: 'line',
        fg: 'yellow'
      }
    });

    // Log Panel
    this.widgets.logs = blessed.log({
      top: '73%',
      left: 0,
      width: '100%',
      height: '27%',
      label: ' Test Logs ',
      scrollable: true,
      alwaysScroll: true,
      style: {
        fg: 'white'
      },
      border: {
        type: 'line',
        fg: 'magenta'
      }
    });

    // Add all widgets to screen
    Object.values(this.widgets).forEach(widget => {
      this.screen.append(widget);
    });
  }

  setupEventHandlers() {
    // Listen for test runner events
    this.on('network-started', (data) => {
      this.data.networks.set(data.networkName, {
        name: data.networkName,
        totalTests: data.totalTests,
        completedTests: 0,
        successfulTests: 0,
        status: 'Starting...',
        startTime: Date.now()
      });
      this.logMessage(`🌐 Started testing ${data.networkName}`);
    });

    this.on('test-completed', (data) => {
      const network = this.data.networks.get(data.networkName);
      if (network) {
        network.completedTests++;
        if (data.success) {
          network.successfulTests++;
          this.data.metrics.successfulTests++;
        }
        network.status = `${data.testType} ${data.success ? '✅' : '❌'}`;
        this.data.metrics.completedTests++;
      }
      
      this.logMessage(`${data.success ? '✅' : '❌'} ${data.networkName}: ${data.testType}`);
    });

    this.on('network-completed', (data) => {
      const network = this.data.networks.get(data.networkName);
      if (network) {
        network.status = `Complete (${data.successRate}%)`;
        network.duration = data.duration;
      }
      
      this.logMessage(`🏁 ${data.networkName} completed: ${data.successRate}% success`);
    });

    this.on('metrics-updated', (metrics) => {
      Object.assign(this.data.metrics, metrics);
    });
  }

  startRefreshTimer() {
    this.refreshInterval = setInterval(() => {
      this.updateContent();
      this.render();
    }, this.options.refreshRate);
  }

  updateContent() {
    this.widgets.header.setContent(this.getHeaderContent());
    this.widgets.networkStatus.setContent(this.getNetworkStatusContent());
    this.widgets.testProgress.setContent(this.getTestProgressContent());
    this.widgets.metrics.setContent(this.getMetricsContent());
  }

  getHeaderContent() {
    const elapsed = Date.now() - this.data.metrics.startTime;
    const elapsedStr = this.formatDuration(elapsed);
    
    return ` Blockchain Test Dashboard - Runtime: ${elapsedStr} - Press 'q' to quit `;
  }

  getNetworkStatusContent() {
    let content = '';
    
    if (this.data.networks.size === 0) {
      content = '\\n  No networks being tested...\\n';
    } else {
      this.data.networks.forEach((network, name) => {
        const successRate = network.completedTests > 0 ? 
          Math.round((network.successfulTests / network.completedTests) * 100) : 0;
        
        const progress = network.totalTests > 0 ? 
          Math.round((network.completedTests / network.totalTests) * 100) : 0;
        
        const statusColor = network.completedTests === network.totalTests ? 
          (successRate === 100 ? 'green' : 'yellow') : 'cyan';
        
        content += `\\n  {${statusColor}-fg}${name.toUpperCase()}{/${statusColor}-fg}\\n`;
        content += `    Progress: ${network.completedTests}/${network.totalTests} (${progress}%)\\n`;
        content += `    Success Rate: ${successRate}%\\n`;
        content += `    Status: ${network.status}\\n`;
        
        if (network.duration) {
          content += `    Duration: ${this.formatDuration(network.duration)}\\n`;
        }
        
        content += '\\n';
      });
    }
    
    return content;
  }

  getTestProgressContent() {
    let content = '';
    
    // Overall progress
    const totalTests = Array.from(this.data.networks.values())
      .reduce((sum, n) => sum + n.totalTests, 0);
    const completedTests = Array.from(this.data.networks.values())
      .reduce((sum, n) => sum + n.completedTests, 0);
    const overallProgress = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0;
    
    content += '\\n  {bold}Overall Progress{/bold}\\n';
    content += `    Tests: ${completedTests}/${totalTests} (${overallProgress}%)\\n`;
    content += `    Success Rate: ${this.getOverallSuccessRate()}%\\n`;
    content += '\\n';
    
    // Progress bars for each network
    content += '  {bold}Network Progress{/bold}\\n';
    this.data.networks.forEach((network, name) => {
      const progress = network.totalTests > 0 ? 
        Math.round((network.completedTests / network.totalTests) * 100) : 0;
      
      const bar = this.generateProgressBar(progress, 20);
      const color = progress === 100 ? 'green' : 'cyan';
      
      content += `    {${color}-fg}${name}:{/${color}-fg} ${bar} ${progress}%\\n`;
    });
    
    return content;
  }

  getMetricsContent() {
    const elapsed = Date.now() - this.data.metrics.startTime;
    const elapsedSec = elapsed / 1000;
    
    const testsPerSecond = elapsedSec > 0 ? 
      Math.round((this.data.metrics.completedTests / elapsedSec) * 10) / 10 : 0;
    
    const eta = this.calculateETA();
    
    let content = '\\n';
    
    // Performance metrics
    content += '  {bold}Performance Metrics{/bold}\\n';
    content += `    Tests/Second: ${testsPerSecond}\\n`;
    content += `    Current TPS: ${this.data.metrics.currentTPS || 0}\\n`;
    content += `    Avg Gas Used: ${this.formatNumber(this.data.metrics.avgGasUsed || 0)}\\n`;
    content += `    ETA: ${eta}\\n`;
    content += '\\n';
    
    // Resource usage
    const memUsage = process.memoryUsage();
    content += '  {bold}Resource Usage{/bold}\\n';
    content += `    Memory: ${this.formatBytes(memUsage.rss)}\\n`;
    content += `    Heap Used: ${this.formatBytes(memUsage.heapUsed)}\\n`;
    content += `    External: ${this.formatBytes(memUsage.external)}\\n`;
    content += '\\n';
    
    // Network summary
    const activeNetworks = Array.from(this.data.networks.values())
      .filter(n => n.completedTests < n.totalTests).length;
    
    content += '  {bold}Summary{/bold}\\n';
    content += `    Active Networks: ${activeNetworks}\\n`;
    content += `    Total Networks: ${this.data.networks.size}\\n`;
    content += `    Overall Success: ${this.getOverallSuccessRate()}%\\n`;
    
    return content;
  }

  generateProgressBar(percentage, width = 20) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  calculateETA() {
    const totalTests = Array.from(this.data.networks.values())
      .reduce((sum, n) => sum + n.totalTests, 0);
    const completedTests = Array.from(this.data.networks.values())
      .reduce((sum, n) => sum + n.completedTests, 0);
    const remainingTests = totalTests - completedTests;
    
    const elapsed = Date.now() - this.data.metrics.startTime;
    const rate = elapsed > 0 ? completedTests / elapsed : 0;
    
    if (rate === 0 || remainingTests === 0) return 'Unknown';
    
    const etaMs = remainingTests / rate;
    return this.formatDuration(etaMs);
  }

  getOverallSuccessRate() {
    const totalCompleted = Array.from(this.data.networks.values())
      .reduce((sum, n) => sum + n.completedTests, 0);
    const totalSuccessful = Array.from(this.data.networks.values())
      .reduce((sum, n) => sum + n.successfulTests, 0);
    
    return totalCompleted > 0 ? Math.round((totalSuccessful / totalCompleted) * 100) : 0;
  }

  logMessage(message) {
    if (this.widgets.logs) {
      const timestamp = new Date().toLocaleTimeString();
      this.widgets.logs.log(`[${timestamp}] ${message}`);
    }
  }

  render() {
    if (this.screen && this.isActive) {
      this.screen.render();
    }
  }

  stop() {
    if (!this.isActive) return;
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    if (this.screen) {
      this.screen.destroy();
      this.screen = null;
    }
    
    this.isActive = false;
    console.log(chalk.gray('📊 Dashboard stopped'));
  }

  // Utility methods
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${Math.round(size * 10) / 10} ${units[unitIndex]}`;
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return `${Math.round(num / 100000) / 10}M`;
    } else if (num >= 1000) {
      return `${Math.round(num / 100) / 10}K`;
    }
    return num.toString();
  }

  // Public API for updating from test runner
  updateNetworkStatus(networkName, status, data = {}) {
    const network = this.data.networks.get(networkName);
    if (network) {
      network.status = status;
      Object.assign(network, data);
    }
    
    this.emit('network-status-updated', { networkName, status, data });
  }

  updateMetrics(metrics) {
    Object.assign(this.data.metrics, metrics);
    this.emit('metrics-updated', metrics);
  }

  addNetwork(networkName, totalTests) {
    this.emit('network-started', { networkName, totalTests });
  }

  completeTest(networkName, testType, success, details = {}) {
    this.emit('test-completed', { networkName, testType, success, details });
  }

  completeNetwork(networkName, summary) {
    this.emit('network-completed', { networkName, ...summary });
  }
}

module.exports = { DashboardManager };