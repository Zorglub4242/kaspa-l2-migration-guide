let cliProgress;
try {
  cliProgress = require('cli-progress');
} catch (error) {
  // Fallback when cli-progress is not available
  cliProgress = {
    MultiBar: class {
      constructor() {}
      create() { return { update: () => {}, stop: () => {} }; }
      stop() {}
    },
    Presets: { shades_classic: {} }
  };
}
const chalk = require('chalk');
const { EventEmitter } = require('events');

class ProgressTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      showETA: options.showETA !== false,
      showPercentage: options.showPercentage !== false,
      showSpeed: options.showSpeed !== false,
      showValue: options.showValue !== false,
      ...options
    };
    
    this.multiBar = null;
    this.bars = new Map();
    this.networkProgress = new Map();
    this.overallProgress = null;
    this.startTime = Date.now();
    this.isActive = false;
  }

  async initialize() {
    if (this.isActive) return;
    
    this.multiBar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: this.getProgressFormat(),
      barCompleteChar: '█',
      barIncompleteChar: '░',
      fps: 10
    }, cliProgress.Presets.shades_grey);
    
    this.isActive = true;
    console.log(chalk.cyan('📊 Progress tracking initialized\\n'));
  }

  getProgressFormat() {
    let format = chalk.cyan('{bar}') + ' {percentage}% | {network} | {status}';
    
    if (this.options.showETA) {
      format += ' | ETA: {eta}s';
    }
    
    if (this.options.showSpeed) {
      format += ' | {speed} ops/s';
    }
    
    if (this.options.showValue) {
      format += ' | {value}/{total}';
    }
    
    return format;
  }

  startOverallProgress(totalNetworks, totalTests) {
    if (!this.isActive) return;
    
    const totalOperations = totalNetworks * totalTests;
    
    this.overallProgress = this.multiBar.create(totalOperations, 0, {
      network: 'OVERALL',
      status: 'Starting...',
      speed: 0
    });
    
    this.emit('overall-started', { totalNetworks, totalTests, totalOperations });
  }

  startNetwork(networkName, totalTests) {
    if (!this.isActive) return;
    
    const networkBar = this.multiBar.create(totalTests, 0, {
      network: networkName.toUpperCase(),
      status: 'Initializing...',
      speed: 0
    });
    
    this.bars.set(networkName, networkBar);
    this.networkProgress.set(networkName, {
      completed: 0,
      total: totalTests,
      startTime: Date.now(),
      tests: []
    });
    
    this.emit('network-started', { networkName, totalTests });
  }

  updateNetworkStatus(networkName, status, details = {}) {
    if (!this.isActive) return;
    
    const bar = this.bars.get(networkName);
    if (!bar) return;
    
    bar.update(bar.value, {
      network: networkName.toUpperCase(),
      status: status,
      ...details
    });
    
    this.emit('network-status-updated', { networkName, status, details });
  }

  completeTest(networkName, testType, success, details = {}) {
    if (!this.isActive) return;
    
    const bar = this.bars.get(networkName);
    const progress = this.networkProgress.get(networkName);
    
    if (!bar || !progress) return;
    
    progress.completed++;
    progress.tests.push({
      type: testType,
      success,
      timestamp: Date.now(),
      ...details
    });
    
    const statusIcon = success ? '✅' : '❌';
    const newValue = progress.completed;
    const percentage = Math.round((newValue / progress.total) * 100);
    
    // Calculate speed
    const elapsed = Date.now() - progress.startTime;
    const speed = elapsed > 0 ? Math.round((progress.completed / elapsed) * 1000) : 0;
    
    bar.update(newValue, {
      network: networkName.toUpperCase(),
      status: `${statusIcon} ${testType} (${percentage}%)`,
      speed: speed
    });
    
    // Update overall progress
    if (this.overallProgress) {
      this.overallProgress.increment(1, {
        network: 'OVERALL',
        status: `${networkName}:${testType} ${statusIcon}`,
        speed: this.calculateOverallSpeed()
      });
    }
    
    this.emit('test-completed', { 
      networkName, 
      testType, 
      success, 
      progress: newValue,
      total: progress.total,
      details 
    });
  }

  completeNetwork(networkName) {
    if (!this.isActive) return;
    
    const bar = this.bars.get(networkName);
    const progress = this.networkProgress.get(networkName);
    
    if (!bar || !progress) return;
    
    const duration = Date.now() - progress.startTime;
    const successCount = progress.tests.filter(t => t.success).length;
    const successRate = Math.round((successCount / progress.total) * 100);
    
    bar.update(progress.total, {
      network: networkName.toUpperCase(),
      status: `✅ Complete (${successRate}% success)`,
      speed: Math.round((progress.total / duration) * 1000)
    });
    
    this.emit('network-completed', { 
      networkName, 
      duration, 
      successCount, 
      totalTests: progress.total,
      successRate 
    });
  }

  calculateOverallSpeed() {
    const elapsed = Date.now() - this.startTime;
    const totalCompleted = Array.from(this.networkProgress.values())
      .reduce((sum, progress) => sum + progress.completed, 0);
    
    return elapsed > 0 ? Math.round((totalCompleted / elapsed) * 1000) : 0;
  }

  updateTestProgress(networkName, testType, current, total, details = {}) {
    if (!this.isActive) return;
    
    const percentage = Math.round((current / total) * 100);
    const status = `⚡ ${testType} ${percentage}%`;
    
    this.updateNetworkStatus(networkName, status, {
      ...details,
      testProgress: { current, total, percentage }
    });
    
    this.emit('test-progress-updated', { 
      networkName, 
      testType, 
      current, 
      total, 
      percentage,
      details 
    });
  }

  showEstimates() {
    if (!this.isActive) return;
    
    console.log(chalk.yellow('\\n📈 Progress Estimates:'));
    
    for (const [networkName, progress] of this.networkProgress) {
      if (progress.completed === 0) continue;
      
      const elapsed = Date.now() - progress.startTime;
      const rate = progress.completed / elapsed;
      const remaining = progress.total - progress.completed;
      const eta = remaining > 0 ? Math.round(remaining / rate / 1000) : 0;
      
      console.log(`  ${networkName}: ${progress.completed}/${progress.total} tests (ETA: ${eta}s)`);
    }
  }

  displaySummaryStats() {
    if (!this.isActive) return;
    
    console.log(chalk.cyan('\\n📊 Progress Summary:'));
    
    const totalElapsed = Date.now() - this.startTime;
    const totalTests = Array.from(this.networkProgress.values())
      .reduce((sum, progress) => sum + progress.total, 0);
    const totalCompleted = Array.from(this.networkProgress.values())
      .reduce((sum, progress) => sum + progress.completed, 0);
    const totalSuccessful = Array.from(this.networkProgress.values())
      .reduce((sum, progress) => sum + progress.tests.filter(t => t.success).length, 0);
    
    const overallRate = totalTests > 0 ? Math.round((totalCompleted / totalTests) * 100) : 0;
    const successRate = totalCompleted > 0 ? Math.round((totalSuccessful / totalCompleted) * 100) : 0;
    const avgSpeed = totalElapsed > 0 ? Math.round((totalCompleted / totalElapsed) * 1000) : 0;
    
    console.log(`  Overall Progress: ${totalCompleted}/${totalTests} (${overallRate}%)`);
    console.log(`  Success Rate: ${totalSuccessful}/${totalCompleted} (${successRate}%)`);
    console.log(`  Average Speed: ${avgSpeed} tests/second`);
    console.log(`  Total Duration: ${Math.round(totalElapsed / 1000)}s`);
  }

  async cleanup() {
    if (!this.isActive) return;
    
    if (this.multiBar) {
      this.multiBar.stop();
    }
    
    this.bars.clear();
    this.networkProgress.clear();
    this.isActive = false;
    
    console.log(chalk.gray('\\n📊 Progress tracking stopped'));
  }

  // Utility methods for specific test types
  startEVMTest(networkName, totalSubTests) {
    this.updateNetworkStatus(networkName, '🧪 Starting EVM tests...', {
      testType: 'EVM',
      subTests: totalSubTests
    });
  }

  startDeFiTest(networkName, totalProtocols) {
    this.updateNetworkStatus(networkName, '💰 Starting DeFi tests...', {
      testType: 'DeFi',
      protocols: totalProtocols
    });
  }

  startLoadTest(networkName, duration, targetTPS) {
    this.updateNetworkStatus(networkName, '⚡ Starting load tests...', {
      testType: 'Load',
      duration: duration,
      targetTPS: targetTPS
    });
  }

  updateLoadTestMetrics(networkName, currentTPS, successRate, transactions) {
    this.updateNetworkStatus(networkName, `⚡ Load test: ${currentTPS} TPS`, {
      currentTPS: currentTPS,
      successRate: Math.round(successRate * 100),
      transactions: transactions
    });
  }

  // Real-time metrics display
  displayRealTimeMetrics() {
    if (!this.isActive) return;
    
    const metrics = this.gatherMetrics();
    
    console.log(chalk.cyan('\\n📈 Real-time Metrics:'));
    console.log(`  Active Networks: ${metrics.activeNetworks}`);
    console.log(`  Tests in Progress: ${metrics.testsInProgress}`);
    console.log(`  Current TPS: ${metrics.averageTPS}`);
    console.log(`  Success Rate: ${metrics.successRate}%`);
    console.log(`  Estimated Completion: ${metrics.eta}s`);
  }

  gatherMetrics() {
    const activeNetworks = Array.from(this.networkProgress.values())
      .filter(p => p.completed < p.total).length;
    
    const testsInProgress = Array.from(this.networkProgress.values())
      .reduce((sum, p) => sum + (p.total - p.completed), 0);
    
    const totalElapsed = Date.now() - this.startTime;
    const totalCompleted = Array.from(this.networkProgress.values())
      .reduce((sum, progress) => sum + progress.completed, 0);
    
    const averageTPS = totalElapsed > 0 ? Math.round((totalCompleted / totalElapsed) * 1000) : 0;
    
    const totalSuccessful = Array.from(this.networkProgress.values())
      .reduce((sum, progress) => sum + progress.tests.filter(t => t.success).length, 0);
    
    const successRate = totalCompleted > 0 ? Math.round((totalSuccessful / totalCompleted) * 100) : 0;
    
    const eta = averageTPS > 0 ? Math.round(testsInProgress / averageTPS) : 0;
    
    return {
      activeNetworks,
      testsInProgress,
      averageTPS,
      successRate,
      eta
    };
  }
}

module.exports = { ProgressTracker };