/**
 * Circuit Breaker pattern implementation for handling API failures
 * Prevents cascading failures and provides resilience
 */

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 300000; // 5 minutes
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = Date.now();
    this.successCount = 0;
  }

  async execute(fn, fallback = null) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN. Next attempt in ${Math.ceil((this.nextAttempt - Date.now()) / 1000)}s`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(); // Update circuit breaker state
      if (fallback) { // Always try fallback if provided and primary fails
        console.warn(`Primary function failed. Attempting fallback.`);
        try {
          return await fallback();
        } catch (fallbackError) {
          console.error(`Fallback function also failed:`, fallbackError);
          throw error; // Re-throw original error if fallback also fails
        }
      }
      throw error; // Re-throw if no fallback or fallback failed
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = Date.now();
    this.successCount = 0;
  }
}

export default CircuitBreaker;