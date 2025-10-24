/**
 * AI Service V2 - Refactored and Simplified
 * Main orchestrator with clean initialization and clear responsibilities
 *
 * Key improvements:
 * - Explicit initialization with clear error states
 * - Removed 4-source complexity (now uses AIServiceInitializer)
 * - Separated core AI calling logic (AIServiceCore)
 * - No auto-initialization in call method (explicit is better than implicit)
 * - Streaming removed (was broken for multi-user apps)
 */

import logger from '../utils/logger.js';
import { AIServiceInitializer } from './core/AIServiceInitializer.js';
import { AIServiceCore } from './core/AIServiceCore.js';
import { RequestQueue } from './services/RequestQueue.js';
import { UsageTracker } from './services/UsageTracker.js';
import { AISdkService } from './AISdkService.js';
import { tools } from './tools/index.js';

export class AIServiceV2 {
  constructor() {
    // Core service - null until initialized
    this.core = null;

    // SDK service for tool calling
    this.aiSdkService = null;

    // Request queue to prevent rate limiting
    this.requestQueue = new RequestQueue(2000); // 2 second intervals
    this.requestQueueCleanupInterval = null;

    // Usage tracking
    this.usageTracker = new UsageTracker();

    // Current state
    this.initialized = false;
    this.currentApiKeys = null;
    this.initializationError = null;

    // Start cleanup
    this.startQueueCleanup();
  }

  /**
   * Initialize AI service with API keys
   *
   * @param {Object} options - Initialization options
   * @param {Object} options.apiKeys - Direct API keys { gemini?, openai? }
   * @param {string} options.userId - User ID for database lookup
   * @param {boolean} options.useLocalStorage - Try localStorage (default: true)
   * @returns {Promise<InitResult>}
   *
   * @example
   * // Direct initialization with keys
   * const result = await aiService.initialize({
   *   apiKeys: { gemini: 'key123', openai: 'key456' }
   * });
   *
   * // Initialize from database
   * const result = await aiService.initialize({
   *   userId: 'user123'
   * });
   */
  async initialize(options = {}) {
    try {
      logger.info('🔧 Initializing AI Service V2...');

      // Use AIServiceInitializer for clean initialization
      const initResult = await AIServiceInitializer.initialize(options);

      if (!initResult.success) {
        this.initialized = false;
        this.initializationError = {
          code: initResult.error,
          message: initResult.message,
          details: initResult.validationErrors
        };

        logger.error(`❌ AI Service initialization failed: ${initResult.message}`);
        return {
          success: false,
          error: this.initializationError
        };
      }

      // Initialize core with clients
      this.core = new AIServiceCore(initResult.clients);
      this.currentApiKeys = initResult.apiKeys;

      // Initialize AI SDK service for tool calling
      if (initResult.apiKeys) {
        try {
          this.aiSdkService = new AISdkService(initResult.apiKeys);
          logger.info('✅ AI SDK Service initialized');
        } catch (error) {
          logger.warn('⚠️ AI SDK Service initialization failed:', error);
          // Non-critical - continue without SDK service
        }
      }

      this.initialized = true;
      this.initializationError = null;

      logger.info('✅ AI Service V2 initialized successfully', {
        providers: initResult.providers,
        hasSdkService: !!this.aiSdkService
      });

      return {
        success: true,
        providers: initResult.providers
      };

    } catch (error) {
      this.initialized = false;
      this.initializationError = {
        code: 'INITIALIZATION_ERROR',
        message: error.message,
        stack: error.stack
      };

      logger.error('❌ AI Service initialization error:', error);

      return {
        success: false,
        error: this.initializationError
      };
    }
  }

  /**
   * Reinitialize with new API keys
   * Useful when user updates their API keys
   */
  async reinitialize(newApiKeys) {
    logger.info('🔄 Reinitializing AI Service with new API keys');

    // Clear existing state
    this.core = null;
    this.aiSdkService = null;
    this.initialized = false;
    this.currentApiKeys = null;
    this.initializationError = null;

    // Reset circuit breakers if core exists
    if (this.core) {
      this.core.resetCircuitBreakers();
    }

    // Initialize with new keys
    return await this.initialize({ apiKeys: newApiKeys });
  }

  /**
   * Make an AI call
   * REQUIRES explicit initialization - no auto-initialization
   *
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Call options
   * @param {Object} options.agent - Agent configuration
   * @param {number} options.complexity - Complexity level (1-4)
   * @param {Object} options.context - Additional context
   * @param {string} options.userId - User ID for usage tracking
   * @param {boolean} options.useTools - Whether to use tool calling
   * @returns {Promise<{content: string, provider: string, usage: Object}>}
   */
  async call(prompt, options = {}) {
    const { agent, complexity = 1, context = {}, userId, useTools = false } = options;

    // Auto-initialize if not initialized and userId is provided
    if (!this.initialized && userId) {
      logger.info(`🔧 Auto-initializing AIServiceV2 for user: ${userId}`);
      const initResult = await this.initialize({ userId });
      if (!initResult.success) {
        throw new Error(
          `AI Service initialization failed: No API keys configured for user ${userId}. ` +
          `Please configure your API keys in user settings before running workflows. ` +
          `${this.initializationError ? `Error: ${this.initializationError.message}` : ''}`
        );
      }
    } else if (!this.initialized) {
      throw new Error(
        `AI Service initialization failed: No API keys configured. ` +
        `${this.initializationError ?
          `Initialization error: ${this.initializationError.message}` :
          'Please configure your API keys in user settings.'}`
      );
    }

    // Route to appropriate handler
    if (useTools) {
      return await this.callWithTools(prompt, { agent, complexity, context, userId });
    }

    // Check usage limits
    if (userId) {
      const limitsCheck = await this.usageTracker.checkUserLimits(userId);
      if (!limitsCheck.allowed) {
        throw new Error(`Usage limit exceeded: ${limitsCheck.reason}`);
      }
    }

    // Queue request and execute through core
    return await this.requestQueue.enqueue(userId || 'anonymous', async () => {
      const result = await this.core.call(prompt, { agent, complexity, context });

      // Track usage
      if (userId) {
        await this.trackUsage(userId, result);
      }

      return result;
    });
  }

  /**
   * Call with tool support
   */
  async callWithTools(prompt, options = {}) {
    const { agent, complexity, context, userId } = options;

    // Check SDK service availability
    if (!this.aiSdkService) {
      throw new Error('AI SDK Service not available for tool calling');
    }

    // Check usage limits
    if (userId) {
      const limitsCheck = await this.usageTracker.checkUserLimits(userId);
      if (!limitsCheck.allowed) {
        throw new Error(`Usage limit exceeded: ${limitsCheck.reason}`);
      }
    }

    // Build messages with agent context
    const messages = this.buildToolMessages(prompt, agent);

    try {
      // Set tool execution context
      if (userId) {
        const { setUserContext, setRepositoryContext } = await import('./tools/toolExecutor.js');
        setUserContext(userId);

        if (context?.repository) {
          setRepositoryContext({
            owner: context.repository.owner,
            name: context.repository.name
          });
        }
      }

      // Update SDK service with current keys
      if (this.currentApiKeys) {
        this.aiSdkService.updateApiKeys(this.currentApiKeys);
      }

      // Generate with tools
      const result = await this.aiSdkService.generateWithTools(messages, tools, {
        maxTokens: this.core.calculateMaxTokens(complexity, context),
        temperature: 0.7,
        userId
      });

      // Track usage
      if (userId) {
        await this.usageTracker.trackUsage(
          userId,
          'tools',
          result.usage?.totalTokens || 0,
          0,
          result.usage?.inputTokens || 0,
          result.usage?.outputTokens || 0
        );
      }

      return result;

    } finally {
      // Clear context
      if (userId) {
        const { clearUserContext } = await import('./tools/toolExecutor.js');
        clearUserContext();
      }
    }
  }

  /**
   * Build messages for tool calling
   */
  buildToolMessages(prompt, agent) {
    const messages = [];

    if (agent?.persona) {
      const systemPrompt = this.buildAgentPrompt(agent.persona, agent.name);
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });
    return messages;
  }

  /**
   * Build agent system prompt
   */
  buildAgentPrompt(persona, agentName) {
    let prompt = '';

    if (persona.identity) {
      prompt += `Identity: ${persona.identity}\n\n`;
    }

    if (persona.role) {
      prompt += `Role: ${persona.role}\n`;
    }

    if (persona.focus) {
      prompt += `Focus: ${persona.focus}\n`;
    }

    if (persona.core_principles && Array.isArray(persona.core_principles)) {
      prompt += `\nCore Principles:\n${persona.core_principles.map(p => `- ${p}`).join('\n')}\n`;
    }

    return prompt;
  }

  /**
   * Track usage for a user
   */
  async trackUsage(userId, result) {
    const usage = result.usage || {};
    const provider = result.provider;

    const cost = this.estimateCost(provider, usage);
    const totalTokens = usage.total_tokens || usage.totalTokenCount || 0;
    const promptTokens = usage.prompt_tokens || usage.promptTokenCount || 0;
    const completionTokens = usage.completion_tokens || usage.candidatesTokenCount || 0;

    await this.usageTracker.trackUsage(
      userId,
      provider,
      totalTokens,
      cost,
      promptTokens,
      completionTokens
    );

    logger.info(`📊 Usage tracked for user ${userId}:`, {
      provider,
      totalTokens,
      cost: cost.toFixed(6)
    });
  }

  /**
   * Estimate cost based on provider and usage
   */
  estimateCost(provider, usage) {
    if (provider === 'gemini') {
      const tokens = usage.totalTokenCount || usage.total_tokens || 0;
      return tokens * 0.000001; // $0.000001 per token
    } else if (provider === 'openai') {
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      const promptCost = promptTokens * 0.00000015;
      const completionCost = completionTokens * 0.0000006;
      return promptCost + completionCost;
    }
    return 0;
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.initialized) {
      return {
        status: 'uninitialized',
        error: this.initializationError,
        providers: {},
        timestamp: new Date().toISOString()
      };
    }

    const results = {
      gemini: await this.core.checkProviderHealth('gemini'),
      openai: await this.core.checkProviderHealth('openai')
    };

    const healthyProviders = Object.entries(results)
      .filter(([_, stats]) => stats.healthy)
      .map(([provider]) => provider);

    return {
      status: healthyProviders.length > 0 ? 'healthy' : 'unhealthy',
      providers: results,
      healthyProviders,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get initialization state
   */
  getInitializationState() {
    return {
      initialized: this.initialized,
      error: this.initializationError,
      hasCore: !!this.core,
      hasSdkService: !!this.aiSdkService,
      hasApiKeys: !!this.currentApiKeys
    };
  }

  /**
   * Get usage stats
   */
  async getUsageStats(userId) {
    return await this.usageTracker.getUserStats(userId);
  }

  /**
   * Get global usage stats
   */
  async getGlobalUsageStats() {
    return await this.usageTracker.getGlobalStats();
  }

  /**
   * Get health stats from core
   */
  getHealthStats() {
    if (!this.core) {
      return {
        gemini: { healthy: false, error: 'Not initialized' },
        openai: { healthy: false, error: 'Not initialized' }
      };
    }
    return this.core.getHealthStats();
  }

  /**
   * Reset circuit breakers
   */
  resetCircuitBreakers() {
    if (this.core) {
      this.core.resetCircuitBreakers();
    }
  }

  /**
   * Set provider priority
   */
  setProviderPriority(priority) {
    if (this.core) {
      this.core.setProviderPriority(priority);
    }
  }

  /**
   * Queue cleanup
   */
  startQueueCleanup() {
    if (this.requestQueueCleanupInterval) return;

    this.requestQueueCleanupInterval = setInterval(() => {
      this.requestQueue.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.requestQueueCleanupInterval) {
      clearInterval(this.requestQueueCleanupInterval);
    }
    if (this.usageTracker) {
      this.usageTracker.destroy();
    }
    this.core = null;
    this.aiSdkService = null;
    this.initialized = false;
  }

  /**
   * Singleton instance
   */
  static getInstance() {
    if (!AIServiceV2.instance) {
      AIServiceV2.instance = new AIServiceV2();
    }
    return AIServiceV2.instance;
  }
}

// Export singleton
export const aiServiceV2 = AIServiceV2.getInstance();
export default aiServiceV2;
