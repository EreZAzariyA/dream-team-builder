import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import User from '@/lib/database/models/User.js';
import AgentChat from '@/lib/database/models/AgentChat.js';

const { AgentLoader } = require('@/lib/bmad/AgentLoader.js');
const { PusherService } = require('@/lib/bmad/orchestration/PusherService.js');

/**
 * BMAD Agent Chat Streaming API
 * 
 * Provides real-time streaming responses from agents
 * Uses Server-Sent Events (SSE) for streaming
 */

export async function POST(request) {
  try {
    const { agentId, message, conversationId } = await request.json();

    // Validate required fields
    if (!agentId || !message || !conversationId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: agentId, message, conversationId'
      }, { status: 400 });
    }

    // Get authenticated user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Load user data and API keys
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    const userApiKeys = user.getApiKeys();
    const mockMode = !userApiKeys.openai && !userApiKeys.gemini;

    // Load agent configuration
    let agent;
    try {
      const agentLoader = new AgentLoader();
      await agentLoader.loadAllAgents();
      const loadedAgent = await agentLoader.loadAgent(agentId);
      
      if (!loadedAgent) {
        return NextResponse.json({
          success: false,
          error: `Agent '${agentId}' not found`
        }, { status: 404 });
      }
      
      agent = loadedAgent;
    } catch (error) {
      console.error(`Failed to load agent ${agentId}:`, error);
      return NextResponse.json({
        success: false,
        error: `Failed to load agent '${agentId}'`
      }, { status: 500 });
    }

    // Verify chat session exists
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

    await chatSession.addMessage(userMessage);

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send user message confirmation
          controller.enqueue(`data: ${JSON.stringify({
            type: 'user_message',
            message: userMessage
          })}\n\n`);

          if (mockMode) {
            // Mock streaming response
            await streamMockResponse(controller, agent);
          } else {
            // Real AI streaming response
            await streamAIResponse(controller, agent, message, user, userApiKeys, conversationId);
          }

          // Send completion signal
          controller.enqueue(`data: ${JSON.stringify({
            type: 'stream_complete'
          })}\n\n`);

          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(`data: ${JSON.stringify({
            type: 'error',
            error: error.message
          })}\n\n`);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('❌ BMAD agent chat streaming error:', error);
    return NextResponse.json({
      success: false,
      error: 'Streaming request failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Stream mock response for testing
 */
async function streamMockResponse(controller, agent) {
  const mockResponse = `[Mock mode - AI service not available. Agent ${agent.agent?.name || agent.id} would respond here based on their expertise in ${agent.persona?.focus || 'this area'}.]`;
  
  // Simulate streaming by sending chunks
  const chunks = mockResponse.split(' ');
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] + (i < chunks.length - 1 ? ' ' : '');
    controller.enqueue(`data: ${JSON.stringify({
      type: 'content_chunk',
      chunk,
      isComplete: false
    })}\n\n`);
    
    // Add delay to simulate real streaming
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  }

  // Send completion
  controller.enqueue(`data: ${JSON.stringify({
    type: 'content_chunk',
    chunk: '',
    isComplete: true
  })}\n\n`);
}

/**
 * Stream real AI response
 */
async function streamAIResponse(controller, agent, message, user, userApiKeys, conversationId) {
  try {
    const { aiService } = await import('@/lib/ai/AIService.js');
    
    // Initialize AI service if needed
    if (!aiService.initialized && userApiKeys) {
      await aiService.initialize(userApiKeys, user._id.toString());
    }

    if (!aiService.supportsStreaming()) {
      throw new Error('Streaming not supported');
    }

    // Prepare context for agent execution
    const chatContext = {
      conversationId,
      chatHistory: [], // Will be loaded from session
      userPrompt: message,
      userId: user._id.toString(),
      userName: user.profile?.name || user.email.split('@')[0],
      mockMode: false,
      chatMode: true,
      elicitationEnabled: false,
      interactiveMode: true
    };

    // Execute agent with streaming
    const result = await aiService.streamResponse(
      message,
      agent,
      1, // complexity
      chatContext,
      user._id.toString(),
      { 
        provider: userApiKeys.openai ? 'openai' : 'gemini',
        maxTokens: 4000,
        temperature: 0.7
      }
    );

    if (result && result.textStream) {
      // Stream the response
      for await (const chunk of result.textStream) {
        controller.enqueue(`data: ${JSON.stringify({
          type: 'content_chunk',
          chunk,
          isComplete: false
        })}\n\n`);
      }

      // Send completion
      controller.enqueue(`data: ${JSON.stringify({
        type: 'content_chunk',
        chunk: '',
        isComplete: true
      })}\n\n`);
    } else if (result && result.content) {
      // Fallback: simulate streaming with non-streaming response
      const content = result.content;
      const chunks = content.split(' ');
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i] + (i < chunks.length - 1 ? ' ' : '');
        controller.enqueue(`data: ${JSON.stringify({
          type: 'content_chunk',
          chunk,
          isComplete: false
        })}\n\n`);
        
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Send completion
      controller.enqueue(`data: ${JSON.stringify({
        type: 'content_chunk',
        chunk: '',
        isComplete: true
      })}\n\n`);
    } else {
      throw new Error('No streaming or regular response received');
    }

  } catch (error) {
    console.error('AI streaming error:', error);
    throw error;
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
