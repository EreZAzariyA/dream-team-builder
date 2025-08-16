/**
 * AI Service Integration - Refactored Modular Version
 * Main orchestrator that combines all AI service components
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import ResponseFormatter, { STRUCTURED_RESPONSE_TEMPLATE } from '../bmad/ResponseFormatter.js';
import logger from '../utils/logger.js';

// Import extracted modules
import { RequestQueue } from './services/RequestQueue.js';
import { ErrorHandler } from './handlers/ErrorHandler.js';
import { CircuitBreaker } from './handlers/CircuitBreaker.js';
import { RetryPolicy } from './utils/RetryPolicy.js';
import { ApiKeyValidator } from './utils/ApiKeyValidator.js';
import { UsageTracker } from './services/UsageTracker.js';
import { ClientSideCrypto } from './utils/ClientSideCrypto.js';
import { AISdkService } from './AISdkService.js';

export class AIService {
  constructor() {
    this.geminiClient = null;
    this.openaiClient = null;
    this.aiSdkService = null; // New AI SDK service
    this.currentApiKeys = { gemini: null, openai: null };
    this.initialized = false;
    
    // Initialize circuit breakers for each provider
    this.geminiCircuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000 // 5 minutes
    });
    
    this.openaiCircuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000, // 30 seconds
      monitoringPeriod: 300000 // 5 minutes
    });
    
    // Initialize retry policies
    this.retryPolicy = new RetryPolicy({
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 3
    });
    
    // Initialize request queue system
    this.requestQueue = new RequestQueue(2000); // 2 second intervals
    this.requestQueueCleanupInterval = null;
    
    // Start queue cleanup
    this.startQueueCleanup();
    
    // Initialize usage tracker
    this.usageTracker = new UsageTracker();
    
    
    // Provider priority (primary to fallback)
    this.providerPriority = ['gemini', 'openai', 'fallback'];
    
    // Health monitoring
    this.healthStats = {
      gemini: { healthy: true, lastCheck: null, errorCount: 0, quotaExhausted: false, lastQuotaError: null },
      openai: { healthy: true, lastCheck: null, errorCount: 0, quotaExhausted: false, lastQuotaError: null }
    };
  }

  startQueueCleanup() {
    if (this.requestQueueCleanupInterval) return;
    
    this.requestQueueCleanupInterval = setInterval(() => {
      this.requestQueue.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  /**
   * Initialize AI service with API keys
   */
  async initialize(userApiKeys = null, userId = null) {
    try {
      let apiKeys = userApiKeys;
      
      // Server-side: fetch from database if userId provided
      if (!apiKeys && userId && typeof window === 'undefined') {
        apiKeys = await this.loadApiKeysFromDatabase(userId);
      }
      
      // Client-side: try localStorage as fallback
      if (!apiKeys && typeof window !== 'undefined') {
        apiKeys = await this.loadApiKeysFromLocalStorage();
      }
      
      // REMOVED: No longer fall back to environment variables - users must provide their own keys
      if (!apiKeys || (!apiKeys.gemini && !apiKeys.openai)) {
        logger.info('🔧 No API keys provided. AI service will run in limited mode - users must provide their own API keys.');
        return false;
      }

      // Validate API keys
      const validation = ApiKeyValidator.validateAll(apiKeys);
      if (!validation.valid) {
        logger.error('Invalid API keys:', validation.errors);
        return false;
      }

      // Initialize clients
      await this.initializeClients(apiKeys);
      
      // Initialize AI SDK service
      if (apiKeys) {
        try {
          this.aiSdkService = new AISdkService(apiKeys);
          logger.info('✅ AI SDK Service initialized');
        } catch (error) {
          logger.warn('⚠️ AI SDK Service initialization failed:', error);
        }
      }
      
      this.initialized = true;
      logger.info('🔧 AI Service initialized - health checks will be performed on-demand');
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize AI Service:', error);
      return false;
    }
  }

  async loadApiKeysFromDatabase(userId) {
    try {
      const { connectMongoose } = await import('../database/mongodb.js');
      const { User } = await import('../database/models/index.js');
      
      await connectMongoose();
      const user = await User.findById(userId);
      if (user) {
        const userApiKeys = user.getApiKeys();
        if (userApiKeys.openai || userApiKeys.gemini) {
          logger.info('📚 Loaded user API keys from database');
          return {
            openai: userApiKeys.openai,
            gemini: userApiKeys.gemini
          };
        }
      }
    } catch (error) {
      logger.warn('Failed to load user API keys from database:', error);
    }
    return null;
  }

  async loadApiKeysFromLocalStorage() {
    try {
      const savedKeys = localStorage.getItem('userApiKeys');
      if (savedKeys) {
        const parsedKeys = JSON.parse(savedKeys);
        
        // Decrypt API keys if they're encrypted
        const decryptedKeys = {};
        if (parsedKeys.openai) {
          decryptedKeys.openai = await ClientSideCrypto.decrypt(parsedKeys.openai);
        }
        if (parsedKeys.gemini) {
          decryptedKeys.gemini = await ClientSideCrypto.decrypt(parsedKeys.gemini);
        }
        
        logger.info('🔑 Loaded encrypted API keys from localStorage');
        return decryptedKeys;
      }
    } catch (error) {
      logger.warn('Failed to load API keys from localStorage:', error);
    }
    return null;
  }

  // REMOVED: loadApiKeysFromEnvironment() - Users must provide their own API keys

  async initializeClients(apiKeys) {
    this.currentApiKeys = apiKeys;

    // Initialize Gemini
    if (apiKeys.gemini) {
      try {
        this.geminiClient = new GoogleGenerativeAI(apiKeys.gemini);
        logger.info('✅ Gemini AI initialized (user key)');
      } catch (error) {
        logger.warn('Failed to initialize Gemini client:', error);
        this.healthStats.gemini.healthy = false;
      }
    }

    // Initialize OpenAI
    if (apiKeys.openai) {
      try {
        this.openaiClient = new OpenAI({
          apiKey: apiKeys.openai,
          timeout: 60000,
          maxRetries: 1
        });
        logger.info('✅ OpenAI initialized (user key)');
      } catch (error) {
        logger.warn('Failed to initialize OpenAI client:', error);
        this.healthStats.openai.healthy = false;
      }
    }
  }

  /**
   * Main AI call method with circuit breakers, retry, and fallback
   */
  async call(prompt, agent = null, complexity = 1, context = {}, userId = null) {
    // Auto-initialize with user keys if not initialized and userId is provided
    if (!this.initialized && userId) {
      logger.info(`🔧 Auto-initializing AI Service for user: ${userId}`);
      const initSuccess = await this.initialize(null, userId);
      if (!initSuccess) {
        throw new Error(`Failed to initialize AI Service with user ${userId} API keys. Please configure your API keys.`);
      }
    } else if (!this.initialized) {
      throw new Error('AI Service not initialized. Please provide API keys.');
    }

    // Check user limits
    if (userId) {
      const limitsCheck = this.usageTracker.checkUserLimits(userId);
      if (!limitsCheck.allowed) {
        throw new Error(`Usage limit exceeded: ${limitsCheck.reason}`);
      }
    }

    // Queue the request to prevent rate limiting
    return this.requestQueue.enqueue(userId || 'anonymous', async () => {
      return this.executeWithRetryAndFallback(prompt, agent, complexity, context, userId);
    });
  }

  async executeWithRetryAndFallback(prompt, agent, complexity, context, userId) {
    const errors = [];
    
    for (const provider of this.providerPriority) {
      if (provider === 'fallback') {
        return this.generateFallbackResponse(prompt, agent);
      }
      
      // Skip provider if client is not available
      if (provider === 'gemini' && !this.geminiClient) {
        logger.info(`⏭️ Skipping ${provider} - client not initialized`);
        continue;
      }
      if (provider === 'openai' && !this.openaiClient) {
        logger.info(`⏭️ Skipping ${provider} - client not initialized`);
        continue;
      }
      
      try {
        const circuitBreaker = provider === 'gemini' ? this.geminiCircuitBreaker : this.openaiCircuitBreaker;
        
        const result = await circuitBreaker.execute(async () => {
          return this.retryPolicy.execute(async () => {
            if (provider === 'gemini') {
              return await this.callGemini(prompt, agent, complexity, context, userId);
            } else if (provider === 'openai') {
              return await this.callOpenAI(prompt, agent, complexity, context, userId);
            }
            throw new Error(`${provider} client not available`);
          });
        });
        
        return result;
      } catch (error) {
        const errorCategory = ErrorHandler.categorizeError(error);
        errors.push({ provider, error: error.message, category: errorCategory.category });
        
        logger.warn(`${provider} failed:`, error.message);
        
        // Update health stats
        this.healthStats[provider].errorCount++;
        this.healthStats[provider].lastCheck = new Date();
        
        if (errorCategory.category === 'QUOTA_EXCEEDED') {
          this.healthStats[provider].quotaExhausted = true;
          this.healthStats[provider].lastQuotaError = new Date();
        }
        
        // Continue to next provider
        continue;
      }
    }
    
    throw new Error(`All AI providers failed: ${JSON.stringify(errors)}`);
  }

  async callGemini(prompt, agent, complexity, context, userId) {
    if (!this.geminiClient) throw new Error('Gemini client not initialized');
    
    try {
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      logger.info(`🔍 [GEMINI] Making API call to Gemini 2.5 Flash`);
      const result = await model.generateContent(prompt);
      
      const response = await result.response;
      const text = response.text();
      
      // Track usage with detailed logging
      if (userId) {
        const usage = response.usageMetadata;
        
        // Enhanced usage tracking with fallback calculations
        const promptTokens = usage?.promptTokenCount || 0;
        const candidatesTokens = usage?.candidatesTokenCount || 0;
        const totalTokens = usage?.totalTokenCount || (promptTokens + candidatesTokens) || Math.ceil(text.length / 4);
        
        const cost = this.estimateGeminiCost(totalTokens);
        
        // Create detailed usage object
        const usageDetails = {
          userId: userId,
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          totalTokens: totalTokens,
          promptTokens: promptTokens,
          candidatesTokens: candidatesTokens,
          estimatedCost: parseFloat(cost.toFixed(6)),
          timestamp: new Date().toISOString(),
          textLength: text.length,
          hasActualMetadata: !!usage,
          rawUsageMetadata: usage || null
        };
        
        // Track in usage tracker
        this.usageTracker.trackUsage(
          userId, 
          'gemini', 
          totalTokens, 
          cost,
          promptTokens,
          candidatesTokens
        );
        
        // Enhanced logging
        logger.info(`📊 Gemini Usage Details: ${JSON.stringify({
          totalTokens: usageDetails.totalTokens,
          promptTokens: usageDetails.promptTokens,
          candidatesTokens: usageDetails.candidatesTokens,
          estimatedCost: `$${usageDetails.estimatedCost}`,
          textLength: usageDetails.textLength,
          hasMetadata: usageDetails.hasActualMetadata
        })}`);
        
        // Store detailed usage for potential export/reporting
        this.storeDetailedUsage(usageDetails);
      }
      
      return {
        content: text,
        provider: 'gemini',
        usage: response.usageMetadata
      };
    } catch (error) {
      logger.error('Gemini API error:', error);
      throw error;
    }
  }

  async callOpenAI(prompt, agent, complexity, context, userId) {
    if (!this.openaiClient) throw new Error('OpenAI client not initialized');
    
    try {
      const completion = await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: Math.min(4000, 1000 * complexity),
        temperature: 0.7
      });
      
      const text = completion.choices[0]?.message?.content || '';
      
      // Track usage
      if (userId) {
        const usage = completion.usage;
        const tokens = usage?.total_tokens || 0;
        const cost = this.estimateOpenAICost(usage?.prompt_tokens || 0, usage?.completion_tokens || 0);
        
        this.usageTracker.trackUsage(
          userId, 
          'openai', 
          tokens, 
          cost,
          usage?.prompt_tokens,
          usage?.completion_tokens
        );
        
        logger.info('📊 OpenAI usage:', {
          totalTokens: usage?.total_tokens,
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
          estimatedCost: `$${cost.toFixed(4)}`
        });
      }
      
      return {
        content: text,
        provider: 'openai',
        usage: completion.usage
      };
    } catch (error) {
      logger.error('OpenAI API error:', error);
      throw error;
    }
  }

  generateFallbackResponse(prompt, agent) {
    const fallbackResponses = [
      "I understand you'd like me to help with that task. While I'm currently experiencing technical difficulties with my AI providers, I can provide some general guidance.",
      "I'm having trouble connecting to my AI services right now, but I can offer some basic assistance with your request.",
      "Due to technical issues, I can't provide my full AI-powered response, but let me give you some general guidance."
    ];
    
    const response = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    return {
      content: response,
      provider: 'fallback',
      usage: null
    };
  }

  estimateGeminiCost(tokens) {
    // Gemini 1.5 Flash pricing (approximate)
    const costPerToken = 0.000001; // $0.000001 per token
    return tokens * costPerToken;
  }

  /**
   * Store detailed usage information for analytics and reporting
   * @param {Object} usageDetails - Detailed usage information
   */
  storeDetailedUsage(usageDetails) {
    try {
      // Initialize usage storage if not exists
      if (!this.detailedUsageStore) {
        this.detailedUsageStore = [];
      }
      
      // Store usage details
      this.detailedUsageStore.push(usageDetails);
      
      // Keep only last 1000 entries to prevent memory bloat
      if (this.detailedUsageStore.length > 1000) {
        this.detailedUsageStore = this.detailedUsageStore.slice(-1000);
      }
      
      // Persist to database for permanent storage (async, non-blocking)
      this.persistUsageIfConfigured(usageDetails).catch(error => {
        logger.warn('Background persistence failed:', error.message);
      });
      
    } catch (error) {
      logger.warn('Failed to store detailed usage:', error.message);
    }
  }

  /**
   * Persist usage to database for permanent storage
   * @param {Object} usageDetails - Usage details to persist
   */
  async persistUsageIfConfigured(usageDetails) {
    try {
      // Always persist to database (removed environment flag requirement)
      const { default: UsageLog } = await import('../database/models/UsageLog.js');
      
      const logEntry = {
        userId: usageDetails.userId,
        provider: usageDetails.provider,
        model: usageDetails.model || 'gemini-2.5-flash',
        totalTokens: usageDetails.totalTokens,
        promptTokens: usageDetails.promptTokens,
        candidatesTokens: usageDetails.candidatesTokens,
        estimatedCost: usageDetails.estimatedCost,
        textLength: usageDetails.textLength,
        hasActualMetadata: usageDetails.hasActualMetadata,
        rawUsageMetadata: usageDetails.rawUsageMetadata,
        timestamp: new Date(usageDetails.timestamp),
        workflowId: usageDetails.workflowId || null,
        agentId: usageDetails.agentId || null,
        requestType: usageDetails.requestType || 'direct'
      };
      
      await UsageLog.logUsage(logEntry);
      
      logger.debug('💾 Usage persisted to database:', {
        userId: usageDetails.userId,
        provider: usageDetails.provider,
        totalTokens: usageDetails.totalTokens,
        cost: usageDetails.estimatedCost
      });
      
    } catch (error) {
      logger.warn('Failed to persist usage to database:', error.message);
      // Don't throw - usage tracking shouldn't break the main flow
    }
  }

  /**
   * Get detailed usage statistics from database
   * @param {string} userId - Optional user ID filter
   * @param {string} timeframe - Optional timeframe filter (hour, day, week)
   * @returns {Object} Usage statistics
   */
  async getDetailedUsageStats(userId = null, timeframe = null) {
    try {
      // Try to get stats from database first
      const { default: UsageLog } = await import('../database/models/UsageLog.js');
      
      if (userId) {
        // Get user-specific stats from database
        const dbStats = await UsageLog.getUserUsageStats(userId, timeframe);
        return dbStats;
      }
      
      // For backward compatibility, fall back to in-memory if no userId specified
      logger.warn('No userId provided for usage stats, using in-memory fallback');
      return this.getInMemoryUsageStats(timeframe);
      
    } catch (error) {
      logger.warn('Failed to get usage stats from database, using in-memory fallback:', error.message);
      return this.getInMemoryUsageStats(timeframe);
    }
  }

  /**
   * Get usage statistics from in-memory store (fallback method)
   * @param {string} timeframe - Optional timeframe filter
   * @returns {Object} Usage statistics
   */
  getInMemoryUsageStats(timeframe = null) {
    if (!this.detailedUsageStore || this.detailedUsageStore.length === 0) {
      return { totalEntries: 0, totalTokens: 0, totalCost: 0, providers: {} };
    }

    let filteredUsage = this.detailedUsageStore;

    // Filter by timeframe if specified
    if (timeframe) {
      const now = new Date();
      let cutoffTime;
      
      switch (timeframe) {
        case 'hour':
          cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'day':
          cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffTime = null;
      }
      
      if (cutoffTime) {
        filteredUsage = filteredUsage.filter(entry => 
          new Date(entry.timestamp) >= cutoffTime
        );
      }
    }

    // Calculate statistics
    const stats = {
      totalEntries: filteredUsage.length,
      totalTokens: filteredUsage.reduce((sum, entry) => sum + entry.totalTokens, 0),
      totalCost: filteredUsage.reduce((sum, entry) => sum + entry.estimatedCost, 0),
      providers: {},
      averageTokensPerRequest: 0,
      averageCostPerRequest: 0,
      timeRange: {
        earliest: filteredUsage.length > 0 ? Math.min(...filteredUsage.map(e => new Date(e.timestamp).getTime())) : null,
        latest: filteredUsage.length > 0 ? Math.max(...filteredUsage.map(e => new Date(e.timestamp).getTime())) : null
      }
    };

    // Calculate averages
    if (stats.totalEntries > 0) {
      stats.averageTokensPerRequest = stats.totalTokens / stats.totalEntries;
      stats.averageCostPerRequest = stats.totalCost / stats.totalEntries;
    }

    // Group by provider
    filteredUsage.forEach(entry => {
      if (!stats.providers[entry.provider]) {
        stats.providers[entry.provider] = {
          requests: 0,
          totalTokens: 0,
          totalCost: 0
        };
      }
      
      stats.providers[entry.provider].requests++;
      stats.providers[entry.provider].totalTokens += entry.totalTokens;
      stats.providers[entry.provider].totalCost += entry.estimatedCost;
    });

    return stats;
  }

  estimateOpenAICost(promptTokens, completionTokens) {
    // GPT-4o-mini pricing
    const promptCost = promptTokens * 0.00000015; // $0.00015 per 1K tokens
    const completionCost = completionTokens * 0.0000006; // $0.0006 per 1K tokens
    return promptCost + completionCost;
  }

  // Health check methods
  async checkHealth() {
    const results = {};
    
    if (this.geminiClient) {
      results.gemini = await this.checkGeminiHealth();
    }
    
    if (this.openaiClient) {
      results.openai = await this.checkOpenAIHealth();
    }
    
    return results;
  }

  async checkGeminiHealth() {
    try {
      logger.info('🔍 Checking Gemini health...');
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent('Hello');
      const response = await result.response;
      
      this.healthStats.gemini.healthy = true;
      this.healthStats.gemini.lastCheck = new Date();
      this.healthStats.gemini.errorCount = 0;
      
      logger.info(`✅ Gemini health check passed: ${JSON.stringify({
        model: 'gemini-2.5-flash',
        responseLength: response.text().length
      })}`);
      
      return { healthy: true, provider: 'gemini', model: 'gemini-2.5-flash' };
    } catch (error) {
      this.healthStats.gemini.healthy = false;
      this.healthStats.gemini.lastCheck = new Date();
      this.healthStats.gemini.errorCount++;
      
      logger.error('❌ Gemini health check failed:', error);
      return { healthy: false, provider: 'gemini', error: error.message };
    }
  }

  async checkOpenAIHealth() {
    try {
      logger.info('🔍 Checking OpenAI health...');
      const completion = await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      });
      
      this.healthStats.openai.healthy = true;
      this.healthStats.openai.lastCheck = new Date();
      this.healthStats.openai.errorCount = 0;
      
      logger.info('✅ OpenAI health check passed:', {
        model: 'gpt-3.5-turbo',
        responseLength: completion.choices[0]?.message?.content?.length || 0
      });
      
      return { healthy: true, provider: 'openai', model: 'gpt-4o-mini' };
    } catch (error) {
      this.healthStats.openai.healthy = false;
      this.healthStats.openai.lastCheck = new Date();
      this.healthStats.openai.errorCount++;
      
      logger.error('❌ OpenAI health check failed:', error);
      return { healthy: false, provider: 'openai', error: error.message };
    }
  }

  // Utility methods
  getUsageStats(userId) {
    return this.usageTracker.getUserStats(userId);
  }

  getGlobalUsageStats() {
    return this.usageTracker.getGlobalStats();
  }

  getHealthStats() {
    return this.healthStats;
  }

  clearQueue(userId) {
    this.requestQueue.clearQueue(userId);
  }

  // API compatibility methods for health endpoints
  async healthCheck() {
    const results = await this.checkHealth();
    const healthyProviders = Object.entries(results)
      .filter(([provider, stats]) => stats.healthy)
      .map(([provider]) => provider);
    
    const circuitBreakers = {
      gemini: {
        state: this.geminiCircuitBreaker.state,
        failureCount: this.geminiCircuitBreaker.failureCount,
        successCount: this.geminiCircuitBreaker.successCount,
        nextAttempt: this.geminiCircuitBreaker.nextAttempt
      },
      openai: {
        state: this.openaiCircuitBreaker.state,
        failureCount: this.openaiCircuitBreaker.failureCount,
        successCount: this.openaiCircuitBreaker.successCount,
        nextAttempt: this.openaiCircuitBreaker.nextAttempt
      }
    };

    // Check if user API keys are needed
    const needsUserApiKeys = healthyProviders.length === 0 && 
      (Object.values(results).some(r => r.error?.includes('API key') || r.error?.includes('quota')));

    return {
      status: healthyProviders.length > 0 ? 'healthy' : (needsUserApiKeys ? 'needs_api_keys' : 'unhealthy'),
      providers: results,
      healthyProviders,
      circuitBreakers,
      providerPriority: this.providerPriority,
      needsUserApiKeys,
      timestamp: new Date().toISOString()
    };
  }

  getSystemStatus() {
    return {
      initialized: this.initialized,
      providers: {
        gemini: {
          available: !!this.geminiClient,
          healthy: this.healthStats.gemini.healthy,
          lastCheck: this.healthStats.gemini.lastCheck,
          errorCount: this.healthStats.gemini.errorCount
        },
        openai: {
          available: !!this.openaiClient,
          healthy: this.healthStats.openai.healthy,
          lastCheck: this.healthStats.openai.lastCheck,
          errorCount: this.healthStats.openai.errorCount
        }
      },
      queue: {
        pending: this.requestQueue.queues ? Array.from(this.requestQueue.queues.values()).reduce((total, queue) => total + queue.length, 0) : 0
      },
      usage: this.usageTracker.getGlobalStats()
    };
  }

  // Circuit breaker methods for API compatibility
  resetCircuitBreakers() {
    this.geminiCircuitBreaker.reset();
    this.openaiCircuitBreaker.reset();
  }

  setProviderPriority(priority) {
    if (Array.isArray(priority)) {
      this.providerPriority = priority;
    }
  }

  // Health check methods (for backward compatibility and admin endpoints)
  async performHealthChecks() {
    return await this.checkHealth();
  }

  // Singleton pattern
  static getInstance() {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Update API keys without full reinitialization (alias for reinitializeWithUserKeys)
   * Used by chat routes that need to update keys dynamically
   */
  async updateApiKeys(apiKeys, userId = null) {
    return await this.reinitializeWithUserKeys(apiKeys, userId);
  }

  /**
   * Reinitialize AI service with user-provided API keys
   * Used by the reinitialize route
   */
  async reinitializeWithUserKeys(apiKeys, userId = null) {
    try {
      logger.info('🔄 Reinitializing AI service with user keys');
      
      // Clear existing clients
      this.geminiClient = null;
      this.openaiClient = null;
      this.aiSdkService = null; // Clear AI SDK service
      this.initialized = false;
      
      // Reset health stats
      this.healthStats = {
        gemini: { healthy: true, lastCheck: null, errorCount: 0, quotaExhausted: false, lastQuotaError: null },
        openai: { healthy: true, lastCheck: null, errorCount: 0, quotaExhausted: false, lastQuotaError: null }
      };
      
      // Reset circuit breakers
      this.resetCircuitBreakers();
      
      // Initialize with new keys
      const success = await this.initialize(apiKeys, userId);
      
      if (success) {
        logger.info('✅ AI service successfully reinitialized');
      } else {
        logger.warn('⚠️ AI service reinitialization partially failed');
      }
      
      return success;
    } catch (error) {
      logger.error('❌ Failed to reinitialize AI service:', error);
      return false;
    }
  }

  /**
   * Generate agent response with proper formatting
   * Used by routes that need structured agent responses
   */
  async generateAgentResponse(agentDefinition, userMessage, conversationHistory = [], userId = null) {
    try {
      if (!this.initialized) {
        await this.initialize(null, userId);
      }
      
      // Build context-aware prompt
      const agent = agentDefinition?.agent || {};
      const persona = agentDefinition?.persona || {};
      
      let prompt = '';
      
      // Add agent identity
      if (persona.identity) {
        prompt += `Identity: ${persona.identity}\n\n`;
      }
      
      // Add role and focus
      if (persona.role) {
        prompt += `Role: ${persona.role}\n`;
      }
      if (persona.focus) {
        prompt += `Focus: ${persona.focus}\n`;
      }
      
      // Add core principles
      if (persona.core_principles && Array.isArray(persona.core_principles)) {
        prompt += `\nCore Principles:\n${persona.core_principles.map(p => `- ${p}`).join('\n')}\n\n`;
      }
      
      // Add conversation history if provided
      if (conversationHistory && conversationHistory.length > 0) {
        prompt += 'Previous conversation:\n';
        conversationHistory.slice(-3).forEach(msg => {
          prompt += `${msg.role}: ${msg.content}\n`;
        });
        prompt += '\n';
      }
      
      // Add the user message
      prompt += `User: ${userMessage}\n\nRespond as ${agent.name || 'the assistant'} with your expertise and personality:`;
      
      // Call AI service
      const response = await this.call(prompt, agent, 1, {}, userId);
      
      // Format the response using ResponseFormatter
      const formattedResponse = ResponseFormatter.formatAgentResponse(
        agentDefinition,
        response.content,
        {
          provider: response.provider,
          usage: response.usage,
          confidence: 0.8
        }
      );
      
      return {
        content: formattedResponse.response.content.main || response.content,
        agentId: formattedResponse.agentId,
        agentName: formattedResponse.agentName,
        provider: response.provider,
        structured: formattedResponse.response.type === 'structured' ? formattedResponse.response.content : null,
        usage: response.usage
      };
      
    } catch (error) {
      logger.error('Error generating agent response:', error);
      
      // Return a fallback response
      const agent = agentDefinition?.agent || {};
      return {
        content: `Hello! I'm ${agent.name || 'an AI assistant'}. I received your message but encountered a technical issue. Please try again.`,
        agentId: agent.id || 'fallback',
        agentName: agent.name || 'Assistant',
        provider: 'fallback',
        error: error.message
      };
    }
  }

  /**
   * Stream response using AI SDK (new method)
   */
  async streamResponse(prompt, agent = null, complexity = 1, context = {}, userId = null, options = {}) {
    // Auto-initialize with user keys if not initialized and userId is provided
    if (!this.initialized && userId) {
      logger.info(`🔧 Auto-initializing AI Service for streaming: ${userId}`);
      const initSuccess = await this.initialize(null, userId);
      if (!initSuccess) {
        throw new Error(`Failed to initialize AI Service with user ${userId} API keys for streaming.`);
      }
    } else if (!this.initialized) {
      throw new Error('AI Service not initialized for streaming.');
    }

    // Check if AI SDK service is available
    if (!this.aiSdkService) {
      logger.warn('AI SDK service not available, falling back to regular call');
      return await this.call(prompt, agent, complexity, context, userId);
    }

    try {
      // Use AI SDK for streaming
      const streamResult = await this.aiSdkService.streamText(prompt, {
        provider: options.provider || 'auto',
        maxTokens: Math.min(4000, 1000 * complexity),
        temperature: options.temperature || 0.7
      });

      logger.info('🌊 Streaming response started via AI SDK:', {
        provider: streamResult.provider,
        agent: agent?.name || 'unknown'
      });

      return streamResult;
    } catch (error) {
      logger.warn('AI SDK streaming failed, falling back to regular call:', error.message);
      // Fallback to regular call
      return await this.call(prompt, agent, complexity, context, userId);
    }
  }

  /**
   * Generate structured output using AI SDK (new method)
   */
  async generateStructuredOutput(prompt, schema, agent = null, context = {}, userId = null, options = {}) {
    // Auto-initialize with user keys if not initialized
    if (!this.initialized && userId) {
      const initSuccess = await this.initialize(null, userId);
      if (!initSuccess) {
        throw new Error(`Failed to initialize AI Service for structured output.`);
      }
    } else if (!this.initialized) {
      throw new Error('AI Service not initialized for structured output.');
    }

    // Check if AI SDK service is available
    if (!this.aiSdkService || !this.aiSdkService.supportsStructuredOutput()) {
      throw new Error('Structured output not available - AI SDK service not initialized');
    }

    try {
      const result = await this.aiSdkService.generateObject(prompt, schema, {
        provider: options.provider || 'auto',
        maxTokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.3
      });

      // Track usage if userId provided
      if (userId && result.usage) {
        this.usageTracker.trackUsage(
          userId,
          result.provider,
          result.usage.totalTokens || 0,
          this.estimateCost(result.provider, result.usage)
        );
      }

      logger.info('🏗️ Structured output generated via AI SDK:', {
        provider: result.provider,
        agent: agent?.name || 'unknown'
      });

      return result;
    } catch (error) {
      logger.error('AI SDK structured output failed:', error);
      throw error;
    }
  }

  /**
   * Estimate cost for different providers
   */
  estimateCost(provider, usage) {
    if (provider === 'openai') {
      return this.estimateOpenAICost(usage.promptTokens || 0, usage.completionTokens || 0);
    } else if (provider === 'google') {
      return this.estimateGeminiCost(usage.totalTokens || 0);
    }
    return 0;
  }

  /**
   * Check if streaming is supported
   */
  supportsStreaming() {
    return this.aiSdkService && this.aiSdkService.supportsStreaming();
  }

  /**
   * Check if structured output is supported
   */
  supportsStructuredOutput() {
    return this.aiSdkService && this.aiSdkService.supportsStructuredOutput();
  }

  // Cleanup method
  destroy() {
    if (this.requestQueueCleanupInterval) {
      clearInterval(this.requestQueueCleanupInterval);
    }
    if (this.usageTracker) {
      this.usageTracker.destroy();
    }
    this.aiSdkService = null; // Clean up AI SDK service
  }
}

// Export individual classes for testing and direct use
export { 
  RequestQueue, 
  ErrorHandler, 
  ClientSideCrypto, 
  ApiKeyValidator, 
  UsageTracker, 
  CircuitBreaker, 
  RetryPolicy 
};

// Export singleton instance
export const aiService = new AIService();
export default aiService;