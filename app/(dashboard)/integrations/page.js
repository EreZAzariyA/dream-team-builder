'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import IntegrationManager from '../../../components/integrations/IntegrationManager.js';

export default function IntegrationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading
    if (!session) router.push('/auth/signin'); // Not signed in
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  return (
    <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h1 className="text-h1 mb-4">Integration Hub</h1>
          <p className="text-body text-gray-600 dark:text-gray-400">
            Connect your BMAD workflows with external services like GitHub, Slack, and JIRA to automate your development pipeline.
          </p>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-2xl">🐙</span>
                <h3 className="text-h4 text-gray-900 dark:text-white">GitHub</h3>
              </div>
              <p className="text-body-small text-gray-600 dark:text-gray-400">
                Upload workflow artifacts, create issues, and manage repositories automatically.
              </p>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-2xl">💬</span>
                <h3 className="text-h4 text-gray-900 dark:text-white">Slack</h3>
              </div>
              <p className="text-body-small text-gray-600 dark:text-gray-400">
                Send workflow notifications, share artifacts, and keep your team informed.
              </p>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-2xl">📋</span>
                <h3 className="text-h4 text-gray-900 dark:text-white">JIRA</h3>
              </div>
              <p className="text-body-small text-gray-600 dark:text-gray-400">
                Create issues for workflow results, track progress, and manage project tasks.
              </p>
            </div>
          </div>
        </div>

        <IntegrationManager />

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-h3 text-gray-900 dark:text-white mb-4">
            🔗 How Integrations Work
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-h4 text-gray-900 dark:text-white mb-2">Automatic Triggers</h4>
              <ul className="text-body-small text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Workflow completion notifications</li>
                <li>• Artifact uploads and sharing</li>
                <li>• Error reporting and alerts</li>
                <li>• Progress updates and status changes</li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-h4 text-gray-900 dark:text-white mb-2">Manual Actions</h4>
              <ul className="text-body-small text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Test integration connectivity</li>
                <li>• Send custom messages</li>
                <li>• Create specific issues or repositories</li>
                <li>• Upload files and documents</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <h4 className="text-h4 text-green-900 dark:text-green-100 mb-2">
              🛡️ Security & Privacy
            </h4>
            <p className="text-body-small text-green-800 dark:text-green-200">
              All integration credentials are encrypted and stored securely. Only you can access your integrations, 
              and they&apos;re only used for the specific actions you configure. You can disable or delete any integration at any time.
            </p>
          </div>
        </div>
    </div>
  );
}
