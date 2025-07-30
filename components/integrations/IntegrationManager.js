'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';

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

  const [isCreating, setIsCreating] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [testingIntegration, setTestingIntegration] = useState(null);
  const [testResult, setTestResult] = useState(null);

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
    onError: (err) => {
      setTestResult({ error: err.message });
      dispatch({
        type: 'ui/showToast',
        payload: { message: `Test failed: ${err.message}`, type: 'error' },
      });
    },
  });

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
            {availablePlugins.map((plugin) => (
              <div
                key={plugin.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {plugin.name}
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    v{plugin.version}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {plugin.description}
                </p>
                <button
                  onClick={() => handleStartCreate(plugin.id)}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                >
                  + Add Integration
                </button>
              </div>
            ))}
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
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {integration.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {integration.pluginId} • {integration.isActive ? 'Active' : 'Inactive'}
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