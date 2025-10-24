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
import { LangChainService } from './LangChainService.js';
import { tools, toolExecutor } from '@/lib/ai/tools/index.js';
import { langchainTools } from '@/lib/ai/tools/langchain.js';

export class AIService {
  constructor() {
    this.geminiClient = null;
    this.openaiClient = null;
    this.aiSdkService = null; // Vercel AI SDK service (legacy)
    this.langchainService = null; // LangChain service (new)
    this.useLangChain = true; // Feature flag: true = LangChain, false = Vercel AI SDK
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
    
    
    // Provider priority - only real AI providers, no fallback
    this.providerPriority = ['gemini', 'openai'];
    
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
      
      // Initialize AI SDK Service (legacy)
      this.aiSdkService = new AISdkService(apiKeys);
      logger.info('✅ AI SDK Service initialized');

      // Initialize LangChain Service (new)
      this.langchainService = new LangChainService(apiKeys);
      logger.info('✅ LangChain Service initialized');

      this.initialized = true;
      logger.info(`🔧 AI Service initialized using ${this.useLangChain ? 'LangChain' : 'Vercel AI SDK'} - health checks will be performed on-demand`);

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
  async call(prompt, agent = null, complexity = 1, context = {}, userId = null, useTools = false) {
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

    if (useTools) {
      return this.callWithTools(prompt, agent, complexity, context, userId);
    }

    // Check user limits (now async)
    if (userId) {
      const limitsCheck = await this.usageTracker.checkUserLimits(userId);
      if (!limitsCheck.allowed) {
        throw new Error(`Usage limit exceeded: ${limitsCheck.reason}`);
      }
    }

    // Queue the request to prevent rate limiting
    return this.requestQueue.enqueue(userId || 'anonymous', async () => {
      return this.executeWithRetryAndFallback(prompt, agent, complexity, context, userId);
    });
  }

  /**
   * Build agent persona prompt
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

  async callWithTools(prompt, agent, complexity, context, userId) {
    // Validate user permissions and rate limits (now async)
    if (userId) {
      const limitsCheck = await this.usageTracker.checkUserLimits(userId);
      if (!limitsCheck.allowed) {
        throw new Error(`Rate limit exceeded: ${limitsCheck.reason}`);
      }
    }

    // Check which service to use
    const service = this.useLangChain ? this.langchainService : this.aiSdkService;
    if (!service) {
      throw new Error(`${this.useLangChain ? 'LangChain' : 'AI SDK'} Service not available for tool calling.`);
    }

    // Build agent context if provided
    let systemPrompt = '';
    if (agent && agent.persona) {
      systemPrompt = this.buildAgentPrompt(agent.persona, agent.name);
    }

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    // Track the conversation for tool calling
    logger.info(`🛠️ Starting tool-enabled AI call using ${this.useLangChain ? 'LangChain' : 'Vercel AI SDK'} for user: ${userId || 'anonymous'}`);

    try {
      // Set user context for tool execution
      if (userId) {
        const { setUserContext, setRepositoryContext } = await import('@/lib/ai/tools/toolExecutor.js');
        setUserContext(userId);

        // Set repository context if provided
        if (context && context.repository) {
          setRepositoryContext({
            owner: context.repository.owner,
            name: context.repository.name
          });
          logger.info(`🗂️ Set repository context: ${context.repository.owner}/${context.repository.name}`);
        }
      }

      // Ensure service has current API keys
      if (this.currentApiKeys && (this.currentApiKeys.gemini || this.currentApiKeys.openai)) {
        logger.info(`🔑 Updating ${this.useLangChain ? 'LangChain' : 'AISdk'}Service with keys: gemini=${!!this.currentApiKeys.gemini}, openai=${!!this.currentApiKeys.openai}`);
        service.updateApiKeys(this.currentApiKeys);
      }

      // Use appropriate service with tools
      const selectedTools = this.useLangChain ? langchainTools : tools;
      const result = await service.generateWithTools(messages, selectedTools, {
        maxTokens: this.calculateMaxTokens(complexity),
        temperature: 0.7,
        maxIterations: 5,
        userId: userId // Pass userId for security validation
      });

      // Track usage if userId provided (now async)
      if (userId) {
        await this.usageTracker.trackUsage(userId, 'tools', result.usage?.totalTokens || 0, 0,
          result.usage?.inputTokens || 0, result.usage?.outputTokens || 0);
      }

      return result;

    } catch (error) {
      logger.error('❌ Tool-enabled AI call failed:', error);
      throw new Error(`Tool-enabled AI call failed: ${error.message}`);
    } finally {
      // Clear user context after execution
      if (userId) {
        const { clearUserContext } = await import('./tools/toolExecutor.js');
        clearUserContext();
      }
    }
  }

  /**
   * Calculate max tokens based on complexity
   */
  calculateMaxTokens(complexity) {
    const complexityValue = typeof complexity === 'string' ? 
      (complexity === 'simple' ? 1 : complexity === 'complex' ? 4 : 2) : 
      complexity;
    return Math.min(8000, 2000 * complexityValue);
  }

  async executeWithRetryAndFallback(prompt, agent, complexity, context, userId) {
    // Use LangChain exclusively (no fallback to native clients)
    if (this.useLangChain && this.langchainService && this.langchainService.initialized) {
      logger.info(`🔮 Using LangChain for text generation (complexity: ${complexity})`);

      const result = await this.langchainService.generateText(prompt, {
        provider: 'auto',
        maxTokens: this.calculateMaxTokens(complexity),
        temperature: 0.7
      });

      // Track usage
      if (userId) {
        await this.usageTracker.trackUsage(
          userId,
          result.provider,
          result.usage?.totalTokens || 0,
          0,
          result.usage?.promptTokens || 0,
          result.usage?.completionTokens || 0
        );
      }

      return result;
    }

    // If LangChain is disabled or not initialized, use native clients as fallback
    const errors = [];
    for (const provider of this.providerPriority) {

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
      // Use context.maxTokens if provided, otherwise calculate from complexity
      let maxTokens;
      if (context?.maxTokens) {
        maxTokens = Math.min(8000, context.maxTokens); // Respect caller's maxTokens
      } else {
        // Convert complexity to max_output_tokens like OpenAI does
        const complexityValue = typeof complexity === 'string' ?
          (complexity === 'simple' ? 1 : complexity === 'complex' ? 4 : 2) :
          complexity;
        maxTokens = Math.min(8000, 2000 * complexityValue); // Increased base tokens to prevent truncation
      }

      const model = this.geminiClient.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.7
        }
      });
      
      logger.info(`🔍 [GEMINI] Making API call to Gemini 2.5 Flash (agent: ${agent?.name || agent?.id || 'unknown'}, complexity: ${complexity}, maxTokens: ${maxTokens})`);
      const result = await model.generateContent(prompt);
      
      const response = await result.response;
      
      // Debug: Log complete response structure
      logger.info(`🔍 [GEMINI DEBUG] Full response structure: ${JSON.stringify({
        candidates: response.candidates?.length || 0,
        promptFeedback: response.promptFeedback || 'none',
        usageMetadata: response.usageMetadata || 'none'
      })}`);
      
      // Check for safety blocking or other issues
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        
        logger.info(`🔍 [GEMINI DEBUG] First candidate details: ${JSON.stringify({
          finishReason: candidate.finishReason,
          safetyRatings: candidate.safetyRatings,
          content: candidate.content ? 'present' : 'missing',
          parts: candidate.content?.parts?.length || 0
        })}`);
        
        if (candidate.finishReason === 'SAFETY') {
          logger.warn('🛡️ Gemini response blocked by safety filters:', {
            safetyRatings: candidate.safetyRatings,
            finishReason: candidate.finishReason
          });
          throw new Error('Content was blocked by safety filters. Please try rephrasing your request.');
        }
        
        if (candidate.finishReason === 'RECITATION') {
          logger.warn('📝 Gemini response blocked due to recitation concerns');
          throw new Error('Content was blocked due to recitation concerns. Please try a different approach.');
        }
        
        if (candidate.finishReason === 'MAX_TOKENS') {
          logger.warn('📏 Gemini response truncated due to max tokens limit');
          // Don't throw error, just warn - partial response might still be useful
        }
        
        if (candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
          logger.warn('⚠️ Unexpected finish reason from Gemini:', {
            finishReason: candidate.finishReason,
            safetyRatings: candidate.safetyRatings
          });
        }
      } else {
        logger.error('❌ No candidates in Gemini response:', {
          promptFeedback: response.promptFeedback,
          candidates: response.candidates
        });
        throw new Error('Gemini returned no response candidates');
      }
      
      let text;
      try {
        text = response.text();
        logger.info(`🔍 [GEMINI DEBUG] Text extraction successful: ${JSON.stringify({
          textLength: text?.length || 0,
          textPreview: text?.substring(0, 100) || 'empty'
        })}`);
      } catch (textError) {
        logger.error('❌ Failed to extract text from Gemini response:', textError);
        logger.error('Response details:', {
          candidates: response.candidates?.length || 0,
          finishReason: response.candidates?.[0]?.finishReason || 'unknown',
          safetyRatings: response.candidates?.[0]?.safetyRatings || 'none',
          candidateContent: response.candidates?.[0]?.content || 'missing'
        });
        throw new Error(`Failed to extract response text: ${textError.message}`);
      }
      
      if (!text || text.trim() === '') {
        logger.warn('⚠️ Gemini returned empty response text');
        logger.warn('Debug empty response:', {
          textType: typeof text,
          textLength: text?.length || 0,
          candidatesLength: response.candidates?.length || 0,
          firstCandidateContent: response.candidates?.[0]?.content || 'missing',
          finishReason: response.candidates?.[0]?.finishReason || 'unknown'
        });
        throw new Error('AI service returned empty response. Please try again.');
      }
      
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
        await this.usageTracker.trackUsage(
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
          estimatedCost: `${usageDetails.estimatedCost}`,
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
        
        await this.usageTracker.trackUsage(
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
          estimatedCost: `${cost.toFixed(4)}`
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

  // Utility methods (now async to support Redis)
  async getUsageStats(userId) {
    return await this.usageTracker.getUserStats(userId);
  }

  async getGlobalUsageStats() {
    return await this.usageTracker.getGlobalStats();
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
      
      // No fallback responses - re-throw error to ensure proper error handling
      throw error;
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

    // REMOVED: AI SDK streaming is broken for multi-user apps
    // Fall back to regular call method instead
    logger.info('🔄 Using regular AI call instead of broken streaming');
    return await this.call(prompt, agent, complexity, context, userId);
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
        await this.usageTracker.trackUsage(
          userId,
          result.provider,
          result.usage.totalTokens || 0,
          this.estimateCost(result.provider, result.usage),
          result.usage.promptTokens || 0,
          result.usage.completionTokens || 0
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
