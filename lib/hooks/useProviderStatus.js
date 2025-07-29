'use client';

import { useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { wsManager } from '../store/middleware/websocketMiddleware.js';

/**
 * Custom hook to check the status of all providers
 * Useful for debugging and health checks
 */
export const useProviderStatus = () => {
  const [status, setStatus] = useState({
    redux: false,
    reactQuery: false,
    webSocket: false,
    hydrated: false,
    errors: []
  });

  const queryClient = useQueryClient();
  
  // Test Redux connection
  const reduxState = useSelector(state => state);
  
  useEffect(() => {
    const checkProviders = () => {
      const newStatus = {
        redux: false,
        reactQuery: false,
        webSocket: false,
        hydrated: true,
        errors: []
      };

      try {
        // Check Redux
        if (reduxState && typeof reduxState === 'object') {
          const hasRequiredSlices = ['ui', 'workflow', 'agents', 'realtime'].every(
            slice => reduxState[slice] !== undefined
          );
          newStatus.redux = hasRequiredSlices;
          
          if (!hasRequiredSlices) {
            newStatus.errors.push('Redux store missing required slices');
          }
        } else {
          newStatus.errors.push('Redux store not accessible');
        }

        // Check React Query
        if (queryClient) {
          newStatus.reactQuery = true;
        } else {
          newStatus.errors.push('React Query client not accessible');
        }

        // Check WebSocket Manager
        if (wsManager && typeof wsManager.connect === 'function') {
          newStatus.webSocket = true;
        } else {
          newStatus.errors.push('WebSocket manager not accessible');
        }

      } catch (error) {
        newStatus.errors.push(`Provider check error: ${error.message}`);
      }

      setStatus(newStatus);
    };

    checkProviders();
  }, [reduxState, queryClient]);

  return {
    ...status,
    isReady: status.redux && status.reactQuery && status.webSocket && status.hydrated,
    hasErrors: status.errors.length > 0
  };
};

/**
 * Hook to get detailed provider information
 */
export const useProviderInfo = () => {
  const queryClient = useQueryClient();
  const reduxState = useSelector(state => state);
  const [info, setInfo] = useState({});

  useEffect(() => {
    const gatherInfo = () => {
      const newInfo = {
        redux: {
          slices: Object.keys(reduxState || {}),
          storeSize: JSON.stringify(reduxState || {}).length,
          selectedWorkflow: reduxState?.workflow?.selectedWorkflowId,
          theme: reduxState?.ui?.theme,
          activeAgents: reduxState?.agents?.activeAgents?.length || 0,
        },
        reactQuery: {
          queryCache: queryClient?.getQueryCache?.()?.getAll?.()?.length || 0,
          mutationCache: queryClient?.getMutationCache?.()?.getAll?.()?.length || 0,
          defaultOptions: queryClient?.getDefaultOptions?.() || {},
        },
        webSocket: {
          managerAvailable: !!wsManager,
          activeConnections: wsManager?.getActiveConnections?.()?.length || 0,
          connectionManager: typeof wsManager?.connect === 'function',
        },
        performance: {
          renderTime: Date.now(),
          memoryUsage: typeof performance !== 'undefined' && performance.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
          } : null,
        }
      };

      setInfo(newInfo);
    };

    gatherInfo();
    
    // Update info every 5 seconds
    const interval = setInterval(gatherInfo, 5000);
    return () => clearInterval(interval);
  }, [reduxState, queryClient]);

  return info;
};

/**
 * Hook for provider health monitoring
 */
export const useProviderHealth = () => {
  const [health, setHealth] = useState({
    status: 'checking',
    checks: {
      redux: { status: 'pending', message: '' },
      reactQuery: { status: 'pending', message: '' },
      webSocket: { status: 'pending', message: '' },
      hydration: { status: 'pending', message: '' },
    },
    lastCheck: null,
    score: 0
  });

  const reduxState = useSelector(state => state);
  const queryClient = useQueryClient();

  useEffect(() => {
    const runHealthCheck = () => {
      const checks = {};
      let passedChecks = 0;
      const totalChecks = 4;

      // Redux health check
      try {
        if (reduxState && Object.keys(reduxState).length >= 4) {
          checks.redux = { status: 'healthy', message: 'Redux store operational' };
          passedChecks++;
        } else {
          checks.redux = { status: 'unhealthy', message: 'Redux store incomplete' };
        }
      } catch (error) {
        checks.redux = { status: 'error', message: `Redux error: ${error.message}` };
      }

      // React Query health check
      try {
        if (queryClient && typeof queryClient.invalidateQueries === 'function') {
          checks.reactQuery = { status: 'healthy', message: 'React Query operational' };
          passedChecks++;
        } else {
          checks.reactQuery = { status: 'unhealthy', message: 'React Query not accessible' };
        }
      } catch (error) {
        checks.reactQuery = { status: 'error', message: `React Query error: ${error.message}` };
      }

      // WebSocket health check
      try {
        if (wsManager && typeof wsManager.connect === 'function') {
          checks.webSocket = { status: 'healthy', message: 'WebSocket manager ready' };
          passedChecks++;
        } else {
          checks.webSocket = { status: 'unhealthy', message: 'WebSocket manager not available' };
        }
      } catch (error) {
        checks.webSocket = { status: 'error', message: `WebSocket error: ${error.message}` };
      }

      // Hydration check
      try {
        if (typeof window !== 'undefined') {
          checks.hydration = { status: 'healthy', message: 'Client-side hydrated' };
          passedChecks++;
        } else {
          checks.hydration = { status: 'pending', message: 'Server-side rendering' };
        }
      } catch (error) {
        checks.hydration = { status: 'error', message: `Hydration error: ${error.message}` };
      }

      const score = Math.round((passedChecks / totalChecks) * 100);
      const status = score === 100 ? 'healthy' : score >= 75 ? 'warning' : 'unhealthy';

      setHealth({
        status,
        checks,
        lastCheck: new Date().toISOString(),
        score
      });
    };

    runHealthCheck();
    
    // Run health check every 10 seconds
    const interval = setInterval(runHealthCheck, 10000);
    return () => clearInterval(interval);
  }, [reduxState, queryClient]);

  return health;
};

export default useProviderStatus;