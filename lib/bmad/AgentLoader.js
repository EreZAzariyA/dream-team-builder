/**
 * BMAD Agent Loader Service
 * Handles loading, parsing, and managing BMAD agent definitions from database
 */

import logger from '../utils/logger.js';
import Agent from '../database/models/Agent.js';
import { connectMongoose } from '../database/mongodb.js';

// Check if we're in server environment
const isServer = typeof window === 'undefined';

class AgentLoader {
  constructor() {
    // agentCache has been removed to ensure fresh data from the database
    this.dependencies = {
      tasks: new Map(),
      templates: new Map(),
      checklists: new Map(),
      data: new Map(),
      workflows: new Map()
    };
  }

  /**
   * Load all available BMAD agents from database
   */
  async loadAllAgents() {
    if (!isServer) {
      console.warn('AgentLoader can only run on server side');
      return new Map();
    }

    try {
      await connectMongoose();
      
      // Load all active agents from database
      const dbAgents = await Agent.find({ isActive: true }).lean();
      const agents = new Map();

      for (const dbAgent of dbAgents) {
        const agent = {
          id: dbAgent.agentId,
          config: dbAgent,  // Pass the entire agent as config for compatibility
          activationInstructions: dbAgent.activationInstructions || [],
          agent: {
            id: dbAgent.agentId,
            name: dbAgent.name,
            title: dbAgent.title,
            icon: dbAgent.icon,
            whenToUse: dbAgent.whenToUse
          },
          persona: dbAgent.persona || {},
          commands: Array.from(dbAgent.commands || new Map()),
          dependencies: dbAgent.dependencies || {},
          rawContent: dbAgent.rawContent,
          status: 'idle',
          lastExecuted: null,
          executionHistory: []
        };
        
        agents.set(dbAgent.agentId, agent);
      }

      logger.info(`✅ [AGENT LOADER] Loaded ${agents.size} agents from database`);
      return agents;
    } catch (error) {
      logger.error('❌ [AGENT LOADER] Error loading agents from database:', error);
      return new Map();
    }
  }

  /**
   * Load a specific agent by ID from database
   */
  async loadAgent(agentId) {
    try {
      await connectMongoose();

      // Handle compound agent IDs like "pm/architect" by trying fallback strategies
      let actualAgentId = agentId;
      let dbAgent = await Agent.findOne({ agentId: actualAgentId, isActive: true }).lean();
      
      if (!dbAgent && agentId.includes('/')) {
        const parts = agentId.split('/');
        logger.warn(`⚠️ [AGENT LOADER] Compound agent ID '${agentId}' not found, trying fallbacks...`);
        
        // Strategy 1: Try the first part (e.g., "pm" from "pm/architect")
        actualAgentId = parts[0];
        dbAgent = await Agent.findOne({ agentId: actualAgentId, isActive: true }).lean();
        
        if (!dbAgent) {
          // Strategy 2: Try the second part (e.g., "architect" from "pm/architect")
          actualAgentId = parts[1];
          dbAgent = await Agent.findOne({ agentId: actualAgentId, isActive: true }).lean();
        }
        
        if (dbAgent) {
          logger.info(`✅ [AGENT LOADER] Using fallback agent '${actualAgentId}' for '${agentId}'`);
        }
      }

      if (!dbAgent) {
        logger.error(`❌ [AGENT LOADER] Agent '${agentId}' not found in database`);
        return null;
      }

      const agent = {
        id: dbAgent.agentId,
        config: dbAgent.config,
        activationInstructions: dbAgent.config?.activationInstructions || [],
        agent: dbAgent.config?.agent || {},
        persona: dbAgent.config?.persona || {},
        commands: dbAgent.config?.commands || [],
        dependencies: dbAgent.config?.dependencies || {},
        rawContent: dbAgent.content,
        status: 'idle',
        lastExecuted: null,
        executionHistory: []
      };
      
      return agent;
    } catch (error) {
      logger.error(`❌ [AGENT LOADER] Error loading agent ${agentId}:`, error);
      return null;
    }
  }


  /**
   * Get agent metadata
   */
  async getAgentMetadata(agentId) {
    const agent = await this.loadAgent(agentId);
    if (!agent) return null;

    return {
      id: agent.id,
      name: agent.agent.name || agentId,
      title: agent.agent.title || 'Agent',
      icon: agent.agent.icon || '🤖',
      whenToUse: agent.agent.whenToUse || 'General purpose agent',
      status: agent.status,
      lastExecuted: agent.lastExecuted,
      commands: Array.isArray(agent.commands) ? agent.commands.map(cmd => {
        if (typeof cmd === 'string') return cmd;
        return Object.keys(cmd)[0];
      }) : (agent.commands || [])
    };
  }

  /**
   * Load agent dependency - deprecated, dependencies should be stored in database
   */
  async loadDependency(type, name) {
    logger.warn(`⚠️ [AGENT LOADER] loadDependency is deprecated. Dependencies should be stored in database.`);
    return null;
  }

  /**
   * Get all available agents metadata
   */
  async getAllAgentsMetadata() {
    const agents = await this.loadAllAgents();
    const metadata = [];
    for (const agentId of agents.keys()) {
        const agentMetadata = await this.getAgentMetadata(agentId);
        if (agentMetadata) {
            metadata.push(agentMetadata);
        }
    }
    return metadata;
  }

  /**
   * Check if agent exists
   */
  async hasAgent(agentId) {
    const agent = await this.loadAgent(agentId);
    return !!agent;
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId, status, metadata = {}) {
    // This is now a no-op since agent status is not persisted in memory.
    // This should be handled by the workflow execution state.
    logger.info(`[AgentLoader] updateAgentStatus called for ${agentId} with status ${status}. This is a no-op.`);
  }

  /**
   * Get workflow sequence for BMAD method
   * Default sequence: analyst -> pm -> architect -> dev -> qa
   */
  getDefaultWorkflowSequence() {
    return [
      { agentId: 'analyst', role: 'Business Analysis', description: 'Analyze requirements and business context' },
      { agentId: 'pm', role: 'Product Management', description: 'Create PRD and define product requirements' },
      { agentId: 'architect', role: 'System Architecture', description: 'Design system architecture and technical approach' },
      { agentId: 'dev', role: 'Development', description: 'Implement the solution' },
      { agentId: 'qa', role: 'Quality Assurance', description: 'Test and validate the implementation' }
    ];
  }

  /**
   * Validate workflow sequence
   */
  async validateWorkflowSequence(sequence) {
    const validation = { valid: true, errors: [], warnings: [] };

    for (const step of sequence) {
        if (step.agentId === 'various') {
            // 'various' is valid - handled dynamically
            continue;
        }

        if (step.agentId && step.agentId.includes('/')) {
            const agents = step.agentId.split('/');
            for (const agent of agents) {
                if (!await this.hasAgent(agent.trim())) {
                    validation.valid = false;
                    validation.errors.push(`Multi-agent '${step.agentId}' contains unknown agent '${agent.trim()}'`);
                }
            }
        } else if (step.agentId && !await this.hasAgent(step.agentId)) {
            validation.valid = false;
            validation.errors.push(`Agent '${step.agentId}' not found`);
        }
    }
    return validation;
}


  /**
   * Clear cache
   */
  clearCache() {
    // No-op since there is no cache to clear.
    this.dependencies = {
      tasks: new Map(),
      templates: new Map(),
      checklists: new Map(),
      data: new Map(),
      workflows: new Map()
    };
  }
}

module.exports = { AgentLoader };