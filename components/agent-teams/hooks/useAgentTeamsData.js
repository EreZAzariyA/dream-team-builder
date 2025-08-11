'use client';

import { useState, useEffect } from 'react';
import { getTeamStyle } from '@/lib/utils/agentHelpers';

export const useAgentTeamsData = () => {
  const [teamConfigs, setTeamConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAgentTeams = async () => {
      try {
        const response = await fetch('/api/agent-teams');
        const result = await response.json();
        
        if (result.success) {
          // Enhance the data with UI styling from helpers
          const enhancedTeams = result.data.map(team => ({
            ...team,
            ...getTeamStyle(team.id)
          }));
          setTeamConfigs(enhancedTeams);
        } else {
          setError('Failed to load agent teams');
        }
      } catch (err) {
        setError('Error fetching agent teams: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAgentTeams();
  }, []);

  return {
    teamConfigs,
    loading,
    error
  };
};