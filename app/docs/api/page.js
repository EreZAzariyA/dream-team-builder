'use client';

import React from 'react';
import InteractiveAPIDocumentation from '../../components/docs/InteractiveAPIDocumentation.js';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function APIDocumentationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading
    if (!session) router.push('/auth/signin'); // Not signed in
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <nav className="flex space-x-4 mb-4">
            <a
              href="/dashboard"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← Back to Dashboard
            </a>
          </nav>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              API Documentation
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Interactive documentation for the BMAD Workflow API. Test endpoints, view request/response schemas, and explore available operations.
            </p>
            
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                🚀 Getting Started
              </h3>
              <ul className="text-blue-800 dark:text-blue-200 text-sm space-y-1">
                <li>• All endpoints require authentication except health checks</li>
                <li>• Use session-based auth (automatic) or bearer tokens</li>
                <li>• Test endpoints directly from this interface</li>
                <li>• Download OpenAPI spec for external tools</li>
              </ul>
            </div>
          </div>
        </div>

        <InteractiveAPIDocumentation />

        {/* Export Options */}
        <div className="mt-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📥 Export Options
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="/api/docs/openapi"
                target="_blank"
                className="flex items-center justify-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">📄</div>
                  <div className="font-medium text-gray-900 dark:text-white">OpenAPI JSON</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Download spec file</div>
                </div>
              </a>
              
              <a
                href="https://editor.swagger.io/"
                target="_blank"
                className="flex items-center justify-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">🔧</div>
                  <div className="font-medium text-gray-900 dark:text-white">Swagger Editor</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Edit in Swagger</div>
                </div>
              </a>
              
              <button
                onClick={() => {
                  const specUrl = `${window.location.origin}/api/docs/openapi`;
                  const postmanUrl = `https://www.postman.com/api-documentation-generator/?url=${encodeURIComponent(specUrl)}`;
                  window.open(postmanUrl, '_blank');
                }}
                className="flex items-center justify-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">📮</div>
                  <div className="font-medium text-gray-900 dark:text-white">Import to Postman</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Use with Postman</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}