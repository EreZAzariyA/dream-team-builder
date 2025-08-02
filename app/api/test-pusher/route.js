import { NextResponse } from 'next/server';
import { pusherServer } from '../../../lib/pusher/config.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId') || 'test-workflow';
    
    // Send a test event
    await pusherServer.trigger(`workflow-${workflowId}`, 'agent-activated', {
      agentId: 'test-agent',
      status: 'active',
      message: 'Test agent activated',
      timestamp: new Date().toISOString()
    });
    
    await pusherServer.trigger(`workflow-${workflowId}`, 'workflow-message', {
      message: {
        id: `test-msg-${Date.now()}`,
        from: 'test-agent',
        to: 'user',
        summary: 'Test message from Pusher API',
        timestamp: new Date().toISOString()
      }
    });
    
    console.log(`🧪 Test Pusher events sent for workflow: ${workflowId}`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Test events sent successfully',
      workflowId,
      events: ['agent-activated', 'workflow-message']
    });
    
  } catch (error) {
    console.error('Test Pusher error:', error);
    return NextResponse.json({ 
      error: 'Failed to send test events',
      details: error.message 
    }, { status: 500 });
  }
}