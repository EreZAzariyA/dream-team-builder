import { NextResponse } from 'next/server';
import AgentChat from '@/lib/database/models/AgentChat.js';

const { PusherService } = require('@/lib/bmad/orchestration/PusherService.js');

/**
 * Start a new chat session with an agent
 */
export async function handleChatStart(user, agent, conversationId, userApiKeys) {
  const chatId = conversationId || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Check if chat session already exists (for streaming initialization)
  let chatSession = await AgentChat.findOne({ chatId });
  
  if (chatSession) {
    // Return existing session instead of creating duplicate
    console.log('🔄 Returning existing chat session:', chatId);
    const existingGreeting = chatSession.messages.find(msg => msg.type === 'greeting');
    
    return NextResponse.json({
      success: true,
      chatId,
      agent: {
        id: agent.id,
        name: agent.agent?.name || agent.id,
        title: agent.agent?.title || 'AI Agent',
        icon: agent.agent?.icon || '🤖'
      },
      greeting: existingGreeting || { content: 'Hello! How can I help you today?' },
      conversationId: chatId
    });
  }
  
  // Create new database chat session
  chatSession = new AgentChat({
    chatId,
    userId: user._id,
    userName: user.profile?.name || user.email.split('@')[0],
    userEmail: user.email,
    agentId: agent.id,
    agentName: agent.agent?.name || agent.id,
    agentTitle: agent.agent?.title || 'AI Agent',
    agentIcon: agent.agent?.icon || '🤖',
    status: 'active',
    messages: []
  });

  // Let agent handle greeting naturally according to their YAML activation instructions
  const greeting = await executeAgentGreeting(agent, user, mockMode, userApiKeys);
  
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
      greeting: greetingMessage,
      user: {
        name: user.profile?.name || user.email.split('@')[0],
        id: user._id.toString()
      }
    });
  } catch (error) {
    console.error('Pusher trigger failed in handleChatStart:', error);
  }

  return NextResponse.json({
    success: true,
    chatId,
    agent: {
      id: agent.id,
      name: agent.agent?.name || agent.id,
      title: agent.agent?.title || 'AI Agent',
      icon: agent.agent?.icon || '🤖'
    },
    greeting: greetingMessage,
    mockMode,
    conversationId: chatId
  });
}

/**
 * Get chat history for a conversation
 */
export async function handleChatHistory(user, agent, conversationId) {
  if (!conversationId) {
    return NextResponse.json({
      success: false,
      error: 'conversationId required for loading chat history'
    }, { status: 400 });
  }

  const chatSession = await AgentChat.findOne({ 
    chatId: conversationId,
    userId: user._id 
  });
  
  if (!chatSession) {
    return NextResponse.json({
      success: false,
      error: 'Chat session not found or access denied'
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    conversationId,
    agent: {
      id: chatSession.agentId,
      name: chatSession.agentName,
      title: chatSession.agentTitle,
      icon: chatSession.agentIcon
    },
    messages: chatSession.messages,
    status: chatSession.status,
    createdAt: chatSession.createdAt,
    updatedAt: chatSession.updatedAt
  });
}

/**
 * End a chat session
 */
export async function handleChatEnd(user, agent, conversationId) {
  if (!conversationId) {
    return NextResponse.json({
      success: false,
      error: 'conversationId required for ending chat'
    }, { status: 400 });
  }

  const chatSession = await AgentChat.findOne({ 
    chatId: conversationId,
    userId: user._id 
  });
  
  if (!chatSession) {
    return NextResponse.json({
      success: false,
      error: 'Chat session not found or access denied'
    }, { status: 404 });
  }

  // Update session status
  chatSession.status = 'ended';
  chatSession.endedAt = new Date();
  await chatSession.save();

  // Add end message
  const endMessage = {
    id: `msg_${Date.now()}`,
    from: 'system',
    fromName: 'System',
    to: 'user',
    toName: user.profile?.name || user.email.split('@')[0],
    content: `Chat session with ${chatSession.agentName} has been ended.`,
    timestamp: new Date(),
    type: 'system_message'
  };

  await chatSession.addMessage(endMessage);

  // Trigger real-time update via Pusher
  try {
    const pusherService = new PusherService();
    await pusherService.trigger(conversationId, 'chat:ended', {
      chatId: conversationId,
      endedAt: chatSession.endedAt,
      finalMessage: endMessage
    });
  } catch (error) {
    console.error('Pusher trigger failed in handleChatEnd:', error);
  }

  return NextResponse.json({
    success: true,
    conversationId,
    status: 'ended',
    endedAt: chatSession.endedAt,
    messageCount: chatSession.messages.length
  });
}

/**
 * Execute agent greeting naturally according to YAML activation instructions
 * Instead of hardcoded prompts, let agents follow their defined behavior
 */
async function executeAgentGreeting(agent, user, mockMode, userApiKeys) {
  const userName = user.profile?.name || user.email.split('@')[0];
  
  if (mockMode) {
    // Simple mock greeting that doesn't override agent behavior
    return `Hello ${userName}! I'm ${agent.agent?.name || agent.id} ${agent.agent?.icon || '🤖'}, your ${agent.agent?.title || 'AI assistant'}. How can I help you today?`;
  }

  try {
    // Import AI service dynamically
          const { aiService } = await import('@/lib/ai/AIService.js');
    
    // Initialize AI service with user API keys if needed
    if (!aiService.initialized && userApiKeys) {
      await aiService.initialize(userApiKeys, user._id.toString());
    }

    // Let the agent execute their natural activation instructions
    // STEP 3 in YAML: "Greet user with your name/role and mention `*help` command"
    const activationContext = {
      action: 'activate',
      userName: userName,
      isGreeting: true,
      chatMode: true
    };

    // Use the agent's markdown definition with activation instructions
    const agentMarkdown = agent.generateMarkdown ? agent.generateMarkdown() : 
      `# ${agent.id}\n\nactivation-instructions:\n${(agent.activationInstructions || []).map(inst => `- ${inst}`).join('\n')}\n\nagent:\n  name: ${agent.agent?.name}\n  title: ${agent.agent?.title}\n  icon: ${agent.agent?.icon}\n\npersona: ${JSON.stringify(agent.persona, null, 2)}`;

    const response = await aiService.call(agentMarkdown, agent, 1, activationContext, user._id.toString());
    
    if (response && response.content) {
      return response.content.trim();
    } else {
      // Fallback if AI fails
      return `Hello ${userName}! I'm ${agent.agent?.name || agent.id} ${agent.agent?.icon || '🤖'}, your ${agent.agent?.title || 'AI assistant'}. Type *help to see what I can do for you.`;
    }

  } catch (error) {
    console.error('Agent greeting execution failed:', error);
    // Fallback greeting
    return `Hello ${userName}! I'm ${agent.agent?.name || agent.id} ${agent.agent?.icon || '🤖'}, your ${agent.agent?.title || 'AI assistant'}. Type *help to see what I can do for you.`;
  }
}