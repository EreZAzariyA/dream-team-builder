'use client';

import React, { useState, useEffect } from 'react';

export default function JiraIntegrationForm({ onSubmit, onCancel, isLoading, initialData }) {
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    email: '',
    apiToken: '',
    defaultProject: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        domain: initialData.config?.domain || '',
        email: initialData.config?.email || '',
        apiToken: initialData.config?.apiToken || '',
        defaultProject: initialData.config?.defaultProject || ''
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const config = {
      domain: formData.domain,
      email: formData.email,
      apiToken: formData.apiToken,
      ...(formData.defaultProject && { defaultProject: formData.defaultProject })
    };

    onSubmit({
      name: formData.name,
      config
    });
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        {initialData ? 'Edit JIRA Integration' : 'Configure JIRA Integration'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Integration Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="My JIRA Integration"
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            A friendly name for this integration
          </p>
        </div>

        <div>
          <label htmlFor="domain" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            JIRA Domain *
          </label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm">
              https://
            </span>
            <input
              type="text"
              id="domain"
              name="domain"
              value={formData.domain}
              onChange={handleChange}
              className="flex-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-none focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="your-domain"
              required
            />
            <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm">
              .atlassian.net
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Your JIRA Cloud domain (without https:// and .atlassian.net)
          </p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email Address *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="your-email@example.com"
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Your JIRA account email address
          </p>
        </div>

        <div>
          <label htmlFor="apiToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            API Token *
          </label>
          <input
            type="password"
            id="apiToken"
            name="apiToken"
            value={formData.apiToken}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="ATATT3xFfGF0T4..."
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Generate an API token at{' '}
            <a 
              href="https://id.atlassian.com/manage-profile/security/api-tokens" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Atlassian Account Settings → Security → API tokens
            </a>
          </p>
        </div>

        <div>
          <label htmlFor="defaultProject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Default Project Key
          </label>
          <input
            type="text"
            id="defaultProject"
            name="defaultProject"
            value={formData.defaultProject}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="PROJ"
            style={{ textTransform: 'uppercase' }}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Default project key for creating workflow-related issues (usually 3-5 uppercase letters)
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            📋 Setup Instructions
          </h4>
          <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="underline">Atlassian Account Settings</a></li>
            <li>Click "Create API token"</li>
            <li>Give it a descriptive label like "BMAD Workflow Integration"</li>
            <li>Copy the generated token and paste it above</li>
            <li>Make sure you have appropriate permissions to create issues in your JIRA projects</li>
          </ol>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
          <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
            ⚠️ Required Permissions
          </h4>
          <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
            <li>• <strong>Browse Projects</strong> - View projects and project configurations</li>
            <li>• <strong>Create Issues</strong> - Create new issues in projects</li>
            <li>• <strong>Edit Issues</strong> - Modify existing issues</li>
            <li>• <strong>Add Comments</strong> - Comment on issues</li>
            <li>• <strong>Transition Issues</strong> - Move issues through workflow states</li>
          </ul>
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : (initialData ? 'Update Integration' : 'Create Integration')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}