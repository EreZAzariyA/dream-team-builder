import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import BmadOrchestrator from '../../../../../lib/bmad/BmadOrchestrator.js';

export async function POST(request, { params }) {
  const { workflowId } = params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { elicitationResponse } = body;

    if (!elicitationResponse) {
      return NextResponse.json({ error: 'Elicitation response is required' }, { status: 400 });
    }

    const orchestrator = new BmadOrchestrator();
    await orchestrator.initialize(); // Ensure orchestrator is initialized

    const result = await orchestrator.resumeWorkflowWithElicitation(workflowId, elicitationResponse);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`Error resuming workflow ${workflowId} with elicitation:`, error);
    return NextResponse.json(
      {
        error: 'Failed to resume workflow with elicitation',
        details: error.message,
      },
      { status: 500 }
    );
  }
}