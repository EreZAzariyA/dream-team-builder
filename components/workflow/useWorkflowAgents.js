import { useMemo, useState } from 'react';
import { getAgentIcon, getAgentRole, normalizeAgentId, getAgentDisplayName } from '../../lib/utils/agentUtils';

export const useWorkflowAgents = ({ messages, elicitationPrompt, activeAgents, currentAgent }) => {
  const [activeAgentId, setActiveAgentId] = useState(null);

  const detectedAgents = useMemo(() => {
    // Track message activity for all agents
    const agentActivity = new Map();
    
    // Add agents from messages
    messages.forEach(msg => {
      if (msg.from && msg.from !== 'User' && msg.from !== 'System' && msg.from !== 'BMAD System') {
        const agentId = msg.from.toLowerCase().replace(/\s+/g, '-');
        agentActivity.set(agentId, new Date(msg.timestamp || Date.now()));
      }
      if (msg.agentId && msg.agentId !== 'user' && msg.agentId !== 'system') {
        agentActivity.set(msg.agentId, new Date(msg.timestamp || Date.now()));
      }
    });
    
    // Add elicitation agent activity
    if (elicitationPrompt?.agentId) {
      const agentId = normalizeAgentId(elicitationPrompt.agentId);
      if (agentId !== 'unknown') {
        agentActivity.set(agentId, new Date());
        if (activeAgentId !== agentId) {
          setActiveAgentId(agentId);
        }
      }
    }
    
    // Auto-set current agent as active if no active agent selected
    if (!activeAgentId && currentAgent) {
      const agentId = normalizeAgentId(currentAgent);
      if (agentId !== 'unknown') {
        setActiveAgentId(agentId);
      }
    }
    
    // Prioritize workflow agents (activeAgents) and show them in order
    const workflowAgents = [];
    const additionalAgents = [];
    
    if (activeAgents && activeAgents.length > 0) {
      // Process workflow agents in order
      activeAgents.forEach(agent => {
        const agentId = normalizeAgentId(agent);
        const agentName = typeof agent === 'string' ? 
          getAgentDisplayName(agentId) : 
          (agent.name || getAgentDisplayName(agentId));
        const agentStatus = typeof agent === 'object' ? agent.status : 'pending';
        
        workflowAgents.push({
          id: agentId,
          name: agentName,
          role: getAgentRole(agentId),
          icon: getAgentIcon(agentId),
          isActive: agentId === activeAgentId,
          isRecent: agentId === currentAgent && agentId !== activeAgentId,
          isCurrent: agentId === currentAgent,
          workflowStatus: agentStatus,
          lastActivity: agentActivity.get(agentId),
          order: activeAgents.indexOf(agent) + 1
        });
      });
    }
    
    // Add any additional agents from messages that aren't in workflow
    agentActivity.forEach((activity, agentId) => {
      const isInWorkflow = workflowAgents.some(wa => wa.id === agentId);
      if (!isInWorkflow) {
        additionalAgents.push({
          id: agentId,
          name: getAgentDisplayName(agentId),
          role: getAgentRole(agentId),
          icon: getAgentIcon(agentId),
          isActive: agentId === activeAgentId,
          isRecent: false,
          isCurrent: false,
          workflowStatus: 'additional',
          lastActivity: activity,
          order: 999
        });
      }
    });
    
    // Combine workflow agents first (in order), then additional agents
    return [...workflowAgents, ...additionalAgents];
  }, [messages, elicitationPrompt, activeAgents, currentAgent, activeAgentId]);

  return { detectedAgents, activeAgentId, setActiveAgentId };
};
