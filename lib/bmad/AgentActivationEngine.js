/**
 * BMAD Agent Activation Engine
 * 
 * Handles activating agents into specific personas.
 */

const { AgentLoader } = require('./AgentLoader.js');

class AgentActivationEngine {
  constructor() {
    this.agentLoader = new AgentLoader();
  }

  async activateAgent(agentId) {
    const agent = await this.agentLoader.loadAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // For now, we'll just return the agent object.
    // In the future, this could be expanded to do more complex activation.
    return agent;
  }
}

module.exports = { AgentActivationEngine };
