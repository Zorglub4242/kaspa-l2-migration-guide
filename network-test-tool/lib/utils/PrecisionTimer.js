/**
 * High-precision timing utility for finality measurements
 * Uses process.hrtime.bigint() for nanosecond precision
 */
class PrecisionTimer {
  static now() {
    return process.hrtime.bigint();
  }
  
  static elapsedMs(start, end = PrecisionTimer.now()) {
    return Number(end - start) / 1e6; // Convert nanoseconds to milliseconds
  }
  
  static elapsedSeconds(start, end = PrecisionTimer.now()) {
    return Number(end - start) / 1e9; // Convert nanoseconds to seconds
  }
  
  // Account for system clock adjustments with monotonic timing
  static async monotonic(fn) {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    return { 
      result, 
      elapsed: Number(end - start) / 1e6, // milliseconds
      elapsedNs: Number(end - start) // nanoseconds for ultra-precision
    };
  }
  
  // MEV-aware timing with activity correlation
  static async mevAwareMonotonic(fn, mevMonitor = null) {
    const start = process.hrtime.bigint();
    const mevScoreStart = mevMonitor ? await mevMonitor.getCurrentScore() : 0;
    
    const result = await fn();
    
    const end = process.hrtime.bigint();
    const mevScoreEnd = mevMonitor ? await mevMonitor.getCurrentScore() : 0;
    
    return {
      result,
      elapsed: Number(end - start) / 1e6,
      elapsedNs: Number(end - start),
      mevDelta: mevScoreEnd - mevScoreStart,
      mevImpact: Math.abs(mevScoreEnd - mevScoreStart) > 10, // Significant MEV change during operation
      mevScoreStart,
      mevScoreEnd
    };
  }
  
  // Benchmark with statistics
  static async benchmark(fn, iterations = 1) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const { elapsed } = await this.monotonic(fn);
      times.push(elapsed);
    }
    
    times.sort((a, b) => a - b);
    
    return {
      iterations,
      times,
      min: times[0],
      max: times[times.length - 1],
      median: times[Math.floor(times.length / 2)],
      mean: times.reduce((sum, t) => sum + t, 0) / times.length,
      p90: times[Math.floor(times.length * 0.9)],
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)]
    };
  }
  
  // Format timing results for display
  static formatTiming(elapsedMs) {
    if (elapsedMs < 1000) {
      return `${elapsedMs.toFixed(2)}ms`;
    } else if (elapsedMs < 60000) {
      return `${(elapsedMs / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(elapsedMs / 60000);
      const seconds = ((elapsedMs % 60000) / 1000).toFixed(2);
      return `${minutes}m ${seconds}s`;
    }
  }
  
  // Create a stopwatch for continuous timing
  static createStopwatch() {
    const startTime = this.now();
    
    return {
      elapsed: () => this.elapsedMs(startTime),
      elapsedFormatted: () => this.formatTiming(this.elapsedMs(startTime)),
      lap: () => {
        const currentElapsed = this.elapsedMs(startTime);
        return {
          elapsed: currentElapsed,
          formatted: this.formatTiming(currentElapsed),
          timestamp: new Date().toISOString()
        };
      },
      reset: () => {
        return this.createStopwatch(); // Create new stopwatch
      }
    };
  }
  
  // Sleep with high precision
  static async sleep(ms) {
    const start = this.now();
    return new Promise((resolve) => {
      const checkTime = () => {
        if (this.elapsedMs(start) >= ms) {
          resolve();
        } else {
          setImmediate(checkTime);
        }
      };
      checkTime();
    });
  }
  
  // Rate limiting utility
  static createRateLimiter(operationsPerSecond) {
    const intervalMs = 1000 / operationsPerSecond;
    let lastExecution = 0;
    
    return async () => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecution;
      
      if (timeSinceLastExecution < intervalMs) {
        await this.sleep(intervalMs - timeSinceLastExecution);
      }
      
      lastExecution = Date.now();
    };
  }
}

module.exports = { PrecisionTimer };