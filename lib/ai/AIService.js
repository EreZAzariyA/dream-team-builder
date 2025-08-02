/**
 * AI Service Integration - Production Ready
 * Handles communication with multiple AI providers with circuit breakers,
 * intelligent retry policies, and automatic failover
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { ResponseFormatter, STRUCTURED_RESPONSE_TEMPLATE } from '../bmad/ResponseFormatter.js';

/**
 * Circuit Breaker class for handling API failures
 */
class CircuitBreaker {
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
}

/**
 * Retry utility with exponential backoff
 */
class RetryPolicy {
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
        console.log(`🔄 Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms. Error: ${error.message}`);
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

/**
 * Usage tracking for cost control
 */
class UsageTracker {
  constructor() {
    this.userUsage = new Map();
    this.globalUsage = {
      requests: 0,
      tokens: 0,
      cost: 0
    };
  }

  trackUsage(userId, provider, tokens, estimatedCost) {
    if (!this.userUsage.has(userId)) {
      this.userUsage.set(userId, {
        requests: 0,
        tokens: 0,
        cost: 0,
        providers: {}
      });
    }

    const userStats = this.userUsage.get(userId);
    userStats.requests++;
    userStats.tokens += tokens;
    userStats.cost += estimatedCost;
    
    if (!userStats.providers[provider]) {
      userStats.providers[provider] = { requests: 0, tokens: 0, cost: 0 };
    }
    userStats.providers[provider].requests++;
    userStats.providers[provider].tokens += tokens;
    userStats.providers[provider].cost += estimatedCost;

    // Update global usage
    this.globalUsage.requests++;
    this.globalUsage.tokens += tokens;
    this.globalUsage.cost += estimatedCost;
  }

  checkUserLimits(userId, limits = {}) {
    const userStats = this.userUsage.get(userId);
    if (!userStats) return { allowed: true };

    const dailyRequestLimit = limits.dailyRequests || 1000;
    const dailyCostLimit = limits.dailyCost || 10; // $10
    
    if (userStats.requests >= dailyRequestLimit) {
      return {
        allowed: false,
        reason: 'Daily request limit exceeded',
        current: userStats.requests,
        limit: dailyRequestLimit
      };
    }

    if (userStats.cost >= dailyCostLimit) {
      return {
        allowed: false,
        reason: 'Daily cost limit exceeded',
        current: userStats.cost.toFixed(2),
        limit: dailyCostLimit
      };
    }

    return { allowed: true };
  }

  getUserStats(userId) {
    return this.userUsage.get(userId) || null;
  }

  getGlobalStats() {
    return this.globalUsage;
  }
}

export class AIService {
  constructor() {
    this.geminiClient = null;
    this.openaiClient = null;
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
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    });
    
    // Initialize usage tracker
    this.usageTracker = new UsageTracker();
    
    // Provider priority (primary to fallback)
    this.providerPriority = ['gemini', 'openai', 'fallback'];
    
    // Health monitoring
    this.healthStats = {
      gemini: { healthy: true, lastCheck: null, errorCount: 0 },
      openai: { healthy: true, lastCheck: null, errorCount: 0 }
    };
  }

  /**
   * Initialize AI service with API keys from environment
   */
  async initialize() {
    try {
      // Initialize Gemini
      if (process.env.GEMINI_API_KEY) {
        this.geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ Gemini AI initialized');
      } else {
        console.warn('⚠️ GEMINI_API_KEY not found in environment');
      }

      // Initialize OpenAI
      if (process.env.OPENAI_API_KEY) {
        this.openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('✅ OpenAI initialized');
      } else {
        console.warn('⚠️ OPENAI_API_KEY not found in environment');
      }

      // Ensure at least one provider is available
      if (!this.geminiClient && !this.openaiClient) {
        throw new Error('No AI providers available. Please configure GEMINI_API_KEY or OPENAI_API_KEY');
      }

      this.initialized = true;
      
      // Perform initial health checks
      await this.performHealthChecks();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize AI service:', error);
      return false;
    }
  }

  /**
   * Generate response using agent persona and rules with intelligent failover
   */
  async generateAgentResponse(agentDefinition, userMessage, conversationHistory = [], userId = 'anonymous') {
    console.log('Provider Priority:', this.providerPriority);
    console.log('OpenAI Client Initialized:', !!this.openaiClient);
    if (!this.initialized) {
      await this.initialize();
    }

    // Check user usage limits
    const usageCheck = this.usageTracker.checkUserLimits(userId);
    if (!usageCheck.allowed) {
      throw new Error(`Usage limit exceeded: ${usageCheck.reason}. Current: ${usageCheck.current}, Limit: ${usageCheck.limit}`);
    }

    // Try providers in priority order
    for (const provider of this.providerPriority) {
      console.log(`Attempting to generate response with provider: ${provider}`);
      if (provider === 'fallback') {
        console.log('🔄 All AI providers failed, using fallback response');
        return this.generateFallbackResponse(agentDefinition, userMessage);
      }

      try {
        const result = await this.generateWithProvider(provider, agentDefinition, userMessage, conversationHistory, userId);
        
        // Track successful usage
        const tokens = this.estimateTokens(userMessage + (result.content || ''));
        const cost = this.estimateCost(provider, tokens);
        this.usageTracker.trackUsage(userId, provider, tokens, cost);
        
        return result;
      } catch (error) {
        console.error(`❌ Provider ${provider} failed:`, error.message);
        this.healthStats[provider].errorCount++;
        this.healthStats[provider].healthy = false;
        
        // Continue to next provider
        continue;
      }
    }

    // If we get here, all providers failed
    throw new Error('All AI providers are currently unavailable');
  }

  /**
   * Generate response with specific provider using circuit breaker and retry logic
   */
  async generateWithProvider(provider, agentDefinition, userMessage, conversationHistory, userId) { // eslint-disable-line no-unused-vars
    if (provider === 'gemini' && this.geminiClient) {
      return await this.geminiCircuitBreaker.execute(
        () => this.retryPolicy.execute(
          () => this.generateWithGemini(agentDefinition, userMessage, conversationHistory)
        ),
        () => this.generateWithOpenAI(agentDefinition, userMessage, conversationHistory)
      );
    }
    
    if (provider === 'openai' && this.openaiClient) {
      return await this.openaiCircuitBreaker.execute(
        () => this.retryPolicy.execute(
          () => this.generateWithOpenAI(agentDefinition, userMessage, conversationHistory)
        )
      );
    }
    
    throw new Error(`Provider ${provider} not available`);
  }

  /**
   * Generate response using Gemini
   */
  async generateWithGemini(agentDefinition, userMessage, conversationHistory) {
    try {
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Build the system prompt with agent persona and rules
      const systemPrompt = this.buildAgentPrompt(agentDefinition);
      
      // Build conversation context
      const conversationContext = this.buildConversationContext(conversationHistory);
      
      // Combine everything into the final prompt
      const fullPrompt = `${systemPrompt}

${conversationContext}

User: ${userMessage}

Agent Response:`;

      console.log('🤖 Sending to Gemini:', {
        agent: agentDefinition.agent?.name,
        role: agentDefinition.agent?.title,
        messageLength: userMessage.length,
        circuitBreakerState: this.geminiCircuitBreaker.getStatus().state
      });

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      // Mark provider as healthy
      this.healthStats.gemini.healthy = true;
      this.healthStats.gemini.lastCheck = new Date();

      // Format response using unified structure
      const formattedResponse = ResponseFormatter.formatAgentResponse(
        agentDefinition, 
        text.trim(), 
        {
          provider: 'gemini',
          usage: {
            tokens: this.estimateTokens(fullPrompt + text),
            cost: this.estimateCost('gemini', this.estimateTokens(fullPrompt + text))
          }
        }
      );

      return {
        content: text.trim(),
        agentId: agentDefinition.agent?.id || 'unknown-agent',
        agentName: agentDefinition.agent?.name || 'AI Agent',
        provider: 'gemini',
        usage: {
          tokens: this.estimateTokens(fullPrompt + text),
          cost: this.estimateCost('gemini', this.estimateTokens(fullPrompt + text))
        },
        structured: formattedResponse
      };
    } catch (error) {
      console.error('❌ Gemini generation error:', error);
      
      // Check if it's a retryable error
      const isRetryable = this.isRetryableError(error);
      if (!isRetryable) {
        this.geminiCircuitBreaker.onFailure();
      }
      
      throw error;
    }
  }

  /**
   * Generate response using OpenAI
   */
  async generateWithOpenAI(agentDefinition, userMessage, conversationHistory) {
    try {
      // Build the system prompt with agent persona and rules
      const systemPrompt = this.buildAgentPrompt(agentDefinition);
      
      // Build conversation context
      const conversationContext = this.buildConversationContext(conversationHistory);
      
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${conversationContext}

${userMessage}` }
      ];

      console.log('🤖 Sending to OpenAI:', {
        agent: agentDefinition.agent?.name,
        role: agentDefinition.agent?.title,
        messageLength: userMessage.length,
        circuitBreakerState: this.openaiCircuitBreaker.getStatus().state
      });

      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Mark provider as healthy
      this.healthStats.openai.healthy = true;
      this.healthStats.openai.lastCheck = new Date();

      // Format response using unified structure
      const formattedResponse = ResponseFormatter.formatAgentResponse(
        agentDefinition, 
        content.trim(), 
        {
          provider: 'openai',
          usage: {
            tokens: response.usage?.total_tokens || this.estimateTokens(systemPrompt + userMessage + content),
            cost: this.estimateCost('openai', response.usage?.total_tokens || 0)
          }
        }
      );

      return {
        content: content.trim(),
        agentId: agentDefinition.agent?.id || 'unknown-agent',
        agentName: agentDefinition.agent?.name || 'AI Agent',
        provider: 'openai',
        usage: {
          tokens: response.usage?.total_tokens || this.estimateTokens(systemPrompt + userMessage + content),
          cost: this.estimateCost('openai', response.usage?.total_tokens || 0)
        },
        structured: formattedResponse
      };
    } catch (error) {
      console.error('❌ OpenAI generation error:', error);
      
      // Check if it's a retryable error
      const isRetryable = this.isRetryableError(error);
      if (!isRetryable) {
        this.openaiCircuitBreaker.onFailure();
      }
      
      throw error;
    }
  }

  /**
   * Build agent prompt from definition
   */
  buildAgentPrompt(agentDefinition) {
    if (!agentDefinition || !agentDefinition.agent || !agentDefinition.persona) {
      return "You are a helpful AI assistant.";
    }

    const { agent, persona } = agentDefinition;
    
    let prompt = `You are ${agent.name}, a ${agent.title}. ${agent.icon}

PERSONA:
- Role: ${persona.role}
- Style: ${persona.style}
- Identity: ${persona.identity}
- Focus: ${persona.focus}

CORE PRINCIPLES:`;

    if (persona.core_principles && Array.isArray(persona.core_principles)) {
      persona.core_principles.forEach(principle => {
        prompt += `\n- ${principle}`;
      });
    }

    prompt += `\n\nIMPORTANT: Stay in character as ${agent.name}. Respond according to your persona and expertise as a ${agent.title}.`;

    // Add available commands if they exist
    if (agentDefinition.commands && Array.isArray(agentDefinition.commands)) {
      const commandNames = agentDefinition.commands.map(cmd => {
        if (typeof cmd === 'string') {
          return `*${cmd.split(':')[0]}`;
        } else if (typeof cmd === 'object' && cmd !== null) {
          // Handle YAML object format like {help: "Show numbered list..."}
          const commandName = Object.keys(cmd)[0];
          return `*${commandName}`;
        }
        return '*unknown';
      });
      prompt += `\n\nAVAILABLE COMMANDS: ${commandNames.join(', ')}`;
      prompt += `\nNote: Users can use commands with * prefix (e.g., *help)`;
    }

    // Add structured response format instruction
    prompt += `\n\n${STRUCTURED_RESPONSE_TEMPLATE}`;

    return prompt;
  }

  /**
   * Build conversation context from history
   */
  buildConversationContext(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return "This is the start of a new conversation.";
    }

    let context = "Previous conversation:\n";
    conversationHistory.slice(-5).forEach(msg => { // Only use last 5 messages
      const role = msg.from === 'user' ? 'User' : 'Agent';
      context += `${role}: ${msg.content}\n`;
    });

    return context;
  }

  /**
   * Generate fallback response when AI services are unavailable
   */
  generateFallbackResponse(agentDefinition, userMessage) {
    const agentName = agentDefinition?.agent?.name || 'AI Agent';
    const agentTitle = agentDefinition?.agent?.title || 'Assistant';
    
    const fallbackResponses = [
      `Hi! I'm ${agentName}, your ${agentTitle}. I received your message: "${userMessage}". I'm currently experiencing some technical issues but I'm here to help. Could you please try rephrasing your request?`,
      `Hello! ${agentName} here (${agentTitle}). I see you asked about: "${userMessage}". I'm having some connectivity issues right now, but I'd love to help once my systems are back online.`,
      `Greetings! This is ${agentName}, your ${agentTitle}. I got your message about: "${userMessage}". I'm currently in fallback mode but still ready to assist. What would you like to work on?`
    ];

    const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

    return {
      content: randomResponse,
      agentId: agentDefinition?.agent?.id || 'fallback-agent',
      agentName: agentName,
      provider: 'fallback'
    };
  }

  /**
   * Check if error is retryable (temporary issues vs permanent failures)
   */
  isRetryableError(error) {
    const retryableMessages = [
      'rate limit',
      'timeout',
      'network',
      'temporarily unavailable',
      'service unavailable',
      'internal server error',
      'bad gateway',
      'gateway timeout'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return retryableMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Estimate token count for cost calculation
   */
  estimateTokens(text) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate cost based on provider and token count
   */
  estimateCost(provider, tokens) {
    const costs = {
      gemini: 0.00015 / 1000, // $0.00015 per 1K tokens (rough estimate)
      openai: 0.0015 / 1000   // $0.0015 per 1K tokens for GPT-4o-mini
    };
    
    return (costs[provider] || 0) * tokens;
  }

  /**
   * Perform health checks on all providers
   */
  async performHealthChecks() {
    const checks = [];
    
    if (this.geminiClient) {
      checks.push(this.checkGeminiHealth());
    }
    
    if (this.openaiClient) {
      checks.push(this.checkOpenAIHealth());
    }
    
    await Promise.allSettled(checks);
  }

  /**
   * Check Gemini health
   */
  async checkGeminiHealth() {
    try {
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent('Health check - respond with "OK"');
      const response = await result.response;
      const text = response.text();
      
      this.healthStats.gemini.healthy = true;
      this.healthStats.gemini.lastCheck = new Date();
      this.healthStats.gemini.errorCount = 0;
      
      return { provider: 'gemini', status: 'healthy', response: text.trim() };
    } catch (error) {
      this.healthStats.gemini.healthy = false;
      this.healthStats.gemini.lastCheck = new Date();
      this.healthStats.gemini.errorCount++;
      
      return { provider: 'gemini', status: 'error', error: error.message };
    }
  }

  /**
   * Check OpenAI health
   */
  async checkOpenAIHealth() {
    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Health check - respond with "OK"' }],
        max_tokens: 10
      });
      
      const content = response.choices[0]?.message?.content || '';
      
      this.healthStats.openai.healthy = true;
      this.healthStats.openai.lastCheck = new Date();
      this.healthStats.openai.errorCount = 0;
      
      return { provider: 'openai', status: 'healthy', response: content.trim() };
    } catch (error) {
      this.healthStats.openai.healthy = false;
      this.healthStats.openai.lastCheck = new Date();
      this.healthStats.openai.errorCount++;
      
      return { provider: 'openai', status: 'error', error: error.message };
    }
  }

  /**
   * Check if AI service is available and working
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const healthChecks = await this.performHealthChecks();
      
      const healthyProviders = Object.entries(this.healthStats)
        .filter(([_, stats]) => stats.healthy)
        .map(([provider, _]) => provider);
      
      const circuitBreakerStatus = {
        gemini: this.geminiCircuitBreaker.getStatus(),
        openai: this.openaiCircuitBreaker.getStatus()
      };
      
      return {
        status: healthyProviders.length > 0 ? 'healthy' : 'degraded',
        providers: this.healthStats,
        circuitBreakers: circuitBreakerStatus,
        usageStats: this.usageTracker.getGlobalStats(),
        healthyProviders,
        providerPriority: this.providerPriority
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        providers: this.healthStats
      };
    }
  }

  /**
   * Get detailed system status for monitoring
   */
  getSystemStatus() {
    return {
      initialized: this.initialized,
      providers: {
        gemini: {
          available: !!this.geminiClient,
          health: this.healthStats.gemini,
          circuitBreaker: this.geminiCircuitBreaker.getStatus()
        },
        openai: {
          available: !!this.openaiClient,
          health: this.healthStats.openai,
          circuitBreaker: this.openaiCircuitBreaker.getStatus()
        }
      },
      usage: this.usageTracker.getGlobalStats(),
      providerPriority: this.providerPriority
    };
  }

  /**
   * Update provider priority order
   */
  setProviderPriority(newPriority) {
    this.providerPriority = newPriority;
    console.log('🔄 Updated provider priority:', newPriority);
  }

  /**
   * Get user-specific usage stats
   */
  getUserUsageStats(userId) {
    return this.usageTracker.getUserStats(userId);
  }

  /**
   * Reset circuit breakers (admin function)
   */
  resetCircuitBreakers() {
    this.geminiCircuitBreaker = new CircuitBreaker({ failureThreshold: 5, resetTimeout: 60000 });
    this.openaiCircuitBreaker = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 30000 });
    console.log('🔄 Circuit breakers reset');
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;