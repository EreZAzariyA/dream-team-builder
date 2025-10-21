/**
 * AI Service Core
 * Clean core API for AI service without initialization complexity
 * Focuses on making AI calls with proper error handling
 */

import logger from '../../utils/logger.js';
import { CircuitBreaker } from '../handlers/CircuitBreaker.js';
import { RetryPolicy } from '../utils/RetryPolicy.js';
import { ErrorHandler } from '../handlers/ErrorHandler.js';

export class AIServiceCore {
  constructor(clients, options = {}) {
    // Require initialized clients
    if (!clients.gemini && !clients.openai) {
      throw new Error('At least one AI provider client must be provided');
    }

    this.geminiClient = clients.gemini;
    this.openaiClient = clients.openai;

    // Initialize circuit breakers
    this.geminiCircuitBreaker = new CircuitBreaker({
      failureThreshold: options.geminiFailureThreshold || 5,
      resetTimeout: options.geminiResetTimeout || 60000,
      monitoringPeriod: options.monitoringPeriod || 300000
    });

    this.openaiCircuitBreaker = new CircuitBreaker({
      failureThreshold: options.openaiFailureThreshold || 3,
      resetTimeout: options.openaiResetTimeout || 30000,
      monitoringPeriod: options.monitoringPeriod || 300000
    });

    // Initialize retry policy
    this.retryPolicy = new RetryPolicy({
      maxRetries: options.maxRetries || 2,
      baseDelay: options.baseDelay || 2000,
      maxDelay: options.maxDelay || 30000,
      backoffMultiplier: options.backoffMultiplier || 3
    });

    // Provider priority
    this.providerPriority = this.determineProviderPriority(clients, options.providerPriority);

    // Health stats
    this.healthStats = {
      gemini: { healthy: true, lastCheck: null, errorCount: 0, quotaExhausted: false },
      openai: { healthy: true, lastCheck: null, errorCount: 0, quotaExhausted: false }
    };
  }

  /**
   * Determine provider priority based on available clients
   */
  determineProviderPriority(clients, customPriority) {
    if (customPriority && Array.isArray(customPriority)) {
      return customPriority.filter(p => clients[p]);
    }

    const priority = [];
    if (clients.gemini) priority.push('gemini');
    if (clients.openai) priority.push('openai');
    return priority;
  }

  /**
   * Make an AI call with automatic retry and fallback
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Call options
   * @param {Object} options.agent - Agent configuration
   * @param {number} options.complexity - Complexity level (1-4)
   * @param {Object} options.context - Additional context
   * @param {number} options.maxTokens - Max tokens to generate
   * @returns {Promise<{content: string, provider: string, usage: Object}>}
   */
  async call(prompt, options = {}) {
    const { agent, complexity = 1, context = {}, maxTokens } = options;

    // Try each provider in priority order
    const errors = [];

    for (const provider of this.providerPriority) {
      try {
        const circuitBreaker = provider === 'gemini' ? this.geminiCircuitBreaker : this.openaiCircuitBreaker;

        const result = await circuitBreaker.execute(async () => {
          return this.retryPolicy.execute(async () => {
            if (provider === 'gemini') {
              return await this.callGemini(prompt, { agent, complexity, context, maxTokens });
            } else if (provider === 'openai') {
              return await this.callOpenAI(prompt, { agent, complexity, context, maxTokens });
            }
          });
        });

        // Success - update health stats
        this.healthStats[provider].healthy = true;
        this.healthStats[provider].lastCheck = new Date();
        this.healthStats[provider].errorCount = 0;

        return result;

      } catch (error) {
        const errorCategory = ErrorHandler.categorizeError(error);
        errors.push({
          provider,
          error: error.message,
          category: errorCategory.category
        });

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

    // All providers failed
    throw new Error(`All AI providers failed: ${JSON.stringify(errors)}`);
  }

  /**
   * Call Gemini API
   */
  async callGemini(prompt, options = {}) {
    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized');
    }

    const { complexity = 1, context = {}, maxTokens } = options;

    try {
      // Calculate max tokens
      const calculatedMaxTokens = maxTokens || this.calculateMaxTokens(complexity, context);

      const model = this.geminiClient.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          maxOutputTokens: calculatedMaxTokens,
          temperature: 0.7
        }
      });

      logger.info(`🔍 [GEMINI] Making API call (complexity: ${complexity}, maxTokens: ${calculatedMaxTokens})`);

      const result = await model.generateContent(prompt);
      const response = await result.response;

      // Validate response
      this.validateGeminiResponse(response);

      const text = response.text();

      if (!text || text.trim() === '') {
        throw new Error('Gemini returned empty response');
      }

      return {
        content: text,
        provider: 'gemini',
        usage: response.usageMetadata || {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: Math.ceil(text.length / 4)
        }
      };

    } catch (error) {
      logger.error('Gemini API error:', error);
      throw error;
    }
  }

  /**
   * Validate Gemini response for safety/completion
   */
  validateGeminiResponse(response) {
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('Gemini returned no response candidates');
    }

    const candidate = response.candidates[0];
    const finishReason = candidate.finishReason;

    if (finishReason === 'SAFETY') {
      throw new Error('Content was blocked by safety filters. Please try rephrasing your request.');
    }

    if (finishReason === 'RECITATION') {
      throw new Error('Content was blocked due to recitation concerns. Please try a different approach.');
    }

    if (finishReason === 'MAX_TOKENS') {
      logger.warn('⚠️ Gemini response truncated due to max tokens limit');
      // Don't throw - partial response might still be useful
    }

    if (finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
      logger.warn(`⚠️ Unexpected finish reason: ${finishReason}`);
    }
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(prompt, options = {}) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const { complexity = 1, context = {}, maxTokens } = options;

    try {
      const calculatedMaxTokens = maxTokens || Math.min(4000, 1000 * complexity);

      const completion = await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: calculatedMaxTokens,
        temperature: 0.7
      });

      const text = completion.choices[0]?.message?.content || '';

      if (!text || text.trim() === '') {
        throw new Error('OpenAI returned empty response');
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

  /**
   * Calculate max tokens based on complexity and context
   */
  calculateMaxTokens(complexity, context = {}) {
    if (context.maxTokens) {
      return Math.min(8000, context.maxTokens);
    }

    const complexityValue = typeof complexity === 'string'
      ? (complexity === 'simple' ? 1 : complexity === 'complex' ? 4 : 2)
      : complexity;

    return Math.min(8000, 2000 * complexityValue);
  }

  /**
   * Health check for specific provider
   */
  async checkProviderHealth(provider) {
    if (provider === 'gemini' && this.geminiClient) {
      return await this.checkGeminiHealth();
    } else if (provider === 'openai' && this.openaiClient) {
      return await this.checkOpenAIHealth();
    }
    return { healthy: false, error: 'Provider not available' };
  }

  async checkGeminiHealth() {
    try {
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent('Hello');
      const response = await result.response;

      this.healthStats.gemini.healthy = true;
      this.healthStats.gemini.lastCheck = new Date();
      this.healthStats.gemini.errorCount = 0;

      return {
        healthy: true,
        provider: 'gemini',
        model: 'gemini-2.5-flash'
      };
    } catch (error) {
      this.healthStats.gemini.healthy = false;
      this.healthStats.gemini.lastCheck = new Date();
      this.healthStats.gemini.errorCount++;

      return {
        healthy: false,
        provider: 'gemini',
        error: error.message
      };
    }
  }

  async checkOpenAIHealth() {
    try {
      const completion = await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      });

      this.healthStats.openai.healthy = true;
      this.healthStats.openai.lastCheck = new Date();
      this.healthStats.openai.errorCount = 0;

      return {
        healthy: true,
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      };
    } catch (error) {
      this.healthStats.openai.healthy = false;
      this.healthStats.openai.lastCheck = new Date();
      this.healthStats.openai.errorCount++;

      return {
        healthy: false,
        provider: 'openai',
        error: error.message
      };
    }
  }

  /**
   * Get health stats
   */
  getHealthStats() {
    return { ...this.healthStats };
  }

  /**
   * Reset circuit breakers
   */
  resetCircuitBreakers() {
    this.geminiCircuitBreaker.reset();
    this.openaiCircuitBreaker.reset();
  }

  /**
   * Set provider priority
   */
  setProviderPriority(priority) {
    if (Array.isArray(priority)) {
      this.providerPriority = priority.filter(p =>
        (p === 'gemini' && this.geminiClient) ||
        (p === 'openai' && this.openaiClient)
      );
    }
  }
}
