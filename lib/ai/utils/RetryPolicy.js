/**
 * Retry utility with exponential backoff
 * Provides configurable retry logic with jitter
 */

import logger from '../../utils/logger.js';

export class RetryPolicy {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.jitter = options.jitter || 0.1;
  }

  async execute(fn, retryCondition = (error) => true) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === this.maxRetries || !retryCondition(error)) {
          throw error;
        }
        
        const delay = this.calculateDelay(attempt);
        logger.info(`🔄 Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms. Error: ${error.message}`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  calculateDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);
    const jitter = cappedDelay * this.jitter * Math.random();
    return Math.floor(cappedDelay + jitter);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default RetryPolicy;