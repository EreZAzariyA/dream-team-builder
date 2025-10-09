/**
 * AI SDK Integration Service
 * Wrapper around AI SDK for enhanced streaming and structured outputs
 * Integrates with existing AIService architecture
 */

import { generateText, streamText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import logger from '../utils/logger.js';

export class AISdkService {
  constructor(apiKeys = {}) {
    this.providers = {};
    this.currentApiKeys = apiKeys;
    this.initialized = false;
    
    this.initializeProviders(apiKeys);
  }

  initializeProviders(apiKeys) {
    try {
      // Store API keys for provider configuration
      this.apiKeys = apiKeys;

      // Set up provider functions with API keys
      if (apiKeys.openai) {
        this.providers.openai = (modelName) => openai(modelName, { apiKey: apiKeys.openai });
        logger.info('✅ AI SDK OpenAI provider initialized');
      }

      if (apiKeys.gemini) {
        logger.info(`🔑 Initializing Gemini provider with API key: ${apiKeys.gemini.substring(0, 10)}...`);
        const googleProvider = createGoogleGenerativeAI({ apiKey: apiKeys.gemini });
        this.providers.gemini = (modelName) => googleProvider(modelName);
        logger.info('✅ AI SDK Gemini provider initialized');
      }

      this.initialized = Object.keys(this.providers).length > 0;
      
      if (!this.initialized) {
        logger.warn('⚠️ No AI SDK providers initialized - no API keys provided');
      }
    } catch (error) {
      logger.error('❌ Failed to initialize AI SDK providers:', error);
      this.initialized = false;
    }
  }

  getModel(providerName = 'auto') {
    if (!this.initialized) {
      throw new Error('AI SDK service not initialized');
    }

    // Auto-select provider based on availability (prefer Gemini, fallback to OpenAI)
    if (providerName === 'auto') {
      if (this.providers.gemini) {
        logger.info('🔑 Getting Gemini model with provider function');
        return this.providers.gemini('gemini-2.5-flash');
      } else if (this.providers.openai) {
        logger.info('🔑 Getting OpenAI model with provider function');
        return this.providers.openai('gpt-3.5-turbo');
      }
      throw new Error('No AI providers available');
    }

    // Specific provider selection
    switch (providerName) {
      case 'openai':
        if (!this.providers.openai) throw new Error('OpenAI provider not available');
        return this.providers.openai('gpt-3.5-turbo');
      
      case 'gemini':
        if (!this.providers.gemini) throw new Error('Gemini provider not available');
        return this.providers.gemini('gemini-2.5-flash');
      
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  /**
   * Generate text response using AI SDK
   */
  async generateText(prompt, options = {}) {
    try {
      const model = this.getModel(options.provider);
      
      const result = await generateText({
        model,
        prompt,
        maxTokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.7,
        ...options
      });

      let provider = options.provider;
      if (provider === 'auto') {
        if (this.providers.gemini) {
          provider = 'gemini';
        } else if (this.providers.openai) {
          provider = 'openai';
        } else {
          provider = 'unknown';
        }
      }

      logger.info('📝 AI SDK text generation completed:', {
        provider: provider,
        promptLength: prompt.length,
        responseLength: result.text.length,
        usage: result.usage
      });

      return {
        content: result.text,
        provider: provider,
        usage: result.usage,
        finishReason: result.finishReason
      };
    } catch (error) {
      logger.error('❌ AI SDK text generation failed:', error);
      throw error;
    }
  }

  /**
   * REMOVED: Stream text response - AI SDK streaming is broken for multi-user
   */

  /**
   * Generate structured object using AI SDK
   */
  async generateObject(prompt, schema, options = {}) {
    try {
      const model = this.getModel(options.provider);
      
      const result = await generateObject({
        model,
        prompt,
        schema,
        maxTokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.3, // Lower temp for structured output
        ...options
      });

      let provider = options.provider;
      if (provider === 'auto') {
        if (this.providers.gemini) {
          provider = 'gemini';
        } else if (this.providers.openai) {
          provider = 'openai';
        } else {
          provider = 'unknown';
        }
      }

      logger.info('🏗️ AI SDK object generation completed:', {
        provider: provider,
        promptLength: prompt.length,
        usage: result.usage
      });

      return {
        object: result.object,
        provider: provider,
        usage: result.usage,
        finishReason: result.finishReason
      };
    } catch (error) {
      logger.error('❌ AI SDK object generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate response with tools using AI SDK
   */
  async generateWithTools(messages, tools, options = {}) {
    try {
      const model = this.getModel(options.provider);
      
      logger.info(`🛠️ Generating with tools using ${options.provider || 'auto'} provider`);
      
      const result = await generateText({
        model,
        messages,
        tools,
        maxTokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.7,
        ...options
      });

      logger.info(`✅ Tool generation completed with ${result.toolCalls?.length || 0} tool calls`);
      
      return {
        text: result.text,
        toolCalls: result.toolCalls || [],
        usage: result.usage || {},
        finishReason: result.finishReason
      };

    } catch (error) {
      logger.error('❌ Tool generation failed:', error);
      throw new Error(`Tool generation failed: ${error.message}`);
    }
  }

  /**
   * Update API keys and reinitialize providers
   */
  updateApiKeys(newApiKeys) {
    logger.info(`🔑 AISdkService.updateApiKeys called with: gemini=${!!newApiKeys.gemini}, openai=${!!newApiKeys.openai}`);
    this.currentApiKeys = { ...this.currentApiKeys, ...newApiKeys };
    logger.info(`🔑 Current keys after update: gemini=${!!this.currentApiKeys.gemini}, openai=${!!this.currentApiKeys.openai}`);
    this.initializeProviders(this.currentApiKeys);
    logger.info('🔄 AI SDK providers updated with new API keys');
  }

  /**
   * Check if streaming is supported
   */
  supportsStreaming() {
    return this.initialized;
  }

  /**
   * Check if structured output is supported
   */
  supportsStructuredOutput() {
    return this.initialized;
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Health check for AI SDK service
   */
  async healthCheck() {
    const results = {};
    
    for (const [providerName, provider] of Object.entries(this.providers)) {
      try {
        const model = providerName === 'openai' 
          ? provider('gpt-3.5-turbo') 
          : provider('gemini-2.5-flash');
          
        const result = await generateText({
          model,
          prompt: 'Hello',
          maxTokens: 10
        });
        
        results[providerName] = {
          healthy: true,
          responseLength: result.text.length,
          usage: result.usage
        };
      } catch (error) {
        results[providerName] = {
          healthy: false,
          error: error.message
        };
      }
    }
    
    return results;
  }
}

export default AISdkService;