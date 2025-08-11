/**
 * Global Authentication Error Handler
 * Prevents spam of repeated "Unauthorized" errors by throttling and tracking them
 */

class AuthErrorHandler {
  constructor() {
    this.recentAuthErrors = new Map(); // Track recent auth errors by endpoint
    this.throttleWindow = 60000; // 1 minute throttle window
    this.maxErrorsPerWindow = 3; // Max 3 errors per window
  }

  /**
   * Check if we should log/report this auth error or if it's been throttled
   */
  shouldReportAuthError(endpoint) {
    const now = Date.now();
    const key = endpoint || 'unknown';
    
    if (!this.recentAuthErrors.has(key)) {
      this.recentAuthErrors.set(key, { count: 1, firstSeen: now, lastSeen: now });
      return true;
    }

    const errorInfo = this.recentAuthErrors.get(key);
    
    // Reset count if we're past the throttle window
    if (now - errorInfo.firstSeen > this.throttleWindow) {
      this.recentAuthErrors.set(key, { count: 1, firstSeen: now, lastSeen: now });
      return true;
    }

    // Increment count
    errorInfo.count++;
    errorInfo.lastSeen = now;

    // Only report if we haven't exceeded the max errors per window
    if (errorInfo.count <= this.maxErrorsPerWindow) {
      return true;
    }

    // Throttled - don't report
    return false;
  }

  /**
   * Clean up old error tracking data
   */
  cleanup() {
    const now = Date.now();
    for (const [key, errorInfo] of this.recentAuthErrors.entries()) {
      if (now - errorInfo.lastSeen > this.throttleWindow * 2) {
        this.recentAuthErrors.delete(key);
      }
    }
  }

  /**
   * Get current error statistics
   */
  getStats() {
    const stats = {};
    for (const [key, errorInfo] of this.recentAuthErrors.entries()) {
      stats[key] = {
        count: errorInfo.count,
        duration: errorInfo.lastSeen - errorInfo.firstSeen,
        throttled: errorInfo.count > this.maxErrorsPerWindow
      };
    }
    return stats;
  }

  /**
   * Enhanced console.error that respects auth error throttling
   */
  logAuthError(message, endpoint, ...args) {
    if (this.shouldReportAuthError(endpoint)) {
      const errorInfo = this.recentAuthErrors.get(endpoint || 'unknown');
      if (errorInfo.count === this.maxErrorsPerWindow) {
        console.warn(`[AUTH ERROR THROTTLED] Further authentication errors for ${endpoint} will be silenced for ${this.throttleWindow / 1000}s`);
      }
      console.error(`[AUTH ERROR] ${message}`, ...args);
    }
    // Silent when throttled
  }
}

// Global instance
const authErrorHandler = new AuthErrorHandler();

// Cleanup interval
setInterval(() => {
  authErrorHandler.cleanup();
}, 5 * 60 * 1000); // Cleanup every 5 minutes

export default authErrorHandler;

/**
 * Wrapper for fetch that handles auth errors gracefully
 */
export const fetchWithAuthHandling = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 401) {
      authErrorHandler.logAuthError('Unauthorized request', url);
      throw new Error('Authentication required');
    }
    
    return response;
  } catch (error) {
    if (error.message !== 'Authentication required') {
      throw error; // Re-throw non-auth errors
    }
    throw error;
  }
};

/**
 * Enhanced error boundary for React Query that handles auth errors
 */
export const handleQueryError = (error, queryKey) => {
  const endpoint = Array.isArray(queryKey) ? queryKey.join('/') : 'unknown';
  
  if (error.message === 'Authentication required' || 
      (error.response?.status === 401)) {
    authErrorHandler.logAuthError('Query authentication failed', endpoint, error);
    return; // Don't propagate auth errors to avoid spam
  }
  
  // Log other errors normally
  console.error('Query failed:', endpoint, error);
};