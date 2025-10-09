import { NextResponse } from 'next/server';
import AgentChat from '@/lib/database/models/AgentChat.js';

const { AgentLoader } = require('@/lib/bmad/AgentLoader.js');
const { PusherService } = require('@/lib/bmad/orchestration/PusherService.js');

/**
 * Send a message in an existing chat session
 */
export async function handleChatMessage(user, agent, message, conversationId, userApiKeys, options = {}) {
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
    chatMode: true, // Important: This tells the agent it's in chat mode
    elicitationEnabled: false, // Disable formal elicitation in chat mode
    interactiveMode: true
  };

  // Check if streaming is requested
  if (options.streaming) {
    // Return streaming response
    return handleStreamingResponse(agent, message, chatContext, userApiKeys);
  }

  // Execute agent via BMAD AgentExecutor (pure BMAD approach)
  let agentResponse;
  try {
    // Always use AgentExecutor - let agent handle everything per YAML
    agentResponse = await executeViaAgentExecutor(agent, message, chatContext, userApiKeys);
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
  const contentString = typeof agentResponse.content === 'string' ? 
    agentResponse.content : 
    JSON.stringify(agentResponse.content || '');
    
  if (contentString && contentString.length > 4500) {
    let truncateAt = 4200; // Leave room for the truncation message
    
    // Try to find a good break point (end of paragraph, sentence, or section)
    const breakPoints = [
      contentString.lastIndexOf('\n\n', truncateAt),
      contentString.lastIndexOf('. ', truncateAt),
      contentString.lastIndexOf('.\n', truncateAt),
      contentString.lastIndexOf('---', truncateAt)
    ];
    
    const bestBreak = Math.max(...breakPoints.filter(pos => pos > 3000)); // Ensure we don't truncate too early
    if (bestBreak > 0) {
      truncateAt = bestBreak + (contentString[bestBreak] === '.' ? 1 : 0);
    }
    
    messageContent = contentString.substring(0, truncateAt) + 
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
      model: agentResponse.model || 'ai',
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


// Singleton instances to prevent memory leaks
let sharedAgentLoader = null;
let sharedAgentExecutor = null;

/**
 * Execute via AgentExecutor for standalone agent chat
 */
async function executeViaAgentExecutor(agent, message, chatContext, userApiKeys) {
  try {
    const { SimplifiedAgentExecutor } = require('@/lib/bmad/SimplifiedAgentExecutor.js');
    const { AgentLoader } = require('@/lib/bmad/AgentLoader.js');
    
    // Simple chat context - no GitHub/workflow integration
    const workflowContext = {
      userPrompt: message,
      userId: chatContext.userId,
      userName: chatContext.userName,
      chatMode: true,
      elicitationEnabled: false,
      interactiveMode: true
    };
    
    console.log(`💬 [CHAT] Agent ${agent.id} responding in standalone chat mode`);
    
    // Reuse singleton AgentLoader to prevent memory leaks
    if (!sharedAgentLoader) {
      sharedAgentLoader = new AgentLoader();
      await sharedAgentLoader.loadAllAgents();
    }
    
          const { aiService } = await import('@/lib/ai/AIService.js');
    if (!aiService.initialized && userApiKeys) {
      await aiService.initialize(userApiKeys, chatContext.userId);
    }
    
    // Reuse singleton SimplifiedAgentExecutor to prevent memory leaks
    if (!sharedAgentExecutor) {
      sharedAgentExecutor = new SimplifiedAgentExecutor({
        agentLoader: sharedAgentLoader,
        aiService: aiService
      });
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

/**
 * Handle streaming response for real-time chat
 */
async function handleStreamingResponse(agent, message, chatContext, userApiKeys) {
  try {
    // Use the streaming endpoint
    const { aiService } = await import('@/lib/ai/AIService.js');
      
      if (!aiService.initialized && userApiKeys) {
        await aiService.initialize(userApiKeys, chatContext.userId);
      }

      if (!aiService.supportsStreaming()) {
        throw new Error('Streaming not supported');
      }

      const result = await aiService.streamResponse(
        message,
        agent,
        1, // complexity
        chatContext,
        chatContext.userId,
        { 
          provider: userApiKeys.openai ? 'openai' : 'gemini',
          maxTokens: 4000,
          temperature: 0.7
        }
      );

      if (result && result.textStream) {
        return new Response(
          new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of result.textStream) {
                  controller.enqueue(`data: ${JSON.stringify({
                    type: 'content_chunk',
                    chunk,
                    isComplete: false
                  })}\n\n`);
                }
                
                controller.enqueue(`data: ${JSON.stringify({
                  type: 'content_chunk',
                  chunk: '',
                  isComplete: true
                })}\n\n`);
                
                controller.close();
              } catch (error) {
                controller.enqueue(`data: ${JSON.stringify({
                  type: 'error',
                  error: error.message
                })}\n\n`);
                controller.close();
              }
            }
          }),
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            }
          }
        );
    } else {
      throw new Error('No streaming response received');
    }
  } catch (error) {
    console.error('Streaming response error:', error);
    return new Response(
      `data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      }
    );
  }
}