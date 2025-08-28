import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import { BmadOrchestrator } from '../../../../../lib/bmad/BmadOrchestrator.js';
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
    
    // Get orchestrator singleton
    const { getOrchestrator } = require('../../../../../lib/bmad/BmadOrchestrator.js');
    const orchestrator = await getOrchestrator();
    

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