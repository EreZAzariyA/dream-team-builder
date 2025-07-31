/**
 * Pusher Message Sending API Route
 * Handles server-side message broadcasting via Pusher
 */

import { NextResponse } from 'next/server';
import { pusherServer, CHANNELS, EVENTS } from '../../../../lib/pusher/config';

export async function POST(request) {
  try {
    const { content, target, userId, timestamp } = await request.json();

    if (!content || !target) {
      return NextResponse.json(
        { error: 'Content and target are required' },
        { status: 400 }
      );
    }

    // Determine channel and event based on target
    let channelName;
    let eventName;
    
    if (target.type === 'workflow') {
      channelName = CHANNELS.WORKFLOW(target.id);
      eventName = EVENTS.USER_MESSAGE;
    } else if (target.type === 'agent') {
      channelName = CHANNELS.AGENT(target.id);
      eventName = EVENTS.USER_MESSAGE;
    } else if (target.type === 'channel') {
      channelName = `channel-${target.id}`;
      eventName = 'user-message';
    } else {
      channelName = CHANNELS.GLOBAL;
      eventName = EVENTS.USER_MESSAGE;
    }

    // Prepare message data
    const messageData = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      userId,
      timestamp: timestamp || new Date().toISOString(),
      target,
    };

    // Send message via Pusher
    await pusherServer.trigger(channelName, eventName, messageData);

    // Simulate agent response (replace with actual BMAD integration)
    if (target.type === 'workflow') {
      setTimeout(async () => {
        const agentResponse = {
          id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content: `Agent received your message: "${content}". Processing...`,
          agentId: 'bmad-orchestrator',
          userId: 'system',
          timestamp: new Date().toISOString(),
          workflowId: target.id,
        };

        await pusherServer.trigger(
          channelName,
          EVENTS.AGENT_MESSAGE,
          agentResponse
        );
      }, 1000);
    }

    return NextResponse.json({
      success: true,
      messageId: messageData.id,
      channel: channelName,
      event: eventName,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}