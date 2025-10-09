import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../lib/utils/routeAuth.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import AgentTeam from '../../../../lib/database/models/AgentTeam.js';

/**
 * GET /api/agent-teams/status
 * Returns status of all agent teams and their individual agents
 */
export async function GET(request) {
  try {
    const { user, error: authError } = await authenticateRoute(request);
    if (authError) return authError;

    await connectMongoose();

    // Get all teams for the user (active and recently completed)
    const teams = await AgentTeam.find({
      userId: user._id,
      isActive: true,
      $or: [
        { 'deployment.status': { $in: ['active', 'running', 'paused', 'completed'] } },
        { 'deployment.updatedAt': { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Last 24 hours
      ]
    })
    .sort({ 'deployment.updatedAt': -1 })
    .limit(50)
    .lean();

    // Transform data for agent status display
    const teamsWithStatus = teams.map(team => ({
      teamInstanceId: team.teamInstanceId,
      teamId: team.teamId,
      teamConfig: {
        name: team.teamConfig?.name || team.teamId,
        agents: team.teamConfig?.agents || []
      },
      agents: team.teamConfig?.agents || [],
      deployment: {
        status: team.deployment?.status || 'idle',
        workflowInstanceId: team.deployment?.workflowInstanceId,
        currentStep: team.deployment?.currentStep,
        progress: team.deployment?.progress || 0,
        createdAt: team.deployment?.createdAt,
        updatedAt: team.deployment?.updatedAt
      },
      performance: team.performance
    }));

    // Calculate summary stats
    const totalAgents = teamsWithStatus.reduce((acc, team) => acc + (team.agents?.length || 0), 0);
    const activeTeams = teamsWithStatus.filter(team => 
      ['active', 'running'].includes(team.deployment.status)
    ).length;

    return NextResponse.json({
      success: true,
      teams: teamsWithStatus,
      summary: {
        totalTeams: teamsWithStatus.length,
        activeTeams,
        totalAgents,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching agent teams status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent teams status', details: error.message },
      { status: 500 }
    );
  }
}