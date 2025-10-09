'use client';

import React, { useState } from 'react';
import { useDispatch } from 'react-redux';

// Custom hooks
import { useIntegrations } from './hooks/useIntegrations.js';
import { useGitHubIntegration } from './hooks/useGitHubIntegration.js';

// Integration configuration forms
import GitHubIntegrationForm from './GitHubIntegrationForm.js';
import SlackIntegrationForm from './SlackIntegrationForm.js';
import JiraIntegrationForm from './JiraIntegrationForm.js';

export default function IntegrationManager() {
  const dispatch = useDispatch();

  // Custom hooks for data management
  const {
    integrations,
    availablePlugins,
    isLoading,
    error,
    createIntegrationAsync,
    updateIntegration,
    deleteIntegration,
    testIntegration,
    isCreating: isCreatingIntegration,
    isUpdating,
    isDeleting,
    isTesting,
    testMutation
  } = useIntegrations();

  const {
    showGitHubTokenForm,
    githubToken,
    isLinkingGitHub,
    hasGitHubAccount,
    handleConnectGitHub,
    handleLinkGitHub,
    handleCancelGitHubLink,
    setGithubToken
  } = useGitHubIntegration();

  // Local state for forms and UI
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [testingIntegration, setTestingIntegration] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [autoCreatingGitHub, setAutoCreatingGitHub] = useState(false);

  // Event handlers
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
      updateIntegration({ id: editingIntegration._id, ...formData });
      setEditingIntegration(null);
    } else {
      createIntegrationAsync({ pluginId: selectedPlugin, ...formData });
      setSelectedPlugin(null);
    }
    setIsCreating(false);
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
      testIntegration({
        id: integration._id,
        action: testAction.action,
        data: testAction.data
      });
    }
  };

  // Enhanced GitHub linking with auto-integration creation
  const handleEnhancedLinkGitHub = async () => {
    const success = await handleLinkGitHub(async (result) => {
      // Auto-create the GitHub integration
      try {
        await createIntegrationAsync({ 
          pluginId: 'github', 
          name: `GitHub (${result.user.githubLogin})`, 
          config: {
            githubLogin: result.user.githubLogin,
            connectedAt: new Date().toISOString()
          }
        });
      } catch (integrationError) {
        console.warn('Failed to auto-create integration, but GitHub account is linked:', integrationError);
      }
    });
    
    if (success) {
      dispatch({
        type: 'ui/showToast',
        payload: { 
          message: '🎉 GitHub integration linked and activated successfully!', 
          type: 'success' 
        },
      });
    }
  };

  // Handle test results
  React.useEffect(() => {
    if (testMutation.isSuccess && testMutation.data) {
      setTestResult(testMutation.data);
    }
    if (testMutation.isError) {
      setTestResult({ error: testMutation.error.message });
      
      // Handle token expiration specifically
      if (testMutation.error.message.includes('token expired') || testMutation.error.message.includes('GITHUB_TOKEN_EXPIRED')) {
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
      }
    }
  }, [testMutation.isSuccess, testMutation.isError, testMutation.data, testMutation.error, dispatch, handleConnectGitHub]);

  const renderIntegrationForm = () => {
    const formProps = {
      onSubmit: handleSubmitForm,
      onCancel: handleCancelForm,
      isLoading: isCreatingIntegration || isUpdating,
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

  // Check GitHub integration states
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
              const canLinkGitHub = isGitHub && !hasGitHubAccount;
              
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
                        ✓ GitHub account linked via Personal Access Token
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
                      onClick={() => createIntegrationAsync({ pluginId: 'github', name: 'GitHub', config: {} })}
                      className="w-full px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
                    >
                      + Add Integration
                    </button>
                  ) : canLinkGitHub ? (
                    <div className="space-y-2">
                      {!showGitHubTokenForm ? (
                        <>
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
                            Link your GitHub account with a personal access token
                          </p>
                        </>
                      ) : (
                        <div className="space-y-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              GitHub Personal Access Token
                            </label>
                            <input
                              type="password"
                              value={githubToken}
                              onChange={(e) => setGithubToken(e.target.value)}
                              placeholder="ghp_..."
                              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Create a token at GitHub Settings → Developer settings → Personal access tokens
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Required scopes: repo, read:user, user:email
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={handleEnhancedLinkGitHub}
                              disabled={isLinkingGitHub || !githubToken.trim()}
                              className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isLinkingGitHub ? 'Linking...' : 'Link'}
                            </button>
                            <button
                              onClick={handleCancelGitHubLink}
                              disabled={isLinkingGitHub}
                              className="flex-1 px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
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
                        {integration.pluginId === 'github' && integration.name.includes('GitHub') && (
                          <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded-full">
                            PAT
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {integration.pluginId} • {integration.isActive ? 'Active' : 'Inactive'}
                        {integration.pluginId === 'github' && (
                          <span className="text-green-600 dark:text-green-400"> • Linked via Personal Access Token</span>
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
                      disabled={isTesting && testingIntegration?._id === integration._id}
                      className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      {isTesting && testingIntegration?._id === integration._id ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      onClick={() => handleStartEdit(integration)}
                      className="px-3 py-1 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteIntegration(integration._id)}
                      disabled={isDeleting}
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