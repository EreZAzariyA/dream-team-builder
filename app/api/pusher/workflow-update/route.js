/**
 * Pusher Workflow Update API Route
 * Handles workflow status updates and agent communications via Pusher
 */

import { NextResponse } from 'next/server';
import { pusherServer, CHANNELS, EVENTS } from '../../../../lib/pusher/config';

export async function POST(request) {
  try {
    const { workflowId, event, data } = await request.json();

    if (!workflowId || !event) {
      return NextResponse.json(
        { error: 'WorkflowId and event are required' },
        { status: 400 }
      );
    }

    const channelName = CHANNELS.WORKFLOW(workflowId);
    let eventName;

    // Map event types to Pusher events
    switch (event) {
      case 'agent_activated':
        eventName = EVENTS.AGENT_ACTIVATED;
        break;
      case 'agent_completed':
        eventName = EVENTS.AGENT_COMPLETED;
        break;
      case 'agent_communication':
        eventName = EVENTS.AGENT_COMMUNICATION;
        break;
      case 'workflow_update':
        eventName = EVENTS.WORKFLOW_UPDATE;
        break;
      case 'workflow_message':
        eventName = EVENTS.WORKFLOW_MESSAGE;
        break;
      default:
        eventName = event;
    }

    const updateData = {
      workflowId,
      timestamp: new Date().toISOString(),
      ...data,
    };

    await pusherServer.trigger(channelName, eventName, updateData);

    console.log(`🔄 Workflow update sent to ${channelName}:`, eventName);

    return NextResponse.json({
      success: true,
      workflowId,
      event: eventName,
      channel: channelName,
    });

  } catch (error) {
    console.error('Error sending workflow update:', error);
    return NextResponse.json(
      { error: 'Failed to send workflow update' },
      { status: 500 }
    );
  }
}

// GET endpoint to trigger demo events for testing
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId') || 'demo-workflow';

    const channelName = CHANNELS.WORKFLOW(workflowId);

    // Send a demo agent activation
    await pusherServer.trigger(channelName, EVENTS.AGENT_ACTIVATED, {
      workflowId,
      agentId: 'demo-agent',
      timestamp: new Date().toISOString(),
    });

    // Send a demo workflow message after 2 seconds
    setTimeout(async () => {
      await pusherServer.trigger(channelName, EVENTS.WORKFLOW_MESSAGE, {
        workflowId,
        message: {
          id: `demo-${Date.now()}`,
          from: 'demo-agent',
          to: 'user',
          summary: 'Demo workflow message from Pusher!',
          timestamp: new Date().toISOString(),
        },
      });
    }, 2000);

    return NextResponse.json({
      success: true,
      message: 'Demo events triggered',
      workflowId,
      channel: channelName,
    });

  } catch (error) {
    console.error('Error triggering demo events:', error);
    return NextResponse.json(
      { error: 'Failed to trigger demo events' },
      { status: 500 }
    );
  }
}