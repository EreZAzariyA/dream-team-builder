/**
 * AI Provider Status Component
 * Shows current AI provider status, health, and allows switching between providers
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Brain, 
  Zap, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  ChevronDown,
  Settings,
  TrendingUp
} from 'lucide-react';

const AIProviderStatus = ({ className = '' }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch AI service health status
  const { data: healthStatus, isLoading } = useQuery({
    queryKey: ['ai-health-status'],
    queryFn: async () => {
      const response = await fetch('/api/ai/health');
      if (!response.ok) throw new Error('Failed to fetch AI health');
      return response.json();
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: 2
  });

  // Provider configurations with icons and colors
  const providerConfig = {
    gemini: {
      name: 'Gemini',
      icon: Zap,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    openai: {
      name: 'OpenAI',
      icon: Brain,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    anthropic: {
      name: 'Claude',
      icon: Shield,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    }
  };

  // Get status color and icon based on health
  const getStatusIndicator = (isHealthy, circuitBreakerState) => {
    if (!isHealthy || circuitBreakerState === 'OPEN') {
      return { icon: XCircle, color: 'text-red-500', label: 'Failed' };
    } else if (circuitBreakerState === 'HALF_OPEN') {
      return { icon: AlertTriangle, color: 'text-yellow-500', label: 'Recovering' };
    } else {
      return { icon: CheckCircle, color: 'text-green-500', label: 'Healthy' };
    }
  };

  // Get current primary provider
  const getCurrentProvider = () => {
    if (!healthStatus?.healthyProviders || healthStatus.healthyProviders.length === 0) {
      return null;
    }
    
    // Return first healthy provider from priority list
    const primaryProvider = healthStatus.providerPriority?.find(provider => 
      healthStatus.healthyProviders.includes(provider) && provider !== 'fallback'
    );
    
    return primaryProvider || healthStatus.healthyProviders[0];
  };

  const currentProvider = getCurrentProvider();
  const currentConfig = currentProvider ? providerConfig[currentProvider] : null;
  const StatusIcon = currentConfig?.icon || Brain;

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-500"></div>
        <span className="text-body-small text-gray-500">Loading AI status...</span>
      </div>
    );
  }

  // Error state
  if (!healthStatus || healthStatus.status === 'error') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <XCircle className="w-4 h-4 text-red-500" />
        <span className="text-body-small text-red-600">AI Service Error</span>
      </div>
    );
  }

  const totalProviders = Object.keys(healthStatus.providers || {}).length;
  const healthyCount = healthStatus.healthyProviders?.filter(p => p !== 'fallback').length || 0;

  return (
    <div className={`relative ${className}`}>
      {/* Main Status Button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {currentConfig ? (
          <>
            <StatusIcon className={`w-4 h-4 ${currentConfig.color}`} />
            <span className="text-body-small font-medium text-gray-700 dark:text-gray-300">
              {currentConfig.name}
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-body-small font-medium text-red-600 dark:text-red-400">
              No AI Provider
            </span>
          </>
        )}
        
        {/* Health indicator dot */}
        <div className={`w-2 h-2 rounded-full ${
          healthStatus.status === 'healthy' ? 'bg-green-500' :
          healthStatus.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
        }`} />
        
        <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${
          isDropdownOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Dropdown Panel */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-body font-semibold text-gray-900">AI Provider Status</h3>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-body-small text-blue-600 hover:text-blue-700"
              >
                {showDetails ? 'Less Details' : 'More Details'}
              </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-h4 font-bold text-gray-900">{healthyCount}/{totalProviders}</div>
                <div className="text-caption text-gray-500">Healthy</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-h4 font-bold text-green-600">
                  {healthStatus.usageStats?.requests || 0}
                </div>
                <div className="text-caption text-gray-500">Requests</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-h4 font-bold text-blue-600">
                  ${(healthStatus.usageStats?.cost || 0).toFixed(3)}
                </div>
                <div className="text-caption text-gray-500">Cost</div>
              </div>
            </div>

            {/* Provider List */}
            <div className="space-y-2">
              {Object.entries(healthStatus.providers || {}).map(([provider, stats]) => {
                const config = providerConfig[provider];
                const circuitBreaker = healthStatus.circuitBreakers?.[provider];
                const status = getStatusIndicator(stats.healthy, circuitBreaker?.state);
                const Icon = config?.icon || Brain;
                const StatusIndicatorIcon = status.icon;

                return (
                  <div key={provider} className={`p-3 rounded-lg border ${
                    provider === currentProvider ? config?.borderColor + ' ' + config?.bgColor : 'border-gray-100 bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-5 h-5 ${config?.color || 'text-gray-500'}`} />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-body-small font-medium text-gray-900">
                              {config?.name || provider}
                            </span>
                            {provider === currentProvider && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                                Primary
                              </span>
                            )}
                          </div>
                          {showDetails && (
                            <div className="text-caption text-gray-500">
                              Last check: {stats.lastCheck ? new Date(stats.lastCheck).toLocaleTimeString() : 'Never'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <StatusIndicatorIcon className={`w-4 h-4 ${status.color}`} />
                        <span className={`text-caption ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>

                    {/* Detailed Stats (when expanded) */}
                    {showDetails && circuitBreaker && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="grid grid-cols-3 gap-2 text-caption text-gray-600">
                          <div>
                            <span className="font-medium">State:</span> {circuitBreaker.state}
                          </div>
                          <div>
                            <span className="font-medium">Failures:</span> {circuitBreaker.failureCount}
                          </div>
                          <div>
                            <span className="font-medium">Successes:</span> {circuitBreaker.successCount}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between">
              <button 
                onClick={() => window.open('/dashboard/settings', '_blank')}
                className="flex items-center space-x-1 text-body-small text-gray-600 hover:text-gray-800"
              >
                <Settings className="w-3 h-3" />
                <span>Settings</span>
              </button>
              <button 
                onClick={() => window.open('/dashboard/analytics', '_blank')}
                className="flex items-center space-x-1 text-body-small text-blue-600 hover:text-blue-700"
              >
                <TrendingUp className="w-3 h-3" />
                <span>Analytics</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
};

export default AIProviderStatus;