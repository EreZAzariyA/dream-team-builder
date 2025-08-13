
import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../../lib/utils/routeAuth.js';
import { getOrchestrator } from '../../../../../lib/bmad/BmadOrchestrator.js';
import { connectMongoose } from '../../../../../lib/database/mongodb.js';
import Workflow from '../../../../../lib/database/models/Workflow.js';
import AgentTeam from '../../../../../lib/database/models/AgentTeam.js';
import logger from '@/lib/utils/logger.js';

export async function GET(request, { params }) {
  try {
    const { workflowInstanceId } = await params;
    logger.info(`🔍 [LiveWorkflow] API called with workflowInstanceId: ${workflowInstanceId}`);
    
    // Get authenticated session
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    await connectMongoose();

    // First check database for workflow
    let workflowDoc = null;
    let agentTeamDoc = null;
    
    try {
      // Search in Workflow collection first
      workflowDoc = await Workflow.findOne({ workflowId: workflowInstanceId });
      logger.info(`🔍 [LiveWorkflow] Workflow collection search: ${workflowDoc ? 'FOUND' : 'NOT FOUND'}`);
      
      // If not found in Workflow, check AgentTeam collection (for team deployments)
      if (!workflowDoc) {
        agentTeamDoc = await AgentTeam.findOne({ 
          'deployment.workflowInstanceId': workflowInstanceId 
        });
        logger.info(`🔍 [LiveWorkflow] AgentTeam collection search: ${agentTeamDoc ? 'FOUND' : 'NOT FOUND'}`);
      }
    } catch (error) {
      logger.error(`Database search error for ${workflowInstanceId}:`, error.message);
    }

    // Get singleton BMAD orchestrator to maintain workflow state
    let orchestrator = null;
    let bmadWorkflowState = null;
    
    try {
      orchestrator = await getOrchestrator();
      bmadWorkflowState = await orchestrator.getWorkflowStatus(workflowInstanceId);
      logger.info(`🔍 [LiveWorkflow] BMAD orchestrator search for ${workflowInstanceId}: ${bmadWorkflowState ? 'FOUND' : 'NOT FOUND'}`);
    } catch (bmadError) {
      logger.warn('BMAD orchestrator not available:', bmadError.message);
    }

    // If no workflow found in any source
    if (!workflowDoc && !agentTeamDoc && !bmadWorkflowState) {
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
      status: bmadWorkflowState?.status || workflowDoc?.status || agentTeamDoc?.deployment?.status || 'unknown',
      workflow: {
        name: workflowDoc?.title || 
              agentTeamDoc?.deployment?.selectedWorkflow?.workflowName || 
              bmadWorkflowState?.name || 
              `Workflow ${workflowInstanceId}`,
        description: workflowDoc?.description || 
                    agentTeamDoc?.description || 
                    bmadWorkflowState?.description || 
                    'AI-powered workflow execution',
        template: workflowDoc?.template || 
                 agentTeamDoc?.deployment?.selectedWorkflow?.workflowId || 
                 'default',
        agents: bmadWorkflowState?.sequence ? 
          // Extract unique agents from workflow sequence steps
          [...new Set(bmadWorkflowState.sequence.map(step => step.agentId || step.agent).filter(Boolean))] :
          // Use team agents if available
          agentTeamDoc?.teamConfig?.agentIds || []
      },
      metadata: {
        initiatedBy: workflowDoc?.userId || agentTeamDoc?.userId || session.user.id,
        startTime: workflowDoc?.createdAt || 
                  agentTeamDoc?.deployment?.createdAt || 
                  bmadWorkflowState?.startTime || 
                  new Date(),
        priority: workflowDoc?.metadata?.priority || 
                 agentTeamDoc?.metadata?.priority || 
                 'medium',
        tags: workflowDoc?.metadata?.tags || 
             agentTeamDoc?.metadata?.tags || 
             [],
        category: workflowDoc?.metadata?.category || 
                 (agentTeamDoc ? 'team-deployment' : 'user-generated')
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
      currentAgent: (() => {
        // CRITICAL FIX: Ensure currentAgent is always a string or null
        const agent = bmadWorkflowState?.currentAgent || workflowDoc?.currentAgent;
        if (!agent) return null;
        if (typeof agent === 'string') return agent;
        if (typeof agent === 'object' && agent.agentId) return agent.agentId;
        if (typeof agent === 'object' && agent.id) return agent.id;
        return null;
      })()
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
