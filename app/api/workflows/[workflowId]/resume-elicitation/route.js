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

    if (!elicitationResponse) {
      return NextResponse.json({ error: 'Elicitation response is required' }, { status: 400 });
    }

    logger.info('Resume elicitation request', { workflowId, agentId });
    

    const orchestrator = await getOrchestrator(); // Use singleton orchestrator
    const result = await orchestrator.resumeWorkflowWithElicitation(workflowId, elicitationResponse, agentId);

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