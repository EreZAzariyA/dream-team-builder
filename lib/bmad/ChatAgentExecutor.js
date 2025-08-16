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

const { AgentExecutor } = require('./AgentExecutor/index.js');
import logger from '../utils/logger.js';

class ChatAgentExecutor extends AgentExecutor {
  constructor(agentLoader, aiService, configurationManager = null) {
    super(agentLoader, aiService, configurationManager);
    this.chatSessions = new Map(); // Store chat-specific state
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
      
      // Execute with AI service or fallback to mock
      let response;
      if (this.aiService && !chatContext.mockMode) {
        response = await this.executeWithAI(agent, chatPrompt, chatContext);
      } else {
        response = await this.executeWithMock(agent, chatContext);
      }

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
      
      return {
        success: false,
        agentId: agent.id,
        agentName: agent.agent?.name || agent.id,
        content: this.generateErrorResponse(agent, error),
        type: 'error_response',
        error: error.message,
        executionTime: Date.now() - startTime,
        conversationId: chatContext.conversationId
      };
    }
  }

  /**
   * Get or create chat session state
   */
  getChatSession(sessionId, agent, chatContext) {
    if (!this.chatSessions.has(sessionId)) {
      this.chatSessions.set(sessionId, {
        id: sessionId,
        agentId: agent.id,
        userId: chatContext.userId,
        startTime: new Date(),
        messageCount: 0,
        context: {
          userPreferences: {},
          conversationTopic: null,
          lastIntent: null
        }
      });
    }
    return this.chatSessions.get(sessionId);
  }

  /**
   * Update chat session state
   */
  updateChatSession(sessionId, updates) {
    const session = this.chatSessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      this.chatSessions.set(sessionId, session);
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

      return {
        content: aiResponse.content || 'I processed your message.',
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

  /**
   * Execute with mock responses for testing
   */
  async executeWithMock(agent, chatContext) {
    const mockResponses = this.generatePersonaMockResponses(agent, chatContext.userPrompt);
    const selectedResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    return {
      content: selectedResponse,
      tokensUsed: 0,
      model: 'mock',
      metadata: {
        aiProvider: 'mock',
        conversationMode: true
      }
    };
  }

  /**
   * Generate persona-appropriate mock responses
   */
  generatePersonaMockResponses(agent, userMessage) {
    const agentName = agent.agent?.name || agent.id;
    const style = agent.persona?.style || 'professional';
    
    // Base responses for all agents
    const baseResponses = [
      `That's a great question! Let me share my perspective on that.`,
      `I appreciate you bringing this up. Here's how I see it...`,
      `Interesting point! Based on my experience, I'd suggest...`,
      `That's exactly the kind of challenge I enjoy discussing. Let me help you with that.`
    ];

    // Agent-specific response patterns
    const agentResponses = {
      pm: [
        `From a product management perspective, we should consider the user impact and business value here.`,
        `That aligns well with product strategy thinking. Let's explore the requirements and success metrics.`,
        `I'd like to understand the user story behind this. What problem are we solving?`,
        `Great product question! Let's think about this from the user's perspective and work backwards.`
      ],
      architect: [
        `From a system architecture standpoint, we need to consider scalability and maintainability.`,
        `That's an excellent technical question. Let me walk you through the design considerations.`,
        `We should evaluate the architectural trade-offs here. There are several approaches we could take.`,
        `Solid technical thinking! Let's consider how this fits into the broader system architecture.`
      ],
      dev: [
        `That's a solid development question! Let me share some practical implementation approaches.`,
        `I can definitely help you code that efficiently. Here's how I'd tackle it...`,
        `Good technical question! Let's think about the best practices and edge cases.`,
        `I've solved similar challenges before. Let me share some insights and code patterns.`
      ],
      'ux-expert': [
        `From a user experience perspective, we should focus on user needs and usability principles.`,
        `That's a fantastic UX question! User research and testing would really help us here.`,
        `Let's think about the user journey and potential friction points in this experience.`,
        `Excellent UX thinking! Accessibility and inclusive design are key considerations here.`
      ],
      qa: [
        `From a quality assurance perspective, we need to think about comprehensive testing strategies.`,
        `That's a great quality question! Let's consider the testing scenarios and edge cases.`,
        `Quality is paramount here. We should establish clear acceptance criteria and test coverage.`,
        `Excellent attention to quality! Let's plan the testing approach and validation steps.`
      ],
      analyst: [
        `That's a data-driven question! Let's analyze the information and identify key insights.`,
        `From an analytical perspective, we need to examine the metrics and user behavior patterns.`,
        `Great analytical thinking! Let's dive into the data and understand what's really happening.`,
        `I love analytical challenges! Let's gather the right data and uncover the insights.`
      ],
      po: [
        `From a product ownership perspective, let's align this with our product goals and user value.`,
        `That's an important product decision! Let's consider the backlog priorities and stakeholder needs.`,
        `Excellent product thinking! We need to balance user needs with business objectives.`,
        `Great product question! Let's ensure this creates maximum value for our users.`
      ],
      sm: [
        `From a Scrum Master perspective, let's think about team collaboration and process improvement.`,
        `That's a great agile question! Let's consider how this impacts team velocity and delivery.`,
        `Excellent process thinking! Let's facilitate a solution that works for the whole team.`,
        `I love process optimization questions! Let's make sure we're removing impediments and enabling success.`
      ]
    };

    const specificResponses = agentResponses[agent.id] || baseResponses;
    return [...baseResponses.slice(0, 2), ...specificResponses];
  }

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
        content: msg.content.substring(0, 200) // Truncate long messages
      }));
  }

  /**
   * Generate error response in agent's persona
   */
  generateErrorResponse(agent, error) {
    const agentName = agent.agent?.name || agent.id;
    const style = agent.persona?.style || 'professional';
    
    const errorResponses = [
      `I apologize, but I encountered a technical issue while processing your message. Could you please try again?`,
      `I'm experiencing some difficulty right now. Let me try a different approach - could you rephrase your question?`,
      `Sorry about that! I seem to have hit a snag. Can you help me understand what you're looking for?`,
      `I ran into an unexpected issue. Let me reset and try again - what would you like to discuss?`
    ];

    return errorResponses[Math.floor(Math.random() * errorResponses.length)];
  }

  /**
   * Clear old chat sessions (memory management)
   */
  cleanupOldSessions(olderThanHours = 24) {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    
    for (const [sessionId, session] of this.chatSessions) {
      if (session.startTime < cutoffTime) {
        this.chatSessions.delete(sessionId);
        logger.info(`🧹 [CHAT EXECUTOR] Cleaned up old session: ${sessionId}`);
      }
    }
  }

  /**
   * Get chat session analytics
   */
  getChatAnalytics(sessionId) {
    const session = this.chatSessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId: session.id,
      agentId: session.agentId,
      messageCount: session.messageCount,
      duration: Date.now() - session.startTime.getTime(),
      startTime: session.startTime,
      lastActivity: session.lastActivity
    };
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