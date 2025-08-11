/**
 * API endpoints for workflow artifacts
 * GET: List all artifacts for a workflow
 */

import logger from '@/lib/utils/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import { getOrchestrator } from '../../../../../lib/bmad/BmadOrchestrator.js';

export async function GET(request, { params }) {
  try {
    // Check authentication first
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { workflowId } = await params;
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    const bmad = await getOrchestrator();
    const artifactManager = bmad.artifactManager;

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