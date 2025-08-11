'use client';

import { SessionProvider } from 'next-auth/react';
import { useAuthSync, useAuth } from '../../lib/store/hooks/authHooks.js';
import { useEffect } from 'react';

// Component to sync NextAuth with Redux
const AuthSyncComponent = ({ children }) => {
  const { isLoading } = useAuthSync();
  const { user, isAuthenticated } = useAuth();
  
  // Optional: Add analytics or side effects based on auth state
  useEffect(() => {
    if (isAuthenticated && user) {
            console.info(`✅ User authenticated: ${user.email}`);
      // You could trigger analytics events here
      // analytics.identify(user.id, { email: user.email, name: user.name });
    }
  }, [isAuthenticated, user]);

  // Show auth loading state if needed
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Authenticating...</p>
        </div>
      </div>
    );
  }

  return children;
};

// Main AuthProvider component
export const AuthProvider = ({ children, session }) => {
  return (
    <SessionProvider 
      session={session}
      refetchInterval={5 * 60} // Refetch every 5 minutes
      refetchOnWindowFocus={true} // Refetch when window gains focus
    >
      <AuthSyncComponent>
        {children}
      </AuthSyncComponent>
    </SessionProvider>
  );
};

export default AuthProvider;