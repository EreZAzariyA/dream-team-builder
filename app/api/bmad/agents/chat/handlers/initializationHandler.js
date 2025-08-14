import { NextResponse } from 'next/server';
import AgentChat from '@/lib/database/models/AgentChat';
import { generateAIAgentGreeting } from './greetingGenerator.js';

const { PusherService } = require('@/lib/bmad/orchestration/PusherService.js');

/**
 * Start a new chat session with an agent
 */
export async function handleChatStart(user, agent, conversationId, mockMode, userApiKeys) {
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
      mockMode,
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
    mockMode,
    messages: []
  });

  // Generate AI-powered greeting based on agent persona
  const greeting = await generateAIAgentGreeting(agent, user, mockMode, userApiKeys);
  
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