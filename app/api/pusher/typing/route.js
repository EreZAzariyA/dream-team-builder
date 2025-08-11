/**
 * Pusher Typing Indicator API Route
 * Handles typing indicators via Pusher
 */

import { NextResponse } from 'next/server';
import { pusherServer, CHANNELS, EVENTS } from '../../../../lib/pusher/config';

export async function POST(request) {
  try {
    const { workflowId, userId, isTyping } = await request.json();

    if (!workflowId || !userId) {
      return NextResponse.json(
        { error: 'WorkflowId and userId are required' },
        { status: 400 }
      );
    }

    const channelName = CHANNELS.WORKFLOW(workflowId);
    const eventName = isTyping ? EVENTS.TYPING_START : EVENTS.TYPING_STOP;

    const typingData = {
      userId,
      workflowId,
      timestamp: new Date().toISOString(),
    };

    await pusherServer.trigger(channelName, eventName, typingData);

    logger.info(`✍️ Typing indicator sent: ${userId} ${isTyping ? 'started' : 'stopped'} typing`);

    return NextResponse.json({
      success: true,
      event: eventName,
      channel: channelName,
    });

  } catch (error) {
    logger.error('Error sending typing indicator:', error);
    return NextResponse.json(
      { error: 'Failed to send typing indicator' },
      { status: 500 }
    );
  }
}