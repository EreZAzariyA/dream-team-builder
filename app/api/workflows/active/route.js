/**
 * Simple API endpoint to get active workflows from database only
 * Bypasses BMAD orchestrator to avoid initialization delays
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import Workflow from '../../../../lib/database/models/Workflow.js';

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

    // Get query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'RUNNING'; // BMAD standardized status
    const limit = parseInt(url.searchParams.get('limit')) || 10;

    // Query database directly for active workflows
    const query = {
      userId: session.user.id,
      status: { $in: ['RUNNING', 'PAUSED', 'PAUSED_FOR_ELICITATION'] } // BMAD standardized statuses
    };

    if (status !== 'all') {
      query.status = status;
    }

    const workflows = await Workflow.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    // Transform to match expected format
    const transformedWorkflows = workflows.map(w => ({
      id: w._id.toString(),
      _id: w._id.toString(),
      workflowId: w._id.toString(),
      name: w.title,
      title: w.title,
      description: w.description,
      status: w.status,
      template: w.template,
      tags: w.metadata?.tags || [],
      metadata: w.metadata,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt
    }));


    return NextResponse.json({
      success: true,
      workflows: transformedWorkflows,
      meta: {
        total: transformedWorkflows.length,
        source: 'database'
      }
    });

  } catch (error) {
    logger.error('Error fetching workflows from database:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows', details: error.message },
      { status: 500 }
    );
  }
}