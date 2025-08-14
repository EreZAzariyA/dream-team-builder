/**
 * AI SDK Integration Service
 * Wrapper around AI SDK for enhanced streaming and structured outputs
 * Integrates with existing AIService architecture
 */

import { generateText, streamText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
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
      // Initialize OpenAI provider
      if (apiKeys.openai) {
        this.providers.openai = openai({
          apiKey: apiKeys.openai,
        });
        logger.info('✅ AI SDK OpenAI provider initialized');
      }

      // Initialize Google provider  
      if (apiKeys.gemini) {
        this.providers.google = google({
          apiKey: apiKeys.gemini,
        });
        logger.info('✅ AI SDK Google provider initialized');
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
      if (this.providers.google) {
        return this.providers.google('gemini-2.5-flash');
      } else if (this.providers.openai) {
        return this.providers.openai('gpt-3.5-turbo');
      }
      throw new Error('No AI providers available');
    }

    // Specific provider selection
    switch (providerName) {
      case 'openai':
        if (!this.providers.openai) throw new Error('OpenAI provider not available');
        return this.providers.openai('gpt-3.5-turbo');
      
      case 'google':
      case 'gemini':
        if (!this.providers.google) throw new Error('Google provider not available');
        return this.providers.google('gemini-2.5-flash');
      
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

      logger.info('📝 AI SDK text generation completed:', {
        provider: options.provider || 'auto',
        promptLength: prompt.length,
        responseLength: result.text.length,
        usage: result.usage
      });

      return {
        content: result.text,
        provider: this.getProviderName(model),
        usage: result.usage,
        finishReason: result.finishReason
      };
    } catch (error) {
      logger.error('❌ AI SDK text generation failed:', error);
      throw error;
    }
  }

  /**
   * Stream text response using AI SDK
   */
  async streamText(prompt, options = {}) {
    try {
      const model = this.getModel(options.provider);
      
      const result = await streamText({
        model,
        prompt,
        maxTokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.7,
        ...options
      });

      logger.info('🌊 AI SDK text streaming started:', {
        provider: options.provider || 'auto',
        promptLength: prompt.length
      });

      return {
        textStream: result.textStream,
        fullStream: result.fullStream,
        provider: this.getProviderName(model),
        usage: result.usage
      };
    } catch (error) {
      logger.error('❌ AI SDK text streaming failed:', error);
      throw error;
    }
  }

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

      logger.info('🏗️ AI SDK object generation completed:', {
        provider: options.provider || 'auto',
        promptLength: prompt.length,
        usage: result.usage
      });

      return {
        object: result.object,
        provider: this.getProviderName(model),
        usage: result.usage,
        finishReason: result.finishReason
      };
    } catch (error) {
      logger.error('❌ AI SDK object generation failed:', error);
      throw error;
    }
  }

  /**
   * Get provider name from model
   */
  getProviderName(model) {
    // Simple provider detection based on model string
    const modelStr = model.toString();
    if (modelStr.includes('openai') || modelStr.includes('gpt')) return 'openai';
    if (modelStr.includes('google') || modelStr.includes('gemini')) return 'google';
    return 'unknown';
  }

  /**
   * Update API keys and reinitialize providers
   */
  updateApiKeys(newApiKeys) {
    this.currentApiKeys = { ...this.currentApiKeys, ...newApiKeys };
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