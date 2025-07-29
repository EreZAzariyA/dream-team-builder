'use client';

import React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';

import { store, persistor } from '../store/index.js';
import { queryClient } from '../react-query.js';
import { wsManager } from '../store/middleware/websocketMiddleware.js';
import AuthProvider from '../../components/auth/AuthProvider.js';

// Loading component for PersistGate
const PersistGateLoading = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="text-gray-600 dark:text-gray-400 font-medium">
        Loading Dream Team...
      </p>
    </div>
  </div>
);

// Error boundary for providers
class ProvidersErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Providers Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-red-50">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-red-800 mb-4">
              Application Error
            </h2>
            <p className="text-red-600 mb-4">
              Something went wrong loading the application providers.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Redux Provider Wrapper
const ReduxProviderWrapper = ({ children }) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Initialize WebSocket manager with store reference
    wsManager.setStore({
      dispatch: store.dispatch,
      getState: store.getState
    });
    
    // Set query client for cache invalidation
    wsManager.setQueryClient(queryClient);
  }, []);

  if (!isClient) {
    // Return loading component for SSR
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <ReduxProvider store={store}>
      <PersistGate loading={<PersistGateLoading />} persistor={persistor}>
        {children}
      </PersistGate>
    </ReduxProvider>
  );
};

// React Query Provider Wrapper
const ReactQueryProviderWrapper = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false}
          position="bottom-right"
          toggleButtonProps={{
            style: {
              marginLeft: '5px',
              transform: 'scale(0.8)',
              zIndex: 99999,
            }
          }}
        />
      )}
    </QueryClientProvider>
  );
};

// Theme Provider (basic implementation)
const ThemeProvider = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Prevent hydration mismatch
    return <div suppressHydrationWarning>{children}</div>;
  }

  return children;
};

// WebSocket Connection Manager
const WebSocketProvider = ({ children }) => {
  useEffect(() => {
    // Global WebSocket connection setup if needed
    // For now, connections are managed per workflow
    
    return () => {
      // Cleanup all connections on unmount
      const activeConnections = wsManager.getActiveConnections();
      activeConnections.forEach(workflowId => {
        wsManager.disconnect(workflowId);
      });
    };
  }, []);

  return children;
};

// Main App Providers Component
export const AppProviders = ({ children, session }) => {
  return (
    <ProvidersErrorBoundary>
      <ReactQueryProviderWrapper>
        <ReduxProviderWrapper>
          <AuthProvider session={session}>
            <ThemeProvider>
              <WebSocketProvider>
                {children}
              </WebSocketProvider>
            </ThemeProvider>
          </AuthProvider>
        </ReduxProviderWrapper>
      </ReactQueryProviderWrapper>
    </ProvidersErrorBoundary>
  );
};

// Individual provider exports for flexibility
export { 
  ReduxProviderWrapper as ReduxProvider,
  ReactQueryProviderWrapper as ReactQueryProvider,
  AuthProvider,
  ThemeProvider,
  WebSocketProvider,
  ProvidersErrorBoundary
};

export default AppProviders;