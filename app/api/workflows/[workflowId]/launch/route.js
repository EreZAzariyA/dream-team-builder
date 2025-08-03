
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
        console.log(`🚀 Starting BMAD workflow ${finalWorkflowInstanceId}...`);
        const orchestrator = new BmadOrchestrator();
        await orchestrator.initialize();
        console.log(`✅ BMAD orchestrator initialized for ${finalWorkflowInstanceId}`);
        
        // Send immediate test event to verify Pusher connection
        await pusherServer.trigger(`workflow-${finalWorkflowInstanceId}`, 'agent-activated', {
          agentId: 'test-agent',
          status: 'active',
          message: 'Test agent activation for debugging',
          timestamp: new Date().toISOString()
        });
        console.log(`🧪 Test agent activation event sent for ${finalWorkflowInstanceId}`);
        
        // Demo workflow with mock agents when AI services are down
        const demoAgents = ['pm', 'architect', 'ux-expert', 'developer', 'qa'];
        let agentIndex = 0;
        
        const runMockWorkflow = async () => {
          for (const agentId of demoAgents) {
            // Agent activation
            await pusherServer.trigger(`workflow-${finalWorkflowInstanceId}`, 'agent-activated', {
              agentId,
              status: 'active',
              message: `${agentId.toUpperCase()} agent is now working on: ${userPrompt}`,
              timestamp: new Date().toISOString()
            });
            console.log(`🤖 Mock agent ${agentId} activated`);
            
            // Simulate work time
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Agent message
            await pusherServer.trigger(`workflow-${finalWorkflowInstanceId}`, 'agent-message', {
              id: `msg-${Date.now()}-${agentId}`,
              content: `Hello! I'm the ${agentId.toUpperCase()} agent. I've analyzed your request: "${userPrompt}". My recommendations will be integrated into the final solution.`,
              agentId,
              agentName: agentId.toUpperCase(),
              provider: 'mock-ai',
              userId: 'system',
              timestamp: new Date().toISOString(),
              workflowId: finalWorkflowInstanceId
            });
            console.log(`💬 Mock message sent from ${agentId}`);
            
            // Agent completion
            await pusherServer.trigger(`workflow-${finalWorkflowInstanceId}`, 'agent-completed', {
              agentId,
              status: 'completed',
              message: `${agentId.toUpperCase()} agent completed analysis successfully`,
              timestamp: new Date().toISOString()
            });
            console.log(`✅ Mock agent ${agentId} completed`);
            
            agentIndex++;
          }
          
          // Final workflow completion
          await pusherServer.trigger(`workflow-${finalWorkflowInstanceId}`, 'workflow-update', {
            workflowId: finalWorkflowInstanceId,
            status: 'completed',
            message: 'Mock workflow completed successfully! All agents have provided their analysis.',
            timestamp: new Date().toISOString()
          });
          console.log(`🎉 Mock workflow ${finalWorkflowInstanceId} completed`);
        };
        
        // Run real BMAD workflow with AI agents
        const workflowResult = await orchestrator.startWorkflow(userPrompt, {
          workflowId: finalWorkflowInstanceId,
          name: name || `${workflowId} Project`,
          description: description || `AI-generated project using ${workflowId} workflow`,
          userId: session.user.id
        });
        console.log(`✅ Real BMAD workflow ${finalWorkflowInstanceId} started:`, workflowResult.workflowId);
      } catch (bmadError) {
        console.error(`❌ BMAD workflow ${finalWorkflowInstanceId} failed:`, bmadError.message);
        console.error('Full error details:', bmadError);
        // Update workflow status to error
        await Workflow.findByIdAndUpdate(finalWorkflowInstanceId, { status: 'error' });
        
        // Send error event via Pusher
        try {
          await pusherServer.trigger(`workflow-${finalWorkflowInstanceId}`, 'workflow-update', {
            workflowId: finalWorkflowInstanceId,
            status: 'error',
            message: `Workflow failed: ${bmadError.message}`,
            timestamp: new Date().toISOString()
          });
        } catch (pusherError) {
          console.error('Failed to send error event via Pusher:', pusherError);
        }
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
