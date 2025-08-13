import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Create QueryClient with optimized configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache Configuration
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection time (renamed from cacheTime)
      
      // Retry Configuration
      retry: (failureCount, error) => {
        // Don't retry on 404 or 401 errors
        if (error?.response?.status === 404 || error?.response?.status === 401) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Background Refetching
      refetchOnWindowFocus: false, // Disable refetch on window focus for better UX
      refetchOnReconnect: true,   // Refetch when network reconnects
      refetchOnMount: true,       // Refetch when component mounts
      
      // Network Mode
      networkMode: 'online', // Only run queries when online
    },
    mutations: {
      // Mutation Configuration
      retry: 1, // Retry failed mutations once
      networkMode: 'online',
      
      // Global error handling for mutations
      onError: (error) => {
        console.error('Mutation failed:', error);
        // You can add global error handling here (toast notifications, etc.)
      }
    }
  }
});

// Query keys factory for consistent key management
export const queryKeys = {
  // User queries
  user: {
    all: ['user'],
    profile: () => [...queryKeys.user.all, 'profile'],
    settings: () => [...queryKeys.user.all, 'settings'],
  },
  
  // Workflow queries
  workflows: {
    all: ['workflows'],
    lists: () => [...queryKeys.workflows.all, 'list'],
    list: (filters) => [...queryKeys.workflows.lists(), { filters }],
    details: () => [...queryKeys.workflows.all, 'detail'],
    detail: (id) => [...queryKeys.workflows.details(), id],
    stats: () => [...queryKeys.workflows.all, 'stats'],
  },
  
  // Agent queries
  agents: {
    all: ['agents'],
    definitions: () => [...queryKeys.agents.all, 'definitions'],
    executions: () => [...queryKeys.agents.all, 'executions'],
    execution: (workflowId) => [...queryKeys.agents.executions(), workflowId],
    messages: () => [...queryKeys.agents.all, 'messages'],
    message: (workflowId) => [...queryKeys.agents.messages(), workflowId],
    artifacts: () => [...queryKeys.agents.all, 'artifacts'],
    artifact: (workflowId, agentId) => 
      [...queryKeys.agents.artifacts(), workflowId, agentId],
  },
  
  // Real-time queries (though most real-time data comes through WebSocket)
  realtime: {
    all: ['realtime'],
    status: (workflowId) => [...queryKeys.realtime.all, 'status', workflowId],
    health: () => [...queryKeys.realtime.all, 'health'],
  }
};

// Error boundary for React Query
export const QueryErrorBoundary = ({ children }) => {
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
            }
          }}
        />
      )}
    </QueryClientProvider>
  );
};

// Query Provider component
export const QueryProvider = ({ children }) => {
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
            }
          }}
        />
      )}
    </QueryClientProvider>
  );
};

// Utility functions for cache management
export const invalidateWorkflowQueries = (workflowId) => {
  if (workflowId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(workflowId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.execution(workflowId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.message(workflowId) });
  } else {
    queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
  }
};

export const invalidateAgentQueries = (workflowId, agentId) => {
  if (workflowId && agentId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.artifact(workflowId, agentId) });
  } else if (workflowId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.execution(workflowId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.message(workflowId) });
  } else {
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
  }
};

export const prefetchWorkflowData = async (workflowId) => {
  // Prefetch commonly needed data
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.workflows.detail(workflowId),
      queryFn: () => fetch(`/api/workflows/${workflowId}`).then(res => res.json()),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.agents.execution(workflowId),
      queryFn: () => fetch(`/api/workflows/${workflowId}/executions`).then(res => res.json()),
    }),
  ]);
};

import { getSession } from 'next-auth/react';

// Helper function to create authenticated fetch requests (NextAuth Compatible)
export const fetchWithAuth = async (url, options = {}) => {
  // Skip authentication on auth pages to prevent circular calls
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth')) {
    throw new Error('Cannot make authenticated requests on auth pages');
  }

  let session = null;
  try {
    session = await getSession();
  } catch (error) {
    console.warn('Failed to get session for authenticated request:', error);
    // Continue without session - let the API endpoint handle authentication
  }
  
  // For NextAuth, we rely on cookies being sent automatically
  // No need to manually add Authorization headers
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };

  // Only add Authorization header if session has an explicit accessToken
  // (This would be for JWT tokens from OAuth providers)
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`;
  }

  const response = await fetch(url, { 
    ...options, 
    headers,
    credentials: 'include' // Ensure cookies are sent with the request
  });

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    
    // Log unauthorized errors for debugging
    if (response.status === 401) {
      console.error(`[Error: Unauthorized] ${url} - Session:`, session ? 'Present' : 'Missing');
    }
    
    throw error;
  }

  return response.json();
};

// Cache warming for frequently accessed data
export const warmCache = async () => {
  try {
    // Prefetch agent definitions (rarely change, good for caching)
    await queryClient.prefetchQuery({
      queryKey: queryKeys.agents.definitions(),
      queryFn: () => fetchWithAuth('/api/agents'),
      staleTime: 30 * 60 * 1000, // 30 minutes
    });
    
    // Prefetch user profile
    await queryClient.prefetchQuery({
      queryKey: queryKeys.user.profile(),
      queryFn: () => fetchWithAuth('/api/auth/me'),
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  } catch (error) {
    console.warn('Cache warming failed:', error);
  }
};

// Optimistic update helpers
export const createOptimisticUpdate = (queryKey, updater) => {
  return {
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, updater);
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    }
  };
};

// Background sync utilities
export const enableBackgroundSync = () => {
  // Set up periodic background sync for critical data
  setInterval(() => {
    // Only sync if there are active queries
    const queries = queryClient.getQueryCache().getAll();
    const activeQueries = queries.filter(query => query.getObserversCount() > 0);
    
    if (activeQueries.length > 0) {
      // Refetch workflows if any are being observed
      const workflowQueries = activeQueries.filter(query => 
        query.queryKey.includes('workflows')
      );
      
      if (workflowQueries.length > 0) {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.workflows.all,
          refetchType: 'active' // Only refetch active queries
        });
      }
    }
  }, 60000); // Every minute
};

export default queryClient;