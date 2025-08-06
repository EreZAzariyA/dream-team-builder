
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import { getOrchestrator } from '../../../../../lib/bmad/BmadOrchestrator.js';
import { connectMongoose } from '../../../../../lib/database/mongodb.js';
import Workflow from '../../../../../lib/database/models/Workflow.js';
import { pusherServer } from '../../../../../lib/pusher/config.js';
import { WorkflowId } from '../../../../../lib/utils/workflowId.js';
import logger from '@/lib/utils/logger.js';
import { WorkflowSequences } from '@/lib/bmad/types.js';

export async function POST(request, { params }) {
  const { workflowId: workflowTemplate } = await params;

  try {
    // Validate workflow template parameter
    if (!workflowTemplate || typeof workflowTemplate !== 'string' || !workflowTemplate.trim()) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid workflow template',
        details: 'workflowId parameter is required and must be a non-empty string'
      }, { status: 400 });
    }

    // Get authenticated session
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized',
        details: 'Authentication required'
      }, { status: 401 });
    }

    // Validate user ID exists
    if (!session.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid session',
        details: 'User ID not found in session'
      }, { status: 401 });
    }

    await connectMongoose();

    // Get and validate request body
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      logger.error('Invalid JSON in request body:', jsonError.message);
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        details: jsonError.message 
      }, { status: 400 });
    }

    // Validate required fields
    const { userPrompt, name, description } = body || {};
    
    if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
      return NextResponse.json({ 
        error: 'userPrompt is required and must be a non-empty string' 
      }, { status: 400 });
    }

    // Validate optional fields
    if (name && typeof name !== 'string') {
      return NextResponse.json({ 
        error: 'name must be a string if provided' 
      }, { status: 400 });
    }

    if (description && typeof description !== 'string') {
      return NextResponse.json({ 
        error: 'description must be a string if provided' 
      }, { status: 400 });
    }

    // Sanitize inputs
    const sanitizedUserPrompt = userPrompt.trim();
    const sanitizedName = name ? name.trim() : '';
    const sanitizedDescription = description ? description.trim() : '';

    // Create workflow record in database with proper error handling
    let savedWorkflow;
    let finalWorkflowInstanceId;
    
    try {
      const workflowDoc = new Workflow({
        title: sanitizedName || `${workflowTemplate} Workflow`,
        description: sanitizedDescription || `Automated execution of ${workflowTemplate} workflow`,
        prompt: sanitizedUserPrompt,
        template: workflowTemplate,
        status: 'running', // Set to running since we're about to start the orchestrator
        userId: session.user.id,
        metadata: {
          priority: 'medium',
          tags: [workflowTemplate],
          category: 'workflow-template',
          createdAt: new Date().toISOString()
        }
      });

      savedWorkflow = await workflowDoc.save();
      finalWorkflowInstanceId = savedWorkflow._id.toString();
      logger.info(`✅ Workflow record created: ${finalWorkflowInstanceId}`);
      
      // Workflow created with running status, ready to start orchestrator
      
    } catch (dbError) {
      logger.error('Database error creating workflow:', dbError);
      return NextResponse.json({ 
        error: 'Failed to create workflow record',
        details: dbError.message 
      }, { status: 500 });
    }

    // Start BMAD orchestrator
    try {
      logger.info(`🚀 Starting BMAD workflow ${finalWorkflowInstanceId}...`);
      const orchestrator = await getOrchestrator();
      logger.info(`✅ BMAD orchestrator initialized for ${finalWorkflowInstanceId}`);

      const channelName = WorkflowId.toChannelName(finalWorkflowInstanceId);

      // Send immediate test event to verify Pusher connection
      await pusherServer.trigger(channelName, 'agent-activated', {
        agentId: 'test-agent',
        status: 'active',
        message: 'Test agent activation for debugging',
        timestamp: new Date().toISOString(),
        workflowId: finalWorkflowInstanceId
      });
      logger.info(`🧪 Test agent activation event sent for ${finalWorkflowInstanceId}`);
      
      // Run real BMAD workflow with AI agents
      const workflowResult = await orchestrator.startWorkflow(sanitizedUserPrompt, {
        workflowId: finalWorkflowInstanceId,
        sequence: workflowTemplate, // Use template name string, not the actual sequence array
        name: sanitizedName || `${workflowTemplate} Project`,
        description: sanitizedDescription || `AI-generated project using ${workflowTemplate} workflow`,
        userId: session.user.id,
        templateId: workflowTemplate
      });
      logger.info(`✅ Real BMAD workflow ${finalWorkflowInstanceId} started:`, workflowResult.workflowId);

    } catch (bmadError) {
      logger.error(`❌ BMAD workflow ${finalWorkflowInstanceId} failed:`, bmadError.message || JSON.stringify(bmadError));
      logger.error('Full error details:', bmadError);
      
      // Update workflow status to error with proper error handling
      try {
        await Workflow.findByIdAndUpdate(finalWorkflowInstanceId, { 
          status: 'error',
          'metadata.errorAt': new Date().toISOString(),
          'metadata.errorMessage': bmadError.message || 'Unknown error'
        });
      } catch (updateError) {
        logger.error('Failed to update workflow status to error:', updateError);
      }
      
      // Send error event via Pusher
      try {
        const channelName = WorkflowId.toChannelName(finalWorkflowInstanceId);
        await pusherServer.trigger(channelName, 'workflow-update', {
          workflowId: finalWorkflowInstanceId,
          status: 'error',
          message: `Workflow failed: ${bmadError.message || 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          error: true,
          errorDetails: {
            type: bmadError.name || 'WorkflowError',
            code: bmadError.code || 'WORKFLOW_EXECUTION_FAILED'
          }
        });
      } catch (pusherError) {
        logger.error('Failed to send error event via Pusher:', pusherError);
      }
      
      // Return error response but don't throw - workflow was created successfully even if execution failed
      return NextResponse.json({ 
        success: false,
        error: 'Workflow execution failed',
        details: bmadError.message || 'Unknown error',
        workflowInstanceId: finalWorkflowInstanceId,
        workflowId: finalWorkflowInstanceId
      }, { status: 500 });
    }

    // Trigger initial Pusher event for workflow start
    try {
      const channelName = WorkflowId.toChannelName(finalWorkflowInstanceId);
      await pusherServer.trigger(channelName, 'workflow-update', {
        workflowId: finalWorkflowInstanceId,
        workflowInstanceId: finalWorkflowInstanceId, // Consistent field naming
        status: 'running',
        message: 'Workflow started successfully',
        timestamp: new Date().toISOString(),
        agents: ['pm', 'architect', 'ux-expert', 'developer', 'qa'],
        templateId: workflowTemplate
      });
      logger.info(`🚀 Workflow started event sent for: ${finalWorkflowInstanceId}`);
    } catch (pusherError) {
      logger.warn('Failed to send workflow start event:', pusherError.message);
      // Don't fail the request if Pusher fails - workflow is still created
    }

    // Consistent response structure
    const responseData = { 
      success: true,
      message: 'Workflow started successfully', 
      workflowInstanceId: finalWorkflowInstanceId,
      workflowId: finalWorkflowInstanceId, // Include both for backward compatibility
      templateId: workflowTemplate,
      bmadEnabled: true,
      realTimeChannel: WorkflowId.toChannelName(finalWorkflowInstanceId),
      metadata: {
        createdAt: new Date().toISOString(),
        userId: session.user.id,
        status: 'running'
      }
    };
    
    logger.info('Sending successful response:', responseData);
    return NextResponse.json(responseData, { status: 201 });

  } catch (error) {
    logger.error(`Error starting workflow template ${workflowTemplate}:`, error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to start workflow',
      details: error.message || 'Unknown server error',
      metadata: {
        timestamp: new Date().toISOString(),
        templateId: workflowTemplate,
        errorType: error.name || 'ServerError'
      }
    }, { status: 500 });
  }
}
