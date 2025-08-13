import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import { getOrchestrator } from '../../../../../lib/bmad/BmadOrchestrator.js';
import logger from '../../../../../lib/utils/logger.js';

export async function POST(request, { params }) {
  const { workflowId } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { elicitationResponse, agentId } = body;
    
    // Debug: Log the received request body
    logger.info('🔍 [DEBUG] Resume elicitation request body received:', {
      body,
      elicitationResponse,
      elicitationResponseType: typeof elicitationResponse,
      elicitationResponseString: String(elicitationResponse),
      agentId,
      workflowId,
      workflowIdType: typeof workflowId
    });
    
    // Additional debug: Log the exact workflowId being processed
    logger.info(`🎯 [WORKFLOW ID] Resuming elicitation for workflowId: "${workflowId}" (type: ${typeof workflowId})`);

    if (!elicitationResponse) {
      return NextResponse.json({ error: 'Elicitation response is required' }, { status: 400 });
    }

    logger.info('Resume elicitation request', { workflowId, agentId, userId: session.user.id });
    
    // Get orchestrator and ensure AIService is initialized for this user
    const orchestrator = await getOrchestrator();
    
    // Initialize AIService with user session if not already done
    if (orchestrator.aiService && session.user.id) {
      try {
        logger.info('Initializing AIService for user:', session.user.id);
        const initResult = await orchestrator.aiService.initialize(null, session.user.id);
        if (initResult) {
          logger.info('✅ AIService initialized successfully for workflow execution');
        } else {
          logger.warn('⚠️ AIService initialization returned false - may need API keys');
        }
      } catch (aiError) {
        logger.warn('AIService initialization failed:', aiError.message);
      }
    } else if (!orchestrator.aiService) {
      logger.error('❌ No AIService available in orchestrator - workflow will fail');
      return NextResponse.json(
        { error: 'AI Service not available. Please check system configuration or provide API keys.' },
        { status: 503 }
      );
    }

    const result = await orchestrator.resumeWorkflowWithElicitation(workflowId, elicitationResponse, agentId, session.user.id);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error(`Error resuming workflow ${workflowId} with elicitation:`, error);
    return NextResponse.json(
      {
        error: 'Failed to resume workflow with elicitation',
        details: error.message,
      },
      { status: 500 }
    );
  }
}