/**
 * Agent Helper Utilities
 * 
 * Shared utilities for working with BMAD agents across the application.
 * Provides consistent styling, icons, and agent-related functionality.
 */

/**
 * Get consistent styling for agent display across the app
 * @param {string} agentId - The agent identifier (pm, architect, dev, etc.)
 * @returns {object} Style object with color, bgColor, and borderColor properties
 */
export const getAgentStyle = (agentId) => {
  const styles = {
    pm: { 
      color: 'text-purple-600', 
      bgColor: 'bg-purple-50 dark:bg-purple-900/20', 
      borderColor: 'border-purple-200 dark:border-purple-800' 
    },
    architect: { 
      color: 'text-cyan-600', 
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20', 
      borderColor: 'border-cyan-200 dark:border-cyan-800' 
    },
    dev: { 
      color: 'text-green-600', 
      bgColor: 'bg-green-50 dark:bg-green-900/20', 
      borderColor: 'border-green-200 dark:border-green-800' 
    },
    qa: { 
      color: 'text-orange-600', 
      bgColor: 'bg-orange-50 dark:bg-orange-900/20', 
      borderColor: 'border-orange-200 dark:border-orange-800' 
    },
    'ux-expert': { 
      color: 'text-pink-600', 
      bgColor: 'bg-pink-50 dark:bg-pink-900/20', 
      borderColor: 'border-pink-200 dark:border-pink-800' 
    },
    analyst: { 
      color: 'text-indigo-600', 
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20', 
      borderColor: 'border-indigo-200 dark:border-indigo-800' 
    },
    po: { 
      color: 'text-blue-600', 
      bgColor: 'bg-blue-50 dark:bg-blue-900/20', 
      borderColor: 'border-blue-200 dark:border-blue-800' 
    },
    sm: { 
      color: 'text-teal-600', 
      bgColor: 'bg-teal-50 dark:bg-teal-900/20', 
      borderColor: 'border-teal-200 dark:border-teal-800' 
    },
    'bmad-orchestrator': {
      color: 'text-slate-600',
      bgColor: 'bg-slate-50 dark:bg-slate-900/20',
      borderColor: 'border-slate-200 dark:border-slate-800'
    }
  };

  // Return default style for unknown agents
  return styles[agentId] || { 
    color: 'text-gray-600', 
    bgColor: 'bg-gray-50 dark:bg-gray-900/20', 
    borderColor: 'border-gray-200 dark:border-gray-800' 
  };
};

/**
 * Get agent display name mapping
 * @param {string} agentId - The agent identifier
 * @returns {string} Human-readable agent name
 */
export const getAgentDisplayName = (agentId) => {
  const names = {
    'bmad-orchestrator': 'BMAD Orchestrator',
    'analyst': 'Business Analyst',
    'pm': 'Project Manager',
    'ux-expert': 'UX Expert',
    'architect': 'System Architect',
    'po': 'Product Owner',
    'sm': 'Scrum Master',
    'dev': 'Developer',
    'qa': 'QA Engineer'
  };

  return names[agentId] || agentId;
};

/**
 * Get consistent team styling (for agent teams)
 * @param {string} teamId - The team identifier (team-all, team-fullstack, etc.)
 * @returns {object} Style object with icon, emoji, color, bgColor, and borderColor properties
 */
export const getTeamStyle = (teamId) => {
  const styles = {
    'team-all': { 
      emoji: '👥', 
      color: 'text-blue-600', 
      bgColor: 'bg-blue-50 dark:bg-blue-900/20', 
      borderColor: 'border-blue-200 dark:border-blue-800' 
    },
    'team-fullstack': { 
      emoji: '🚀', 
      color: 'text-purple-600', 
      bgColor: 'bg-purple-50 dark:bg-purple-900/20', 
      borderColor: 'border-purple-200 dark:border-purple-800' 
    },
    'team-ide-minimal': { 
      emoji: '⚡', 
      color: 'text-green-600', 
      bgColor: 'bg-green-50 dark:bg-green-900/20', 
      borderColor: 'border-green-200 dark:border-green-800' 
    },
    'team-no-ui': { 
      emoji: '🔧', 
      color: 'text-orange-600', 
      bgColor: 'bg-orange-50 dark:bg-orange-900/20', 
      borderColor: 'border-orange-200 dark:border-orange-800' 
    }
  };

  // Return default style for unknown teams
  return styles[teamId] || { 
    emoji: '🤖', 
    color: 'text-gray-600', 
    bgColor: 'bg-gray-50 dark:bg-gray-900/20', 
    borderColor: 'border-gray-200 dark:border-gray-800' 
  };
};

/**
 * Extract agent IDs from agents string/array (handles '*' wildcard)
 * @param {string|array} agents - Agent specification from team config
 * @returns {array} Array of specific agent IDs
 */
export const parseAgentList = (agents) => {
  if (!agents) return [];
  
  // Handle array of agents
  if (Array.isArray(agents)) {
    // If contains '*', return all known agents
    if (agents.includes('*')) {
      return ['bmad-orchestrator', 'analyst', 'pm', 'ux-expert', 'architect', 'po', 'sm', 'dev', 'qa'];
    }
    return agents;
  }

  // Handle string (shouldn't happen with current YAML structure, but defensive)
  return [agents];
};

/**
 * Check if agent is a core BMAD agent (vs custom agent)
 * @param {string} agentId - The agent identifier
 * @returns {boolean} True if core agent, false if custom
 */
export const isCoreAgent = (agentId) => {
  const coreAgents = ['bmad-orchestrator', 'analyst', 'pm', 'ux-expert', 'architect', 'po', 'sm', 'dev', 'qa'];
  return coreAgents.includes(agentId);
};