/**
 * BMAD Filtered Workflows API
 * Returns workflows filtered by project context using server-side filtering
 */

import { NextResponse } from 'next/server';
import WorkflowParser from '@/lib/bmad/WorkflowParser.js';
import logger from '@/lib/utils/logger.js';

/**
 * @swagger
 * /api/bmad/workflows/filtered:
 *   post:
 *     summary: Get filtered workflows based on project context
 *     description: Returns workflows filtered by project type and scope with recommendation scoring
 *     tags:
 *       - BMAD Workflows
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
 *                 description: Array of workflow filenames (e.g., ['greenfield-service.yaml'])
 *               projectContext:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     description: Project type (e.g., 'rest-api', 'web-app')
 *                   scope:
 *                     type: string
 *                     description: Project scope (e.g., 'mvp', 'feature')
 *     responses:
 *       200:
 *         description: Successfully filtered workflows
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 workflows:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                       projectTypes:
 *                         type: array
 *                         items:
 *                           type: string
 *                       steps:
 *                         type: number
 *                       agents:
 *                         type: array
 *                         items:
 *                           type: string
 *                       complexity:
 *                         type: string
 *                       estimatedDuration:
 *                         type: string
 *                       recommended:
 *                         type: boolean
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     filtered:
 *                       type: number
 *                     recommended:
 *                       type: number
 *                     projectContext:
 *                       type: object
 */
export async function POST(request) {
  try {
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
 * Useful for getting all workflows for a team
 */
export async function GET(request) {
  try {
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