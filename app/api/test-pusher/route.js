import { NextResponse } from 'next/server';
import { pusherServer } from '../../../lib/pusher/config.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId') || 'test-workflow';
    
    // Debug Pusher server initialization
    logger.info('🔍 Pusher server status:', {
      pusherServerExists: !!pusherServer,
      envVarsSet: {
        PUSHER_APP_ID: !!process.env.PUSHER_APP_ID,
        PUSHER_KEY: !!process.env.PUSHER_KEY,
        PUSHER_SECRET: !!process.env.PUSHER_SECRET,
        PUSHER_CLUSTER: process.env.PUSHER_CLUSTER
      }
    });
    
    if (!pusherServer) {
      throw new Error('Pusher server not initialized - check environment variables');
    }
    
    const channelName = `workflow-${workflowId}`;
    logger.info(`📡 Sending test events to channel: ${channelName}`);
    
    // Send a test event
    await pusherServer.trigger(channelName, 'agent-activated', {
      agentId: 'test-agent',
      status: 'active',
      message: 'Test agent activated',
      timestamp: new Date().toISOString()
    });
    
    await pusherServer.trigger(channelName, 'workflow-message', {
      message: {
        id: `test-msg-${Date.now()}`,
        from: 'test-agent',
        to: 'user',
        summary: 'Test message from Pusher API',
        timestamp: new Date().toISOString()
      }
    });
    
    logger.info(`🧪 Test Pusher events sent for workflow: ${workflowId}`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Test events sent successfully',
      workflowId,
      events: ['agent-activated', 'workflow-message']
    });
    
  } catch (error) {
    logger.error('Test Pusher error:', error);
    return NextResponse.json({ 
      error: 'Failed to send test events',
      details: error.message 
    }, { status: 500 });
  }
}