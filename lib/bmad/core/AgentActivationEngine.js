/**
 * BMAD Agent Activation Engine
 * 
 * Loads and activates agent personas from database.
 * Implements the agent persona system discovered in documentation analysis.
 * 
 * Key Features:
 * - Load agent definitions from database
 * - Load agent personas with unique voices and capabilities  
 * - Manage agent state and context
 * - Handle agent switching and command routing
 * - Implement permission-based document section editing
 */

import logger from '../../utils/logger.js';
import Agent from '../../database/models/Agent.js';
import { connectMongoose } from '../../database/mongodb.js';

class AgentActivationEngine {
  constructor(configurationManager) {
    this.configManager = configurationManager;
    this.agents = new Map();
    this.activeAgent = null;
    this.agentStates = new Map();
    this.loadedAgentFiles = new Set();
    
    // Special agents from documentation
    this.specialAgents = {
      'bmad-orchestrator': 'Meta-agent that transforms into any specialist',
      'bmad-master': 'Universal task executor without persona constraints'
    };
  }

  /**
   * Load all agent definitions from .bmad-core/agents/ directory
   */
  async loadAllAgents() {
    if (!this.configManager.isLoaded) {
      throw new Error('Configuration must be loaded before loading agents');
    }

    const agentsPath = this.configManager.getBmadCorePaths().agents;
    logger.info(`🤖 [AGENTS] Loading agents from: ${agentsPath}`);

    try {
      // Get all .md files in agents directory
      const files = await fs.readdir(agentsPath);
      const agentFiles = files.filter(file => file.endsWith('.md'));

      logger.info(`🤖 [AGENTS] Found ${agentFiles.length} agent files: ${agentFiles.join(', ')}`);

      // Load each agent file
      for (const filename of agentFiles) {
        await this.loadAgent(filename);
      }

      logger.info(`✅ [AGENTS] Successfully loaded ${this.agents.size} agents`);
      return this.agents;

    } catch (error) {
      logger.error(`❌ [AGENTS] Failed to load agents from ${agentsPath}:`, error.message);
      throw new Error(`Failed to load agents: ${error.message}`);
    }
  }

  /**
   * Load individual agent from file
   */
  async loadAgent(filename) {
    const agentsPath = this.configManager.getBmadCorePaths().agents;
    const filePath = path.join(agentsPath, filename);
    const agentId = path.basename(filename, '.md');

    try {
      validateFilePath(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Parse agent definition (YAML front matter + markdown)
      const agent = this.parseAgentDefinition(content, agentId, filePath);
      
      // Store agent
      this.agents.set(agentId, agent);
      this.loadedAgentFiles.add(filename);
      
      logger.info(`✅ [AGENT] Loaded agent: ${agentId} (${agent.agent?.name || agentId})`);
      return agent;

    } catch (error) {
      logger.error(`❌ [AGENT] Failed to load agent ${agentId}:`, error.message);
      throw error;
    }
  }

  /**
   * Parse agent definition from markdown file
   * Agents can be YAML-only or YAML front matter + markdown content
   */
  parseAgentDefinition(content, agentId, filePath) {
    try {
      // Check if it's pure YAML or YAML front matter + markdown
      let yamlContent, markdownContent = '';
      
      if (content.startsWith('```yaml\n')) {
        // Extract YAML from code block
        const endIndex = content.indexOf('\n```', 7);
        if (endIndex === -1) {
          throw new Error('Invalid YAML code block format');
        }
        yamlContent = content.substring(7, endIndex);
        markdownContent = content.substring(endIndex + 4).trim();
      } else if (content.startsWith('---\n')) {
        // YAML front matter format
        const endIndex = content.indexOf('\n---\n', 4);
        if (endIndex === -1) {
          yamlContent = content.substring(4);
        } else {
          yamlContent = content.substring(4, endIndex);
          markdownContent = content.substring(endIndex + 5).trim();
        }
      } else {
        // Assume entire content is YAML
        yamlContent = content;
      }

      // Parse YAML
      const agentData = yaml.load(yamlContent);
      
      if (!agentData || typeof agentData !== 'object') {
        throw new Error('Agent definition must be a valid YAML object');
      }

      // Build complete agent object
      const agent = {
        id: agentId,
        filePath: filePath,
        ...agentData,
        markdownContent: markdownContent,
        loadedAt: new Date().toISOString()
      };

      // Validate required agent fields
      this.validateAgentDefinition(agent);
      
      return agent;

    } catch (error) {
      throw new Error(`Failed to parse agent definition: ${error.message}`);
    }
  }

  /**
   * Validate agent definition structure
   */
  validateAgentDefinition(agent) {
    // Basic structure validation
    if (!agent.agent || typeof agent.agent !== 'object') {
      throw new Error('Agent must have an "agent" section');
    }

    const agentInfo = agent.agent;
    
    // Required fields
    const requiredFields = ['name', 'title'];
    for (const field of requiredFields) {
      if (!agentInfo[field]) {
        logger.warn(`⚠️ [AGENT] Missing recommended field "${field}" for agent ${agent.id}`);
      }
    }

    // Validate commands structure if present
    if (agent.commands && !Array.isArray(agent.commands)) {
      throw new Error('Agent commands must be an array');
    }

    // Validate dependencies if present
    if (agent.dependencies && !Array.isArray(agent.dependencies)) {
      throw new Error('Agent dependencies must be an array');
    }
  }

  /**
   * Activate an agent (switch to agent persona)
   */
  async activateAgent(agentId) {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      throw new Error(`Agent "${agentId}" not found. Available agents: ${Array.from(this.agents.keys()).join(', ')}`);
    }

    logger.info(`🎭 [ACTIVATION] Activating agent: ${agentId} (${agent.agent?.name || agentId})`);

    // Store previous active agent
    const previousAgent = this.activeAgent;
    
    // Set new active agent
    this.activeAgent = {
      id: agentId,
      agent: agent,
      activatedAt: new Date(),
      previousAgent: previousAgent?.id || null
    };

    // Initialize agent state
    if (!this.agentStates.has(agentId)) {
      this.agentStates.set(agentId, {
        loaded: false,
        dependencies: [],
        context: {},
        permissions: this.extractAgentPermissions(agent),
        executionHistory: []
      });
    }

    // Log activation details
    this.logAgentActivation(agent);
    
    return this.activeAgent;
  }

  /**
   * Log agent activation with persona details
   */
  logAgentActivation(agent) {
    const agentInfo = agent.agent;
    const name = agentInfo.name || agent.id;
    const title = agentInfo.title || 'AI Assistant';
    const icon = agentInfo.icon || '🤖';
    const description = agentInfo.description || 'No description available';

    logger.info(`🎭 [PERSONA] ${icon} Activated: ${name}, ${title}`);
    logger.info(`📋 [PERSONA] Role: ${description}`);
    
    if (agent.commands && agent.commands.length > 0) {
      logger.info(`⚙️ [PERSONA] Available commands: ${agent.commands.length}`);
    }
    
    if (agent.dependencies && agent.dependencies.length > 0) {
      logger.info(`📦 [PERSONA] Dependencies: ${agent.dependencies.join(', ')}`);
    }
  }

  /**
   * Extract agent permissions from agent definition
   */
  extractAgentPermissions(agent) {
    const permissions = {
      canEdit: agent.permissions?.canEdit || [],
      canCreate: agent.permissions?.canCreate || [],
      canDelete: agent.permissions?.canDelete || [],
      canView: agent.permissions?.canView || ['all'],
      restrictedSections: agent.permissions?.restrictedSections || []
    };

    // Special handling for dev agent restrictions
    if (agent.id === 'dev') {
      permissions.restrictedSections.push(
        'business-requirements',
        'competitive-analysis', 
        'market-research'
      );
      logger.info(`🔒 [PERMISSIONS] Applied dev agent restrictions`);
    }

    return permissions;
  }

  /**
   * Load agent dependencies (only when needed, not during activation)
   */
  async loadAgentDependencies(agentId) {
    const agent = this.agents.get(agentId);
    const state = this.agentStates.get(agentId);
    
    if (!agent || !state) {
      throw new Error(`Agent ${agentId} not found or not activated`);
    }

    if (state.loaded) {
      logger.info(`📦 [DEPENDENCIES] Dependencies already loaded for ${agentId}`);
      return state.dependencies;
    }

    logger.info(`📦 [DEPENDENCIES] Loading dependencies for ${agentId}`);

    const dependencies = [];
    
    if (agent.dependencies) {
      for (const depPath of agent.dependencies) {
        try {
          const dependency = await this.loadDependency(depPath);
          dependencies.push(dependency);
        } catch (error) {
          logger.warn(`⚠️ [DEPENDENCIES] Failed to load dependency ${depPath}:`, error.message);
        }
      }
    }

    // Special handling for dev agent always-load files
    if (agentId === 'dev') {
      const devFiles = this.configManager.getDevAlwaysFiles();
      for (const filePath of devFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          dependencies.push({
            type: 'dev-always-file',
            path: filePath,
            content: content
          });
        } catch (error) {
          logger.warn(`⚠️ [DEV-FILES] Failed to load dev file ${filePath}:`, error.message);
        }
      }
    }

    state.dependencies = dependencies;
    state.loaded = true;
    
    logger.info(`✅ [DEPENDENCIES] Loaded ${dependencies.length} dependencies for ${agentId}`);
    return dependencies;
  }

  /**
   * Load a single dependency
   */
  async loadDependency(dependencyPath) {
    const paths = this.configManager.getBmadCorePaths();
    
    // Resolve dependency path
    let fullPath;
    if (dependencyPath.startsWith('.bmad-core/')) {
      fullPath = path.resolve(process.cwd(), dependencyPath);
    } else if (dependencyPath.includes('/')) {
      fullPath = path.resolve(process.cwd(), dependencyPath);
    } else {
      // Try to find in BMAD core directories
      for (const [type, dirPath] of Object.entries(paths)) {
        const candidatePath = path.join(dirPath, dependencyPath);
        try {
          await fs.access(candidatePath, fs.constants.F_OK);
          fullPath = candidatePath;
          break;
        } catch (error) {
          continue;
        }
      }
    }

    if (!fullPath) {
      throw new Error(`Dependency not found: ${dependencyPath}`);
    }

    const content = await fs.readFile(fullPath, 'utf8');
    const ext = path.extname(fullPath);
    
    return {
      type: ext === '.md' ? 'markdown' : ext === '.yaml' ? 'yaml' : 'text',
      path: fullPath,
      content: content,
      loadedAt: new Date().toISOString()
    };
  }

  /**
   * Get active agent information
   */
  getActiveAgent() {
    return this.activeAgent;
  }

  /**
   * Get all loaded agents
   */
  getAllAgents() {
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.agent?.name || agent.id,
      title: agent.agent?.title || 'AI Assistant',
      icon: agent.agent?.icon || '🤖',
      description: agent.agent?.description || 'No description',
      commands: agent.commands?.length || 0,
      loaded: this.agentStates.has(agent.id)
    }));
  }

  /**
   * Check agent permissions for document section
   */
  canAgentEditSection(agentId, sectionType, documentType = null) {
    const state = this.agentStates.get(agentId);
    if (!state) return false;

    const permissions = state.permissions;
    
    // Check if section is restricted
    if (permissions.restrictedSections.includes(sectionType)) {
      return false;
    }
    
    // Check if agent can edit this type
    if (permissions.canEdit.includes(sectionType) || permissions.canEdit.includes('all')) {
      return true;
    }
    
    return false;
  }

  /**
   * Get agent help information
   */
  getAgentHelp(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    const agentInfo = agent.agent;
    const commands = agent.commands || [];
    
    return {
      name: agentInfo.name || agentId,
      title: agentInfo.title || 'AI Assistant',
      icon: agentInfo.icon || '🤖',
      description: agentInfo.description || 'No description available',
      commands: commands.map((cmd, index) => ({
        number: index + 1,
        command: typeof cmd === 'string' ? cmd : Object.keys(cmd)[0],
        description: typeof cmd === 'object' ? Object.values(cmd)[0] : `Execute ${cmd}`
      })),
      usage: `Type *help to see available commands for ${agentInfo.name || agentId}`
    };
  }

  /**
   * System health check
   */
  getSystemHealth() {
    const totalAgents = this.agents.size;
    const activeAgent = this.activeAgent;
    const loadedStates = this.agentStates.size;

    return {
      totalAgents,
      activeAgent: activeAgent ? {
        id: activeAgent.id,
        name: activeAgent.agent.agent?.name,
        activatedAt: activeAgent.activatedAt
      } : null,
      loadedStates,
      agentFiles: Array.from(this.loadedAgentFiles),
      specialAgentsAvailable: Object.keys(this.specialAgents),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { AgentActivationEngine };