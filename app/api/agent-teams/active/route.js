import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../lib/utils/routeAuth.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import AgentTeam from '../../../../lib/database/models/AgentTeam.js';

/**
 * GET /api/agent-teams/active
 * Returns currently active agent team deployments
 */
export async function GET(request) {
  try {
    const { user, error: authError } = await authenticateRoute(request);
    if (authError) return authError;

    await connectMongoose();

    // Get active deployments for the authenticated user
    const activeDeployments = await AgentTeam.find({
      userId: user._id,
      'deployment.status': { $in: ['pending', 'validating', 'active', 'running'] },
      isActive: true
    })
    .sort({ 'deployment.createdAt': -1 })
    .limit(20)
    .lean();

    // Transform data for dashboard consumption
    const deployments = activeDeployments.map(deployment => ({
      teamInstanceId: deployment.teamInstanceId,
      teamId: deployment.teamId,
      teamConfig: {
        name: deployment.teamConfig?.name || deployment.teamId,
        agents: deployment.teamConfig?.agents || []
      },
      deployment: {
        status: deployment.deployment.status,
        workflowInstanceId: deployment.deployment.workflowInstanceId,
        createdAt: deployment.deployment.createdAt,
        updatedAt: deployment.deployment.updatedAt,
        currentStep: deployment.deployment.currentStep,
        progress: deployment.deployment.progress,
        projectContext: deployment.deployment.projectContext
      },
      performance: deployment.performance,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt
    }));

    return NextResponse.json({
      success: true,
      deployments,
      count: deployments.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching active deployments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active deployments', details: error.message },
      { status: 500 }
    );
  }
}