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
 * @param {boolean} githubMode - Whether to enhance team for GitHub integration
 * @returns {object} Style object with icon, emoji, color, bgColor, and borderColor properties
 */
export const getTeamStyle = (teamId, githubMode = false) => {
  const styles = {
    'team-all': { 
      emoji: '👥',
      name: 'All Agents Team',
      color: 'text-blue-600', 
      bgColor: 'bg-blue-50 dark:bg-blue-900/20', 
      borderColor: 'border-blue-200 dark:border-blue-800',
      description: 'Complete agent team for comprehensive projects'
    },
    'team-fullstack': { 
      emoji: '🚀',
      name: 'Full-Stack Team', 
      color: 'text-purple-600', 
      bgColor: 'bg-purple-50 dark:bg-purple-900/20', 
      borderColor: 'border-purple-200 dark:border-purple-800',
      description: 'End-to-end development with UI and backend'
    },
    'team-ide-minimal': { 
      emoji: '⚡',
      name: 'Minimal IDE Team', 
      color: 'text-green-600', 
      bgColor: 'bg-green-50 dark:bg-green-900/20', 
      borderColor: 'border-green-200 dark:border-green-800',
      description: 'Lightweight development team for quick iterations'
    },
    'team-no-ui': { 
      emoji: '🔧',
      name: 'Backend Team', 
      color: 'text-orange-600', 
      bgColor: 'bg-orange-50 dark:bg-orange-900/20', 
      borderColor: 'border-orange-200 dark:border-orange-800',
      description: 'Backend services and API development'
    }
  };

  const baseStyle = styles[teamId] || { 
    emoji: '🤖',
    name: 'Custom Team', 
    color: 'text-gray-600', 
    bgColor: 'bg-gray-50 dark:bg-gray-900/20', 
    borderColor: 'border-gray-200 dark:border-gray-800',
    description: 'Custom agent team configuration'
  };
  
  // Enhance with GitHub mode
  if (githubMode) {
    return {
      ...baseStyle,
      emoji: '🐙', // GitHub octopus
      name: `${baseStyle.name} + GitHub`,
      description: `${baseStyle.description} with GitHub integration`,
      githubEnabled: true,
      color: 'text-slate-700', // GitHub-themed color
      bgColor: 'bg-slate-50 dark:bg-slate-900/20',
      borderColor: 'border-slate-200 dark:border-slate-800'
    };
  }
  
  return baseStyle;
};

/**
 * Check if a team is compatible with GitHub integration
 * @param {object} team - The team object with agents array
 * @returns {boolean} True if team can work with GitHub
 */
export const isTeamGitHubCompatible = (team) => {
  if (!team || !team.agents || !Array.isArray(team.agents)) {
    return false;
  }
  
  // Teams with developer, architect, or analyst agents can work with GitHub
  const githubCompatibleAgents = ['developer', 'architect', 'analyst', 'dev'];
  return team.agents.some(agent => githubCompatibleAgents.includes(agent));
};

/**
 * Get GitHub-specific capabilities for a team
 * @param {object} team - The team object
 * @returns {array} Array of GitHub capabilities
 */
export const getTeamGitHubCapabilities = (team) => {
  if (!isTeamGitHubCompatible(team)) {
    return [];
  }
  
  const capabilities = ['repository-analysis', 'branch-creation', 'file-commits'];
  
  // Add specific capabilities based on agents
  if (team.agents?.includes('developer') || team.agents?.includes('dev')) {
    capabilities.push('code-generation', 'automated-testing');
  }
  
  if (team.agents?.includes('architect')) {
    capabilities.push('system-design', 'documentation-generation');
  }
  
  if (team.agents?.includes('analyst')) {
    capabilities.push('requirements-analysis', 'issue-creation');
  }
  
  if (team.agents?.includes('qa')) {
    capabilities.push('test-automation', 'quality-assurance');
  }
  
  return capabilities;
};

