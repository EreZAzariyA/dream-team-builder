/**
 * API endpoints for workflow artifacts
 * GET: List all artifacts for a workflow
 */

import { NextResponse } from 'next/server';
const { ArtifactManager } = require('../../../../../lib/bmad/ArtifactManager');

export async function GET(request, { params }) {
  try {
    const { workflowId } = await params;
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    const artifactManager = new ArtifactManager();
    await artifactManager.initialize();

    // Get artifacts for the workflow
    const artifacts = await artifactManager.getWorkflowArtifacts(workflowId);
    
    return NextResponse.json({
      success: true,
      workflowId,
      artifacts: artifacts || [],
      count: artifacts?.length || 0
    });

  } catch (error) {
    logger.error('Error fetching artifacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artifacts', details: error.message },
      { status: 500 }
    );
  }
}