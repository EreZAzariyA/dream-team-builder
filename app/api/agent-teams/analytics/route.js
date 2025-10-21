/**
 * Agent Team Deployment Analytics API
 * Provides analytics and insights using existing AgentTeam data
 */

import { NextResponse } from 'next/server';
import { authenticateRoute } from '@/lib/utils/routeAuth.js';
import { connectMongoose } from '@/lib/database/mongodb.js';
import AgentTeam from '@/lib/database/models/AgentTeam.js';
import logger from '@/lib/utils/logger.js';

/**
 * @swagger
 * /api/agent-teams/analytics:
 *   get:
 *     summary: Get deployment analytics
 *     description: Returns analytics and insights for user's deployments
 *     tags:
 *       - Agent Teams
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *         description: Time range for analytics
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 */
export async function GET(request) {
  try {
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';

    await connectMongoose();

    // Changed from info to debug - this is normal operation, not noteworthy
    logger.debug(`📊 [Analytics] Generating analytics for user: ${session.user.id}, range: ${range}`);

    // Calculate date range
    const now = new Date();
    const daysBack = {
      '7d': 7,
      '30d': 30,
      '90d': 90
    }[range] || 30;
    
    const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));

    // Base query
    const baseQuery = { 
      userId: session.user.id,
      createdAt: { $gte: startDate }
    };

    // Run analytics queries in parallel
    const [
      totalDeployments,
      summaryStats,
      popularTeams,
      recentActivity,
      statusBreakdown,
      dailyActivity
    ] = await Promise.all([
      // Total deployments count
      AgentTeam.countDocuments(baseQuery),

      // Summary statistics
      AgentTeam.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            successful: {
              $sum: {
                $cond: [{ $eq: ['$deployment.status', 'completed'] }, 1, 0]
              }
            },
            failed: {
              $sum: {
                $cond: [{ $eq: ['$deployment.status', 'failed'] }, 1, 0]
              }
            },
            active: {
              $sum: {
                $cond: [{ $eq: ['$deployment.status', 'active'] }, 1, 0]
              }
            },
            avgDuration: {
              $avg: {
                $subtract: [
                  { $ifNull: ['$updatedAt', new Date()] },
                  '$createdAt'
                ]
              }
            }
          }
        }
      ]),

      // Most popular teams
      AgentTeam.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: '$teamId',
            count: { $sum: 1 },
            lastUsed: { $max: '$createdAt' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),

      // Recent activity
      AgentTeam.find(baseQuery)
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // Status breakdown
      AgentTeam.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: '$deployment.status',
            count: { $sum: 1 }
          }
        }
      ]),

      // Daily activity for trends
      AgentTeam.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            count: { $sum: 1 },
            successful: {
              $sum: {
                $cond: [{ $eq: ['$deployment.status', 'completed'] }, 1, 0]
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Process summary stats
    const summary = summaryStats[0] || {
      total: 0,
      successful: 0,
      failed: 0,
      active: 0,
      avgDuration: 0
    };

    // Convert avgDuration from milliseconds to seconds
    summary.avgDuration = Math.round(summary.avgDuration / 1000) || 0;

    // Process status breakdown
    const statusStats = statusBreakdown.reduce((acc, stat) => {
      acc[stat._id || 'unknown'] = stat.count;
      return acc;
    }, {});

    // Calculate trends
    const calculateTrend = (dailyData) => {
      if (dailyData.length < 2) return 0;
      
      const recent = dailyData.slice(-7); // Last 7 days
      const previous = dailyData.slice(-14, -7); // Previous 7 days
      
      const recentAvg = recent.reduce((sum, day) => sum + day.count, 0) / recent.length;
      const previousAvg = previous.reduce((sum, day) => sum + day.count, 0) / previous.length;
      
      if (previousAvg === 0) return recentAvg > 0 ? 100 : 0;
      return Math.round(((recentAvg - previousAvg) / previousAvg) * 100);
    };

    const deploymentTrend = calculateTrend(dailyActivity);

    // Changed from info to debug - normal operation, only log if there's actual activity
    if (summary.total > 0) {
      logger.debug(`✅ [Analytics] Generated analytics: ${summary.total} deployments, ${summary.successful} successful`);
    }

    return NextResponse.json({
      success: true,
      analytics: {
        range,
        period: {
          start: startDate.toISOString(),
          end: now.toISOString(),
          days: daysBack
        },
        summary: {
          total: summary.total,
          successful: summary.successful,
          failed: summary.failed,
          active: summary.active,
          avgDuration: summary.avgDuration,
          successRate: summary.total > 0 ? Math.round((summary.successful / summary.total) * 100) : 0
        },
        trends: {
          deployments: deploymentTrend
        },
        statusBreakdown: statusStats,
        popularTeams: popularTeams,
        recentActivity: recentActivity,
        dailyActivity: dailyActivity
      }
    });

  } catch (error) {
    logger.error('❌ [Analytics] Error generating analytics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate analytics',
        details: error.message 
      },
      { status: 500 }
    );
  }
}