'use client';

import { useProviderStatus, useProviderHealth } from '../lib/hooks/useProviderStatus.js';

export const ProviderStatusIndicator = () => {
  const status = useProviderStatus();
  
  if (!status.hydrated) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
        Hydrating...
      </div>
    );
  }

  if (!status.isReady) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        Providers Loading...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-green-600">
      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      All Systems Ready
    </div>
  );
};

export const ProviderHealthBadge = () => {
  const health = useProviderHealth();
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unhealthy': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(health.status)}`}>
      <span className="mr-1">
        {health.status === 'healthy' && '✅'}
        {health.status === 'warning' && '⚠️'}
        {health.status === 'unhealthy' && '❌'}
        {health.status === 'checking' && '🔄'}
      </span>
      Health: {health.score}%
    </div>
  );
};

export const DetailedProviderStatus = ({ className = '' }) => {
  const status = useProviderStatus();
  const health = useProviderHealth();

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Provider Status
        </h3>
        <ProviderHealthBadge />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Redux Status */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Redux
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              status.redux 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {status.redux ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {health.checks?.redux?.message || 'Redux state management'}
          </div>
        </div>

        {/* React Query Status */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              React Query
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              status.reactQuery 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {status.reactQuery ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {health.checks?.reactQuery?.message || 'Server state management'}
          </div>
        </div>

        {/* WebSocket Status */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              WebSocket
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              status.webSocket 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {status.webSocket ? 'Ready' : 'Not Ready'}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {health.checks?.webSocket?.message || 'Real-time communication'}
          </div>
        </div>

        {/* Hydration Status */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Hydration
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              status.hydrated 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
            }`}>
              {status.hydrated ? 'Complete' : 'In Progress'}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {health.checks?.hydration?.message || 'Client-side initialization'}
          </div>
        </div>
      </div>

      {/* Error Messages */}
      {status.hasErrors && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-400 mb-2">
            Issues Detected:
          </h4>
          <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
            {status.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Last Check Time */}
      {health.lastCheck && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Last health check: {new Date(health.lastCheck).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default ProviderStatusIndicator;