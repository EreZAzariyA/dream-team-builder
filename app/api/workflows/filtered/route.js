/**
 * Filtered Workflows API
 * Handles filtering workflows by project context
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';
import WorkflowParser from '@/lib/bmad/WorkflowParser.js';
import logger from '@/lib/utils/logger.js';

const authenticateRoute = async (request) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }
  return { user: session.user, session };
};

/**
 * @swagger
 * /api/workflows/filtered:
 *   post:
 *     summary: Get filtered workflows based on project context
 *     description: Returns workflows filtered by project type and scope with recommendation scoring
 *     tags:
 *       - Workflows
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workflowFiles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of workflow filenames
 *               projectContext:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     description: Project type
 *                   scope:
 *                     type: string
 *                     description: Project scope
 *     responses:
 *       200:
 *         description: Successfully filtered workflows
 */
export async function POST(request) {
  try {
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    const { workflowFiles, projectContext } = await request.json();

    logger.info(`🔍 [FilteredWorkflows] Processing ${workflowFiles?.length || 0} workflows with context:`, projectContext);

    if (!workflowFiles || !Array.isArray(workflowFiles)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'workflowFiles array is required' 
        },
        { status: 400 }
      );
    }

    const parser = new WorkflowParser();
    const filteredWorkflows = await parser.getFilteredWorkflows(workflowFiles, projectContext || {});

    const recommendedCount = filteredWorkflows.filter(w => w.recommended).length;

    logger.info(`✅ [FilteredWorkflows] Returning ${filteredWorkflows.length} workflows (${recommendedCount} recommended)`);

    return NextResponse.json({
      success: true,
      workflows: filteredWorkflows,
      meta: {
        total: workflowFiles.length,
        filtered: filteredWorkflows.length,
        recommended: recommendedCount,
        projectContext: projectContext || {}
      }
    });

  } catch (error) {
    logger.error('❌ [FilteredWorkflows] Error filtering workflows:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to filter workflows', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for basic workflow filtering without project context
 */
export async function GET(request) {
  try {
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const workflowFilesParam = searchParams.get('workflowFiles');
    
    if (!workflowFilesParam) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'workflowFiles parameter is required (comma-separated list)' 
        },
        { status: 400 }
      );
    }

    const workflowFiles = workflowFilesParam.split(',').map(f => f.trim());
    
    logger.info(`🔍 [FilteredWorkflows] GET request for ${workflowFiles.length} workflows`);

    const parser = new WorkflowParser();
    const workflows = await parser.getFilteredWorkflows(workflowFiles);

    return NextResponse.json({
      success: true,
      workflows: workflows,
      meta: {
        total: workflowFiles.length,
        filtered: workflows.length,
        recommended: workflows.filter(w => w.recommended).length
      }
    });

  } catch (error) {
    logger.error('❌ [FilteredWorkflows] GET Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get workflows', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}