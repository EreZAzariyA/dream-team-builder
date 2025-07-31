'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function GitHubIntegrationForm({ onSubmit, onCancel, isLoading, initialData }) {
  const { data: session } = useSession();
  
  // Check if user has GitHub OAuth connected
  const hasGitHubOAuth = session?.user?.githubId;
  
  const [formData, setFormData] = useState({
    name: '',
    token: '',
    defaultOwner: '',
    defaultRepo: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        token: initialData.config?.token || '',
        defaultOwner: initialData.config?.defaultOwner || '',
        defaultRepo: initialData.config?.defaultRepo || ''
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
      // Only include token if user doesn't have OAuth or manually provided one
      ...((!hasGitHubOAuth || formData.token) && { token: formData.token }),
      ...(formData.defaultOwner && { defaultOwner: formData.defaultOwner }),
      ...(formData.defaultRepo && { defaultRepo: formData.defaultRepo })
    };

    onSubmit({
      name: formData.name,
      config
    });
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        {initialData ? 'Edit GitHub Integration' : 'Configure GitHub Integration'}
      </h3>

      {/* OAuth Status Display */}
      {hasGitHubOAuth && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-green-800 dark:text-green-200">
              ✓ GitHub OAuth Connected
            </span>
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
            Your GitHub account is linked. No manual token required.
          </p>
        </div>
      )}
      
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
            placeholder="My GitHub Integration"
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            A friendly name for this integration
          </p>
        </div>

        {/* Token field - optional when OAuth is available */}
        <div>
          <label htmlFor="token" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Personal Access Token {hasGitHubOAuth ? '(Optional)' : '*'}
          </label>
          <input
            type="password"
            id="token"
            name="token"
            value={formData.token}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder={hasGitHubOAuth ? "Leave blank to use OAuth token" : "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
            required={!hasGitHubOAuth}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {hasGitHubOAuth ? (
              'Optional: Override OAuth token with a specific Personal Access Token'
            ) : (
              <>
                Generate a token at{' '}
                <a 
                  href="https://github.com/settings/tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  GitHub Settings → Developer settings → Personal access tokens
                </a>
              </>
            )}
          </p>
        </div>

        <div>
          <label htmlFor="defaultOwner" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Default Owner/Organization
          </label>
          <input
            type="text"
            id="defaultOwner"
            name="defaultOwner"
            value={formData.defaultOwner}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="your-username or your-org"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Default GitHub username or organization for repositories
          </p>
        </div>

        <div>
          <label htmlFor="defaultRepo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Default Repository
          </label>
          <input
            type="text"
            id="defaultRepo"
            name="defaultRepo"
            value={formData.defaultRepo}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="your-repo-name"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Default repository name for workflow artifacts
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            📋 Required Permissions
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• <strong>repo</strong> - Full control of private repositories</li>
            <li>• <strong>workflow</strong> - Update GitHub Action workflows</li>
            <li>• <strong>write:packages</strong> - Upload packages to GitHub Package Registry</li>
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