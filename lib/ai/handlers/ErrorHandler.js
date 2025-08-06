/**
 * Error categorization and handling for AI services
 * Provides error classification and retry strategies
 */

export class ErrorHandler {
  static categorizeError(error) {
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.code;

    if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
      return {
        category: 'RATE_LIMIT',
        severity: 'medium',
        retryable: true,
        retryDelay: 60000
      };
    }

    if (message.includes('quota') || message.includes('billing') || message.includes('insufficient funds')) {
      return {
        category: 'QUOTA_EXCEEDED',
        severity: 'high',
        retryable: false,
        userAction: 'Check API key billing/quota'
      };
    }

    if (status === 401 || message.includes('unauthorized') || message.includes('invalid api key')) {
      return {
        category: 'AUTH_ERROR',
        severity: 'high',
        retryable: false,
        userAction: 'Verify API key'
      };
    }

    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return {
        category: 'NETWORK_ERROR',
        severity: 'medium',
        retryable: true,
        retryDelay: 5000
      };
    }

    if (status >= 500 || message.includes('internal server error') || message.includes('service unavailable')) {
      return {
        category: 'SERVER_ERROR',
        severity: 'medium',
        retryable: true,
        retryDelay: 10000
      };
    }

    if (status >= 400 && status < 500) {
      return {
        category: 'CLIENT_ERROR',
        severity: 'low',
        retryable: false
      };
    }

    return {
      category: 'UNKNOWN_ERROR',
      severity: 'medium',
      retryable: true,
      retryDelay: 5000
    };
  }
}

export default ErrorHandler;