/**
 * AI Provider Status Component
 * Shows current AI provider status, health, and allows switching between providers
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Brain, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  ChevronDown,
  Settings,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';

const AIProviderStatus = React.memo(({ className = '' }) => {
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
    refetchInterval: false, // Disable automatic refetching
    retry: 1,
    staleTime: Infinity, // Data never goes stale
    cacheTime: 30000, // Keep in cache for 30 seconds
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    notifyOnChangeProps: ['data', 'isLoading'] // Only re-render when these specific props change
  });

  // Fetch user-specific usage statistics  
  const { data: userUsage, isLoading: isUsageLoading } = useQuery({
    queryKey: ['ai-user-usage'],
    queryFn: async () => {
      const response = await fetch('/api/ai/usage', {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 401) {
          return {
            user: {
              stats: { requests: 0, tokens: 0, cost: 0, providers: {} }
            },
            limits: { dailyRequests: 1000, dailyCost: 10 }
          };
        }
        throw new Error('Failed to fetch user usage');
      }
      return response.json();
    },
    refetchInterval: false, // Disable automatic refetching
    retry: 1,
    staleTime: Infinity,
    cacheTime: 60000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    notifyOnChangeProps: ['data', 'isLoading']
  });

  // Provider configurations with icons and colors (memoized)
  const providerConfig = useMemo(() => ({
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
    }
  }), []);

  // Get status color and icon based on health (memoized)
  const getStatusIndicator = useCallback((isHealthy, circuitBreakerState, errorMessage) => {
    // Check for quota/API key issues first
    if (errorMessage?.includes('quota') || errorMessage?.includes('exceeded') || 
        errorMessage?.includes('API key') || errorMessage?.includes('authentication')) {
      return { 
        icon: AlertTriangle, 
        color: 'text-red-500', 
        label: 'API Key Required',
        needsApiKey: true 
      };
    }
    
    if (circuitBreakerState === 'OPEN') {
      return { icon: XCircle, color: 'text-red-500', label: 'Rate Limited' };
    } else if (!isHealthy) {
      return { icon: XCircle, color: 'text-red-500', label: 'Failed' };
    } else if (circuitBreakerState === 'HALF_OPEN') {
      return { icon: AlertTriangle, color: 'text-yellow-500', label: 'Recovering' };
    } else {
      return { icon: CheckCircle, color: 'text-green-500', label: 'Healthy' };
    }
  }, []);

  // Memoized calculations to prevent unnecessary re-renders
  const currentProvider = useMemo(() => {
    if (!healthStatus?.healthyProviders || healthStatus.healthyProviders.length === 0) {
      return null;
    }
    
    // Return first healthy provider from priority list
    const primaryProvider = healthStatus.providerPriority?.find(provider => 
      healthStatus.healthyProviders.includes(provider) && provider !== 'fallback'
    );
    
    return primaryProvider || healthStatus.healthyProviders[0];
  }, [healthStatus?.healthyProviders, healthStatus?.providerPriority]);

  const currentConfig = useMemo(() => 
    currentProvider ? providerConfig[currentProvider] : null, 
    [currentProvider]
  );

  const StatusIcon = currentConfig?.icon || Brain;

  // Memoized API key check
  const needsApiKey = useMemo(() => {
    return healthStatus?.needsUserApiKeys || 
      (healthStatus?.status === 'needs_api_keys') ||
      (healthStatus?.providers && Object.values(healthStatus.providers).some(provider => {
        const circuitBreaker = healthStatus.circuitBreakers?.[Object.keys(healthStatus.providers).find(key => healthStatus.providers[key] === provider)];
        const status = getStatusIndicator(provider.healthy, circuitBreaker?.state, provider.lastError);
        return status.needsApiKey;
      }));
  }, [healthStatus?.needsUserApiKeys, healthStatus?.status, healthStatus?.providers, healthStatus?.circuitBreakers]);

  // Memoized quota issues check
  const hasQuotaIssues = useMemo(() => {
    return healthStatus?.status === 'quota_limited' ||
      (healthStatus?.circuitBreakers && Object.values(healthStatus.circuitBreakers).some(cb => cb.state === 'OPEN')) ||
      (healthStatus?.providers && Object.values(healthStatus.providers).some(provider => provider.quotaExhausted));
  }, [healthStatus?.status, healthStatus?.circuitBreakers, healthStatus?.providers]);

  // Memoized provider counts
  const { totalProviders, healthyCount } = useMemo(() => ({
    totalProviders: Object.keys(healthStatus?.providers || {}).length,
    healthyCount: healthStatus?.healthyProviders?.filter(p => p !== 'fallback').length || 0
  }), [healthStatus?.providers, healthStatus?.healthyProviders]);

  const handleNavigationLink = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  // Loading state
  if (isLoading || isUsageLoading) {
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
            <AlertTriangle className={`w-4 h-4 ${hasQuotaIssues ? 'text-orange-500' : 'text-red-500'}`} />
            <span className={`text-body-small font-medium ${hasQuotaIssues ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
              {needsApiKey ? 'API Keys Required' : 
               hasQuotaIssues ? 'Quota Exceeded' : 
               'No AI Provider'}
            </span>
          </>
        )}
        
        {/* Health indicator dot - green if any provider works, red if API keys needed */}
        <div className={`w-2 h-2 rounded-full ${
          needsApiKey || healthStatus.status === 'needs_api_keys' ? 'bg-red-500 animate-pulse' :
          healthyCount > 0 ? 'bg-green-500' : 'bg-red-500'
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

            {/* API Key Required Alert */}
            {needsApiKey && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-800">API Keys Required</span>
                </div>
                <p className="text-xs text-red-700 mb-3">
                  AI providers have reached quota limits. Please add your own API keys to continue using AI features.
                </p>
                <button
                  onClick={() => window.open('/settings', '_blank')}
                  className="w-full px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                >
                  Add API Keys in Settings
                </button>
              </div>
            )}

            {/* Quota Limited Alert */}
            {healthStatus.status === 'quota_limited' && !needsApiKey && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium text-orange-800">Quota Limited</span>
                </div>
                <p className="text-xs text-orange-700">
                  Your API keys are configured but have hit quota limits. AI features will automatically recover when quotas reset.
                </p>
              </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-h4 font-bold text-gray-900">{healthyCount}/{totalProviders}</div>
                <div className="text-caption text-gray-500">Healthy</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-h4 font-bold text-green-600">
                  {userUsage?.user?.stats?.requests || 0}
                </div>
                <div className="text-caption text-gray-500">My Requests</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-h4 font-bold text-blue-600">
                  ${(userUsage?.user?.stats?.cost || 0).toFixed(3)}
                </div>
                <div className="text-caption text-gray-500">My Cost</div>
              </div>
            </div>


            {/* Provider List */}
            <div className="space-y-2">
              {Object.entries(healthStatus.providers || {}).map(([provider, stats]) => {
                const config = providerConfig[provider];
                const circuitBreaker = healthStatus.circuitBreakers?.[provider];
                const status = getStatusIndicator(stats.healthy, circuitBreaker?.state, stats.lastError);
                const Icon = config?.icon || Brain;
                const StatusIndicatorIcon = status.icon;

                return (
                  <div key={provider} className={`p-3 rounded-lg border ${
                    status.needsApiKey ? 'border-red-200 bg-red-50' :
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
                    {showDetails && (
                      <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
                        {/* Circuit Breaker Stats */}
                        {circuitBreaker && (
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
                        )}
                        
                        {/* User Usage Stats for this provider */}
                        {userUsage?.user?.stats?.providers?.[provider] && (
                          <div className="grid grid-cols-2 gap-2 text-caption text-gray-600">
                            <div>
                              <span className="font-medium">My Requests:</span> {userUsage.user.stats.providers[provider].requests || 0}
                            </div>
                            <div>
                              <span className="font-medium">My Cost:</span> ${(userUsage.user.stats.providers[provider].cost || 0).toFixed(4)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between">
              <Link
                href={'/settings'}
                onClick={handleNavigationLink}
                className="flex items-center space-x-1 text-body-small text-gray-600 hover:text-gray-800"
              >
                <Settings className="w-3 h-3" />
                <span>Settings</span>
              </Link>
              <Link
                href={'/analytics'}
                onClick={handleNavigationLink}
                className="flex items-center space-x-1 text-body-small text-blue-600 hover:text-blue-700"
              >
                <TrendingUp className="w-3 h-3" />
                <span>Analytics</span>
              </Link>
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
});

AIProviderStatus.displayName = 'AIProviderStatus';

export default AIProviderStatus;