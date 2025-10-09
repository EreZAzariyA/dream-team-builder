import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import { BmadOrchestrator } from '../../../../../lib/bmad/BmadOrchestrator.js';
import logger from '../../../../../lib/utils/logger.js';

/**
 * Handle interactive user responses during workflow execution
 * POST /api/workflows/[workflowId]/respond
 */
export async function POST(request, { params }) {
  const { workflowId } = await params;
  
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { messageId, response, action, feedback } = body;

    logger.info(`📨 [USER RESPONSE] Received for workflow ${workflowId}:`, {
      messageId,
      response,
      action,
      userId: session.user.id
    });

    // Validate required fields
    if (!messageId) {
      return NextResponse.json({ 
        error: 'messageId is required' 
      }, { status: 400 });
    }

    // Get orchestrator singleton
    const { getOrchestrator } = require('../../../../../lib/bmad/BmadOrchestrator.js');
    const orchestrator = await getOrchestrator();
    
    if (!orchestrator.workflowManager || !orchestrator.workflowManager.interactiveMessaging) {
      return NextResponse.json({
        error: 'Interactive messaging not available'
      }, { status: 503 });
    }

    // Process the user response
    const userResponse = {
      messageId,
      response: response || action,
      action,
      feedback,
      userId: session.user.id,
      timestamp: new Date().toISOString()
    };

    // Handle the response through the interactive messaging system (now async)
    const handled = await orchestrator.workflowManager.interactiveMessaging.handleUserResponse(
      messageId,
      userResponse
    );

    if (!handled) {
      logger.warn(`📨 No pending message found for messageId: ${messageId}`);
      return NextResponse.json({
        error: 'Message not found or already responded to',
        messageId
      }, { status: 404 });
    }

    logger.info(`✅ [USER RESPONSE] Successfully processed response for message ${messageId}`);

    return NextResponse.json({
      success: true,
      message: 'Response received and processed',
      messageId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`❌ Error handling user response for workflow ${workflowId}:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process user response',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Get pending messages for a workflow (GET request)
 */
export async function GET(request, { params }) {
  const { workflowId } = await params;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get orchestrator singleton
    const { getOrchestrator } = require('../../../../../lib/bmad/BmadOrchestrator.js');
    const orchestrator = await getOrchestrator();
    
    if (!orchestrator.workflowManager || !orchestrator.workflowManager.interactiveMessaging) {
      return NextResponse.json({
        pendingMessages: [],
        count: 0
      });
    }

    // Get pending response count (for monitoring - now async)
    const pendingCount = await orchestrator.workflowManager.interactiveMessaging.getPendingResponseCount();

    return NextResponse.json({
      success: true,
      workflowId,
      pendingCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Error getting pending messages for workflow ${workflowId}:`, error);
    
    return NextResponse.json({
      error: 'Failed to get pending messages',
      details: error.message
    }, { status: 500 });
  }
}