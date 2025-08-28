/**
 * Agent Team Deployment History API
 * Retrieves user's deployment history using existing AgentTeam model
 */

import { NextResponse } from 'next/server';
import { authenticateRoute } from '@/lib/utils/routeAuth.js';
import { connectMongoose } from '@/lib/database/mongodb.js';
import AgentTeam from '@/lib/database/models/AgentTeam.js';
import logger from '@/lib/utils/logger.js';

/**
 * @swagger
 * /api/agent-teams/history:
 *   get:
 *     summary: Get user's deployment history
 *     description: Returns paginated list of user's agent team deployments
 *     tags:
 *       - Agent Teams
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of deployments to return
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, failed, pending]
 *         description: Filter by deployment status
 *     responses:
 *       200:
 *         description: Deployment history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 deployments:
 *                   type: array
 *                   items:
 *                     type: object
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 */
export async function GET(request) {
  try {
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 20;
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    await connectMongoose();

    logger.info(`📊 [DeploymentHistory] Fetching history for user: ${session.user.id}`);

    // Build query
    const query = { userId: session.user.id };
    if (status) {
      query['deployment.status'] = status;
    }

    // Execute queries in parallel
    const [deployments, totalCount] = await Promise.all([
      AgentTeam.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      AgentTeam.countDocuments(query)
    ]);

    // Calculate stats
    const stats = await AgentTeam.aggregate([
      { $match: { userId: session.user.id } },
      {
        $group: {
          _id: '$deployment.status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = stats.reduce((acc, stat) => {
      acc[stat._id || 'unknown'] = stat.count;
      return acc;
    }, {});

    logger.info(`✅ [DeploymentHistory] Found ${deployments.length}/${totalCount} deployments`);

    return NextResponse.json({
      success: true,
      deployments: deployments.map(deployment => ({
        _id: deployment._id,
        teamId: deployment.teamId,
        teamInstanceId: deployment.teamInstanceId,
        name: deployment.name,
        description: deployment.description,
        icon: deployment.icon,
        deployment: deployment.deployment,
        createdAt: deployment.createdAt,
        updatedAt: deployment.updatedAt,
        // Add workflow instance ID if available
        workflowInstanceId: deployment.workflowInstanceId || deployment.deployment?.workflowInstanceId
      })),
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: skip + deployments.length < totalCount,
        hasPrev: page > 1,
        stats: {
          total: totalCount,
          byStatus: statusCounts
        }
      }
    });

  } catch (error) {
    logger.error('❌ [DeploymentHistory] Error fetching deployment history:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch deployment history',
        details: error.message 
      },
      { status: 500 }
    );
  }
}