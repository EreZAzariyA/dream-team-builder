/**
 * BMAD Workflow Detail API Endpoints
 * Provides detailed workflow information and status
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import BmadOrchestrator from '../../../../../lib/bmad/BmadOrchestrator.js';
import dbConnect from '../../../../../lib/database/mongodb.js';
import Workflow from '../../../../../lib/database/models/Workflow.js';

// Global orchestrator instance
let orchestrator = null;

/**
 * Initialize orchestrator if not already done
 */
async function getOrchestrator() {
  if (!orchestrator) {
    orchestrator = new BmadOrchestrator();
    await orchestrator.initialize();
  }
  return orchestrator;
}

/**
 * GET /api/bmad/workflow/[id] - Get detailed workflow status
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: workflowId } = params;
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    await dbConnect();
    const bmad = await getOrchestrator();

    // Get workflow status from orchestrator
    const workflowStatus = bmad.getWorkflowStatus(workflowId);
    
    if (!workflowStatus) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Get workflow from database for additional metadata
    const workflowDoc = await Workflow.findOne({ workflowId });

    // Get workflow artifacts
    const artifacts = bmad.getWorkflowArtifacts(workflowId);

    // Get message history
    const messages = bmad.communicator.getMessageHistory(workflowId, { limit: 100 });

    return NextResponse.json({
      success: true,
      workflow: {
        ...workflowStatus,
        artifacts,
        messages,
        database: workflowDoc ? {
          id: workflowDoc._id,
          createdAt: workflowDoc.createdAt,
          updatedAt: workflowDoc.updatedAt,
          userId: workflowDoc.userId,
          tags: workflowDoc.metadata?.tags || []
        } : null
      }
    });

  } catch (error) {
    console.error('Error fetching workflow details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow details', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bmad/workflow/[id] - Delete/cancel workflow
 */
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: workflowId } = params;
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    await dbConnect();
    const bmad = await getOrchestrator();

    // Check if workflow exists and user has permission
    const workflowDoc = await Workflow.findOne({ 
      workflowId,
      userId: session.user.id 
    });

    if (!workflowDoc) {
      return NextResponse.json(
        { error: 'Workflow not found or access denied' },
        { status: 404 }
      );
    }

    // Cancel workflow if it's still running
    const workflowStatus = bmad.getWorkflowStatus(workflowId);
    if (workflowStatus && ['running', 'paused'].includes(workflowStatus.status)) {
      await bmad.cancelWorkflow(workflowId);
    }

    // Mark as deleted in database (soft delete)
    await Workflow.findOneAndUpdate(
      { workflowId },
      { 
        status: 'deleted',
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    );

    return NextResponse.json({
      success: true,
      workflowId,
      message: 'Workflow deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting workflow:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow', details: error.message },
      { status: 500 }
    );
  }
}