/**
 * Chat Agent Executor - Specialized for Conversational Mode
 * 
 * Extends AgentExecutor with chat-specific functionality:
 * - Conversational context management
 * - Persona-consistent responses 
 * - Chat history integration
 * - Simplified execution flow for chat
 * - Real-time response generation
 */

const { SimplifiedAgentExecutor } = require('./SimplifiedAgentExecutor.js');
import logger from '../utils/logger.js';

class ChatAgentExecutor extends SimplifiedAgentExecutor {
  constructor(agentLoader, aiService, configurationManager = null) {
    super(agentLoader, aiService, configurationManager);
  }

  /**
   * Execute agent in chat mode - optimized for conversational interaction
   */
  async executeChatAgent(agent, chatContext) {
    const startTime = Date.now();
    
    try {
      logger.info(`💬 [CHAT EXECUTOR] Starting chat execution for ${agent.id}`);
      
      // Validate agent
      if (!agent || !agent.id) {
        throw new Error('Invalid agent provided to chat executor');
      }

      // Validate chat context
      if (!chatContext.userPrompt) {
        throw new Error('User message is required for chat execution');
      }

      // Get or create chat session state
      const sessionId = chatContext.conversationId || 'default';
      const sessionState = this.getChatSession(sessionId, agent, chatContext);

      // Build chat-specific prompt
      const chatPrompt = await this.buildChatPrompt(agent, chatContext, sessionState);
      
      // Execute with AI service - NO MOCK FALLBACK
      if (!this.aiService) {
        throw new Error('AI Service is required - no mock responses allowed');
      }
      
      const response = await this.executeWithAI(agent, chatPrompt, chatContext);

      // Update chat session state
      this.updateChatSession(sessionId, {
        lastMessage: chatContext.userPrompt,
        lastResponse: response.content,
        messageCount: (sessionState.messageCount || 0) + 1,
        lastActivity: new Date()
      });

      // Format response for chat
      const chatResponse = {
        success: true,
        agentId: agent.id,
        agentName: agent.agent?.name || agent.id,
        content: response.content,
        type: 'chat_response',
        executionTime: Date.now() - startTime,
        tokensUsed: response.tokensUsed || 0,
        model: response.model || (chatContext.mockMode ? 'mock' : 'ai'),
        conversationId: sessionId,
        metadata: {
          ...response.metadata,
          chatMode: true,
          sessionMessageCount: sessionState.messageCount + 1
        }
      };

      logger.info(`✅ [CHAT EXECUTOR] Chat execution completed in ${chatResponse.executionTime}ms`);
      return chatResponse;

    } catch (error) {
      logger.error(`❌ [CHAT EXECUTOR] Error executing chat agent:`, error);
      
      // Re-throw the error without generating any fallback response
      throw error;
    }
  }

  /**
   * Get or create chat session state
   */
  async getChatSession(sessionId, agent, chatContext) {
    try {
      const { connectMongoose } = require('../database/mongodb.js');
      await connectMongoose();
      const AgentChat = require('../database/models/AgentChat.js').default;
      
      let session = await AgentChat.findOne({ chatId: sessionId });
      
      if (!session) {
        session = new AgentChat({
          chatId: sessionId,
          userId: chatContext.userId,
          userName: chatContext.userName || 'User',
          userEmail: chatContext.userEmail || '',
          agentId: agent.id,
          agentName: agent.agent?.name || agent.id,
          agentTitle: agent.agent?.title || 'AI Agent',
          agentIcon: agent.agent?.icon || '🤖',
          status: 'active',
          messages: []
        });
        await session.save();
      }
      
      return session;
    } catch (error) {
      logger.error(`Failed to get/create chat session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Update chat session state in database
   */
  async updateChatSession(sessionId, updates) {
    try {
      const { connectMongoose } = require('../database/mongodb.js');
      await connectMongoose();
      const AgentChat = require('../database/models/AgentChat.js').default;
      
      await AgentChat.findOneAndUpdate(
        { chatId: sessionId },
        updates,
        { new: true }
      );
    } catch (error) {
      logger.error(`Failed to update chat session ${sessionId}:`, error);
    }
  }

  /**
   * Build chat-optimized prompt for agent
   */
  async buildChatPrompt(agent, chatContext, sessionState) {
    const persona = agent.persona || {};
    const agentInfo = agent.agent || {};
    
    // Extract recent conversation history
    const recentHistory = this.extractRecentHistory(chatContext.chatHistory || [], 5);
    
    // Build persona-aware chat prompt
    const prompt = `You are ${agentInfo.name || agent.id}, a ${agentInfo.title || 'AI Agent'}.

PERSONA GUIDELINES:
- Role: ${persona.role || 'Professional AI Assistant'}  
- Style: ${persona.style || 'Professional and helpful'}
- Focus: ${persona.focus || 'Providing expert assistance'}
- Core Principles: ${Array.isArray(persona.core_principles) ? persona.core_principles.join(', ') : 'Excellence and user focus'}

CHAT CONTEXT:
- You are in conversational chat mode (NOT formal workflow execution)
- Keep responses natural, engaging, and persona-appropriate
- Draw from your expertise as a ${agentInfo.title || 'specialist'}
- User: ${chatContext.userName || 'User'}
- Session Messages: ${sessionState.messageCount || 0}

${recentHistory.length > 0 ? `RECENT CONVERSATION:
${recentHistory.map(msg => `${msg.from}: ${msg.content}`).join('\n')}` : ''}

CURRENT USER MESSAGE: "${chatContext.userPrompt}"

INSTRUCTIONS:
1. Respond in character as ${agentInfo.name || agent.id}
2. Keep response conversational and helpful
3. Draw from your ${agentInfo.title || 'expertise'} when relevant
4. Be concise but thorough (aim for 1-3 paragraphs)
5. Ask follow-up questions if helpful
6. Maintain your ${persona.style || 'professional'} communication style

Respond naturally as ${agentInfo.name || agent.id}:`;

    return prompt;
  }

  /**
   * Execute with AI service for chat
   */
  async executeWithAI(agent, prompt, chatContext) {
    try {
      // Use AIService's generateAgentResponse method which is designed for agent interactions
      const aiResponse = await this.aiService.generateAgentResponse(
        agent, // Full agent definition with persona
        chatContext.userPrompt, // User's message
        chatContext.chatHistory || [], // Conversation history
        chatContext.userId // User ID for usage tracking
      );

      if (!aiResponse.content) {
        throw new Error('AI service returned empty response content');
      }

      return {
        content: aiResponse.content,
        tokensUsed: aiResponse.usage?.total_tokens || 0,
        model: aiResponse.provider || 'ai',
        metadata: {
          aiProvider: aiResponse.provider || 'unknown',
          conversationMode: true,
          agentId: aiResponse.agentId,
          agentName: aiResponse.agentName
        }
      };

    } catch (error) {
      logger.error(`❌ [CHAT EXECUTOR] AI execution failed:`, error);
      throw new Error(`AI service error: ${error.message}`);
    }
  }

  // Mock responses completely removed - AI service required

  // All mock response generation removed - AI service required for all agent responses

  /**
   * Extract recent conversation history for context
   */
  extractRecentHistory(chatHistory, limit = 5) {
    if (!Array.isArray(chatHistory)) return [];
    
    return chatHistory
      .filter(msg => msg.type !== 'greeting') // Exclude initial greeting
      .slice(-limit) // Get last N messages
      .map(msg => ({
        from: msg.fromName || msg.from,
        content: typeof msg.content === 'string' ? 
          msg.content.substring(0, 200) : 
          JSON.stringify(msg.content || '').substring(0, 200) // Truncate long messages
      }));
  }


  /**
   * Clear old chat sessions from database
   */
  async cleanupOldSessions(olderThanHours = 24) {
    try {
      const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
      const { connectMongoose } = require('../database/mongodb.js');
      await connectMongoose();
      const AgentChat = require('../database/models/AgentChat.js').default;
      
      const result = await AgentChat.deleteMany({
        createdAt: { $lt: cutoffTime }
      });
      
      logger.info(`🧹 [CHAT EXECUTOR] Cleaned up ${result.deletedCount} old sessions`);
    } catch (error) {
      logger.error('Failed to cleanup old chat sessions:', error);
    }
  }

  /**
   * Get chat session analytics
   */
  async getChatAnalytics(sessionId) {
    try {
      const { connectMongoose } = require('../database/mongodb.js');
      await connectMongoose();
      const AgentChat = require('../database/models/AgentChat.js').default;
      
      const session = await AgentChat.findOne({ chatId: sessionId });
      if (!session) return null;

      return {
        sessionId: session.chatId,
        agentId: session.agentId,
        messageCount: session.messages?.length || 0,
        duration: Date.now() - session.createdAt.getTime(),
        startTime: session.createdAt,
        lastActivity: session.updatedAt
      };
    } catch (error) {
      logger.error(`Failed to get analytics for session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Update AI service API keys for chat
   */
  updateApiKeys(apiKeys) {
    if (this.aiService && typeof this.aiService.updateApiKeys === 'function') {
      this.aiService.updateApiKeys(apiKeys);
      logger.info(`🔑 [CHAT EXECUTOR] Updated AI service API keys`);
    }
  }
}

module.exports = { ChatAgentExecutor };