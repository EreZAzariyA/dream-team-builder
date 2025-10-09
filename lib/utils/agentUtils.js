import { Bot } from 'lucide-react';

export const getAgentIcon = (agentId) => {
  if (!agentId || typeof agentId !== 'string') return '🤖';
  if (agentId.includes('/') || agentId === 'various') return '🔄';

  const icons = {
    'analyst': '🧠',
    'pm': '📋',
    'architect': '🏗️',
    'ux-expert': '🎨',
    'dev': '🛠️',
    'qa': '🔍',
    'sm': '📊',
    'po': '✅',
    'system': '⚙️',
    'bmad-orchestrator': '🎭'
  };
  return icons[agentId] || '🤖';
};

export const getAgentRole = (agentId) => {
  if (!agentId || typeof agentId !== 'string') return 'Assistant';
  
  const roles = {
    'analyst': 'Business Analyst',
    'pm': 'Product Manager',
    'architect': 'System Architect',
    'ux-expert': 'UX Designer',
    'dev': 'Developer',
    'qa': 'QA Engineer',
    'sm': 'Scrum Master',
    'po': 'Product Owner',
    'system': 'System',
    'bmad-orchestrator': 'BMad Orchestrator'
  };
  return roles[agentId] || 'AI Agent';
};

export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
};

export const normalizeAgentId = (agentId) => {
  if (!agentId) return 'unknown';
  if (typeof agentId === 'string') return agentId;
  if (typeof agentId === 'object') {
    return agentId.id || agentId.agentId || 'unknown';
  }
  return String(agentId);
};

export const getAgentDisplayName = (agentId) => {
  const safeAgentId = normalizeAgentId(agentId);
  return safeAgentId.charAt(0).toUpperCase() + safeAgentId.slice(1).replace(/-/g, ' ');
};
