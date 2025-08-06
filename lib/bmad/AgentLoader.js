/**
 * BMAD Agent Loader Service
 * Handles loading, parsing, and managing BMAD agent definitions
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

// Check if we're in server environment
const isServer = typeof window === 'undefined';

class AgentLoader {
  constructor() {
    this.agentsPath = path.join(process.cwd(), '.bmad-core', 'agents');
    this.agentCache = new Map();
    this.dependencies = {
      tasks: new Map(),
      templates: new Map(),
      checklists: new Map(),
      data: new Map(),
      workflows: new Map()
    };
  }

  /**
   * Load all available BMAD agents
   */
  async loadAllAgents() {
    if (!isServer) {
      console.warn('AgentLoader can only run on server side');
      return new Map();
    }

    try {
      // Check if agents directory exists
      try {
        await fs.access(this.agentsPath);
      } catch {
        console.warn(`BMAD agents directory not found at ${this.agentsPath}`);
        // Return mock agents for development
        return this.createMockAgents();
      }

      const agentFiles = await fs.readdir(this.agentsPath);
      const agents = new Map();

      for (const file of agentFiles) {
        if (file.endsWith('.md')) {
          const agentId = file.replace('.md', '');
          const agent = await this.loadAgent(agentId);
          if (agent) {
            agents.set(agentId, agent);
          }
        }
      }

      this.agentCache = agents;
      return agents;
    } catch (error) {
      console.error('Error loading agents:', error);
      // Return mock agents instead of failing completely
      return this.createMockAgents();
    }
  }

  /**
   * Load a specific agent by ID
   */
  async loadAgent(agentId) {
    try {
      // Check cache first
      if (this.agentCache.has(agentId)) {
        return this.agentCache.get(agentId);
      }

      const agentPath = path.join(this.agentsPath, `${agentId}.md`);
      const content = await fs.readFile(agentPath, 'utf-8');
      
      const agent = this.parseAgentDefinition(content, agentId);
      this.agentCache.set(agentId, agent);
      
      return agent;
    } catch (error) {
      console.error(`Error loading agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Parse agent definition from markdown content
   */
  parseAgentDefinition(content, agentId) {
    try {
      // Extract YAML block from markdown
      const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/);
      if (!yamlMatch) {
        throw new Error('No YAML configuration found in agent definition');
      }

      const yamlContent = yamlMatch[1];
      const config = yaml.load(yamlContent);

      // Extract activation instructions from YAML content
      const activationInstructions = this.extractActivationInstructions(yamlContent);

      return {
        id: agentId,
        config,
        activationInstructions,
        agent: config.agent || {},
        persona: config.persona || {},
        commands: config.commands || [],
        dependencies: config.dependencies || {},
        rawContent: content,
        status: 'idle',
        lastExecuted: null,
        executionHistory: []
      };
    } catch (error) {
      console.error(`Error parsing agent ${agentId}:`, error);
      throw new Error(`Failed to parse agent definition: ${error.message}`);
    }
  }

  /**
   * Extract activation instructions from YAML content
   */
  extractActivationInstructions(yamlContent) {
    const instructions = [];
    const lines = yamlContent.split('\n');
    let inActivationSection = false;

    for (const line of lines) {
      if (line.trim().startsWith('activation-instructions:')) {
        inActivationSection = true;
        continue;
      }
      
      if (inActivationSection) {
        if (line.startsWith('  - ')) {
          instructions.push(line.substring(4).trim());
        } else if (line.trim() && !line.startsWith('  ')) {
          break; // End of activation instructions section
        }
      }
    }

    return instructions;
  }

  /**
   * Get agent metadata
   */
  getAgentMetadata(agentId) {
    const agent = this.agentCache.get(agentId);
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
   * Load agent dependency file
   */
  async loadDependency(type, name) {
    if (this.dependencies[type]?.has(name)) {
      return this.dependencies[type].get(name);
    }

    try {
      const dependencyPath = path.join(process.cwd(), '.bmad-core', type, name);
      const content = await fs.readFile(dependencyPath, 'utf-8');
      
      if (!this.dependencies[type]) {
        this.dependencies[type] = new Map();
      }
      
      this.dependencies[type].set(name, content);
      return content;
    } catch (error) {
      console.error(`Error loading dependency ${type}/${name}:`, error);
      return null;
    }
  }

  /**
   * Get all available agents metadata
   */
  getAllAgentsMetadata() {
    const metadata = [];
    for (const [agentId, agent] of this.agentCache) {
      metadata.push(this.getAgentMetadata(agentId));
    }
    return metadata;
  }

  /**
   * Check if agent exists
   */
  hasAgent(agentId) {
    return this.agentCache.has(agentId);
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId, status, metadata = {}) {
    const agent = this.agentCache.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastExecuted = status === 'active' ? new Date() : agent.lastExecuted;
      
      if (metadata.executionId) {
        agent.executionHistory.push({
          executionId: metadata.executionId,
          timestamp: new Date(),
          status,
          ...metadata
        });
      }
    }
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
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    for (const step of sequence) {
      if (!this.hasAgent(step.agentId)) {
        validation.valid = false;
        validation.errors.push(`Agent '${step.agentId}' not found`);
      }
    }

    return validation;
  }

  /**
   * Create mock agents for development/testing
   */
  createMockAgents() {
    const mockAgents = new Map();
    
    const agents = [
      { id: 'pm', name: 'Product Manager', icon: '📋', title: 'Product Manager' },
      { id: 'architect', name: 'System Architect', icon: '🏗️', title: 'Architect' },
      { id: 'dev', name: 'Developer', icon: '💻', title: 'Developer' },
      { id: 'qa', name: 'Quality Assurance', icon: '🧪', title: 'QA Engineer' },
      { id: 'ux-expert', name: 'UX Expert', icon: '🎨', title: 'UX Designer' }
    ];

    agents.forEach(agentData => {
      const mockAgent = {
        id: agentData.id,
        config: {
          agent: {
            name: agentData.name,
            id: agentData.id,
            title: agentData.title,
            icon: agentData.icon,
            whenToUse: `Use for ${agentData.title.toLowerCase()} tasks`
          },
          persona: {
            role: agentData.title,
            style: 'Professional and efficient',
            core_principles: ['Quality focused', 'User-centric', 'Collaborative']
          },
          commands: ['help', 'execute', 'status'],
          dependencies: {
            tasks: [],
            templates: [],
            checklists: []
          }
        },
        activationInstructions: [`Activate as ${agentData.title}`, 'Await user instructions'],
        agent: {
          name: agentData.name,
          id: agentData.id,
          title: agentData.title,
          icon: agentData.icon
        },
        persona: {
          role: agentData.title,
          style: 'Professional and efficient'
        },
        commands: ['help', 'execute', 'status'],
        dependencies: {
          tasks: [],
          templates: [],
          checklists: []
        },
        rawContent: `Mock agent definition for ${agentData.name}`,
        status: 'idle',
        lastExecuted: null,
        executionHistory: []
      };
      
      mockAgents.set(agentData.id, mockAgent);
    });

    this.agentCache = mockAgents;
    logger.info(`Created ${mockAgents.size} mock agents for development`);
    return mockAgents;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.agentCache.clear();
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