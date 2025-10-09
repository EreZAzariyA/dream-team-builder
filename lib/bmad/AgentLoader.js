/**
 * Simple BMAD Agent Loader
 * Loads agent YAML definitions from .bmad-core/agents/*.md files
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from '../utils/logger.js';

class AgentLoader {
  constructor() {
    this.agents = new Map();
    this.metadataCache = null;
  }

  /**
   * Load a specific agent by ID
   */
  async loadAgent(agentId) {
    if (this.agents.has(agentId)) {
      return this.agents.get(agentId);
    }

    const agentPath = path.join(process.cwd(), '.bmad-core', 'agents', `${agentId}.md`);
    
    if (!fs.existsSync(agentPath)) {
      logger.error(`❌ Agent '${agentId}' not found at: ${agentPath}`);
      return null;
    }

    try {
      const content = fs.readFileSync(agentPath, 'utf8');
      
      const yamlMatch = content.match(/```yaml\s*\n([\s\S]*?)\n```/);
      if (!yamlMatch) {
        throw new Error('No YAML block found in agent file');
      }

      const agentData = yaml.load(yamlMatch[1]);
      
      if (!agentData?.agent) {
        throw new Error('Invalid agent structure - missing agent section');
      }

      const agent = {
        id: agentData.agent.id || agentId,
        name: agentData.agent.name || agentId,
        title: agentData.agent.title || 'Agent',
        icon: agentData.agent.icon || '🤖',
        whenToUse: agentData.agent.whenToUse || '',
        persona: agentData.persona || {},
        commands: agentData.commands || [],
        dependencies: agentData.dependencies || {},
        agent: agentData.agent
      };

      this.agents.set(agentId, agent); // Cache the loaded agent
      return agent;
      
    } catch (error) {
      logger.error(`❌ Error loading agent '${agentId}': ${error.message}`);
      return null;
    }
  }

  /**
   * Load all agents from .bmad-core/agents directory
   */
  async loadAllAgents() {
    const agentsDir = path.join(process.cwd(), '.bmad-core', 'agents');
    
    if (!fs.existsSync(agentsDir)) {
      logger.error(`❌ Agents directory not found: ${agentsDir}`);
      this.agents = new Map();
      this.metadataCache = [];
      return;
    }

    try {
      const files = fs.readdirSync(agentsDir).filter(file => file.endsWith('.md'));
      
      for (const file of files) {
        const agentId = path.basename(file, '.md');
        await this.loadAgent(agentId); // This will load and cache the agent
      }
      
      // Invalidate metadata cache
      this.metadataCache = null;
      logger.info(`🤖 Loaded ${this.agents.size} agents total`);
      
    } catch (error) {
      logger.error(`❌ Error loading agents: ${error.message}`);
      this.agents = new Map();
      this.metadataCache = [];
    }
  }

  /**
   * Check if agent exists
   */
  async agentExists(agentId) {
    const agentPath = path.join(process.cwd(), '.bmad-core', 'agents', `${agentId}.md`);
    return fs.existsSync(agentPath);
  }

  /**
   * Get simple agent metadata for UI
   */
  async getAgentSummary(agentId) {
    const agent = await this.loadAgent(agentId);
    if (!agent) return null;

    return {
      id: agent.id,
      name: agent.name,
      title: agent.title,
      icon: agent.icon,
      whenToUse: agent.whenToUse
    };
  }

  /**
   * Get metadata for all agents
   */
  getAllAgentsMetadata() {
    if (this.metadataCache) {
      return this.metadataCache;
    }

    const metadata = [];
    for (const agent of this.agents.values()) {
      metadata.push({
        id: agent.id,
        name: agent.name,
        title: agent.title,
        icon: agent.icon,
        description: agent.whenToUse || agent.persona?.role,
      });
    }
    
    this.metadataCache = metadata;
    return metadata;
  }
}

// Export both named and default
export { AgentLoader };
export default AgentLoader;