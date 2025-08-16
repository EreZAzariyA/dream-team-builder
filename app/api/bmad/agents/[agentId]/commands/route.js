import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../../../lib/utils/routeAuth.js';

const { AgentLoader } = require('@/lib/bmad/AgentLoader.js');

/**
 * GET /api/bmad/agents/[agentId]/commands
 * Returns the agent's commands from their YAML definition
 */
export async function GET(request, { params }) {
  try {
    const { user, session, error } = await authenticateRoute();
    if (error) return error;

    const { agentId } = await params;
    
    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Agent ID is required'
      }, { status: 400 });
    }

    // Load agent and extract commands
    const agentLoader = new AgentLoader();
    await agentLoader.loadAllAgents();
    const agent = await agentLoader.loadAgent(agentId);
    
    if (!agent) {
      return NextResponse.json({
        success: false,
        error: `Agent '${agentId}' not found`
      }, { status: 404 });
    }

    // Extract commands from agent definition
    const commands = [];
    
    if (agent.commands && Array.isArray(agent.commands)) {
      for (const cmd of agent.commands) {
        if (typeof cmd === 'string') {
          // Simple string command
          commands.push({
            name: cmd,
            description: `Execute ${cmd} command`
          });
        } else if (typeof cmd === 'object' && cmd !== null) {
          // Object command with description
          const commandName = Object.keys(cmd)[0];
          const commandDescription = cmd[commandName];
          
          commands.push({
            name: commandName,
            description: commandDescription || `Execute ${commandName} command`
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      agentId,
      agentName: agent.agent?.name || agentId,
      commands,
      totalCommands: commands.length
    });

  } catch (error) {
    console.error('Error fetching agent commands:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch agent commands',
      details: error.message
    }, { status: 500 });
  }
}