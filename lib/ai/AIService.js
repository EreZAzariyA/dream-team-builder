/**
 * AI Service Integration
 * Handles communication with Gemini and GPT APIs for agent responses
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export class AIService {
  constructor() {
    this.geminiClient = null;
    this.openaiClient = null;
    this.initialized = false;
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
      }

      // Initialize OpenAI (if needed as fallback)
      if (process.env.OPENAI_API_KEY) {
        // We'll add OpenAI integration later if needed
        console.log('✅ OpenAI API key available');
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize AI service:', error);
      return false;
    }
  }

  /**
   * Generate response using agent persona and rules
   */
  async generateAgentResponse(agentDefinition, userMessage, conversationHistory = []) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Use Gemini as primary AI provider
      if (this.geminiClient) {
        return await this.generateWithGemini(agentDefinition, userMessage, conversationHistory);
      }

      // Fallback response if no AI service available
      return this.generateFallbackResponse(agentDefinition, userMessage);
    } catch (error) {
      console.error('❌ Error generating agent response:', error);
      return this.generateFallbackResponse(agentDefinition, userMessage);
    }
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
        messageLength: userMessage.length
      });

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      return {
        content: text.trim(),
        agentId: agentDefinition.agent?.id || 'unknown-agent',
        agentName: agentDefinition.agent?.name || 'AI Agent',
        provider: 'gemini'
      };
    } catch (error) {
      console.error('❌ Gemini generation error:', error);
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
   * Check if AI service is available and working
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (this.geminiClient) {
        // Simple test with Gemini
        const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent('Hello, respond with just "OK"');
        const response = await result.response;
        const text = response.text();
        
        return {
          status: 'healthy',
          provider: 'gemini',
          response: text.trim()
        };
      }

      return {
        status: 'no-provider',
        message: 'No AI provider available'
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;