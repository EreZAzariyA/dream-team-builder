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
   * Extract text content from LangChain response (handles Gemini array format)
   */
  extractContentText(result) {
    if (typeof result.content === 'string') {
      return result.content;
    }

    if (Array.isArray(result.content)) {
      // Gemini returns array of content parts - filter out function calls
      return result.content
        .filter(part => !part.functionCall)
        .map(part => {
          if (typeof part === 'string') return part;
          if (part.text) return part.text;
          return '';
        })
        .join('');
    }

    if (result.content?.text) {
      return result.content.text;
    }

    if (result.text) {
      return result.text;
    }

    logger.warn('⚠️ Unexpected result format from LangChain:', {
      hasContent: !!result.content,
      contentType: typeof result.content,
      resultKeys: Object.keys(result)
    });

    return result.content?.toString() || result.toString() || '';
  }

  /**
   * Get actual provider name from 'auto' or specific provider
   */
  resolveProvider(providerOption) {
    if (providerOption && providerOption !== 'auto') {
      return providerOption;
    }
    return this.providers.gemini ? 'gemini' : 'openai';
  }

  /**
   * Extract system and user messages from message array
   */
  extractMessages(messages) {
    return {
      systemMessage: messages.find(m => m.role === 'system')?.content || '',
      userMessage: messages.find(m => m.role === 'user')?.content || ''
    };
  }

  /**
   * Initialize Redis client for chat history (uses ioredis)
   */
  async initializeRedis(redisUrl) {
    if (this.redisClient) return this.redisClient;

    try {
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
      if (options.maxTokens) model.maxTokens = options.maxTokens;
      if (options.temperature !== undefined) model.temperature = options.temperature;

      // CRITICAL FIX: For Gemini with JSON requests, ensure response mode is 'text'
      // Gemini can return structured JSON which breaks LangChain's parser
      let modifiedPrompt = prompt;
      const isGemini = options.provider === 'gemini' || (options.provider === 'auto' && this.providers.gemini);
      if (isGemini && (prompt.includes('JSON') || prompt.includes('json'))) {
        logger.info('📝 Gemini + JSON detected - forcing text response mode');
        modifiedPrompt = prompt + '\n\nIMPORTANT: Return the JSON as plain text content, not as structured data.';
      }

      const result = await model.invoke(modifiedPrompt);
      const provider = this.resolveProvider(options.provider);
      const contentText = this.extractContentText(result);

      logger.info('📝 LangChain text generation completed:', {
        provider,
        promptLength: prompt.length,
        responseLength: contentText.length
      });

      return {
        content: contentText,
        text: contentText,
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
   * Execute tool calls for Gemini (manual tool execution loop)
   */
  async executeGeminiToolLoop(model, tools, systemMessage, userMessage, options) {
    const modelWithTools = model.bindTools(tools);
    const conversationHistory = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ];

    let finalResponse = null;
    let intermediateSteps = [];
    let iterations = 0;
    const maxIterations = options.maxIterations || 5;

    while (iterations < maxIterations) {
      iterations++;
      logger.info(`🔄 Gemini tool execution iteration ${iterations}/${maxIterations}`);

      const promptText = conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n\n');
      const response = await modelWithTools.invoke(promptText);

      logger.info(`📋 Gemini response - has tool calls: ${!!response.tool_calls}, count: ${response.tool_calls?.length || 0}`);

      // Execute tool calls if present
      if (response.tool_calls && response.tool_calls.length > 0) {
        logger.info(`📞 Gemini requesting ${response.tool_calls.length} tool calls`);

        for (const toolCall of response.tool_calls) {
          const tool = tools.find(t => t.name === toolCall.name);
          if (!tool) continue;

          try {
            logger.info(`🔧 Executing tool: ${toolCall.name}`);
            const toolResult = await tool.invoke(toolCall.args, { configurable: { userId: options.userId } });

            intermediateSteps.push({
              action: { tool: toolCall.name, toolInput: toolCall.args },
              observation: toolResult
            });

            conversationHistory.push({
              role: 'function',
              content: `Result from ${toolCall.name}: ${typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)}`
            });

            logger.info(`✅ Tool ${toolCall.name} executed`);
          } catch (toolError) {
            logger.error(`❌ Tool ${toolCall.name} failed:`, toolError.message);
            conversationHistory.push({
              role: 'function',
              content: `Error from ${toolCall.name}: ${toolError.message}`
            });
          }
        }

        // Ask for final summary
        conversationHistory.push({
          role: 'user',
          content: 'Based on the information from the tools, please provide the complete analysis summary in the requested format.'
        });
        continue;
      }

      // No tool calls - extract final text response
      const textContent = this.extractContentText(response);
      if (textContent.trim()) {
        finalResponse = textContent;
        logger.info(`✅ Gemini generated final response (${textContent.length} chars)`);
        break;
      }

      logger.warn('⚠️ No text content in response, ending loop');
      break;
    }

    return {
      output: finalResponse || 'Unable to generate summary. Please add an OpenAI API key for better tool support.',
      intermediateSteps
    };
  }

  /**
   * Generate response with tools using LangChain agent
   */
  async generateWithTools(messages, tools, options = {}) {
    try {
      const providerToUse = this.providers.openai ? 'openai' : (options.provider || 'auto');
      const model = this.getModel(providerToUse);
      const isUsingOpenAI = this.providers.openai && providerToUse === 'openai';

      logger.info(`🛠️ LangChain generating with ${tools.length} tools using ${providerToUse} provider (OpenAI agent: ${isUsingOpenAI})`);

      const { systemMessage, userMessage } = this.extractMessages(messages);
      let result;

      if (isUsingOpenAI) {
        // Use OpenAI Functions Agent
        const prompt = ChatPromptTemplate.fromMessages([
          ['system', '{system}'],
          ['human', '{input}'],
          new MessagesPlaceholder('agent_scratchpad')
        ]);

        const agent = await createOpenAIFunctionsAgent({ llm: model, tools, prompt });
        const executor = new AgentExecutor({
          agent,
          tools,
          maxIterations: options.maxIterations || 5,
          returnIntermediateSteps: true,
          verbose: options.verbose || false
        });

        result = await executor.invoke({
          system: systemMessage,
          input: userMessage
        });
      } else {
        // Gemini manual tool execution
        logger.info('🔧 Using Gemini with manual tool execution (no OpenAI agent)');
        result = await this.executeGeminiToolLoop(model, tools, systemMessage, userMessage, options);
      }

      logger.info(`✅ LangChain tool generation completed with ${result.intermediateSteps?.length || 0} steps`);

      // Ensure result.output is a string
      const outputString = typeof result.output === 'string' ? result.output :
                          (result.output?.toString?.() || JSON.stringify(result.output) || '');

      logger.info(`📤 Final output type: ${typeof result.output}, stringified length: ${outputString.length}`);

      // Transform to Vercel AI SDK compatible format
      return {
        text: outputString,
        content: outputString,
        toolCalls: result.intermediateSteps?.map((step) => ({
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

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', '{system}'],
        ['human', '{input}'],
        new MessagesPlaceholder('agent_scratchpad')
      ]);

      const { systemMessage, userMessage } = this.extractMessages(messages);

      const agent = await createOpenAIFunctionsAgent({ llm: model, tools, prompt });
      const executor = new AgentExecutor({
        agent,
        tools,
        maxIterations: options.maxIterations || 5,
        returnIntermediateSteps: true
      });

      const stream = await executor.stream({
        system: systemMessage,
        input: userMessage
      });

      for await (const chunk of stream) {
        if (chunk.intermediateSteps && chunk.intermediateSteps.length > 0) {
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
      const modelWithStructure = model.withStructuredOutput(schema);
      const result = await modelWithStructure.invoke(prompt);
      const provider = this.resolveProvider(options.provider);

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
   * Generate text with conversation memory (for workflows)
   * Uses Redis-backed memory to maintain conversation context across agent calls
   */
  async generateWithMemory(messages, sessionId, options = {}) {
    try {
      const model = this.getModel(options.provider);
      logger.info(`💭 LangChain generation with memory for session: ${sessionId}`);

      // Initialize Redis if not already done
      if (!this.redisClient && redisService.isAvailable()) {
        await this.initializeRedis(process.env.REDIS_URL);
      }

      // Create Redis-backed chat history if available
      let chatHistory = null;
      if (this.redisClient) {
        chatHistory = new RedisChatMessageHistory({
          sessionId: `workflow:${sessionId}`,
          client: this.redisClient,
          sessionTTL: 86400 // 24 hours
        });
        logger.info(`✅ Using Redis-backed memory for workflow session: ${sessionId}`);
      } else {
        logger.warn(`⚠️ Redis not available, using message-based context for session: ${sessionId}`);
      }

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', '{system}'],
        new MessagesPlaceholder('chat_history'),
        ['human', '{input}']
      ]);

      const { systemMessage } = this.extractMessages(messages);
      const userMessage = messages[messages.length - 1]?.content || '';

      // Load chat history
      let chatHistoryMessages = [];
      if (chatHistory) {
        chatHistoryMessages = await chatHistory.getMessages();
      } else {
        const conversationMessages = messages.filter(m => m.role !== 'system');
        chatHistoryMessages = conversationMessages.slice(0, -1).map(msg => ({
          _getType: () => msg.role === 'user' ? 'human' : 'ai',
          content: msg.content
        }));
      }

      const response = await prompt.pipe(model).invoke({
        system: systemMessage,
        input: userMessage,
        chat_history: chatHistoryMessages
      });

      // Save to Redis chat history
      if (chatHistory) {
        await chatHistory.addUserMessage(userMessage);
        await chatHistory.addAIChatMessage(response.content);
      }

      const provider = this.resolveProvider(options.provider);

      logger.info(`✅ LangChain memory-enabled generation completed for ${provider} (${chatHistoryMessages.length} history messages)`);

      return {
        text: response.content,
        content: response.content,
        provider,
        usage: response.response_metadata?.usage || {},
        finishReason: 'stop',
        memoryMessages: chatHistoryMessages.length
      };

    } catch (error) {
      logger.error('❌ LangChain memory generation failed:', error);
      throw new Error(`LangChain memory generation failed: ${error.message}`);
    }
  }

  /**
   * Create chat message history with Redis (uses existing redisService)
   */
  async createRedisChatHistory(sessionId, redisUrl) {
    try {
      if (redisService.isAvailable()) {
        logger.info('✅ Using existing redisService for LangChain chat history');

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
      await this.redisClient.quit();
      this.redisClient = null;
      logger.info('✅ LangChain Redis client disconnected');
    }
  }
}

export default LangChainService;
