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


  // Execute agent via BMAD AgentExecutor (pure BMAD approach)
  let agentResponse;
  try {
    if (mockMode) {
      agentResponse = await executeMockAgentChat(agent, chatContext);
    } else {
      // Always use AgentExecutor - let agent handle everything per YAML
      agentResponse = await executeViaAgentExecutor(agent, message, chatContext, userApiKeys);
    }
  } catch (error) {
    console.error('Error executing agent:', error);
    agentResponse = {
      content: `I apologize, but I encountered an error while processing your message. Please try again.`,
      type: 'error_response'
    };
  }

  // Handle content that exceeds chat message limits
  let messageContent = agentResponse.content;
  let documentUrl = null;
  
  // If content is too long for chat, truncate it intelligently
  if (agentResponse.content && agentResponse.content.length > 4500) {
    let truncateAt = 4200; // Leave room for the truncation message
    
    // Try to find a good break point (end of paragraph, sentence, or section)
    const breakPoints = [
      agentResponse.content.lastIndexOf('\n\n', truncateAt),
      agentResponse.content.lastIndexOf('. ', truncateAt),
      agentResponse.content.lastIndexOf('.\n', truncateAt),
      agentResponse.content.lastIndexOf('---', truncateAt)
    ];
    
    const bestBreak = Math.max(...breakPoints.filter(pos => pos > 3000)); // Ensure we don't truncate too early
    if (bestBreak > 0) {
      truncateAt = bestBreak + (agentResponse.content[bestBreak] === '.' ? 1 : 0);
    }
    
    messageContent = agentResponse.content.substring(0, truncateAt) + 
      '\n\n--- Message truncated due to length ---\n' +
      '💡 **Tip:** For creating documents, use agent commands like `*create-architecture` or `*help` to see available commands.';
  }

  // Add agent response to session
  const responseMessage = {
    id: `msg_${Date.now() + 1}`,
    from: agent.id,
    fromName: agent.agent?.name || agent.id,
    to: 'user',
    toName: user.profile?.name || user.email.split('@')[0],
    content: messageContent,
    timestamp: new Date(),
    type: 'agent_response',
    metadata: {
      executionTime: agentResponse.executionTime || 0,
      tokensUsed: agentResponse.tokensUsed || 0,
      model: agentResponse.model || (mockMode ? 'mock' : 'ai'),
      fullDocumentUrl: documentUrl,
      originalLength: agentResponse.content.length,
      contentType: 'markdown',
      hasDocument: !!documentUrl
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
  
  // In mock mode, indicate that AI is not available but keep response minimal
  return {
    content: `[Mock mode - AI service not available. Agent ${agent.agent?.name || agent.id} would respond here based on their expertise in ${agent.persona?.focus || 'this area'}.]`,
    executionTime: Math.floor(1000 + Math.random() * 2000),
    tokensUsed: 0,
    model: 'mock'
  };
}

// Singleton instances to prevent memory leaks
let sharedAgentLoader = null;
let sharedAgentExecutor = null;

/**
 * Execute via AgentExecutor for actual BMAD workflow
 */
async function executeViaAgentExecutor(agent, message, chatContext, userApiKeys) {
  try {
    const { AgentExecutor } = require('@/lib/bmad/AgentExecutor/index.js');
    const { AgentLoader } = require('@/lib/bmad/AgentLoader.js');
    
    const workflowContext = {
      userPrompt: message,
      userId: chatContext.userId,
      userName: chatContext.userName,
      chatMode: true
    };
    
    // Reuse singleton AgentLoader to prevent memory leaks
    if (!sharedAgentLoader) {
      sharedAgentLoader = new AgentLoader();
      await sharedAgentLoader.loadAllAgents();
    }
    
    const { aiService } = await import('@/lib/ai/AIService.js');
    if (!aiService.initialized && userApiKeys) {
      await aiService.initialize(userApiKeys, chatContext.userId);
    }
    
    // Reuse singleton AgentExecutor to prevent memory leaks
    if (!sharedAgentExecutor) {
      sharedAgentExecutor = new AgentExecutor(sharedAgentLoader, aiService);
    }
    
    const result = await sharedAgentExecutor.executeAgent(agent, workflowContext);
    
    // Cleanup caches to prevent memory leaks
    sharedAgentExecutor.cleanupCaches();
    
    return {
      content: result.content || 'Workflow executed successfully!',
      executionTime: result.executionTime || 0,
      tokensUsed: result.tokensUsed || 0,
      model: 'workflow',
      documentUrl: result.documentUrl || null,
      hasDocument: !!result.documentUrl
    };
    
  } catch (error) {
    return {
      content: `Workflow execution failed: ${error.message}`,
      type: 'error_response'
    };
  }
}