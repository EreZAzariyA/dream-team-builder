/**
 * Checkpoint Monitoring API
 * Provides real-time access to workflow checkpoints in database
 */

import { NextResponse } from 'next/server';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import WorkflowCheckpoint from '../../../../lib/database/models/WorkflowCheckpoint.js';

/**
 * GET /api/monitoring/checkpoints - Get all checkpoints from database
 */
export async function GET(request) {
  try {
    await connectMongoose();

    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const workflowId = url.searchParams.get('workflowId');

    // Build query
    const query = workflowId ? { workflowId } : {};

    // Fetch checkpoints
    const checkpoints = await WorkflowCheckpoint.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Calculate statistics
    const totalSize = checkpoints.reduce((sum, cp) => sum + (cp.stateSize || 0), 0);
    const oldestCheckpoint = checkpoints[checkpoints.length - 1];
    const oldestAge = oldestCheckpoint 
      ? Math.round((Date.now() - new Date(oldestCheckpoint.timestamp)) / (1000 * 60 * 60))
      : 0;

    // Group by workflow for summary
    const workflowSummary = checkpoints.reduce((acc, cp) => {
      const wfId = cp.workflowId;
      if (!acc[wfId]) {
        acc[wfId] = {
          workflowId: wfId,
          count: 0,
          latestTimestamp: null,
          status: cp.status
        };
      }
      acc[wfId].count++;
      if (!acc[wfId].latestTimestamp || cp.timestamp > acc[wfId].latestTimestamp) {
        acc[wfId].latestTimestamp = cp.timestamp;
      }
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      checkpoints: checkpoints.map(cp => ({
        checkpointId: cp.checkpointId,
        workflowId: cp.workflowId,
        type: cp.type,
        description: cp.description,
        step: cp.step,
        currentAgent: cp.currentAgent,
        status: cp.status,
        timestamp: cp.timestamp,
        stateSize: cp.stateSize,
        compressed: cp.compressed,
        userId: cp.userId
      })),
      statistics: {
        total: checkpoints.length,
        totalSize,
        oldestAge,
        workflowCount: Object.keys(workflowSummary).length,
        workflows: Object.values(workflowSummary)
      }
    });

  } catch (error) {
    console.error('Error fetching checkpoints:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch checkpoints',
        details: error.message 
      },
      { status: 500 }
    );
  }
}