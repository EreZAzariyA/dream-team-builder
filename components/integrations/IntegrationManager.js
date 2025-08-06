'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { useSession, signIn, getSession } from 'next-auth/react';

// Integration configuration forms
import GitHubIntegrationForm from './GitHubIntegrationForm.js';
import SlackIntegrationForm from './SlackIntegrationForm.js';
import JiraIntegrationForm from './JiraIntegrationForm.js';

async function fetchIntegrations() {
  const response = await fetch('/api/integrations');
  if (!response.ok) {
    throw new Error('Failed to fetch integrations');
  }
  return response.json();
}

async function createIntegration(integrationData) {
  const response = await fetch('/api/integrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(integrationData)
  });
  if (!response.ok) {
    const error = await response.json();

    throw new Error(error.error || 'Failed to create integration');
  }
  return response.json();
}

async function updateIntegration(id, integrationData) {
  const response = await fetch(`/api/integrations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(integrationData)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update integration');
  }
  return response.json();
}

async function deleteIntegration(id) {
  const response = await fetch(`/api/integrations/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete integration');
  }
  return response.json();
}

async function testIntegration(id, action, data) {
  const response = await fetch(`/api/integrations/${id}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to test integration');
  }
  return response.json();
}

export default function IntegrationManager() {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const { data: session } = useSession();

  const [isCreating, setIsCreating] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [testingIntegration, setTestingIntegration] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [autoCreatingGitHub, setAutoCreatingGitHub] = useState(false);

  const { data, error, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: fetchIntegrations,
  });

  const createMutation = useMutation({
    mutationFn: createIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries(['integrations']);
      setIsCreating(false);
      setSelectedPlugin(null);
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Integration created successfully!', type: 'success' },
      });
    },
    onError: (err) => {
      dispatch({
        type: 'ui/showToast',
        payload: { message: err.message, type: 'error' },
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => updateIntegration(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['integrations']);
      setEditingIntegration(null);
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Integration updated successfully!', type: 'success' },
      });
    },
    onError: (err) => {
      dispatch({
        type: 'ui/showToast',
        payload: { message: err.message, type: 'error' },
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries(['integrations']);
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Integration deleted successfully!', type: 'success' },
      });
    },
    onError: (err) => {
      dispatch({
        type: 'ui/showToast',
        payload: { message: err.message, type: 'error' },
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: ({ id, action, data }) => testIntegration(id, action, data),
    onSuccess: (result) => {
      setTestResult(result);
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Integration test successful!', type: 'success' },
      });
    },
    onError: async (err) => {
      setTestResult({ error: err.message });
      
      // Handle token expiration specifically
      if (err.message.includes('token expired') || err.message.includes('GITHUB_TOKEN_EXPIRED')) {
        dispatch({
          type: 'ui/showToast',
          payload: { 
            message: 'GitHub token expired. Click to reconnect your account.', 
            type: 'error',
            action: {
              label: 'Reconnect GitHub',
              onClick: handleConnectGitHub
            }
          },
        });
      } else {
        dispatch({
          type: 'ui/showToast',
          payload: { message: `Test failed: ${err.message}`, type: 'error' },
        });
      }
    },
  });

  // Handle URL parameters for GitHub linking feedback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const linking = urlParams.get('linking');
      const error = urlParams.get('error');

      if (linking === 'github') {
        // Check if we have account linking data in localStorage
        const linkingData = localStorage.getItem('accountLinking');
        if (linkingData) {
          const { provider, timestamp } = JSON.parse(linkingData);
          
          // Check if the linking data is recent (within 5 minutes)
          if (Date.now() - timestamp < 5 * 60 * 1000 && provider === 'github') {
            dispatch({
              type: 'ui/showToast',
              payload: { 
                message: '🎉 GitHub account linked successfully! Integration will be auto-enabled.', 
                type: 'success' 
              },
            });
            
            // Clean up
            localStorage.removeItem('accountLinking');
            window.history.replaceState({}, '', window.location.pathname);
            
            // Refresh session and data
            const refreshData = async () => {
              await getSession(); // This will refresh the session
              queryClient.invalidateQueries(['integrations']);
              // Force a page refresh to ensure session is updated
              setTimeout(() => window.location.reload(), 1000);
            };
            refreshData();
          }
        }
      } else if (error) {
        const errorMessages = {
          github_oauth_error: 'GitHub OAuth was cancelled or failed.',
          missing_params: 'Missing required parameters for GitHub linking.',
          invalid_state: 'Invalid state parameter. Please try again.',
          user_not_found: 'User session not found. Please sign in again.',
          github_already_linked: 'This GitHub account is already linked to another user.',
          callback_failed: 'GitHub linking failed. Please try again.'
        };
        
        dispatch({
          type: 'ui/showToast',
          payload: { 
            message: errorMessages[error] || 'GitHub linking failed. Please try again.', 
            type: 'error' 
          },
        });
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [dispatch, queryClient]);

  // Auto-create GitHub integration if user signed in with GitHub
  useEffect(() => {
    if (session?.user && data?.data?.integrations && data?.data?.availablePlugins) {
      const integrations = data.data.integrations;
      const availablePlugins = data.data.availablePlugins;
      
      // Check if user has GitHub account linked (from NextAuth)
      const hasGitHubAccount = session.user.accounts?.some(account => account.provider === 'github') ||
                              session.user.githubId; // Fallback for stored githubId
      
      // Check if GitHub plugin is available
      const hasGitHubPlugin = availablePlugins.some(plugin => plugin.id === 'github');
      
      // Check if GitHub integration already exists
      const hasGitHubIntegration = integrations.some(integration => integration.pluginId === 'github');
      
      if (hasGitHubAccount && hasGitHubPlugin && !hasGitHubIntegration && !autoCreatingGitHub) {
        setAutoCreatingGitHub(true);
        
        // Auto-create GitHub integration
        createMutation.mutate({
          pluginId: 'github',
          name: 'GitHub (Auto-connected)',
          config: {}, // No config needed - will use OAuth token
          isActive: true
        }, {
          onSuccess: () => {
            dispatch({
              type: 'ui/showToast',
              payload: { 
                message: '🎉 GitHub integration automatically enabled! You can now use GitHub features.', 
                type: 'success' 
              },
            });
            setAutoCreatingGitHub(false);
          },
          onError: (err) => {
            console.error('Failed to auto-create GitHub integration:', err);
            setAutoCreatingGitHub(false);
          }
        });
      }
    }
  }, [session, data, createMutation, autoCreatingGitHub, dispatch, queryClient]);

  const handleStartCreate = (pluginId) => {
    setSelectedPlugin(pluginId);
    setIsCreating(true);
    setEditingIntegration(null);
  };

  const handleStartEdit = (integration) => {
    setEditingIntegration(integration);
    setSelectedPlugin(integration.pluginId);
    setIsCreating(true);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setSelectedPlugin(null);
    setEditingIntegration(null);
  };

  const handleSubmitForm = (formData) => {
    if (editingIntegration) {
      updateMutation.mutate({ id: editingIntegration._id, ...formData });
    } else {
      createMutation.mutate({ pluginId: selectedPlugin, ...formData });
    }
  };

  const handleTestIntegration = (integration) => {
    setTestingIntegration(integration);
    setTestResult(null);
    
    // Define test actions for each plugin type
    const testActions = {
      github: { action: 'getRepositories', data: { per_page: 5 } },
      slack: { action: 'getChannels', data: { limit: 5 } },
      jira: { action: 'getProjects', data: {} }
    };
    
    const testAction = testActions[integration.pluginId];
    if (testAction) {
      testMutation.mutate({
        id: integration._id,
        action: testAction.action,
        data: testAction.data
      });
    }
  };

  const handleConnectGitHub = async () => {
    // Store current user ID for account linking
    localStorage.setItem('accountLinking', JSON.stringify({
      provider: 'github',
      timestamp: Date.now()
    }));
    
    // Use NextAuth's signIn with custom callback
    await signIn('github', {
      callbackUrl: '/integrations?linking=github',
      prompt: 'consent',
      login: '',
      redirect: 'http://localhost:3000/integrations'
    });
  };

  const renderIntegrationForm = () => {
    const formProps = {
      onSubmit: handleSubmitForm,
      onCancel: handleCancelForm,
      isLoading: createMutation.isPending || updateMutation.isPending,
      initialData: editingIntegration
    };

    switch (selectedPlugin) {
      case 'github':
        return <GitHubIntegrationForm {...formProps} />;
      case 'slack':
        return <SlackIntegrationForm {...formProps} />;
      case 'jira':
        return <JiraIntegrationForm {...formProps} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse">Loading integrations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="text-red-500">Error loading integrations: {error.message}</div>
      </div>
    );
  }

  const integrations = data?.data?.integrations || [];
  const availablePlugins = data?.data?.availablePlugins || [];

  // Check if user has GitHub connected
  const hasGitHubAccount = session?.user?.accounts?.some(account => account.provider === 'github') ||
                          session?.user?.githubId;
  const hasGitHubIntegration = integrations.some(integration => integration.pluginId === 'github');
  

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        🔌 Integration Manager
      </h2>

      {/* Available Plugins */}
      {!isCreating && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Available Integrations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availablePlugins.map((plugin) => {
              const isGitHub = plugin.id === 'github';
              const isGitHubAutoConnected = isGitHub && hasGitHubAccount && hasGitHubIntegration;
              const isGitHubConnectable = isGitHub && hasGitHubAccount && !hasGitHubIntegration;
              const isGitHubCreating = isGitHub && autoCreatingGitHub;
              const canLinkGitHub = isGitHub && !hasGitHubAccount && !hasGitHubIntegration;
              
              return (
                <div
                  key={plugin.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    isGitHubAutoConnected 
                      ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                      : isGitHubConnectable
                      ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {plugin.name}
                      </h4>
                      {isGitHub && hasGitHubAccount && (
                        <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded-full">
                          Connected
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      v{plugin.version}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {plugin.description}
                    {isGitHub && hasGitHubAccount && (
                      <span className="block mt-1 text-green-600 dark:text-green-400 text-xs">
                        ✓ Signed in with GitHub OAuth
                      </span>
                    )}
                  </p>
                  
                  {isGitHubAutoConnected ? (
                    <div className="w-full px-3 py-2 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded-md text-sm text-center">
                      ✓ Auto-enabled
                    </div>
                  ) : isGitHubCreating ? (
                    <div className="w-full px-3 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded-md text-sm text-center">
                      🔄 Setting up...
                    </div>
                  ) : isGitHubConnectable ? (
                    <button
                      onClick={() => handleStartCreate(plugin.id)}
                      className="w-full px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
                    >
                      ⚡ Auto-Setup Available
                    </button>
                  ) : canLinkGitHub ? (
                    <div className="space-y-2">
                      <button
                        onClick={handleConnectGitHub}
                        className="w-full px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-md text-sm hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        <span>Connect GitHub</span>
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        Link your GitHub account for automatic setup
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartCreate(plugin.id)}
                      className="w-full px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                    >
                      + Add Integration
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Integration Form */}
      {isCreating && (
        <div className="mb-8">
          {renderIntegrationForm()}
        </div>
      )}

      {/* Existing Integrations */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Your Integrations
        </h3>
        
        {integrations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No integrations configured yet. Add one from the available integrations above.
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map((integration) => (
              <div
                key={integration._id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      integration.isActive ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {integration.name}
                        </h4>
                        {integration.pluginId === 'github' && integration.name.includes('Auto-connected') && (
                          <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded-full">
                            OAuth
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {integration.pluginId} • {integration.isActive ? 'Active' : 'Inactive'}
                        {integration.pluginId === 'github' && integration.name.includes('Auto-connected') && (
                          <span className="text-green-600 dark:text-green-400"> • Uses your GitHub account</span>
                        )}
                      </p>
                      {integration.lastUsed && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Last used: {new Date(integration.lastUsed).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleTestIntegration(integration)}
                      disabled={testMutation.isPending && testingIntegration?._id === integration._id}
                      className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      {testMutation.isPending && testingIntegration?._id === integration._id ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      onClick={() => handleStartEdit(integration)}
                      className="px-3 py-1 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(integration._id)}
                      disabled={deleteMutation.isPending}
                      className="px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                {/* Test Results */}
                {testingIntegration?._id === integration._id && testResult && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-2">Test Results:</h5>
                    {testResult.error ? (
                      <div className="text-red-600 dark:text-red-400 text-sm">
                        Error: {testResult.error}
                      </div>
                    ) : (
                      <pre className="text-xs text-gray-600 dark:text-gray-300 overflow-x-auto">
                        {JSON.stringify(testResult.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}