/**
 * BMAD Agents API Endpoints
 * Provides CRUD operations for BMAD agents using database
 */

import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../lib/utils/routeAuth.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import Agent from '../../../../lib/database/models/Agent.js';

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

/**
 * GET /api/bmad/agents - Get all available agents
 */
export async function GET(request) {
  try {
    await connectMongoose();

    // Check for admin-only access for full details
    const { user, error: authError } = await authenticateRoute();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const onlyActive = searchParams.get('onlyActive') === 'true';

    // Build query based on user role and parameters
    let query = {};
    
    if (onlyActive || (!user || user.profile?.role !== 'admin')) {
      // Non-admin users and explicit onlyActive requests only see active agents
      query.isActive = true;
    } else if (user.profile?.role === 'admin' && !includeInactive) {
      // Admin users see active agents by default unless specifically requesting inactive
      query.isActive = true;
    }

    const agents = await Agent.find(query)
      .sort({ category: 1, name: 1 })
      .lean();

    // Convert to API format
    const formattedAgents = agents.map(agent => ({
      id: agent.agentId,
      name: agent.name,
      title: agent.title,
      icon: agent.icon,
      description: agent.whenToUse || agent.persona?.identity || '',
      commands: agent.commands || [],
      capabilities: agent.persona?.core_principles || [],
      persona: agent.persona || {},
      dependencies: agent.dependencies || {},
      category: agent.category,
      isSystemAgent: agent.isSystemAgent,
      isActive: agent.isActive,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    }));
    
    return NextResponse.json({
      success: true,
      agents: formattedAgents,
      meta: {
        agentCount: formattedAgents.length,
        totalCommands: formattedAgents.reduce((sum, agent) => sum + (agent.commands?.length || 0), 0),
        categories: [...new Set(formattedAgents.map(a => a.category))],
        systemAgents: formattedAgents.filter(a => a.isSystemAgent).length,
        customAgents: formattedAgents.filter(a => !a.isSystemAgent).length
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

/**
 * POST /api/bmad/agents - Create a new agent
 */
export async function POST(request) {
  try {
    await connectMongoose();

    const { user, error: authError } = await authenticateRoute();
    if (authError) return authError;

    // Only admin users can create agents
    if (user.profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { agentData, rawContent } = body;

    // Validate required fields
    if (!agentData.id || !agentData.name || !agentData.title) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, title' },
        { status: 400 }
      );
    }

    // Validate agent ID format
    if (!/^[a-z-]+$/.test(agentData.id)) {
      return NextResponse.json(
        { error: 'Agent ID must be lowercase with hyphens only' },
        { status: 400 }
      );
    }

    // Check if agent already exists
    const existingAgent = await Agent.findOne({ agentId: agentData.id });
    if (existingAgent) {
      return NextResponse.json(
        { error: 'Agent with this ID already exists' },
        { status: 409 }
      );
    }

    // Create new agent
    const newAgent = new Agent({
      agentId: agentData.id,
      name: agentData.name,
      title: agentData.title,
      icon: agentData.icon || '🤖',
      whenToUse: agentData.whenToUse || '',
      persona: agentData.persona || {
        role: '',
        style: '',
        identity: '',
        focus: '',
        core_principles: []
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
      dependencies: agentData.dependencies || {
        tasks: [],
        templates: [],
        checklists: [],
        data: []
      },
      activationInstructions: normalizeActivationInstructions(agentData.activationInstructions || []),
      category: agentData.category || 'custom',
      isSystemAgent: agentData.isSystemAgent || false,
      rawContent: rawContent || null,
      createdBy: user._id,
      updatedBy: user._id
    });

    await newAgent.save();

    return NextResponse.json({
      success: true,
      message: 'Agent created successfully',
      agent: newAgent.toApiFormat()
    });

  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bmad/agents - Update an existing agent
 */
export async function PUT(request) {
  try {
    await connectMongoose();

    const { user, error: authError } = await authenticateRoute();
    if (authError) return authError;

    // Only admin users can update agents
    if (user.profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { agentId, agentData, rawContent } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Find existing agent
    const existingAgent = await Agent.findOne({ agentId });
    if (!existingAgent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Update agent fields
    const updateData = {
      name: agentData.name || existingAgent.name,
      title: agentData.title || existingAgent.title,
      icon: agentData.icon || existingAgent.icon,
      whenToUse: agentData.whenToUse || existingAgent.whenToUse,
      persona: agentData.persona || existingAgent.persona,
      commands: agentData.commands || existingAgent.commands,
      dependencies: agentData.dependencies || existingAgent.dependencies,
      activationInstructions: agentData.activationInstructions || existingAgent.activationInstructions,
      category: agentData.category || existingAgent.category,
      isSystemAgent: agentData.isSystemAgent !== undefined ? agentData.isSystemAgent : existingAgent.isSystemAgent,
      isActive: agentData.isActive !== undefined ? agentData.isActive : existingAgent.isActive,
      rawContent: rawContent || existingAgent.rawContent,
      updatedBy: user._id
    };

    const updatedAgent = await Agent.findOneAndUpdate(
      { agentId },
      updateData,
      { new: true, runValidators: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Agent updated successfully',
      agent: updatedAgent.toApiFormat()
    });

  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { error: 'Failed to update agent', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bmad/agents - Delete an agent
 */
export async function DELETE(request) {
  try {
    await connectMongoose();

    const { user, error: authError } = await authenticateRoute();
    if (authError) return authError;

    // Only admin users can delete agents
    if (user.profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('id');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Find the agent
    const agent = await Agent.findOne({ agentId });
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Handle deletion based on agent type
    const forceDelete = searchParams.get('force') === 'true';
    const softDelete = searchParams.get('soft') === 'true';
    
    if (agent.isSystemAgent) {
      // System agents: Only soft delete (deactivate) unless forced
      if (forceDelete && softDelete) {
        // Force soft delete for system agents
        await Agent.findOneAndUpdate(
          { agentId },
          { isActive: false, updatedBy: user._id },
          { new: true }
        );
        
        return NextResponse.json({
          success: true,
          message: 'System agent deactivated successfully',
          type: 'soft_delete'
        });
      } else {
        // Prevent hard deletion of system agents
        return NextResponse.json(
          { 
            error: 'Cannot delete system agents. Use ?force=true&soft=true to deactivate instead.',
            suggestion: 'System agents can only be deactivated to preserve BMAD functionality.'
          },
          { status: 403 }
        );
      }
    } else {
      // Custom agents: Allow both soft and hard delete
      const hardDelete = searchParams.get('hard') === 'true';
      
      if (hardDelete) {
        // Permanent deletion for custom agents
        await Agent.findOneAndDelete({ agentId });
        
        return NextResponse.json({
          success: true,
          message: 'Custom agent deleted permanently',
          type: 'hard_delete'
        });
      } else {
        // Soft delete (deactivate) custom agents
        await Agent.findOneAndUpdate(
          { agentId },
          { isActive: false, updatedBy: user._id },
          { new: true }
        );
        
        return NextResponse.json({
          success: true,
          message: 'Custom agent deactivated successfully',
          type: 'soft_delete'
        });
      }
    }

  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bmad/agents - Reactivate a deactivated agent
 */
export async function PATCH(request) {
  try {
    await connectMongoose();

    const { user, error: authError } = await authenticateRoute();
    if (authError) return authError;

    // Only admin users can reactivate agents
    if (user.profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('id');
    const action = searchParams.get('action');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    if (action === 'reactivate') {
      // Reactivate a deactivated agent
      const agent = await Agent.findOne({ agentId });
      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
      }

      await Agent.findOneAndUpdate(
        { agentId },
        { isActive: true, updatedBy: user._id },
        { new: true }
      );

      return NextResponse.json({
        success: true,
        message: `${agent.isSystemAgent ? 'System' : 'Custom'} agent reactivated successfully`,
        type: 'reactivation'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use ?action=reactivate' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error updating agent status:', error);
    return NextResponse.json(
      { error: 'Failed to update agent status', details: error.message },
      { status: 500 }
    );
  }
}