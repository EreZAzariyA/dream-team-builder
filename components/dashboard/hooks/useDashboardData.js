'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook for fetching real dashboard data
 * Connects to actual APIs instead of mock data
 */
export const useDashboardData = () => {
  const [data, setData] = useState({
    activeProjects: 0,
    agentTeams: 0,
    repositories: 0,
    systemHealth: 'good',
    successRate: 0,
    totalDeployments: 0,
    loading: true,
    error: null
  });

  const fetchDashboardData = async () => {
    try {
      // Parallel API calls for better performance
      const [teamsResponse, workflowsResponse, healthResponse] = await Promise.all([
        fetch('/api/agent-teams/analytics').catch(() => ({ ok: false })),
        fetch('/api/workflows/analytics').catch(() => ({ ok: false })),
        fetch('/api/health').catch(() => ({ ok: false }))
      ]);

      let teamsData = { active: 0, total: 0, successRate: 85 };
      let workflowsData = { active: 0, total: 0 };
      let healthData = { status: 'good' };

      if (teamsResponse.ok) {
        teamsData = await teamsResponse.json();
      }

      if (workflowsResponse.ok) {
        workflowsData = await workflowsResponse.json();
      }

      if (healthResponse.ok) {
        const healthResult = await healthResponse.json();
        healthData = healthResult.data || healthResult;
      }

      // Map health status to our format
      const mapHealthStatus = (status) => {
        switch (status) {
          case 'healthy': return 'excellent';
          case 'warning': return 'warning';
          case 'critical': return 'critical';
          default: return 'good';
        }
      };

      setData({
        activeProjects: (teamsData.active || 0) + (workflowsData.active || 0),
        agentTeams: teamsData.active || 0,
        repositories: teamsData.repositoriesAnalyzed || 0,
        systemHealth: mapHealthStatus(healthData.status),
        successRate: teamsData.successRate || workflowsData.successRate || 85,
        totalDeployments: teamsData.total || 0,
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('Dashboard data fetch failed:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Refresh every 5 minutes (300 seconds) - dashboard data doesn't change frequently
    // Previous: 60 seconds (too aggressive, caused log spam)
    const interval = setInterval(fetchDashboardData, 300000);

    return () => clearInterval(interval);
  }, []);

  return {
    ...data,
    refresh: fetchDashboardData
  };
};

/**
 * Hook for real-time active projects data
 */
export const useActiveProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActiveProjects = async () => {
    try {
      const response = await fetch('/api/agent-teams/active');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.deployments) {
        const activeProjects = result.deployments.map(deployment => ({
          id: deployment.teamInstanceId || deployment._id,
          name: deployment.teamConfig?.name || deployment.teamId || 'Unknown Team',
          status: deployment.deployment?.status || 'unknown',
          workflowId: deployment.deployment?.workflowInstanceId,
          teamId: deployment.teamInstanceId,
          startedAt: deployment.deployment?.createdAt || deployment.createdAt,
          repository: deployment.deployment?.projectContext?.repository,
          health: calculateProjectHealth(deployment),
          progress: deployment.deployment?.progress || 0,
          currentStep: deployment.deployment?.currentStep || 'Initializing'
        }));
        
        setProjects(activeProjects);
        setError(null);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error('Failed to fetch active projects:', error);
      setError(error.message);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to calculate project health
  const calculateProjectHealth = (deployment) => {
    const status = deployment.deployment?.status;
    const createdAt = deployment.deployment?.createdAt;
    
    if (status === 'failed' || status === 'error') return 'critical';
    if (status === 'completed') return 'excellent';
    if (status === 'active' || status === 'running') {
      // Check if project is running too long (over 1 hour)
      if (createdAt) {
        const elapsed = Date.now() - new Date(createdAt).getTime();
        const hours = elapsed / (1000 * 60 * 60);
        if (hours > 1) return 'warning';
      }
      return 'good';
    }
    
    return 'good';
  };

  useEffect(() => {
    fetchActiveProjects();
    // Refresh every 30 seconds (was 15s - too frequent for active projects)
    const interval = setInterval(fetchActiveProjects, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    projects,
    loading,
    error,
    refresh: fetchActiveProjects
  };
};

/**
 * Hook for agent status data
 */
export const useAgentStatus = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAgentStatus = async () => {
    try {
      const response = await fetch('/api/agent-teams/status');
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.teams) {
          const allAgents = result.teams.flatMap(team => 
            (team.agents || []).map(agentId => ({
              id: `${team.teamInstanceId}-${agentId}`,
              name: agentId.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              type: agentId,
              status: getAgentStatus(team.deployment?.status, agentId),
              teamId: team.teamInstanceId,
              teamName: team.teamConfig?.name || team.teamId,
              lastActive: team.deployment?.updatedAt,
              currentTask: team.deployment?.currentStep
            }))
          );
          
          setAgents(allAgents);
        } else {
          setAgents([]);
        }
      } else {
        setAgents([]);
      }
    } catch (error) {
      console.error('Agent status fetch failed:', error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine agent status
  const getAgentStatus = (deploymentStatus, agentId) => {
    if (!deploymentStatus) return 'idle';
    
    switch (deploymentStatus) {
      case 'active':
      case 'running':
        return 'working';
      case 'completed':
        return 'completed';
      case 'failed':
      case 'error':
        return 'error';
      case 'paused':
        return 'idle';
      default:
        return 'idle';
    }
  };

  useEffect(() => {
    fetchAgentStatus();
    // Refresh every 45 seconds (was 20s - too frequent for agent status)
    const interval = setInterval(fetchAgentStatus, 45000);
    return () => clearInterval(interval);
  }, []);

  return {
    agents,
    loading,
    refresh: fetchAgentStatus
  };
};