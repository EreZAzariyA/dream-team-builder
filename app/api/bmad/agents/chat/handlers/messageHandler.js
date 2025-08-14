import { NextResponse } from 'next/server';
import AgentChat from '@/lib/database/models/AgentChat';

const { AgentLoader } = require('@/lib/bmad/AgentLoader.js');
const { PusherService } = require('@/lib/bmad/orchestration/PusherService.js');

/**
 * Send a message in an existing chat session
 */
export async function handleChatMessage(user, agent, message, conversationId, mockMode, userApiKeys) {
  if (!conversationId) {
    return NextResponse.json({
      success: false,
      error: 'conversationId required for sending messages',
      suggestion: 'Start a chat session first with action: "start"'
    }, { status: 400 });
  }

  const chatSession = await AgentChat.findOne({ chatId: conversationId });
  if (!chatSession) {
    return NextResponse.json({
      success: false,
      error: 'Chat session not found'
    }, { status: 404 });
  }

  // Add user message to session
  const userMessage = {
    id: `msg_${Date.now()}`,
    from: 'user',
    fromName: user.profile?.name || user.email.split('@')[0],
    to: agent.id,
    toName: agent.agent?.name || agent.id,
    content: message,
    timestamp: new Date(),
    type: 'user_message'
  };
  
  // Note: If agent was loaded from cache, we have basic info but may need full definition for AI
  if (agent._fromCache) {
    // Load full agent definition for proper mock/AI processing
    const agentLoader = new AgentLoader();
    await agentLoader.loadAllAgents();
    const fullAgent = await agentLoader.loadAgent(agent.id);
    if (fullAgent) {
      agent = fullAgent;
    } else {
      console.error(`Failed to reload agent ${agent.id}`);
    }
  }

  await chatSession.addMessage(userMessage);

  // Prepare context for agent execution
  const chatContext = {
    conversationId,
    chatHistory: chatSession.messages.slice(-10), // Last 10 messages for context
    userPrompt: message,
    userId: user._id.toString(),
    userName: user.profile?.name || user.email.split('@')[0],
    mockMode,
    chatMode: true, // Important: This tells the agent it's in chat mode
    elicitationEnabled: false, // Disable formal elicitation in chat mode
    interactiveMode: true
  };


  // Execute agent response (regular)
  let agentResponse;
  try {
    if (mockMode) {
      agentResponse = await executeMockAgentChat(agent, chatContext);
    } else {
      agentResponse = await executeRealAgentChat(agent, chatContext, userApiKeys);
    }
  } catch (error) {
    console.error('Error executing agent chat:', error);
    agentResponse = {
      content: `I apologize, but I encountered an error while processing your message. Please try again.`,
      type: 'error_response'
    };
  }

  // Add agent response to session
  const responseMessage = {
    id: `msg_${Date.now() + 1}`,
    from: agent.id,
    fromName: agent.agent?.name || agent.id,
    to: 'user',
    toName: user.profile?.name || user.email.split('@')[0],
    content: agentResponse.content,
    timestamp: new Date(),
    type: 'agent_response',
    metadata: {
      executionTime: agentResponse.executionTime || 0,
      tokensUsed: agentResponse.tokensUsed || 0,
      model: agentResponse.model || (mockMode ? 'mock' : 'ai')
    }
  };

  await chatSession.addMessage(responseMessage);

  // Trigger real-time update via Pusher
  try {
    const pusherService = new PusherService();
    await pusherService.trigger(conversationId, 'chat:message', {
      chatId: conversationId,
      userMessage,
      agentResponse: responseMessage
    });
  } catch (error) {
    console.error('Pusher trigger failed in handleChatMessage:', error);
  }

  return NextResponse.json({
    success: true,
    userMessage,
    agentResponse: responseMessage,
    conversationId,
    agent: {
      id: agent.id,
      name: agent.agent?.name || agent.id,
      title: agent.agent?.title || 'AI Agent',
      icon: agent.agent?.icon || '🤖'
    }
  });
}

/**
 * Execute mock agent chat (for testing/demo)
 */
async function executeMockAgentChat(agent, chatContext) {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  const responses = [
    `Thanks for your message! As ${agent.agent?.name || agent.id}, I'm here to help you with ${agent.persona?.focus || 'your needs'}.`,
    `I understand your request. Let me think about the best approach based on my expertise in ${agent.persona?.role || 'this area'}.`,
    `That's an interesting point. From my perspective as ${agent.agent?.title || 'an AI assistant'}, I would suggest...`,
    `Great question! Based on my experience, I can help you with that. Let me break it down...`
  ];
  
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  
  return {
    content: randomResponse,
    executionTime: Math.floor(1000 + Math.random() * 2000),
    tokensUsed: Math.floor(50 + Math.random() * 200),
    model: 'mock'
  };
}

/**
 * Execute real agent chat using AI
 */
async function executeRealAgentChat(agent, chatContext, userApiKeys) {
  const startTime = Date.now();
  
  try {
    // Import AI service dynamically to avoid circular dependencies
    const { aiService } = await import('@/lib/ai/AIService.js');
    
    // Initialize AI service with user API keys if needed
    if (!aiService.initialized && userApiKeys) {
      await aiService.initialize(userApiKeys, chatContext.userId);
    }
    
    // Build agent prompt
    const persona = agent.persona || {};
    const agentInfo = agent.agent || {};
    
    let prompt = '';
    
    // Add agent identity and role
    if (persona.identity) {
      prompt += `Identity: ${persona.identity}\n\n`;
    }
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
    
    // Add conversation history
    if (chatContext.chatHistory && chatContext.chatHistory.length > 0) {
      prompt += 'Recent conversation:\n';
      chatContext.chatHistory.slice(-5).forEach(msg => {
        const role = msg.from === 'user' ? 'User' : 'Assistant';
        prompt += `${role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }
    
    // Add current user message
    prompt += `User: ${chatContext.userPrompt}\n\nRespond as ${agentInfo.name || 'the assistant'} with your expertise and personality. Be helpful, engaging, and stay in character:`;
    
    // Call AI service
    const response = await aiService.call(prompt, agent, 1, chatContext, chatContext.userId);
    
    const executionTime = Date.now() - startTime;
    
    return {
      content: response.content,
      executionTime,
      tokensUsed: response.usage?.total_tokens || response.usage?.totalTokens || 0,
      model: response.provider || 'ai'
    };
    
  } catch (error) {
    console.error('Real agent chat execution failed:', error);
    
    const executionTime = Date.now() - startTime;
    
    return {
      content: `I apologize, but I'm experiencing technical difficulties. Please ensure your AI provider keys are configured properly and try again.`,
      executionTime,
      tokensUsed: 0,
      model: 'error',
      error: error.message
    };
  }
}