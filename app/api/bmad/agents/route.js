/**
 * BMAD Agents API Endpoints
 * Provides information about available agents and their capabilities
 */

import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../lib/utils/routeAuth.js';

/**
 * GET /api/bmad/agents - Get all available agents
 */
export async function GET(request) {
  try {
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    // Load agents directly from .bmad-core/agents/
    const agents = await loadBmadAgents();
    
    return NextResponse.json({
      success: true,
      agents,
      meta: {
        agentCount: agents.length,
        totalCommands: agents.reduce((sum, agent) => sum + (agent.commands?.length || 0), 0)
      }
    });

  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents', details: error.message },
      { status: 500 }
    );
  }
}

async function loadBmadAgents() {
  const { promises: fs } = require('fs');
  const path = require('path');
  const yaml = require('js-yaml');
  
  const AGENTS_DIR = path.join(process.cwd(), '.bmad-core', 'agents');
  const agents = [];
  
  try {
    const files = await fs.readdir(AGENTS_DIR);
    const agentFiles = files.filter(file => file.endsWith('.md'));

    for (const file of agentFiles) {
      try {
        const filePath = path.join(AGENTS_DIR, file);
        const content = await fs.readFile(filePath, 'utf8');
        const yamlMatch = content.match(/```yaml\s*\n([\s\S]*?)\n```/);

        if (!yamlMatch) {
          continue;
        }

        const yamlContent = yamlMatch[1];
        const agentData = yaml.load(yamlContent);

        if (agentData?.agent && agentData?.commands) {
          // Extract commands array
          let commandsList = [];
          if (Array.isArray(agentData.commands)) {
            commandsList = agentData.commands.map(cmd => {
              if (typeof cmd === 'string') {
                return cmd;
              } else if (typeof cmd === 'object' && cmd !== null) {
                return Object.keys(cmd)[0];
              }
              return 'unknown';
            });
          } else if (typeof agentData.commands === 'object') {
            commandsList = Object.keys(agentData.commands);
          }

          agents.push({
            id: agentData.agent.id,
            name: agentData.agent.name,
            title: agentData.agent.title,
            icon: agentData.agent.icon,
            description: agentData.agent.whenToUse || agentData.persona?.identity || '',
            commands: commandsList,
            capabilities: agentData.persona?.core_principles || [],
            persona: {
              role: agentData.persona?.role || '',
              style: agentData.persona?.style || '',
              identity: agentData.persona?.identity || '',
              focus: agentData.persona?.focus || ''
            },
            dependencies: agentData.dependencies || {}
          });
        }
      } catch (fileError) {
        console.error(`Error processing agent ${file}:`, fileError.message);
      }
    }
  } catch (error) {
    console.error('Error loading BMAD agents:', error);
  }
  
  return agents;
}