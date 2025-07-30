'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

async function fetchHealthStatus() {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error('Failed to fetch health status');
  }
  return response.json();
}

async function fetchMonitoringStats(period = '24h') {
  const response = await fetch(`/api/monitoring/stats?period=${period}`);
  if (!response.ok) {
    throw new Error('Failed to fetch monitoring stats');
  }
  return response.json();
}

async function fetchAlerts(category = null, type = null) {
  let url = '/api/monitoring/alerts';
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (type) params.append('type', type);
  if (params.toString()) url += `?${params.toString()}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch alerts');
  }
  return response.json();
}

export default function SystemHealthDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState('24h');
  const [alertFilter, setAlertFilter] = useState('all');

  const { data: healthData, error: healthError, isLoading: healthLoading } = useQuery({
    queryKey: ['health-status'],
    queryFn: fetchHealthStatus,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: statsData, error: statsError, isLoading: statsLoading } = useQuery({
    queryKey: ['monitoring-stats', selectedPeriod],
    queryFn: () => fetchMonitoringStats(selectedPeriod),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: alertsData, error: alertsError, isLoading: alertsLoading } = useQuery({
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
    refetchInterval: 30000,
  });

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
                  stats?.performance?.database?.isConnected 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {stats?.performance?.database?.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Avg Connection Time:</span>
                <span className="text-sm font-medium">
                  {(stats?.performance?.database?.avgConnectionTime || 0).toFixed(0)}ms
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

        {alertsLoading ? (
          <div className="text-center py-4">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No alerts found for the selected filter.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 10).map((alert) => (
              <div
                key={alert._id}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.type === 'critical'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : alert.type === 'warning'
                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        alert.type === 'critical'
                          ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                          : alert.type === 'warning'
                          ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
                          : 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                      }`}>
                        {alert.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                        {alert.category}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${
                        alert.isResolved 
                          ? 'bg-green-500' 
                          : 'bg-red-500'
                      }`}></span>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {alert.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!alert.isResolved && (
                    <button className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}