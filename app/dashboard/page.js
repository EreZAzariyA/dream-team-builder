'use client';

import { useSession, signOut } from 'next-auth/react';
import { useAuth } from '../../lib/store/hooks/authHooks.js';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { user, isAuthenticated, authStatus } = useAuth();

  if (status === 'loading' || authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You must be signed in to access the dashboard.
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                🎯 Dream Team Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Welcome back, {user?.name || session?.user?.name || 'User'}!
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-150 ease-in-out"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              👤 User Profile
            </h2>
            <div className="space-y-2">
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Name:</span> {user?.name || session?.user?.name || 'Not provided'}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Email:</span> {user?.email || session?.user?.email}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Role:</span> {user?.role || session?.user?.role || 'user'}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Auth Status:</span> {authStatus}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              🔐 Session Info
            </h2>
            <div className="space-y-2">
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Status:</span> {status}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Authenticated:</span> {isAuthenticated ? 'Yes' : 'No'}
              </p>
              {session?.expires && (
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Expires:</span> {new Date(session.expires).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            ⚡ Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/workflows"
              className="p-4 border-2 border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition duration-150 ease-in-out"
            >
              <div className="text-2xl mb-2">🔄</div>
              <h3 className="font-medium text-gray-900 dark:text-white">Workflows</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Manage AI workflows</p>
            </Link>
            
            <Link
              href="/agents"
              className="p-4 border-2 border-green-200 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition duration-150 ease-in-out"
            >
              <div className="text-2xl mb-2">🤖</div>
              <h3 className="font-medium text-gray-900 dark:text-white">Agents</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Configure AI agents</p>
            </Link>
            
            <Link
              href="/profile"
              className="p-4 border-2 border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition duration-150 ease-in-out"
            >
              <div className="text-2xl mb-2">⚙️</div>
              <h3 className="font-medium text-gray-900 dark:text-white">Settings</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Profile & preferences</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Note: metadata cannot be exported from client components
// Use next/head or document.title for dynamic titles in client components if needed