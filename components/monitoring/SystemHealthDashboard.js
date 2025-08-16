'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '@/lib/react-query';
import { useAuth } from '@/lib/store/hooks/authHooks';
import AlertCard from './AlertCard';

async function fetchHealthStatus() {
  const response = await fetch('/api/health'); // No auth required
  if (!response.ok) {
    throw new Error('Failed to fetch health status');
  }
  return response.json();
}

async function fetchMonitoringStats(period = '24h') {
  return await fetchWithAuth(`/api/monitoring/stats?period=${period}`);
}

async function fetchAlerts(category = null, type = null) {
  let url = '/api/monitoring/alerts';
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (type) params.append('type', type);
  if (params.toString()) url += `?${params.toString()}`;
  
  return await fetchWithAuth(url);
}

async function resolveAlert(alertId) {
  return await fetchWithAuth(`/api/monitoring/alerts/${alertId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'resolve' }),
  });
}

async function bulkResolveAlerts(alertIds) {
  return await fetchWithAuth('/api/monitoring/alerts/bulk-resolve', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ alertIds, action: 'resolve' }),
  });
}

export default function SystemHealthDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState('24h');
  const [alertFilter, setAlertFilter] = useState('all');
  const [resolvingAlerts, setResolvingAlerts] = useState(new Set());
  const [isBulkResolving, setIsBulkResolving] = useState(false);
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: healthData, error: healthError, isLoading: healthLoading } = useQuery({
    queryKey: ['health-status'],
    queryFn: fetchHealthStatus,
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    staleTime: 15000, // Consider data fresh for 15 seconds
  });

  const { data: statsData, error: statsError, isLoading: statsLoading } = useQuery({
    queryKey: ['monitoring-stats', selectedPeriod],
    queryFn: () => fetchMonitoringStats(selectedPeriod),
    enabled: !!isAuthenticated, // Only run when authenticated
    refetchInterval: isAuthenticated ? 60000 : false, // Only refetch when authenticated
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    staleTime: isAuthenticated ? 30000 : 0, // Consider data fresh for 30 seconds
    retry: isAuthenticated ? 3 : false // Only retry when authenticated
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts', alertFilter],
    queryFn: () => {
      switch (alertFilter) {
        case 'critical':
          return fetchAlerts(null, 'critical');
        case 'database':
          return fetchAlerts('database');
        case 'api':
          return fetchAlerts('api');
        case 'system':
          return fetchAlerts('system');
        default:
          return fetchAlerts();
      }
    },
    enabled: !!isAuthenticated, // Only run when authenticated
    refetchInterval: isAuthenticated ? 45000 : false, // Longer interval - 45 seconds
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    staleTime: isAuthenticated ? 20000 : 0, // Consider data fresh for 20 seconds
    retry: isAuthenticated ? 2 : false, // Reduce retry attempts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  // Mutation for resolving alerts
  const resolveAlertMutation = useMutation({
    mutationFn: resolveAlert,
    onMutate: async (alertId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries(['alerts']);
      
      // Snapshot the previous value
      const previousAlerts = queryClient.getQueryData(['alerts', alertFilter]);
      
      // Optimistically update to the new value
      queryClient.setQueryData(['alerts', alertFilter], (old) => {
        if (!old?.data) return old;
        
        return {
          ...old,
          data: old.data.map(alert => 
            alert._id === alertId 
              ? { ...alert, isResolved: true, resolvedAt: new Date().toISOString() }
              : alert
          )
        };
      });
      
      // Update resolving state
      setResolvingAlerts(prev => new Set(prev).add(alertId));
      
      // Return a context object with the snapshotted value
      return { previousAlerts };
    },
    onSuccess: (data, alertId) => {
      // Remove from resolving set
      setResolvingAlerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertId);
        return newSet;
      });
      
      // Update the specific alert data in cache without triggering a refetch
      queryClient.setQueryData(['alerts', alertFilter], (old) => {
        if (!old?.data) return old;
        
        return {
          ...old,
          data: old.data.map(alert => 
            alert._id === alertId 
              ? { ...alert, isResolved: true, resolvedAt: data.data?.resolvedAt || new Date().toISOString() }
              : alert
          )
        };
      });
      
      // Only invalidate after a delay to batch multiple operations
      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: ['alerts'], 
          exact: false,
          refetchType: 'none' // Don't automatically refetch
        });
      }, 2000);
    },
    onError: (error, alertId, context) => {
      // Remove from resolving set
      setResolvingAlerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertId);
        return newSet;
      });
      
      // Roll back to the previous value
      if (context?.previousAlerts) {
        queryClient.setQueryData(['alerts', alertFilter], context.previousAlerts);
      }
      
      console.error('Failed to resolve alert:', error);
    },
  });

  // Mutation for bulk resolving alerts
  const bulkResolveAlertsMutation = useMutation({
    mutationFn: bulkResolveAlerts,
    onMutate: async (alertIds) => {
      setIsBulkResolving(true);
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries(['alerts']);
      
      // Snapshot the previous value
      const previousAlerts = queryClient.getQueryData(['alerts', alertFilter]);
      
      // Optimistically update all alerts to resolved
      queryClient.setQueryData(['alerts', alertFilter], (old) => {
        if (!old?.data) return old;
        
        return {
          ...old,
          data: old.data.map(alert => 
            alertIds.includes(alert._id)
              ? { ...alert, isResolved: true, resolvedAt: new Date().toISOString() }
              : alert
          )
        };
      });
      
      return { previousAlerts };
    },
    onSuccess: (data) => {
      setIsBulkResolving(false);
      
      // Update with actual server response
      queryClient.setQueryData(['alerts', alertFilter], (old) => {
        if (!old?.data || !data?.results?.resolved) return old;
        
        const resolvedIds = data.results.resolved.map(result => result.alertId);
        
        return {
          ...old,
          data: old.data.map(alert => 
            resolvedIds.includes(alert._id)
              ? { ...alert, isResolved: true, resolvedAt: new Date().toISOString() }
              : alert
          )
        };
      });
      
      // Show success message
      console.log(`✅ Bulk resolution completed: ${data.resolved} resolved, ${data.failed} failed`);
    },
    onError: (error, alertIds, context) => {
      setIsBulkResolving(false);
      
      // Roll back to the previous value
      if (context?.previousAlerts) {
        queryClient.setQueryData(['alerts', alertFilter], context.previousAlerts);
      }
      
      console.error('Failed to bulk resolve alerts:', error);
    },
  });

  const handleResolveAlert = (alertId) => {
    // Prevent multiple clicks on the same alert
    if (resolvingAlerts.has(alertId)) {
      return;
    }
    
    resolveAlertMutation.mutate(alertId);
  };

  const handleBulkResolveAlerts = () => {
    // Prevent multiple bulk operations
    if (isBulkResolving) {
      return;
    }

    // Get all unresolved alerts
    const unresolvedAlerts = alerts.filter(alert => !alert.isResolved);
    
    if (unresolvedAlerts.length === 0) {
      console.log('No unresolved alerts to resolve');
      return;
    }

    // Confirm bulk operation for large numbers
    if (unresolvedAlerts.length > 10) {
      const confirmed = window.confirm(
        `This will resolve ${unresolvedAlerts.length} alerts. Are you sure you want to continue?`
      );
      if (!confirmed) return;
    }

    const alertIds = unresolvedAlerts.map(alert => alert._id);
    bulkResolveAlertsMutation.mutate(alertIds);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'critical':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (healthLoading || statsLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse">Loading system health dashboard...</div>
      </div>
    );
  }

  if (healthError || statsError) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="text-red-500">
          Error loading dashboard: {healthError?.message || statsError?.message}
        </div>
      </div>
    );
  }

  const health = healthData?.data;
  const stats = statsData?.data;
  const alerts = alertsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            🏥 System Health Dashboard
          </h2>
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health?.status)}`}>
              {health?.status?.toUpperCase() || 'UNKNOWN'}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {new Date(health?.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatUptime(health?.uptime || 0)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">System Uptime</div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {((health?.monitoring?.system?.memory?.usage || 0) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Memory Usage</div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {health?.monitoring?.database?.isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Database Status</div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {alerts.filter(alert => !alert.isResolved).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active Alerts</div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            📊 Performance Metrics
          </h3>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* API Performance */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">API Performance</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Requests:</span>
                <span className="text-sm font-medium">{stats?.performance?.api?.totalRequests || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time:</span>
                <span className="text-sm font-medium">
                  {(stats?.performance?.api?.avgResponseTime || 0).toFixed(0)}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Active Endpoints:</span>
                <span className="text-sm font-medium">{stats?.performance?.api?.totalEndpoints || 0}</span>
              </div>
              {stats?.performance?.api?.slowestEndpoint && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Slowest endpoint:</div>
                  <div className="text-xs font-mono text-gray-800 dark:text-gray-200 truncate">
                    {stats.performance.api.slowestEndpoint.endpoint}
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {stats.performance.api.slowestEndpoint.time.toFixed(0)}ms
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* System Metrics */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">System Resources</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Avg Memory Usage:</span>
                <span className="text-sm font-medium">
                  {((stats?.performance?.system?.avgMemoryUsage || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Peak Memory Usage:</span>
                <span className="text-sm font-medium">
                  {((stats?.performance?.system?.peakMemoryUsage || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Memory Used:</span>
                <span className="text-sm font-medium">
                  {formatBytes(health?.memory?.heapUsed || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Memory Total:</span>
                <span className="text-sm font-medium">
                  {formatBytes(health?.memory?.heapTotal || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Database Metrics */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Database Health</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Connection Status:</span>
                <span className={`text-sm font-medium ${
                  health?.monitoring?.database?.isConnected 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {health?.monitoring?.database?.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Connection Time:</span>
                <span className="text-sm font-medium">
                  {health?.monitoring?.database?.connectionTime || 0}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Collections:</span>
                <span className="text-sm font-medium">
                  {health?.monitoring?.database?.collectionsCount || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Documents:</span>
                <span className="text-sm font-medium">
                  {health?.monitoring?.database?.documentsCount || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            🚨 System Alerts
          </h3>
          <div className="flex items-center space-x-3">
            {/* Resolve All Button */}
            {alerts.filter(alert => !alert.isResolved).length > 0 && (
              <button
                onClick={handleBulkResolveAlerts}
                disabled={isBulkResolving}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  isBulkResolving
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-600'
                }`}
              >
                {isBulkResolving ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>Resolving...</span>
                  </div>
                ) : (
                  `Resolve All (${alerts.filter(alert => !alert.isResolved).length})`
                )}
              </button>
            )}
            
            {/* Filter Dropdown */}
            <select
              value={alertFilter}
              onChange={(e) => setAlertFilter(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Alerts</option>
              <option value="critical">Critical Only</option>
              <option value="database">Database</option>
              <option value="api">API</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>

        {alertsLoading ? (
          <div className="text-center py-4">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No alerts found for the selected filter.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 10).map((alert) => (
              <AlertCard
                key={alert._id}
                alert={alert}
                isResolving={resolvingAlerts.has(alert._id)}
                onResolve={handleResolveAlert}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}