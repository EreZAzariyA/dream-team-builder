import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../lib/utils/routeAuth.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import AgentTeam from '../../../../lib/database/models/AgentTeam.js';
import logger from '../../../../lib/utils/logger.js';

/**
 * Cleanup Agent Team Deployments
 * 
 * This endpoint helps clean up stuck or failed deployments that are blocking new ones
 */

export async function GET(request) {
  try {
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    await connectMongoose();

    // Get current deployment status for debugging
    const activeDeployments = await AgentTeam.find({
      userId: session.user.id,
      'deployment.status': { $in: ['validating', 'deploying', 'active'] },
    });

    return NextResponse.json({
      success: true,
      activeDeployments: activeDeployments.map(d => ({
        teamInstanceId: d.teamInstanceId,
        teamName: d.name,
        status: d.deployment.status,
        workflowInstanceId: d.deployment.workflowInstanceId,
        startTime: d.deployment.deployedAt || d.deployment.createdAt,
        age: (d.deployment.deployedAt || d.deployment.createdAt)
          ? Math.round((Date.now() - (d.deployment.deployedAt || d.deployment.createdAt).getTime()) / (1000 * 60)) + ' minutes'
          : 'Unknown',
      })),
      count: activeDeployments.length,
    });
  } catch (error) {
    logger.error('Error getting deployment status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    await connectMongoose();

    const { action, teamInstanceId } = await request.json();

    if (action === 'status') {
      // Get current deployment status for debugging
      const activeDeployments = await AgentTeam.find({
        userId: session.user.id,
        'deployment.status': { $in: ['validating', 'deploying', 'active'] },
      });

      return NextResponse.json({
        success: true,
        activeDeployments: activeDeployments.map(d => ({
          teamInstanceId: d.teamInstanceId,
          teamName: d.name,
          status: d.deployment.status,
          workflowInstanceId: d.deployment.workflowInstanceId,
          startTime: d.deployment.deployedAt || d.deployment.createdAt,
          age: (d.deployment.deployedAt || d.deployment.createdAt)
          ? Math.round((Date.now() - (d.deployment.deployedAt || d.deployment.createdAt).getTime()) / (1000 * 60)) + ' minutes'
          : 'Unknown',
        })),
        count: activeDeployments.length,
      });
    }

    if (action === 'cleanup_failed') {
      // Find and cleanup old deployments that should have failed but are stuck in active state
      const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago (more aggressive for debugging)
      
      const stuckDeployments = await AgentTeam.find({
        userId: session.user.id,
        'deployment.status': { $in: ['validating', 'deploying', 'active'] },
        $or: [
          { 'deployment.deployedAt': { $lt: cutoffTime } }, // Deployed more than 5 minutes ago
          { 'deployment.createdAt': { $lt: cutoffTime } }, // Or created more than 5 minutes ago
        ],
      });

      let cleanedCount = 0;
      for (const deployment of stuckDeployments) {
        await deployment.fail('Deployment timed out - automatically cleaned up', {
          autoCleanup: true,
          originalStatus: deployment.deployment.status,
          stuckTime: deployment.deployment.startTime
            ? new Date(Date.now() - deployment.deployment.startTime.getTime()).toISOString()
            : 'Unknown',
        });
        cleanedCount++;
      }

      logger.info(`🧹 [Cleanup] Cleaned up ${cleanedCount} stuck deployments for user ${session.user.id}`);

      return NextResponse.json({
        success: true,
        message: `Cleaned up ${cleanedCount} stuck deployments`,
        cleanedCount,
        cleanedDeployments: stuckDeployments.map(d => ({
          teamInstanceId: d.teamInstanceId,
          teamName: d.name,
          status: d.deployment.status,
          stuckTime: (d.deployment.deployedAt || d.deployment.createdAt)
            ? Math.round((Date.now() - (d.deployment.deployedAt || d.deployment.createdAt).getTime()) / (1000 * 60)) + ' minutes'
            : 'Unknown',
        })),
      });
    }

    if (action === 'cancel_deployment' && teamInstanceId) {
      // Cancel a specific deployment
      const deployment = await AgentTeam.findOne({
        userId: session.user.id,
        teamInstanceId: teamInstanceId,
        'deployment.status': { $in: ['validating', 'deploying', 'active'] },
      });

      if (!deployment) {
        return NextResponse.json({
          success: false,
          error: 'Deployment not found or already completed',
        }, { status: 404 });
      }

      await deployment.cancel('Manually cancelled by user');
      
      return NextResponse.json({
        success: true,
        message: `Deployment ${teamInstanceId} cancelled successfully`,
        teamInstanceId: deployment.teamInstanceId,
        teamName: deployment.name,
      });
    }

    if (action === 'force_cleanup_all') {
      // FORCE cleanup ALL active deployments (for debugging)
      const allActiveDeployments = await AgentTeam.find({
        userId: session.user.id,
        'deployment.status': { $in: ['validating', 'deploying', 'active'] },
      });

      let cleanedCount = 0;
      for (const deployment of allActiveDeployments) {
        await deployment.fail('Force cleanup - manually triggered', {
          forceCleanup: true,
          originalStatus: deployment.deployment.status,
          cleanupTime: new Date().toISOString(),
        });
        cleanedCount++;
      }

      logger.info(`🧹 [ForceCleanup] Force cleaned ${cleanedCount} deployments for user ${session.user.id}`);

      return NextResponse.json({
        success: true,
        message: `Force cleaned ${cleanedCount} active deployments`,
        cleanedCount,
        cleanedDeployments: allActiveDeployments.map(d => ({
          teamInstanceId: d.teamInstanceId,
          teamName: d.name,
          status: d.deployment.status,
        })),
      });
    }

    if (action === 'list_active') {
      // List all active deployments for this user
      const activeDeployments = await AgentTeam.find({
        userId: session.user.id,
        'deployment.status': { $in: ['validating', 'deploying', 'active'] },
      });

      return NextResponse.json({
        success: true,
        activeDeployments: activeDeployments.map(d => ({
          teamInstanceId: d.teamInstanceId,
          teamName: d.name,
          status: d.deployment.status,
          workflowInstanceId: d.deployment.workflowInstanceId,
          startTime: d.deployment.deployedAt || d.deployment.createdAt,
          age: (d.deployment.deployedAt || d.deployment.createdAt)
          ? Math.round((Date.now() - (d.deployment.deployedAt || d.deployment.createdAt).getTime()) / (1000 * 60)) + ' minutes'
          : 'Unknown',
        })),
        count: activeDeployments.length,
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Supported actions: cleanup_failed, cancel_deployment, list_active, status, force_cleanup_all',
    }, { status: 400 });

  } catch (error) {
    logger.error('Error processing cleanup request:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process cleanup request',
        details: error.message,
      },
      { status: 500 }
    );
  }
}