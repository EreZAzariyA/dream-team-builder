
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import BmadOrchestrator from '../../../../../lib/bmad/BmadOrchestrator.js';
import { connectMongoose } from '../../../../../lib/database/mongodb.js';
import Workflow from '../../../../../lib/database/models/Workflow.js';

export async function GET(request, { params }) {
  try {
    const { workflowInstanceId } = await params;
    
    // Get authenticated session
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    // First check database for workflow
    let workflowDoc = null;
    try {
      workflowDoc = await Workflow.findById(workflowInstanceId);
    } catch (dbError) {
      // If not a valid ObjectId, try finding by workflowId field
      workflowDoc = await Workflow.findOne({ workflowId: workflowInstanceId });
    }

    // Initialize BMAD orchestrator
    let orchestrator = null;
    let bmadWorkflowState = null;
    
    try {
      orchestrator = new BmadOrchestrator();
      await orchestrator.initialize();
      bmadWorkflowState = orchestrator.getWorkflowStatus(workflowInstanceId);
    } catch (bmadError) {
      console.warn('BMAD orchestrator not available:', bmadError.message);
    }

    // If no workflow found in either source
    if (!workflowDoc && !bmadWorkflowState) {
      return NextResponse.json({ error: 'Workflow instance not found' }, { status: 404 });
    }

    // Build comprehensive workflow instance response
    const workflowInstance = {
      id: workflowInstanceId,
      status: bmadWorkflowState?.status || workflowDoc?.status || 'unknown',
      workflow: {
        name: workflowDoc?.title || bmadWorkflowState?.name || `Workflow ${workflowInstanceId}`,
        description: workflowDoc?.description || bmadWorkflowState?.description || 'AI-powered workflow execution',
        template: workflowDoc?.template || 'default',
        agents: bmadWorkflowState?.sequence?.steps || ['pm', 'architect', 'ux-expert', 'developer', 'qa']
      },
      metadata: {
        initiatedBy: workflowDoc?.userId || session.user.id,
        startTime: workflowDoc?.createdAt || bmadWorkflowState?.startTime || new Date(),
        priority: workflowDoc?.metadata?.priority || 'medium',
        tags: workflowDoc?.metadata?.tags || [],
        category: workflowDoc?.metadata?.category || 'user-generated'
      },
      progress: {
        currentStep: bmadWorkflowState?.currentStep || 0,
        totalSteps: bmadWorkflowState?.sequence?.steps?.length || 5,
        percentage: bmadWorkflowState?.progress || 0
      },
      communication: bmadWorkflowState?.communication || {
        messageCount: 0,
        timeline: [],
        statistics: {}
      },
      agents: bmadWorkflowState?.agents || {},
      artifacts: bmadWorkflowState?.artifacts || [],
      checkpoints: bmadWorkflowState?.checkpoints || []
    };

    // Add real-time channel information
    workflowInstance.realTime = {
      channelName: `workflow-${workflowInstanceId}`,
      pusherKey: process.env.NEXT_PUBLIC_PUSHER_KEY,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1'
    };

    return NextResponse.json(workflowInstance);

  } catch (error) {
    console.error(`Error fetching workflow instance ${workflowInstanceId}:`, error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch workflow instance', 
        details: error.message,
        workflowId: workflowInstanceId
      }, 
      { status: 500 }
    );
  }
}
