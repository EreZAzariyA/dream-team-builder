/**
 * Admin API endpoint to migrate file-based agents to database
 * POST /api/admin/migrate-agents
 */

import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../lib/utils/routeAuth.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import Agent from '../../../../lib/database/models/Agent.js';
import { promises as fs } from 'fs';
import path from 'path';
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
    await connectMongoose();

    const { user, error: authError } = await authenticateRoute();
    if (authError) return authError;

    // Only admin users can trigger migration
    if (user.profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const agentsDir = path.join(process.cwd(), '.bmad-core', 'agents');
    
    // Check if agents directory exists
    try {
      await fs.access(agentsDir);
    } catch {
      return NextResponse.json(
        { error: 'Agents directory not found. Make sure .bmad-core/agents exists.' },
        { status: 404 }
      );
    }

    // Read all agent files
    const files = await fs.readdir(agentsDir);
    const agentFiles = files.filter(file => file.endsWith('.md'));

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors = [];
    const migrated = [];

    for (const file of agentFiles) {
      const agentId = file.replace('.md', '');
      const filePath = path.join(agentsDir, file);

      try {
        // Check if agent already exists
        const existingAgent = await Agent.findOne({ agentId });
        if (existingAgent) {
          skipCount++;
          continue;
        }

        // Parse agent file
        const content = await fs.readFile(filePath, 'utf8');
        const yamlMatch = content.match(/```yaml\s*\n([\s\S]*?)\n```/);
        
        if (!yamlMatch) {
          errorCount++;
          errors.push(`${agentId}: No YAML block found`);
          continue;
        }

        const yamlContent = yamlMatch[1];
        const agentData = yaml.load(yamlContent);

        if (!agentData || !agentData.agent) {
          errorCount++;
          errors.push(`${agentId}: Invalid agent data`);
          continue;
        }

        // Determine category
        let category = 'core';
        if (['bmad-master', 'bmad-orchestrator'].includes(agentId)) {
          category = 'workflow';
        } else if (['ux-expert'].includes(agentId)) {
          category = 'design';
        }

        // Create agent document
        const agent = new Agent({
          agentId: agentData.agent.id || agentId,
          name: agentData.agent.name || agentId,
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
          commands: agentData.commands ? new Map(Object.entries(
            agentData.commands.reduce ? 
              agentData.commands.reduce((acc, cmd) => {
                const entries = Object.entries(cmd);
                for (const [key, value] of entries) {
                  // Convert complex values to JSON strings
                  acc[key] = typeof value === 'object' ? JSON.stringify(value) : value;
                }
                return acc;
              }, {}) : 
              agentData.commands
          )) : new Map([['help', 'Show available commands'], ['exit', 'Exit agent mode']]),
          dependencies: {
            tasks: agentData.dependencies?.tasks || [],
            templates: agentData.dependencies?.templates || [],
            checklists: agentData.dependencies?.checklists || [],
            data: agentData.dependencies?.data || []
          },
          activationInstructions: normalizeActivationInstructions(agentData['activation-instructions'] || agentData.activationInstructions || []),
          isActive: true,
          isSystemAgent: true,
          category,
          rawContent: content,
          createdBy: user._id,
          updatedBy: user._id
        });

        await agent.save();
        successCount++;
        migrated.push({
          id: agent.agentId,
          name: agent.name,
          category: agent.category
        });

      } catch (error) {
        errorCount++;
        errors.push(`${agentId}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Agent migration completed',
      summary: {
        totalFiles: agentFiles.length,
        successCount,
        skipCount,
        errorCount
      },
      migrated,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    );
  }
}