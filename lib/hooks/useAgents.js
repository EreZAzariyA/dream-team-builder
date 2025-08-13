import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchWithAuth } from '../react-query';

/**
 * Custom hook for fetching BMAD agents data
 * Uses React Query for caching, loading states, and error handling
 */
export const useAgents = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.agents.definitions(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/bmad/agents');
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load agents');
      }
      
      return data.agents;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - agent definitions don't change often
    gcTime: 60 * 60 * 1000,    // 1 hour - keep in cache longer
    retry: (failureCount, error) => {
      // Don't retry on client errors (400-499)
      if (error?.message?.includes('4')) {
        return false;
      }
      return failureCount < 2;
    },
    ...options,
  });
};

/**
 * Custom hook for fetching agent teams data
 */
export const useAgentTeams = (options = {}) => {
  return useQuery({
    queryKey: ['agentTeams'],
    queryFn: async () => {
      const data = await fetchWithAuth('/api/agent-teams');
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load agent teams');
      }
      
      return data.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - team configs don't change often
    gcTime: 60 * 60 * 1000,    // 1 hour
    retry: (failureCount, error) => {
      if (error?.message?.includes('4')) {
        return false;
      }
      return failureCount < 2;
    },
    ...options,
  });
};

/**
 * Custom hook to get a specific agent by ID
 */
export const useAgent = (agentId, options = {}) => {
  const { data: agents, ...agentsQuery } = useAgents(options);
  
  const agent = agents?.find(a => a.id === agentId);
  
  return {
    ...agentsQuery,
    data: agent,
    agent, // alias for convenience
  };
};

export default useAgents;