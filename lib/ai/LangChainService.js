/**
 * LangChain Service
 * Replaces Vercel AI SDK with LangChain for AI operations
 * Supports OpenAI and Google Gemini with tools/agents
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BufferMemory } from 'langchain/memory';
import { MongoDBChatMessageHistory } from '@langchain/community/stores/message/mongodb';
import { RedisChatMessageHistory } from '@langchain/community/stores/message/redis';
import IORedis from 'ioredis';
import logger from '../utils/logger.js';
import { redisService } from '../utils/redis.js';

export class LangChainService {
  constructor(apiKeys = {}) {
    this.providers = {};
    this.currentApiKeys = apiKeys;
    this.initialized = false;
    this.redisClient = null;
    this.mongoClient = null;

    this.initializeProviders(apiKeys);
  }

  /**
   * Initialize AI providers (OpenAI, Gemini)
   */
  initializeProviders(apiKeys) {
    try {
      this.apiKeys = apiKeys;

      // Initialize OpenAI
      if (apiKeys.openai) {
        this.providers.openai = new ChatOpenAI({
          modelName: 'gpt-3.5-turbo',
          temperature: 0.7,
          apiKey: apiKeys.openai,
          maxTokens: 4000
        });
        logger.info('✅ LangChain OpenAI provider initialized');
      }

      // Initialize Gemini
      if (apiKeys.gemini) {
        logger.info(`🔑 Initializing LangChain Gemini provider with API key: ${apiKeys.gemini.substring(0, 10)}...`);
        this.providers.gemini = new ChatGoogleGenerativeAI({
          modelName: 'gemini-2.5-flash',
          temperature: 0.7,
          apiKey: apiKeys.gemini,
          maxOutputTokens: 4000
        });
        logger.info('✅ LangChain Gemini provider initialized');
      }

      this.initialized = Object.keys(this.providers).length > 0;

      if (!this.initialized) {
        logger.warn('⚠️ No LangChain providers initialized - no API keys provided');
      }
    } catch (error) {
      logger.error('❌ Failed to initialize LangChain providers:', error);
      this.initialized = false;
    }
  }

  /**
   * Get model (auto-select or specific provider)
   */
  getModel(providerName = 'auto') {
    if (!this.initialized) {
      throw new Error('LangChain service not initialized');
    }

    // Auto-select: prefer Gemini, fallback to OpenAI
    if (providerName === 'auto') {
      if (this.providers.gemini) {
        logger.info('🔑 Using LangChain Gemini model');
        return this.providers.gemini;
      } else if (this.providers.openai) {
        logger.info('🔑 Using LangChain OpenAI model');
        return this.providers.openai;
      }
      throw new Error('No LangChain providers available');
    }

    // Specific provider
    if (!this.providers[providerName]) {
      throw new Error(`LangChain provider ${providerName} not available`);
    }
    return this.providers[providerName];
  }

  /**
   * Initialize Redis client for chat history (uses ioredis)
   */
  async initializeRedis(redisUrl) {
    if (this.redisClient) return this.redisClient;

    try {
      // Use ioredis (compatible with your existing setup)
      this.redisClient = new IORedis(redisUrl || process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        connectTimeout: 10000
      });

      this.redisClient.on('connect', () => logger.info('✅ LangChain Redis client connected (ioredis)'));
      this.redisClient.on('error', (err) => logger.error('LangChain ioredis Error:', err));

      return this.redisClient;
    } catch (error) {
      logger.error('❌ Failed to connect LangChain Redis client:', error);
      return null;
    }
  }

  /**
   * Generate text response (simple completion, no tools)
   */
  async generateText(prompt, options = {}) {
    try {
      const model = this.getModel(options.provider);

      // Update model configuration
      if (options.maxTokens) {
        model.maxTokens = options.maxTokens;
      }
      if (options.temperature !== undefined) {
        model.temperature = options.temperature;
      }

      const result = await model.invoke(prompt);

      let provider = options.provider;
      if (provider === 'auto') {
        provider = this.providers.gemini ? 'gemini' : 'openai';
      }

      logger.info('📝 LangChain text generation completed:', {
        provider,
        promptLength: prompt.length,
        responseLength: result.content.length
      });

      return {
        content: result.content,
        provider,
        usage: result.usage_metadata || result.response_metadata?.usage || {},
        finishReason: result.response_metadata?.finish_reason || 'stop'
      };
    } catch (error) {
      logger.error('❌ LangChain text generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate response with tools using LangChain agent
   */
  async generateWithTools(messages, tools, options = {}) {
    try {
      const model = this.getModel(options.provider);

      logger.info(`🛠️ LangChain generating with ${tools.length} tools using ${options.provider || 'auto'} provider`);

      // Build prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', '{system}'],
        ['human', '{input}'],
        new MessagesPlaceholder('agent_scratchpad')
      ]);

      // Extract system and user messages
      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const userMessage = messages.find(m => m.role === 'user')?.content || '';

      // Create agent
      const agent = await createOpenAIFunctionsAgent({
        llm: model,
        tools,
        prompt
      });

      // Create executor
      const executor = new AgentExecutor({
        agent,
        tools,
        maxIterations: options.maxIterations || 5,
        returnIntermediateSteps: true,
        verbose: options.verbose || false
      });

      // Execute
      const result = await executor.invoke({
        system: systemMessage,
        input: userMessage
      });

      logger.info(`✅ LangChain tool generation completed with ${result.intermediateSteps?.length || 0} steps`);

      // Transform to Vercel AI SDK compatible format
      return {
        text: result.output,
        content: result.output,
        toolCalls: result.intermediateSteps?.map((step, index) => ({
          type: 'function',
          function: {
            name: step.action?.tool,
            arguments: JSON.stringify(step.action?.toolInput || {})
          },
          result: step.observation
        })) || [],
        usage: {},
        finishReason: 'stop',
        steps: result.intermediateSteps || []
      };

    } catch (error) {
      logger.error('❌ LangChain tool generation failed:', error);
      throw new Error(`LangChain tool generation failed: ${error.message}`);
    }
  }

  /**
   * Stream text response with tools
   */
  async *streamWithTools(messages, tools, options = {}) {
    try {
      const model = this.getModel(options.provider);

      logger.info(`🌊 LangChain streaming with tools`);

      // Build prompt
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', '{system}'],
        ['human', '{input}'],
        new MessagesPlaceholder('agent_scratchpad')
      ]);

      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const userMessage = messages.find(m => m.role === 'user')?.content || '';

      // Create agent
      const agent = await createOpenAIFunctionsAgent({
        llm: model,
        tools,
        prompt
      });

      // Create executor
      const executor = new AgentExecutor({
        agent,
        tools,
        maxIterations: options.maxIterations || 5,
        returnIntermediateSteps: true
      });

      // Stream execution
      const stream = await executor.stream({
        system: systemMessage,
        input: userMessage
      });

      // Yield chunks
      for await (const chunk of stream) {
        if (chunk.intermediateSteps && chunk.intermediateSteps.length > 0) {
          // Tool execution step
          const lastStep = chunk.intermediateSteps[chunk.intermediateSteps.length - 1];
          yield {
            type: 'tool_call',
            toolName: lastStep.action?.tool,
            toolInput: lastStep.action?.toolInput,
            toolResult: lastStep.observation,
            stepIndex: chunk.intermediateSteps.length - 1
          };
        }

        if (chunk.output) {
          // Final output
          yield {
            type: 'text',
            content: chunk.output,
            done: true
          };
        }
      }

    } catch (error) {
      logger.error('❌ LangChain streaming failed:', error);
      throw error;
    }
  }

  /**
   * Generate structured output
   */
  async generateStructuredOutput(prompt, schema, options = {}) {
    try {
      const model = this.getModel(options.provider);

      // Use structured output
      const modelWithStructure = model.withStructuredOutput(schema);
      const result = await modelWithStructure.invoke(prompt);

      let provider = options.provider;
      if (provider === 'auto') {
        provider = this.providers.gemini ? 'gemini' : 'openai';
      }

      logger.info('🏗️ LangChain structured output completed:', {
        provider,
        promptLength: prompt.length
      });

      return {
        object: result,
        provider,
        usage: {},
        finishReason: 'stop'
      };
    } catch (error) {
      logger.error('❌ LangChain structured output failed:', error);
      throw error;
    }
  }

  /**
   * Create chat message history with Redis (uses existing redisService)
   */
  async createRedisChatHistory(sessionId, redisUrl) {
    try {
      // Check if we should use existing redisService or create new client
      if (redisService.isAvailable()) {
        logger.info('✅ Using existing redisService for LangChain chat history');

        // LangChain's RedisChatMessageHistory needs an ioredis client
        // So we initialize a separate one for LangChain
        if (!this.redisClient) {
          await this.initializeRedis(redisUrl);
        }

        if (!this.redisClient) {
          logger.warn('Redis client not available for LangChain chat history');
          return null;
        }

        return new RedisChatMessageHistory({
          sessionId,
          client: this.redisClient,
          sessionTTL: 3600 // 1 hour
        });
      } else {
        logger.warn('Redis not available, chat history will not be persisted');
        return null;
      }
    } catch (error) {
      logger.error('❌ Failed to create Redis chat history:', error);
      return null;
    }
  }

  /**
   * Create chat message history with MongoDB
   */
  async createMongoDBChatHistory(sessionId, mongoUrl, dbName = 'dream-team') {
    try {
      return new MongoDBChatMessageHistory({
        collection: 'chat_messages',
        sessionId,
        connectionString: mongoUrl,
        databaseName: dbName
      });
    } catch (error) {
      logger.error('❌ Failed to create MongoDB chat history:', error);
      return null;
    }
  }

  /**
   * Update API keys and reinitialize providers
   */
  updateApiKeys(newApiKeys) {
    logger.info(`🔑 LangChainService.updateApiKeys called with: gemini=${!!newApiKeys.gemini}, openai=${!!newApiKeys.openai}`);
    this.currentApiKeys = { ...this.currentApiKeys, ...newApiKeys };
    this.initializeProviders(this.currentApiKeys);
    logger.info('🔄 LangChain providers updated with new API keys');
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Health check
   */
  async healthCheck() {
    const results = {};

    for (const [providerName, model] of Object.entries(this.providers)) {
      try {
        const result = await model.invoke('Hello');

        results[providerName] = {
          healthy: true,
          responseLength: result.content.length
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

  /**
   * Cleanup
   */
  async cleanup() {
    if (this.redisClient) {
      await this.redisClient.quit(); // ioredis uses quit() not disconnect()
      this.redisClient = null;
      logger.info('✅ LangChain Redis client disconnected');
    }
  }
}

export default LangChainService;
