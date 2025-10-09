import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import User from '@/lib/database/models/User.js';

// Import agent loader for file-based agents
import { AgentLoader } from '@/lib/bmad/AgentLoader.js';

// Import modular handlers
import { handleChatStart, handleChatHistory, handleChatEnd } from './handlers/initializationHandler.js';
import { handleChatMessage } from './handlers/messageHandler.js';

/**
 * BMAD Agent Chat API
 * 
 * Enables direct communication with agent personas without workflow context.
 * This is a standalone chat system for conversational interaction with agents.
 * 
 * Features:
 * - Direct agent persona communication
 * - Conversation state management
 * - Real-time messaging via Pusher
 * - Streaming responses with AI SDK
 * - No workflow overhead
 * - Pure agent-to-user interaction
 */

export async function POST(request) {
  try {
    const { agentId, message, conversationId, action = 'send', streaming = false, mockMode = false } = await request.json();

    // Validate required fields
    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: agentId',
        usage: 'Send { agentId: "pm", message: "Hello", conversationId?: "conv_123", action?: "send", streaming?: false }'
      }, { status: 400 });
    }

    // Get authenticated user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        message: 'Please log in to chat with agents'
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
    

    // Load agent from file system using AgentLoader
    let agent;
    try {
      const agentLoader = new AgentLoader();
      await agentLoader.loadAllAgents();
      
      const loadedAgent = await agentLoader.loadAgent(agentId);
      
      if (!loadedAgent) {
        // Get available agents for error message
        const availableAgents = agentLoader.getAllAgentsMetadata();
        return NextResponse.json({
          success: false,
          error: `Agent '${agentId}' not found`,
          availableAgents: availableAgents.map(a => a.id)
        }, { status: 404 });
      }
      
      // Agent is already in the correct format from AgentLoader
      agent = loadedAgent;
      
    } catch (error) {
      console.error(`Failed to load agent ${agentId} from files:`, error);
      return NextResponse.json({
        success: false,
        error: `Failed to load agent '${agentId}'`,
        message: error.message
      }, { status: 500 });
    }

    // Handle different chat actions
    switch (action) {
      case 'start':
        return handleChatStart(user, agent, conversationId, userApiKeys, mockMode);
      
      case 'send':
        if (!message) {
          return NextResponse.json({
            success: false,
            error: 'Message is required for send action'
          }, { status: 400 });
        }
        return handleChatMessage(user, agent, message, conversationId, userApiKeys, { streaming });
      
      case 'history':
        return handleChatHistory(user, agent, conversationId);
      
      case 'end':
        return handleChatEnd(user, agent, conversationId);
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
          availableActions: ['start', 'send', 'history', 'end']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ BMAD agent chat error:', error);
    return NextResponse.json({
      success: false,
      error: 'Chat request failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
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

/**
 * GET handler for API documentation and health check
 */
export async function GET() {
  return NextResponse.json({
    service: 'BMAD Agent Chat API',
    version: '2.0.0',
    description: 'Real-time conversational interface with AI agents',
    
    endpoints: {
      POST: {
        description: 'Interact with agents',
        streaming: 'Add x-stream: true header for real-time responses'
      }
    },

    actions: {
      start: {
        description: 'Start a new chat session with an agent',
        body: { agentId: 'required', conversationId: 'optional' },
        response: 'Chat session details and greeting'
      },
      send: {
        description: 'Send a message to an agent in an existing chat',
        body: { agentId: 'required', message: 'required', conversationId: 'required' },
        response: 'User message and agent response'
      },
      history: {
        description: 'Get chat history for a conversation',
        body: { agentId: 'required', conversationId: 'required' },
        response: 'Complete message history'
      },
      end: {
        description: 'End a chat session',
        body: { agentId: 'required', conversationId: 'required' },
        response: 'Session ended confirmation'
      }
    },

    availableAgents: [
      'pm - Product Manager',
      'architect - System Architect', 
      'dev - Full Stack Developer',
      'ux-expert - UX/UI Expert',
      'qa - Quality Assurance',
      'analyst - Business Analyst',
      'po - Product Owner',
      'sm - Scrum Master'
    ],

    features: [
      'Direct agent persona communication',
      'Real-time messaging via Pusher',
      'Conversation state management', 
      'Mock mode for testing',
      'Chat history tracking',
      'Persona-appropriate responses'
    ],

    realTimeEvents: {
      'chat:started': 'New chat session initiated',
      'chat:message': 'New message exchanged',
      'chat:message_complete': 'Streaming message completed',
      'chat:ended': 'Chat session terminated'
    }
  });
}