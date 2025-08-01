/**
 * BMAD Workflow API Endpoints
 * Provides REST API for workflow management and execution
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';
import BmadOrchestrator from '../../../../lib/bmad/BmadOrchestrator.js';
import { WorkflowStatus } from '../../../../lib/bmad/types.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import Workflow from '../../../../lib/database/models/Workflow.js';

// Global orchestrator instance
let orchestrator = null;

/**
 * Initialize orchestrator if not already done
 */
async function getOrchestrator() {
  if (!orchestrator) {
    try {
      orchestrator = new BmadOrchestrator();
      await orchestrator.initialize();
      console.log('✅ BMAD Orchestrator initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize BMAD Orchestrator:', error);
      orchestrator = null; // Reset to allow retry
      throw new Error(`BMAD initialization failed: ${error.message}`);
    }
  }
  return orchestrator;
}

/**
 * @swagger
 * /api/bmad/workflow:
 *   get:
 *     summary: Get all workflows for the authenticated user
 *     description: Retrieves a list of all active and historical workflows initiated by or accessible to the current user.
 *     tags:
 *       - Workflows
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [running, completed, paused, error, cancelled]
 *         description: Filter workflows by their current status.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of workflows to return.
 *     responses:
 *       200:
 *         description: Successfully retrieved workflows.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 workflows:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Unique ID of the workflow.
 *                       name:
 *                         type: string
 *                         description: Name of the workflow.
 *                       status:
 *                         type: string
 *                         description: Current status of the workflow.
 *                       currentStep:
 *                         type: integer
 *                         description: Current step number in the workflow sequence.
 *                       totalSteps:
 *                         type: integer
 *                         description: Total number of steps in the workflow sequence.
 *                       currentAgent:
 *                         type: string
 *                         description: ID of the agent currently executing.
 *                       startTime:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp when the workflow started.
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of workflows found.
 *                     active:
 *                       type: integer
 *                       description: Number of active workflows.
 *                     completed:
 *                       type: integer
 *                       description: Number of completed workflows.
 *       401:
 *         description: Unauthorized. Authentication token is missing or invalid.
 *       500:
 *         description: Internal server error.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectMongoose();
    const bmad = await getOrchestrator();

    // Get query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit')) || 50;

    // Get active workflows
    const activeWorkflows = bmad.getActiveWorkflows();
    
    // Get execution history
    const history = bmad.getExecutionHistory(limit);

    // Filter by status if provided
    let workflows = [...activeWorkflows, ...history];
    if (status) {
      workflows = workflows.filter(w => w.status === status);
    }

    // Filter by user (if user-specific workflows are implemented)
    workflows = workflows.filter(w => 
      w.metadata?.initiatedBy === session.user.id || 
      w.context?.initiatedBy === session.user.id ||
      !w.metadata?.initiatedBy // Include system workflows for now
    );

    return NextResponse.json({
      success: true,
      workflows: workflows.slice(0, limit),
      meta: {
        total: workflows.length,
        active: activeWorkflows.length,
        completed: history.length
      }
    });

  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/bmad/workflow:
 *   post:
 *     summary: Start a new BMAD workflow
 *     description: Initiates a new automated workflow based on a user prompt and optional configuration.
 *     tags:
 *       - Workflows
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userPrompt
 *             properties:
 *               userPrompt:
 *                 type: string
 *                 minLength: 10
 *                 description: The main prompt describing what the user wants to achieve.
 *               name:
 *                 type: string
 *                 description: Optional name for the workflow.
 *               description:
 *                 type: string
 *                 description: Optional detailed description for the workflow.
 *               sequence:
 *                 type: string
 *                 description: The ID of the predefined workflow sequence to use (e.g., FULL_STACK, BACKEND_SERVICE).
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 default: normal
 *                 description: Priority of the workflow.
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of tags for the workflow.
 *     responses:
 *       201:
 *         description: Workflow started successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 workflowId:
 *                   type: string
 *                   description: The ID of the newly started workflow.
 *                 status:
 *                   type: string
 *                   example: running
 *                 message:
 *                   type: string
 *                   example: Workflow started successfully
 *       400:
 *         description: Bad request (e.g., user prompt too short, invalid sequence).
 *       401:
 *         description: Unauthorized. Authentication token is missing or invalid.
 *       500:
 *         description: Internal server error.
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userPrompt, name, description, sequence, priority, tags } = body;

    // Validate required fields
    if (!userPrompt || userPrompt.trim().length < 10) {
      return NextResponse.json(
        { error: 'User prompt must be at least 10 characters long' },
        { status: 400 }
      );
    }

    await connectMongoose();
    
    // Generate a unique workflow ID
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Try to initialize BMAD orchestrator in background (non-blocking)
    let bmadResult = null;
    try {
      const bmad = await getOrchestrator();
      bmadResult = await bmad.startWorkflow(userPrompt, {
        name: name || `Workflow - ${new Date().toLocaleDateString()}`,
        description: description || 'User-initiated BMAD workflow',
        sequence,
        userId: session.user.id,
        priority: priority || 'medium',
        tags: tags || [],
        context: {
          initiatedBy: session.user.id,
          userEmail: session.user.email,
          timestamp: new Date()
        }
      });
    } catch (bmadError) {
      console.warn('BMAD orchestrator failed, continuing with basic workflow:', bmadError.message);
      // Continue without BMAD - we'll still create the database entry
    }

    // Save workflow to database
    const workflowDoc = new Workflow({
      title: name || `Workflow - ${new Date().toLocaleDateString()}`,
      description: description || 'User-initiated BMAD workflow',
      prompt: userPrompt,
      template: 'greenfield-fullstack', // Default template
      status: 'running',
      userId: session.user.id,
      metadata: {
        priority: priority === 'normal' ? 'medium' : priority || 'medium', // Map 'normal' to 'medium'
        tags: tags || [],
        category: 'api-generated'
      }
    });

    await workflowDoc.save();

    return NextResponse.json({
      success: true,
      workflowId: bmadResult?.workflowId || workflowId,
      status: bmadResult?.status || 'running',
      message: 'Workflow started successfully',
      bmadEnabled: !!bmadResult
    });

  } catch (error) {
    console.error('Error starting workflow:', error);
    return NextResponse.json(
      { error: 'Failed to start workflow', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/bmad/workflow:
 *   put:
 *     summary: Update the status of a BMAD workflow
 *     description: Pauses, resumes, or cancels an existing workflow.
 *     tags:
 *       - Workflows
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workflowId
 *               - action
 *             properties:
 *               workflowId:
 *                 type: string
 *                 description: The ID of the workflow to update.
 *               action:
 *                 type: string
 *                 enum: [pause, resume, cancel]
 *                 description: The action to perform on the workflow.
 *     responses:
 *       200:
 *         description: Workflow status updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 workflowId:
 *                   type: string
 *                   description: The ID of the updated workflow.
 *                 status:
 *                   type: string
 *                   description: The new status of the workflow.
 *                 action:
 *                   type: string
 *                   description: The action performed.
 *                 message:
 *                   type: string
 *                   example: Workflow paused successfully
 *       400:
 *         description: Bad request (e.g., missing workflowId or action, invalid action).
 *       401:
 *         description: Unauthorized. Authentication token is missing or invalid.
 *       404:
 *         description: Workflow not found.
 *       500:
 *         description: Internal server error.
 */
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { workflowId, action } = body;

    if (!workflowId || !action) {
      return NextResponse.json(
        { error: 'Missing workflowId or action' },
        { status: 400 }
      );
    }

    await connectMongoose();
    const bmad = await getOrchestrator();

    let result;
    switch (action) {
      case 'pause':
        result = await bmad.pauseWorkflow(workflowId);
        break;
      case 'resume':
        result = await bmad.resumeWorkflow(workflowId);
        break;
      case 'cancel':
        result = await bmad.cancelWorkflow(workflowId);
        break;
      case 'rollback':
        const { checkpointId } = body;
        if (!checkpointId) {
          return NextResponse.json(
            { error: 'checkpointId is required for rollback action' },
            { status: 400 }
          );
        }
        result = await bmad.rollbackToCheckpoint(workflowId, checkpointId);
        break;
      case 'resume_rollback':
        result = await bmad.resumeFromRollback(workflowId);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be pause, resume, cancel, rollback, or resume_rollback' },
          { status: 400 }
        );
    }

    // Update database
    await Workflow.findOneAndUpdate(
      { workflowId },
      { 
        status: result.status,
        updatedAt: new Date()
      }
    );

    return NextResponse.json({
      success: true,
      workflowId: result.workflowId,
      status: result.status,
      action,
      message: `Workflow ${action}d successfully`
    });

  } catch (error) {
    console.error(`Error updating workflow:`, error);
    return NextResponse.json(
      { error: 'Failed to update workflow', details: error.message },
      { status: 500 }
    );
  }
}