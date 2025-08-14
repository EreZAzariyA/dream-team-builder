'use client';

import { SessionProvider } from 'next-auth/react';
import { useAuth } from '../../lib/store/hooks/authHooks.js';
import { useEffect } from 'react';

// Component to sync NextAuth with Redux
const AuthSyncComponent = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  
  // Optional: Add analytics or side effects based on auth state
  useEffect(() => {
    if (isAuthenticated && user) {
      console.info(`✅ User authenticated: ${user.email}`);
      // You could trigger analytics events here
      // analytics.identify(user.id, { email: user.email, name: user.name });
    }
  }, [isAuthenticated, user]);

  // Don't show loading state at provider level - let individual pages handle it
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