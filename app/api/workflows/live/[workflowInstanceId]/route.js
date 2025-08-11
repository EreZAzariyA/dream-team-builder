
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import { getOrchestrator } from '../../../../../lib/bmad/BmadOrchestrator.js';
import { connectMongoose } from '../../../../../lib/database/mongodb.js';
import Workflow from '../../../../../lib/database/models/Workflow.js';
import logger from '@/lib/utils/logger.js';

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
      // Always search by workflowId field - our standardized approach
      workflowDoc = await Workflow.findOne({ workflowId: workflowInstanceId });
    } catch (error) {
      logger.warn(`Workflow ${workflowInstanceId} not found:`, error.message);
    }

    // Get singleton BMAD orchestrator to maintain workflow state
    let orchestrator = null;
    let bmadWorkflowState = null;
    
    try {
      orchestrator = await getOrchestrator();
      bmadWorkflowState = await orchestrator.getWorkflowStatus(workflowInstanceId);
    } catch (bmadError) {
      logger.warn('BMAD orchestrator not available:', bmadError.message);
    }

    // If no workflow found in either source
    if (!workflowDoc && !bmadWorkflowState) {
      return NextResponse.json({ error: 'Workflow instance not found' }, { status: 404 });
    }

    // Load messages for this workflow
    let messages = [];
    try {
      if (orchestrator && orchestrator.messageService) {
        await orchestrator.messageService.initializeWorkflow(workflowInstanceId);
        messages = await orchestrator.messageService.getMessages(workflowInstanceId);
      }
    } catch (messageError) {
      logger.warn(`Failed to load messages for workflow ${workflowInstanceId}:`, messageError.message);
    }

    // Build comprehensive workflow instance response
    const workflowInstance = {
      id: workflowInstanceId,
      status: bmadWorkflowState?.status || workflowDoc?.status || 'unknown',
      workflow: {
        name: workflowDoc?.title || bmadWorkflowState?.name || `Workflow ${workflowInstanceId}`,
        description: workflowDoc?.description || bmadWorkflowState?.description || 'AI-powered workflow execution',
        template: workflowDoc?.template || 'default',
        agents: bmadWorkflowState?.sequence ? 
          // Extract unique agents from workflow sequence steps
          [...new Set(bmadWorkflowState.sequence.map(step => step.agentId || step.agent).filter(Boolean))] :
          []
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
        totalSteps: bmadWorkflowState?.sequence?.length || 5,
        percentage: bmadWorkflowState?.progress || 0
      },
      communication: {
        messageCount: messages.length,
        timeline: messages,
        statistics: {
          totalMessages: messages.length,
          agentMessages: messages.filter(m => m.type === 'response' || m.type === 'request').length,
          userMessages: messages.filter(m => m.from === 'user' || m.to === 'user').length
        }
      },
      agents: bmadWorkflowState?.agents || {},
      artifacts: bmadWorkflowState?.artifacts || [],
      checkpoints: bmadWorkflowState?.checkpoints || [],
      elicitationDetails: bmadWorkflowState?.elicitationDetails || workflowDoc?.elicitationDetails || null,
      currentAgent: bmadWorkflowState?.currentAgent || workflowDoc?.currentAgent?.agentId || null
    };

    // logger.info('🔍 [API DEBUG] Workflow status sources:', {
    //   bmadStatus: bmadWorkflowState?.status,
    //   dbStatus: workflowDoc?.status,
    //   bmadElicitation: bmadWorkflowState?.elicitationDetails,
    //   dbElicitation: workflowDoc?.elicitationDetails,
    //   finalElicitation: workflowInstance.elicitationDetails
    // });

    // Add real-time channel information
    workflowInstance.realTime = {
      channelName: `workflow-${workflowInstanceId}`,
      pusherKey: process.env.NEXT_PUBLIC_PUSHER_KEY,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1'
    };

    console.log({workflowInstance});
    

    return NextResponse.json(workflowInstance);

  } catch (error) {
    logger.error(`Error fetching workflow instance ${workflowInstanceId}:`, error);
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
