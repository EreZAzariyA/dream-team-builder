'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function WelcomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Redirect to signin if not authenticated
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to Dream Team!
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Your account has been successfully created
          </p>
        </div>

        {/* User Info */}
        {session?.user && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center space-x-4">
              {session.user.image ? (
                <Image
                  className="h-12 w-12 rounded-full"
                  src={session.user.image}
                  alt={session.user.name || 'User avatar'}
                  width={48} // Corresponds to w-12 (12 * 4 = 48px)
                  height={48} // Corresponds to h-12 (12 * 4 = 48px)
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-xl text-blue-600 dark:text-blue-400">
                    {session.user.name?.charAt(0).toUpperCase() || '👤'}
                  </span>
                </div>
              )}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {session.user.name || 'New User'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {session.user.email}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Getting Started */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-4">
            🚀 Get Started
          </h3>
          <ul className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
            <li className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
              Explore the BMAD agent workflows
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
              Set up your project preferences
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
              Start your first AI-powered workflow
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <Link
            href="/dashboard"
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            Continue to Dashboard
          </Link>
          
          <Link
            href="/profile"
            className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            Complete Profile Setup
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Need help getting started?{' '}
            <Link href="/help" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">
              Check out our guide
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// Note: metadata cannot be exported from client components
// Use next/head or document.title for dynamic titles in client components if needed