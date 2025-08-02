
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import BmadOrchestrator from '../../../../../lib/bmad/BmadOrchestrator.js';
import { connectMongoose } from '../../../../../lib/database/mongodb.js';
import Workflow from '../../../../../lib/database/models/Workflow.js';
import { pusherServer } from '../../../../../lib/pusher/config.js';

export async function POST(request, { params }) {
  const { workflowId } = await params;
  
  try {
    
    // Get authenticated session
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    // Get request body for additional options
    const body = await request.json().catch(() => ({}));
    const { userPrompt, name, description } = body;

    // Create workflow record in database first
    const workflowDoc = new Workflow({
      title: name || `${workflowId} Workflow`,
      description: description || `Automated execution of ${workflowId} workflow`,
      prompt: userPrompt || `Execute ${workflowId} workflow`,
      template: workflowId,
      status: 'running',
      userId: session.user.id,
      metadata: {
        priority: 'medium',
        tags: [workflowId],
        category: 'workflow-template'
      }
    });

    const savedWorkflow = await workflowDoc.save();
    const finalWorkflowInstanceId = savedWorkflow._id.toString();

    // Start BMAD orchestrator asynchronously (don't wait for completion)
    const startWorkflowAsync = async () => {
      try {
        const orchestrator = new BmadOrchestrator();
        await orchestrator.initialize();
        
        await orchestrator.startWorkflow(userPrompt || `Execute ${workflowId} workflow`, {
          workflowId: finalWorkflowInstanceId, // Use the same ID as the database record
          name: name || `${workflowId} Workflow`,
          description: description || `Automated execution of ${workflowId} workflow`,
          sequence: workflowId.toUpperCase(),
          userId: session.user.id,
          priority: 'medium',
          context: {
            initiatedBy: session.user.id,
            userEmail: session.user.email,
            timestamp: new Date(),
            workflowInstanceId: finalWorkflowInstanceId
          }
        });
        console.log(`✅ Workflow ${finalWorkflowInstanceId} completed successfully`);
      } catch (bmadError) {
        console.error(`❌ BMAD workflow ${finalWorkflowInstanceId} failed:`, bmadError.message);
        // Update workflow status to error
        await Workflow.findByIdAndUpdate(finalWorkflowInstanceId, { status: 'error' });
      }
    };

    // Start workflow in background without waiting
    startWorkflowAsync().catch(error => {
      console.error('Background workflow execution failed:', error);
    });

    // Trigger initial Pusher event for workflow start
    try {
      await pusherServer.trigger(`workflow-${finalWorkflowInstanceId}`, 'workflow-update', {
        workflowId: finalWorkflowInstanceId,
        status: 'running',
        message: 'Workflow started successfully',
        timestamp: new Date().toISOString(),
        agents: ['pm', 'architect', 'ux-expert', 'developer', 'qa']
      });
      console.log(`🚀 Workflow started event sent for: ${finalWorkflowInstanceId}`);
    } catch (pusherError) {
      console.warn('Failed to send workflow start event:', pusherError.message);
    }

    const responseData = { 
      success: true,
      message: 'Workflow started successfully', 
      workflowInstanceId: finalWorkflowInstanceId,
      bmadEnabled: true, // BMAD is always enabled now
      realTimeChannel: `workflow-${finalWorkflowInstanceId}`
    };
    
    console.log('Sending successful response:', responseData);
    return NextResponse.json(responseData, { status: 201 });

  } catch (error) {
    console.error(`Error starting workflow ${workflowId}:`, error);
    return NextResponse.json({ 
      error: 'Failed to start workflow',
      details: error.message 
    }, { status: 500 });
  }
}
