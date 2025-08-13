/**
 * Minimal providers for authentication pages
 * Excludes React Query and other providers that might trigger API calls
 */

'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';

// Error boundary for auth pages
class AuthProvidersErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.log('Auth Providers Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-red-50">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-red-800 mb-4">
              Authentication Error
            </h2>
            <p className="text-red-600 mb-4">
              Something went wrong with the authentication system.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Minimal AuthProvider for auth pages - only NextAuth SessionProvider
const AuthOnlyProviders = ({ children, session }) => {
  return (
    <AuthProvidersErrorBoundary>
      <SessionProvider 
        session={session}
        refetchInterval={0} // Disable refetching on auth pages
        refetchOnWindowFocus={false} // Disable refetch on focus for auth pages
      >
        {children}
      </SessionProvider>
    </AuthProvidersErrorBoundary>
  );
};

export default AuthOnlyProviders;