const chalk = require('chalk');
const { getNetworkConfig } = require('./networks');

class RetryManager {
  constructor(options = {}) {
    this.options = {
      baseDelay: options.baseDelay || 1000,
      maxDelay: options.maxDelay || 30000,
      maxRetries: options.maxRetries || 5,
      exponentialBase: options.exponentialBase || 2,
      jitterMax: options.jitterMax || 0.1,
      ...options
    };
    
    // Network-specific retry configurations
    this.networkConfigs = {
      11155111: { // Sepolia
        maxRetries: 3,
        baseDelay: 2000,
        errors: {
          'gas': { maxRetries: 2, baseDelay: 1000 },
          'timeout': { maxRetries: 5, baseDelay: 5000 },
          'nonce': { maxRetries: 3, baseDelay: 2000 }
        }
      },
      167012: { // Kasplex
        maxRetries: 5,
        baseDelay: 3000,
        errors: {
          'gas': { maxRetries: 3, baseDelay: 2000 },
          'timeout': { maxRetries: 7, baseDelay: 8000 },
          'connection': { maxRetries: 4, baseDelay: 5000 }
        }
      },
      19416: { // Igra
        maxRetries: 4,
        baseDelay: 2500,
        errors: {
          'gas': { maxRetries: 1, baseDelay: 500 }, // Strict gas requirements
          'timeout': { maxRetries: 6, baseDelay: 4000 },
          'revert': { maxRetries: 2, baseDelay: 1000 }
        }
      }
    };
  }

  async executeWithRetry(operation, maxRetries = null, chainId = null, context = {}) {
    const retryConfig = this.getRetryConfig(chainId, context.errorType);
    const finalMaxRetries = maxRetries || retryConfig.maxRetries;
    const baseDelay = retryConfig.baseDelay;
    
    let lastError;
    let attempt = 0;
    
    while (attempt <= finalMaxRetries) {
      try {
        if (attempt > 0) {
          const delay = this.calculateDelay(attempt, baseDelay, chainId);
          console.log(chalk.yellow(`⏳ Retrying in ${delay}ms (attempt ${attempt}/${finalMaxRetries})...`));
          await this.delay(delay);
        }
        
        return await operation();
        
      } catch (error) {
        lastError = error;
        attempt++;
        
        // Analyze error to determine retry strategy
        const errorAnalysis = this.analyzeError(error, chainId);
        
        if (!errorAnalysis.shouldRetry || attempt > finalMaxRetries) {
          console.log(chalk.red(`❌ Max retries exceeded or non-recoverable error: ${error.message}`));
          throw lastError;
        }
        
        console.log(chalk.yellow(`⚠️ Attempt ${attempt} failed: ${errorAnalysis.category} - ${error.message}`));
        
        // Update context for next retry
        context.errorType = errorAnalysis.category;
        context.severity = errorAnalysis.severity;
      }
    }
    
    throw lastError;
  }

  getRetryConfig(chainId, errorType = null) {
    const networkConfig = chainId ? this.networkConfigs[chainId] : null;
    
    if (networkConfig) {
      if (errorType && networkConfig.errors[errorType]) {
        return {
          maxRetries: networkConfig.errors[errorType].maxRetries,
          baseDelay: networkConfig.errors[errorType].baseDelay
        };
      }
      return {
        maxRetries: networkConfig.maxRetries,
        baseDelay: networkConfig.baseDelay
      };
    }
    
    return {
      maxRetries: this.options.maxRetries,
      baseDelay: this.options.baseDelay
    };
  }

  calculateDelay(attempt, baseDelay, chainId = null) {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(this.options.exponentialBase, attempt - 1);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.options.jitterMax * exponentialDelay;
    
    let delay = exponentialDelay + jitter;
    
    // Network-specific delay adjustments
    if (chainId) {
      delay = this.applyNetworkSpecificDelay(delay, chainId, attempt);
    }
    
    // Cap at maximum delay
    return Math.min(delay, this.options.maxDelay);
  }

  applyNetworkSpecificDelay(delay, chainId, attempt) {
    switch (chainId) {
      case 167012: // Kasplex - longer delays due to potential congestion
        return delay * 1.5;
      
      case 19416: // Igra - shorter delays but more cautious
        return delay * 0.8;
      
      case 11155111: // Sepolia - standard Ethereum behavior
      default:
        return delay;
    }
  }

  analyzeError(error, chainId = null) {
    const errorMessage = error.message.toLowerCase();
    const errorCode = error.code;
    
    // Gas-related errors
    if (this.isGasError(errorMessage, errorCode)) {
      return {
        category: 'gas',
        severity: 'medium',
        shouldRetry: chainId !== 19416, // Igra gas errors are often fatal
        suggestion: 'Adjust gas price or limit'
      };
    }
    
    // Timeout errors
    if (this.isTimeoutError(errorMessage, errorCode)) {
      return {
        category: 'timeout',
        severity: 'low',
        shouldRetry: true,
        suggestion: 'Network congestion, retry with longer timeout'
      };
    }
    
    // Nonce errors
    if (this.isNonceError(errorMessage, errorCode)) {
      return {
        category: 'nonce',
        severity: 'medium',
        shouldRetry: true,
        suggestion: 'Nonce synchronization issue'
      };
    }
    
    // Connection errors
    if (this.isConnectionError(errorMessage, errorCode)) {
      return {
        category: 'connection',
        severity: 'medium',
        shouldRetry: true,
        suggestion: 'Network connectivity issue'
      };
    }
    
    // Revert errors
    if (this.isRevertError(errorMessage, errorCode)) {
      return {
        category: 'revert',
        severity: 'high',
        shouldRetry: false, // Contract reverts are typically not retryable
        suggestion: 'Check contract conditions'
      };
    }
    
    // Rate limiting
    if (this.isRateLimitError(errorMessage, errorCode)) {
      return {
        category: 'ratelimit',
        severity: 'low',
        shouldRetry: true,
        suggestion: 'Rate limited, will retry with backoff'
      };
    }
    
    // Unknown errors - conservative approach
    return {
      category: 'unknown',
      severity: 'high',
      shouldRetry: false,
      suggestion: 'Unknown error type, manual investigation needed'
    };
  }

  isGasError(message, code) {
    return message.includes('gas') || 
           message.includes('intrinsic gas too low') ||
           message.includes('gas price') ||
           code === 'UNPREDICTABLE_GAS_LIMIT';
  }

  isTimeoutError(message, code) {
    return message.includes('timeout') ||
           message.includes('network timeout') ||
           code === 'TIMEOUT' ||
           code === 'NETWORK_ERROR';
  }

  isNonceError(message, code) {
    return message.includes('nonce') ||
           message.includes('nonce too low') ||
           message.includes('nonce too high') ||
           code === 'NONCE_EXPIRED';
  }

  isConnectionError(message, code) {
    return message.includes('connection') ||
           message.includes('network error') ||
           message.includes('econnrefused') ||
           message.includes('socket hang up') ||
           code === 'NETWORK_ERROR';
  }

  isRevertError(message, code) {
    return message.includes('revert') ||
           message.includes('execution reverted') ||
           code === 'CALL_EXCEPTION';
  }

  isRateLimitError(message, code) {
    return message.includes('rate limit') ||
           message.includes('too many requests') ||
           message.includes('429') ||
           code === 'RATE_LIMITED';
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Factory method for creating operation-specific retry managers
  static createForOperation(operationType, chainId) {
    const configs = {
      deployment: {
        maxRetries: 3,
        baseDelay: 5000,
        maxDelay: 30000
      },
      transaction: {
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 20000
      },
      query: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000
      },
      loadTest: {
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 5000
      }
    };
    
    const config = configs[operationType] || configs.transaction;
    return new RetryManager(config);
  }

  // Utility methods for common patterns
  async retryTransaction(txFunction, maxRetries = null, chainId = null) {
    return this.executeWithRetry(txFunction, maxRetries, chainId, {
      errorType: 'transaction'
    });
  }

  async retryDeployment(deployFunction, maxRetries = null, chainId = null) {
    return this.executeWithRetry(deployFunction, maxRetries, chainId, {
      errorType: 'deployment'
    });
  }

  async retryQuery(queryFunction, maxRetries = null, chainId = null) {
    return this.executeWithRetry(queryFunction, maxRetries, chainId, {
      errorType: 'query'
    });
  }

  // Get max retries for a specific network and test type
  getMaxRetries(chainId, testType = 'default') {
    const networkConfig = this.networkConfigs[chainId];
    if (!networkConfig) return this.options.maxRetries;
    
    // Test type specific adjustments
    switch (testType) {
      case 'load':
        return Math.min(networkConfig.maxRetries, 2); // Fewer retries for load tests
      case 'evm':
        return networkConfig.maxRetries;
      case 'defi':
        return networkConfig.maxRetries + 1; // DeFi tests might need extra attempts
      default:
        return networkConfig.maxRetries;
    }
  }

  // Circuit breaker pattern for repeated failures
  createCircuitBreaker(failureThreshold = 5, recoveryTimeout = 60000) {
    let failures = 0;
    let lastFailureTime = 0;
    let isOpen = false;
    
    return {
      async execute(operation) {
        const now = Date.now();
        
        // Check if circuit should recover
        if (isOpen && (now - lastFailureTime) > recoveryTimeout) {
          isOpen = false;
          failures = 0;
          console.log(chalk.green('🔄 Circuit breaker recovering...'));
        }
        
        // Reject if circuit is open
        if (isOpen) {
          throw new Error('Circuit breaker is open - too many failures');
        }
        
        try {
          const result = await operation();
          
          // Reset on success
          if (failures > 0) {
            failures = 0;
            console.log(chalk.green('✅ Circuit breaker reset after success'));
          }
          
          return result;
          
        } catch (error) {
          failures++;
          lastFailureTime = now;
          
          if (failures >= failureThreshold) {
            isOpen = true;
            console.log(chalk.red(`🔒 Circuit breaker opened after ${failures} failures`));
          }
          
          throw error;
        }
      }
    };
  }
}

module.exports = { RetryManager };