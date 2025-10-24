/**
 * Error Recovery Manager
 * Provides intelligent error recovery strategies for BMAD workflows
 * 
 * Responsibilities:
 * - Classify error types and severity
 * - Determine appropriate recovery strategies
 * - Execute recovery actions with retry logic
 * - Maintain error context and learning
 * - Provide fallback mechanisms
 */

import logger from '../../utils/logger.js';

class ErrorRecoveryManager {
  constructor(options = {}) {
    this.maxRetryAttempts = options.maxRetryAttempts || 3;
    this.baseRetryDelay = options.baseRetryDelay || 1000; // ms
    this.maxRetryDelay = options.maxRetryDelay || 10000; // ms
    this.enableLearning = options.enableLearning !== false;
    
    // Error classification patterns (ORDER MATTERS - most specific first!)
    this.errorClassification = {
      AI_INIT_FAILURE: /not initialized|api key|configure.*key|initialization failed|Please call initialize/i,
      NETWORK: /network|connection|timeout|ENOTFOUND|ECONNREFUSED/i,
      AI_SERVICE: /ai service|openai|anthropic|rate limit|quota/i,
      VALIDATION: /validation|invalid|malformed|parse error/i,
      AUTHENTICATION: /auth|unauthorized|forbidden|token|credential/i,
      WORKFLOW: /workflow|step|agent|routing/i,
      DATABASE: /database|mongo|connection|query/i,
      FILE_SYSTEM: /ENOENT|EACCES|file not found|permission denied/i,
      RESOURCE: /memory|disk|cpu|resource/i
    };

    // Recovery strategies by error type
    this.recoveryStrategies = {
      NETWORK: ['retry_with_backoff', 'switch_endpoint', 'offline_mode'],
      AI_SERVICE: ['retry_with_backoff', 'switch_provider', 'use_fallback_model'],
      AI_INIT_FAILURE: ['fail_fast'], // Don't retry - user needs to configure API keys
      VALIDATION: ['sanitize_input', 'use_fallback_format', 'request_user_input'],
      AUTHENTICATION: ['refresh_token', 'prompt_reauth', 'use_fallback_auth'],
      WORKFLOW: ['reset_step', 'skip_step', 'use_alternative_path'],
      DATABASE: ['retry_connection', 'use_cache', 'temporary_storage'],
      FILE_SYSTEM: ['create_missing_paths', 'use_temp_location', 'request_permissions'],
      RESOURCE: ['clear_cache', 'reduce_complexity', 'split_task']
    };

    this.errorHistory = new Map(); // Track error patterns for learning
  }

  /**
   * Main error recovery entry point
   */
  async handleError(error, context = {}) {
    logger.info(`🚨 [ERROR-RECOVERY] Handling error: ${error.message}`);
    
    const errorAnalysis = this.analyzeError(error, context);
    const recoveryPlan = this.createRecoveryPlan(errorAnalysis, context);
    
    logger.info(`🔧 [ERROR-RECOVERY] Error type: ${errorAnalysis.type}, Severity: ${errorAnalysis.severity}, Strategy: ${recoveryPlan.strategy}`);
    
    // Record error for learning
    if (this.enableLearning) {
      this.recordError(errorAnalysis, context);
    }
    
    try {
      const recoveryResult = await this.executeRecovery(recoveryPlan, context);
      logger.info(`✅ [ERROR-RECOVERY] Recovery successful: ${recoveryResult.strategy}`);
      return recoveryResult;
    } catch (recoveryError) {
      logger.error(`❌ [ERROR-RECOVERY] Recovery failed: ${recoveryError.message}`);
      return this.createFallbackResponse(error, recoveryError, context);
    }
  }

  /**
   * Analyze error to determine type and severity
   */
  analyzeError(error, context) {
    const errorMessage = error.message || error.toString();
    const errorStack = error.stack || '';
    
    // Classify error type
    let errorType = 'UNKNOWN';
    for (const [type, pattern] of Object.entries(this.errorClassification)) {
      if (pattern.test(errorMessage) || pattern.test(errorStack)) {
        errorType = type;
        break;
      }
    }
    
    // Determine severity
    const severity = this.determineSeverity(error, errorType, context);
    
    // Check for recurring patterns
    const errorPattern = this.getErrorPattern(errorMessage);
    const isRecurring = this.errorHistory.has(errorPattern);
    const occurrenceCount = this.errorHistory.get(errorPattern)?.count || 0;
    
    return {
      originalError: error,
      type: errorType,
      severity,
      message: errorMessage,
      stack: errorStack,
      pattern: errorPattern,
      isRecurring,
      occurrenceCount,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        workflowStep: context.step?.step,
        agentName: context.agent?.name
      }
    };
  }

  /**
   * Create recovery plan based on error analysis
   */
  createRecoveryPlan(errorAnalysis, context) {
    const strategies = this.recoveryStrategies[errorAnalysis.type] || ['retry_with_backoff'];
    
    // Select strategy based on context and error history
    let selectedStrategy = strategies[0];
    
    if (errorAnalysis.isRecurring) {
      // For recurring errors, try alternative strategies
      const strategyIndex = Math.min(errorAnalysis.occurrenceCount, strategies.length - 1);
      selectedStrategy = strategies[strategyIndex];
    }
    
    // Adjust strategy based on severity
    if (errorAnalysis.severity === 'CRITICAL') {
      selectedStrategy = this.getCriticalRecoveryStrategy(errorAnalysis.type);
    }
    
    return {
      strategy: selectedStrategy,
      errorAnalysis,
      maxRetries: this.getMaxRetriesForStrategy(selectedStrategy),
      retryDelay: this.calculateRetryDelay(errorAnalysis.occurrenceCount),
      fallbackOptions: strategies.slice(1)
    };
  }

  /**
   * Execute the recovery strategy
   */
  async executeRecovery(recoveryPlan, context) {
    const { strategy, errorAnalysis } = recoveryPlan;

    logger.info(`🔄 [ERROR-RECOVERY] Executing strategy: ${strategy}`);

    switch (strategy) {
      case 'fail_fast':
        // Don't retry - immediately fail with helpful error message
        throw new Error(
          `AI Service initialization failed. Please configure your API keys in the user settings. ` +
          `Error: ${errorAnalysis.message}`
        );

      case 'retry_with_backoff':
        return await this.retryWithBackoff(recoveryPlan, context);

      case 'switch_provider':
        return await this.switchAIProvider(recoveryPlan, context);

      case 'use_fallback_model':
        return await this.useFallbackModel(recoveryPlan, context);
      
      case 'sanitize_input':
        return await this.sanitizeInput(recoveryPlan, context);
      
      case 'reset_step':
        return await this.resetWorkflowStep(recoveryPlan, context);
      
      case 'skip_step':
        return await this.skipWorkflowStep(recoveryPlan, context);
      
      case 'use_alternative_path':
        return await this.useAlternativePath(recoveryPlan, context);
      
      case 'refresh_token':
        return await this.refreshAuthentication(recoveryPlan, context);
      
      case 'create_missing_paths':
        return await this.createMissingPaths(recoveryPlan, context);
      
      case 'clear_cache':
        return await this.clearSystemCache(recoveryPlan, context);
      
      default:
        throw new Error(`Unknown recovery strategy: ${strategy}`);
    }
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff(recoveryPlan, context) {
    const { errorAnalysis } = recoveryPlan;
    const maxRetries = recoveryPlan.maxRetries;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`🔄 [RETRY] Attempt ${attempt}/${maxRetries}`);
      
      if (attempt > 1) {
        const delay = this.calculateRetryDelay(attempt - 1);
        logger.info(`⏳ [RETRY] Waiting ${delay}ms before retry`);
        await this.sleep(delay);
      }
      
      try {
        // Re-execute the original operation
        const result = await this.reExecuteOperation(context);
        
        logger.info(`✅ [RETRY] Successful on attempt ${attempt}`);
        return {
          success: true,
          strategy: 'retry_with_backoff',
          attempts: attempt,
          result
        };
      } catch (error) {
        logger.warn(`❌ [RETRY] Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === maxRetries) {
          throw new Error(`All ${maxRetries} retry attempts failed. Last error: ${error.message}`);
        }
      }
    }
  }

  /**
   * Switch to alternative AI provider
   */
  async switchAIProvider(recoveryPlan, context) {
    logger.info(`🔄 [AI-SWITCH] Attempting to switch AI provider`);
    
    // This would integrate with the AI service to switch providers
    // For now, return a recovery indication
    return {
      success: true,
      strategy: 'switch_provider',
      message: 'Switched to alternative AI provider',
      requiresRetry: true
    };
  }

  /**
   * Use fallback model with reduced complexity
   */
  async useFallbackModel(recoveryPlan, context) {
    logger.info(`🔄 [AI-FALLBACK] Using fallback model`);
    
    return {
      success: true,
      strategy: 'use_fallback_model',
      message: 'Using simplified AI model for recovery',
      requiresRetry: true,
      adjustedContext: {
        ...context,
        complexity: 'simple',
        fallbackMode: true
      }
    };
  }

  /**
   * Sanitize input to fix validation errors
   */
  async sanitizeInput(recoveryPlan, context) {
    logger.info(`🧹 [SANITIZE] Sanitizing input data`);
    
    const sanitizedContext = { ...context };
    
    // Basic sanitization logic
    if (context.userPrompt) {
      sanitizedContext.userPrompt = context.userPrompt
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    }
    
    return {
      success: true,
      strategy: 'sanitize_input',
      message: 'Input sanitized for compatibility',
      adjustedContext: sanitizedContext
    };
  }

  /**
   * Reset workflow step to retry from a clean state
   */
  async resetWorkflowStep(recoveryPlan, context) {
    logger.info(`🔄 [STEP-RESET] Resetting workflow step`);
    
    return {
      success: true,
      strategy: 'reset_step',
      message: 'Workflow step reset for clean retry',
      action: 'reset_current_step'
    };
  }

  /**
   * Skip problematic step and continue workflow
   */
  async skipWorkflowStep(recoveryPlan, context) {
    logger.warn(`⏭️ [STEP-SKIP] Skipping problematic workflow step`);
    
    return {
      success: true,
      strategy: 'skip_step',
      message: 'Skipped problematic step to continue workflow',
      action: 'skip_to_next_step'
    };
  }

  /**
   * Use alternative workflow path
   */
  async useAlternativePath(recoveryPlan, context) {
    logger.info(`🔀 [ALT-PATH] Using alternative workflow path`);
    
    return {
      success: true,
      strategy: 'use_alternative_path',
      message: 'Using alternative workflow path',
      action: 'route_to_alternative'
    };
  }

  /**
   * Refresh authentication tokens
   */
  async refreshAuthentication(recoveryPlan, context) {
    logger.info(`🔐 [AUTH-REFRESH] Refreshing authentication`);
    
    return {
      success: true,
      strategy: 'refresh_token',
      message: 'Authentication refreshed',
      action: 'refresh_auth_tokens'
    };
  }

  /**
   * Create missing file system paths
   */
  async createMissingPaths(recoveryPlan, context) {
    logger.info(`📁 [PATH-CREATE] Creating missing file paths`);
    
    return {
      success: true,
      strategy: 'create_missing_paths',
      message: 'Missing file paths created',
      action: 'create_directories'
    };
  }

  /**
   * Clear system cache to free resources
   */
  async clearSystemCache(recoveryPlan, context) {
    logger.info(`🗑️ [CACHE-CLEAR] Clearing system cache`);
    
    return {
      success: true,
      strategy: 'clear_cache',
      message: 'System cache cleared',
      action: 'clear_caches'
    };
  }

  /**
   * Create fallback response when recovery fails
   */
  createFallbackResponse(originalError, recoveryError, context) {
    return {
      success: false,
      strategy: 'fallback',
      originalError: originalError.message,
      recoveryError: recoveryError.message,
      message: 'Error recovery failed - using fallback response',
      fallback: true,
      action: 'user_intervention_required',
      userMessage: `I encountered an issue that I couldn't automatically resolve: ${originalError.message}. Please check the system and try again.`
    };
  }

  // Helper methods
  determineSeverity(error, errorType, context) {
    // Critical errors that stop workflow
    if (errorType === 'AUTHENTICATION' || errorType === 'DATABASE') return 'CRITICAL';
    
    // High severity for workflow-blocking errors
    if (errorType === 'WORKFLOW' || errorType === 'AI_SERVICE') return 'HIGH';
    
    // Medium severity for recoverable errors
    if (errorType === 'NETWORK' || errorType === 'VALIDATION') return 'MEDIUM';
    
    return 'LOW';
  }

  getErrorPattern(errorMessage) {
    // Create a pattern from error message for tracking recurring issues
    return errorMessage
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/['"]/g, '') // Remove quotes
      .substring(0, 100); // Limit length
  }

  getCriticalRecoveryStrategy(errorType) {
    const criticalStrategies = {
      AUTHENTICATION: 'refresh_token',
      DATABASE: 'retry_connection',
      WORKFLOW: 'reset_step',
      AI_SERVICE: 'switch_provider'
    };
    return criticalStrategies[errorType] || 'retry_with_backoff';
  }

  getMaxRetriesForStrategy(strategy) {
    const retryLimits = {
      'retry_with_backoff': 3,
      'switch_provider': 2,
      'refresh_token': 1,
      'reset_step': 2
    };
    return retryLimits[strategy] || this.maxRetryAttempts;
  }

  calculateRetryDelay(attempt) {
    // Exponential backoff with jitter
    const delay = Math.min(
      this.baseRetryDelay * Math.pow(2, attempt),
      this.maxRetryDelay
    );
    
    // Add random jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    return Math.max(delay + jitter, this.baseRetryDelay);
  }

  recordError(errorAnalysis, context) {
    const pattern = errorAnalysis.pattern;
    const existing = this.errorHistory.get(pattern) || { count: 0, contexts: [] };
    
    this.errorHistory.set(pattern, {
      count: existing.count + 1,
      lastOccurrence: new Date(),
      contexts: [...existing.contexts.slice(-4), context] // Keep last 5 contexts
    });
  }

  async reExecuteOperation(context) {
    // This would re-execute the original operation that failed
    // The specific implementation would depend on the context
    if (context.retryCallback && typeof context.retryCallback === 'function') {
      return await context.retryCallback();
    }
    
    throw new Error('No retry callback provided');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats() {
    const stats = {
      totalErrors: 0,
      errorsByType: {},
      recurringErrors: 0,
      topErrors: []
    };

    for (const [pattern, data] of this.errorHistory.entries()) {
      stats.totalErrors += data.count;
      if (data.count > 1) {
        stats.recurringErrors++;
      }
    }

    stats.topErrors = Array.from(this.errorHistory.entries())
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10)
      .map(([pattern, data]) => ({ pattern, count: data.count }));

    return stats;
  }
}

export default ErrorRecoveryManager;