import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../lib/utils/routeAuth.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import Workflow from '../../../../lib/database/models/Workflow.js';

/**
 * GET /api/workflows/analytics
 * Returns workflow analytics and metrics
 */
export async function GET(request) {
  try {
    const { user, error: authError } = await authenticateRoute(request);
    if (authError) return authError;

    await connectMongoose();

    // Get date range for analytics (default: last 30 days)
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('days')) || 30;
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Get workflows for the user
    const workflows = await Workflow.find({
      userId: user._id,
      createdAt: { $gte: since }
    }).lean();

    // Calculate analytics
    const analytics = {
      total: workflows.length,
      active: workflows.filter(w => ['RUNNING', 'PAUSED_FOR_ELICITATION'].includes(w.status)).length,
      completed: workflows.filter(w => w.status === 'COMPLETED').length,
      failed: workflows.filter(w => w.status === 'FAILED').length,
      avgDuration: 0,
      successRate: 0
    };

    // Calculate success rate
    const finishedWorkflows = workflows.filter(w => ['COMPLETED', 'FAILED'].includes(w.status));
    if (finishedWorkflows.length > 0) {
      analytics.successRate = Math.round(
        (analytics.completed / finishedWorkflows.length) * 100
      );
    }

    // Calculate average duration for completed workflows
    const completedWorkflows = workflows.filter(w => 
      w.status === 'COMPLETED' && w.startedAt && w.completedAt
    );
    
    if (completedWorkflows.length > 0) {
      const totalDuration = completedWorkflows.reduce((acc, w) => {
        const duration = new Date(w.completedAt) - new Date(w.startedAt);
        return acc + duration;
      }, 0);
      
      analytics.avgDuration = Math.round(totalDuration / completedWorkflows.length / 1000 / 60); // minutes
    }

    // Recent activity (last 7 days)
    const recentSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentWorkflows = workflows.filter(w => w.createdAt >= recentSince);
    
    const recentAnalytics = {
      total: recentWorkflows.length,
      completed: recentWorkflows.filter(w => w.status === 'COMPLETED').length,
      failed: recentWorkflows.filter(w => w.status === 'FAILED').length
    };

    return NextResponse.json({
      success: true,
      ...analytics,
      recent: recentAnalytics,
      period: {
        days: daysBack,
        since: since.toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching workflow analytics:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch workflow analytics', 
        details: error.message,
        // Fallback data
        total: 0,
        active: 0,
        completed: 0,
        failed: 0,
        successRate: 0,
        avgDuration: 0
      },
      { status: 500 }
    );
  }
}