/**
 * Parse BMAD .md agent files for import
 * POST /api/bmad/agents/parse-md
 */

import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../../lib/utils/routeAuth.js';
import yaml from 'js-yaml';

// Function to normalize activation instructions to consistent string format
const normalizeActivationInstructions = (instructions) => {
  if (!Array.isArray(instructions)) return [];
  
  return instructions.map(instruction => {
    if (typeof instruction === 'string') {
      return instruction;
    } else if (typeof instruction === 'object' && instruction !== null) {
      // Convert objects to string format: "KEY: VALUE"
      const entries = Object.entries(instruction);
      if (entries.length === 1) {
        const [key, value] = entries[0];
        return `${key}: ${value}`;
      } else {
        // Handle complex objects by stringifying
        return JSON.stringify(instruction);
      }
    } else {
      return String(instruction);
    }
  });
};

export async function POST(request) {
  try {
    const { user, error: authError } = await authenticateRoute();
    if (authError) return authError;

    // Only admin users can parse agents for import
    if (user.profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content, fileName } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'File content is required' },
        { status: 400 }
      );
    }

    // Extract YAML block from .md file
    const yamlMatch = content.match(/```yaml\s*\n([\s\S]*?)\n```/);
    if (!yamlMatch) {
      return NextResponse.json(
        { error: 'No YAML block found in .md file' },
        { status: 400 }
      );
    }

    try {
      const yamlContent = yamlMatch[1];
      const agentData = yaml.load(yamlContent);

      if (!agentData || !agentData.agent) {
        return NextResponse.json(
          { error: 'Invalid agent data structure in YAML' },
          { status: 400 }
        );
      }

      // Transform the parsed YAML into the expected agent format
      const transformedAgent = {
        id: agentData.agent.id || fileName,
        name: agentData.agent.name || fileName,
        title: agentData.agent.title || 'Agent',
        icon: agentData.agent.icon || '🤖',
        whenToUse: agentData.agent.whenToUse || '',
        persona: {
          role: agentData.persona?.role || '',
          style: agentData.persona?.style || '',
          identity: agentData.persona?.identity || '',
          focus: agentData.persona?.focus || '',
          core_principles: agentData.persona?.core_principles || []
        },
        commands: agentData.commands ? 
          (agentData.commands.reduce ? 
            agentData.commands.reduce((acc, cmd) => {
              const entries = Object.entries(cmd);
              for (const [key, value] of entries) {
                // Convert complex values to JSON strings
                acc[key] = typeof value === 'object' ? JSON.stringify(value) : value;
              }
              return acc;
            }, {}) : 
            agentData.commands
          ) : { help: 'Show available commands', exit: 'Exit agent mode' },
        dependencies: {
          tasks: agentData.dependencies?.tasks || [],
          templates: agentData.dependencies?.templates || [],
          checklists: agentData.dependencies?.checklists || [],
          data: agentData.dependencies?.data || []
        },
        activationInstructions: normalizeActivationInstructions(
          agentData['activation-instructions'] || agentData.activationInstructions || []
        ),
        category: 'custom', // Imported agents are custom by default
        isSystemAgent: false // Imported agents are not system agents
      };

      // Validate required fields
      if (!transformedAgent.id || !transformedAgent.name || !transformedAgent.title) {
        return NextResponse.json(
          { error: 'Missing required fields: id, name, title in agent data' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        agentData: transformedAgent,
        originalContent: content
      });

    } catch (yamlError) {
      return NextResponse.json(
        { error: `YAML parsing error: ${yamlError.message}` },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error parsing .md file:', error);
    return NextResponse.json(
      { error: 'Failed to parse .md file', details: error.message },
      { status: 500 }
    );
  }
}