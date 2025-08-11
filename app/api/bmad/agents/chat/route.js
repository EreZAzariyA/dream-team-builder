import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import User from '@/lib/database/models/User';

// Import BMAD system components for agent chat
const { AgentLoader } = require('@/lib/bmad/AgentLoader.js');
const { ChatAgentExecutor } = require('@/lib/bmad/ChatAgentExecutor.js');
const { ConfigurationManager } = require('@/lib/bmad/core/ConfigurationManager.js');
const { PusherService } = require('@/lib/bmad/orchestration/PusherService.js');
import AgentChat from '@/lib/database/models/AgentChat';

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
 * - No workflow overhead
 * - Pure agent-to-user interaction
 */

// Chat session storage (in production, this would be in Redis or database)


export async function POST(request) {
  try {
    const { agentId, message, conversationId, action = 'send' } = await request.json();

    // Validate required fields
    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: agentId',
        usage: 'Send { agentId: "pm", message: "Hello", conversationId?: "conv_123", action?: "send" }'
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

    // Load user and their API keys
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        message: 'User session is invalid'
      }, { status: 404 });
    }

    // Get user's API keys and determine mode
    const hasApiKeys = user.hasApiKeys();
    const mockMode = !hasApiKeys || process.env.BMAD_MOCK_MODE === 'true';
    const userApiKeys = user.getApiKeys();

    // Load agent - optimize by checking if we already have it in session for 'send' actions
    let agent = null;
    
    if (action === 'send' && conversationId) {
      // For send actions, try to get agent from existing chat session first
      const existingSession = await AgentChat.findOne({ chatId: conversationId });
      if (existingSession && existingSession.agentId === agentId) {
        // Create agent object from cached session data
        agent = {
          id: existingSession.agentId,
          agent: {
            name: existingSession.agentName,
            title: existingSession.agentTitle,
            icon: existingSession.agentIcon
          },
          // Note: We don't cache full persona data, so we'll need to load for AI responses
          _fromCache: true
        };
      }
    }
    
    // Load agent from YAML if not cached or if we need full definition
    if (!agent || (action === 'send' && !mockMode)) {
      const agentLoader = new AgentLoader();
      await agentLoader.loadAllAgents();
      
      const loadedAgent = await agentLoader.loadAgent(agentId);
      if (!loadedAgent) {
        return NextResponse.json({
          success: false,
          error: `Agent '${agentId}' not found`,
          availableAgents: agentLoader.getAllAgentsMetadata().map(a => a.id)
        }, { status: 404 });
      }
      
      agent = loadedAgent;
    }

    // Handle different chat actions
    switch (action) {
      case 'start':
        return handleChatStart(user, agent, conversationId, mockMode, userApiKeys);
      
      case 'send':
        if (!message) {
          return NextResponse.json({
            success: false,
            error: 'Message is required for send action'
          }, { status: 400 });
        }
        return handleChatMessage(user, agent, message, conversationId, mockMode, userApiKeys);
      
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
 * Start a new chat session with an agent
 */
async function handleChatStart(user, agent, conversationId, mockMode, userApiKeys) {
  const chatId = conversationId || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Create database chat session
  const chatSession = new AgentChat({
    chatId,
    userId: user._id,
    userName: user.profile?.name || user.email.split('@')[0],
    userEmail: user.email,
    agentId: agent.id,
    agentName: agent.agent?.name || agent.id,
    agentTitle: agent.agent?.title || 'AI Agent',
    agentIcon: agent.agent?.icon || '🤖',
    status: 'active',
    mockMode,
    messages: []
  });

  // Create agent greeting based on persona
  const greeting = generateAgentGreeting(agent);
  
  // Add greeting to session
  const greetingMessage = {
    id: `msg_${Date.now()}`,
    from: agent.id,
    fromName: agent.agent?.name || agent.id,
    to: 'user',
    toName: user.profile?.name || user.email.split('@')[0],
    content: greeting,
    timestamp: new Date(),
    type: 'greeting'
  };

  // Add to database
  await chatSession.addMessage(greetingMessage);
  await chatSession.save();

  // Trigger real-time update via Pusher
  try {
    const pusherService = new PusherService();
    await pusherService.trigger(chatId, 'chat:started', {
      chatId,
      agent: {
        id: agent.id,
        name: agent.agent?.name || agent.id,
        title: agent.agent?.title || 'AI Agent',
        icon: agent.agent?.icon || '🤖'
      },
      message: greetingMessage
    });
  } catch (error) {
    console.error('Pusher trigger failed in handleChatStart:', error);
  }

  return NextResponse.json({
    success: true,
    action: 'start',
    chatId,
    agent: {
      id: agent.id,
      name: agent.agent?.name || agent.id,
      title: agent.agent?.title || 'AI Agent',
      icon: agent.agent?.icon || '🤖',
      persona: agent.persona
    },
    greeting: greetingMessage,
    sessionCreated: true,
    mockMode
  });
}

/**
 * Send a message in an existing chat session
 */
async function handleChatMessage(user, agent, message, conversationId, mockMode, userApiKeys) {
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

  // Execute agent response
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
    action: 'send',
    chatId: conversationId,
    userMessage,
    agentResponse: responseMessage,
    messageCount: chatSession.messages.length,
    mockMode
  });
}

/**
 * Get chat history for a conversation
 */
async function handleChatHistory(user, agent, conversationId) {
  if (!conversationId) {
    return NextResponse.json({
      success: false,
      error: 'conversationId required for history'
    }, { status: 400 });
  }

  const chatSession = await AgentChat.findOne({ chatId: conversationId });
  if (!chatSession) {
    return NextResponse.json({
      success: false,
      error: 'Chat session not found'
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    action: 'history',
    chatId: conversationId,
    agent: {
      id: agent.id,
      name: agent.agent?.name || agent.id,
      title: agent.agent?.title || 'AI Agent',
      icon: agent.agent?.icon || '🤖'
    },
    messages: chatSession.messages,
    startTime: chatSession.createdAt,
    messageCount: chatSession.messages.length,
    status: chatSession.status
  });
}

/**
 * End a chat session
 */
async function handleChatEnd(user, agent, conversationId) {
  if (!conversationId) {
    return NextResponse.json({
      success: false,
      error: 'conversationId required for ending chat'
    }, { status: 400 });
  }

  const chatSession = await AgentChat.findOne({ chatId: conversationId });
  if (chatSession) {
    chatSession.status = 'ended';
    chatSession.updatedAt = new Date();
    await chatSession.save();
  }

  // Trigger real-time update via Pusher
  try {
    const pusherService = new PusherService();
    await pusherService.trigger(conversationId, 'chat:ended', {
      chatId: conversationId,
      endTime: new Date()
    });
  } catch (error) {
    console.error('Pusher trigger failed in handleChatEnd:', error);
  }

  return NextResponse.json({
    success: true,
    action: 'end',
    chatId: conversationId,
    status: 'ended',
    endTime: new Date()
  });
}

/**
 * Generate persona-appropriate greeting for agent
 */
function generateAgentGreeting(agent) {
  const name = agent.agent?.name || agent.id;
  const title = agent.agent?.title || 'AI Agent';
  const icon = agent.agent?.icon || '🤖';
  // Style could be used for future greeting customization
  
  // Persona-based greetings
  const greetings = {
    pm: `Hello! I'm ${name} ${icon}, your ${title}. I'm here to help with product strategy, requirements gathering, and project planning. What product challenge can we tackle together?`,
    architect: `Greetings! I'm ${name} ${icon}, your ${title}. I specialize in system design and technical architecture. Whether you need to design a new system or optimize an existing one, I'm here to help. What are you building?`,
    dev: `Hey there! I'm ${name} ${icon}, your ${title}. Ready to dive into some code? I can help with implementation, debugging, best practices, or technical problem-solving. What are we working on?`,
    'ux-expert': `Hi! I'm ${name} ${icon}, your ${title}. I'm passionate about creating amazing user experiences. Let's talk about user research, interface design, or user journey optimization. What UX challenge are you facing?`,
    qa: `Hello! I'm ${name} ${icon}, your ${title}. Quality is my priority! I can help with testing strategies, quality assurance, and ensuring your software meets the highest standards. What do you need tested or reviewed?`,
    analyst: `Hello! I'm ${name} ${icon}, your ${title}. I love diving deep into data and uncovering insights. Whether you need market research, user analysis, or strategic recommendations, I'm here to help. What would you like to analyze?`,
    po: `Hi there! I'm ${name} ${icon}, your ${title}. I focus on maximizing product value and ensuring alignment between business goals and development. Need help with backlogs, user stories, or product strategy? I'm here for you!`,
    sm: `Hello! I'm ${name} ${icon}, your ${title}. I facilitate great teamwork and smooth project delivery. Need help with agile processes, team coordination, or removing blockers? Let's make it happen together!`
  };

  return greetings[agent.id] || `Hello! I'm ${name} ${icon}, your ${title}. I'm here to help with ${agent.persona?.focus || 'various tasks'}. How can I assist you today?`;
}

/**
 * Execute agent chat in mock mode using ChatAgentExecutor
 */
async function executeMockAgentChat(agent, context) {
  const startTime = Date.now();
  
  try {
    // Use ChatAgentExecutor for consistent mock behavior
    const { ChatAgentExecutor } = require('@/lib/bmad/ChatAgentExecutor.js');
    const configManager = new ConfigurationManager();
    await configManager.loadConfiguration();
    
    const chatExecutor = new ChatAgentExecutor(new AgentLoader(), null, configManager);
    const result = await chatExecutor.executeWithMock(agent, context);
    
    return {
      content: result.content,
      type: 'mock_response',
      executionTime: Date.now() - startTime,
      tokensUsed: 0,
      model: 'mock'
    };
  } catch (error) {
    console.warn('ChatAgentExecutor mock failed, using fallback:', error);
    
    // Fallback to simple mock responses
    const mockResponses = generateMockChatResponse(agent, context.userPrompt);
    const selectedResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    
    return {
      content: selectedResponse,
      type: 'mock_response',
      executionTime: Date.now() - startTime,
      tokensUsed: 0,
      model: 'mock'
    };
  }
}

/**
 * Execute agent chat with real AI using ChatAgentExecutor
 */
async function executeRealAgentChat(agent, context, userApiKeys) {
  // Initialize configuration and chat executor
  const configManager = new ConfigurationManager();
  await configManager.loadConfiguration();
  
  // Import AI service dynamically
  let aiService = null;
  try {
    const AIServiceModule = await import('@/lib/ai/AIService.js');
    aiService = AIServiceModule.default;
    
    // Update with user's API keys
    if (userApiKeys.openai || userApiKeys.gemini) {
      aiService.updateApiKeys({
        openai: userApiKeys.openai,
        gemini: userApiKeys.gemini
      });
    }
  } catch (error) {
    console.warn('Could not load AIService for chat:', error.message);
    throw new Error('AI service unavailable');
  }
  
  const chatExecutor = new ChatAgentExecutor(new AgentLoader(), aiService, configManager);

  // Execute agent in chat mode
  const result = await chatExecutor.executeChatAgent(agent, context);
  
  return {
    content: result.content || 'I processed your message.',
    type: 'ai_response',
    executionTime: result.executionTime || 0,
    tokensUsed: result.tokensUsed || 0,
    model: result.model || 'ai'
  };
}

/**
 * Generate mock chat responses based on agent persona
 */
function generateMockChatResponse(agent, userMessage) {
  const responses = {
    pm: [
      "That's an interesting product challenge! Let me think about the user needs and business impact here.",
      "From a product perspective, we should consider the user journey and success metrics for this feature.",
      "I'd like to understand the problem better. What's the core user pain point we're trying to solve?",
      "Let's break this down into requirements. What are the must-have vs nice-to-have features?"
    ],
    architect: [
      "From an architectural standpoint, we need to consider scalability and maintainability here.",
      "That's a great technical question! Let me think about the best design patterns for this.",
      "We should evaluate the trade-offs between different technical approaches.",
      "I'd recommend considering the system's long-term evolution and integration points."
    ],
    dev: [
      "That's a solid technical question! Let me walk you through a practical approach.",
      "I can help you implement that efficiently. Here's how I'd approach it...",
      "Good thinking! Let's consider the best practices and potential edge cases.",
      "That reminds me of a similar challenge I solved. Let me share some insights."
    ],
    'ux-expert': [
      "From a user experience perspective, we should focus on user needs and usability.",
      "That's a great UX question! User research would really help us here.",
      "Let's think about the user journey and potential friction points.",
      "Accessibility and inclusive design are important considerations for this feature."
    ]
  };

  const agentResponses = responses[agent.id] || [
    "That's a thoughtful question! Let me provide some insights from my perspective.",
    "I appreciate you bringing this up. Here's how I'd approach it...",
    "Interesting point! Let me share some relevant experience and recommendations.",
    "That's exactly the kind of challenge I enjoy working on. Here are my thoughts..."
  ];

  return agentResponses;
}

/**
 * GET endpoint - API documentation
 */
export async function GET() {
  return NextResponse.json({
    name: 'BMAD Agent Chat API',
    version: '1.0.0',
    description: 'Direct communication with BMAD agent personas without workflow overhead',
    
    endpoints: {
      POST: '/api/bmad/agents/chat'
    },
    
    actions: {
      start: {
        description: 'Start a new chat session with an agent',
        body: { agentId: 'required', conversationId: 'optional' },
        response: 'Chat session created with agent greeting'
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
      'chat:ended': 'Chat session terminated'
    }
  });
}