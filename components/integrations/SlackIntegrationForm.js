'use client';

import React, { useState, useEffect } from 'react';

export default function SlackIntegrationForm({ onSubmit, onCancel, isLoading, initialData }) {
  const [formData, setFormData] = useState({
    name: '',
    botToken: '',
    defaultChannel: '',
    workspaceUrl: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        botToken: initialData.config?.botToken || '',
        defaultChannel: initialData.config?.defaultChannel || '',
        workspaceUrl: initialData.config?.workspaceUrl || ''
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
      botToken: formData.botToken,
      ...(formData.defaultChannel && { defaultChannel: formData.defaultChannel }),
      ...(formData.workspaceUrl && { workspaceUrl: formData.workspaceUrl })
    };

    onSubmit({
      name: formData.name,
      config
    });
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        {initialData ? 'Edit Slack Integration' : 'Configure Slack Integration'}
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
            placeholder="My Slack Integration"
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            A friendly name for this integration
          </p>
        </div>

        <div>
          <label htmlFor="botToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Bot User OAuth Token *
          </label>
          <input
            type="password"
            id="botToken"
            name="botToken"
            value={formData.botToken}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx"
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Create a Slack app at{' '}
            <a 
              href="https://api.slack.com/apps" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              api.slack.com/apps
            </a>
            {' '}and get the Bot User OAuth Token
          </p>
        </div>

        <div>
          <label htmlFor="workspaceUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Workspace URL
          </label>
          <input
            type="url"
            id="workspaceUrl"
            name="workspaceUrl"
            value={formData.workspaceUrl}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder={"https://your-workspace.slack.com"}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Your Slack workspace URL (optional)
          </p>
        </div>

        <div>
          <label htmlFor="defaultChannel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Default Channel
          </label>
          <input
            type="text"
            id="defaultChannel"
            name="defaultChannel"
            value={formData.defaultChannel}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder={"general or @username or C1234567890"}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Default channel for workflow notifications (channel name, user, or channel ID)
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">
            🔑 Required OAuth Scopes
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <li>• <strong>channels:read</strong> - View basic information about public channels</li>
              <li>• <strong>chat:write</strong> - Send messages as the bot</li>
              <li>• <strong>files:write</strong> - Upload files</li>
              <li>• <strong>users:read</strong> - View people in the workspace</li>
            </ul>
            <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <li>• <strong>channels:manage</strong> - Manage public channels</li>
              <li>• <strong>groups:read</strong> - View basic information about private channels</li>
              <li>• <strong>im:write</strong> - Start direct messages with people</li>
              <li>• <strong>mpim:write</strong> - Start group direct messages</li>
            </ul>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            📋 Setup Instructions
          </h4>
          <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="underline">api.slack.com/apps</a> and create a new app</li>
            <li>Go to &quot;OAuth & Permissions&quot; and add the required scopes listed above</li>
            <li>Install the app to your workspace</li>
            <li>Copy the &quot;Bot User OAuth Token&quot; that starts with &quot;xoxb-&quot;</li>
            <li>Invite your bot to channels where you want to send notifications</li>
          </ol>
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