'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

// Query keys for React Query caching
const QUERY_KEYS = {
  repositories: ['repositories'],
  repositoryAnalysis: (repoId) => ['repository-analysis', repoId],
  repositoryStatus: (owner, name) => ['repository-status', owner, name],
};

// Custom hook for repository data management
export const useRepositoryData = () => {
  const queryClient = useQueryClient();
  const [selectedRepository, setSelectedRepository] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch repository analysis status
  const useRepositoryStatus = (repository) => {
    return useQuery({
      queryKey: QUERY_KEYS.repositoryStatus(repository?.owner?.login, repository?.name),
      queryFn: async () => {
        if (!repository) return null;
        
        const response = await fetch(`/api/repo/status?owner=${repository.owner.login}&name=${repository.name}`);
        if (!response.ok) throw new Error('Failed to fetch repository status');
        
        const result = await response.json();
        return result.analysis || null;
      },
      enabled: !!repository,
      staleTime: 30000, // Consider data fresh for 30 seconds
      cacheTime: 300000, // Keep in cache for 5 minutes
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      retry: 1,
    });
  };

  // Start repository analysis mutation
  const startAnalysisMutation = useMutation({
    mutationFn: async (repository) => {
      const response = await fetch('/api/repo/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: repository.owner.login,
          name: repository.name,
          repositoryId: repository.id,
          full_name: repository.full_name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed to start');
      }

      return response.json();
    },
    onSuccess: (data, repository) => {
      // When analysis starts, or if we get a cached completed analysis back,
      // we need to update the query cache immediately.
      const queryKey = QUERY_KEYS.repositoryStatus(repository.owner.login, repository.name);

      if (data.status === 'completed' && data.analysis) {
        // If the API returned a cached, completed analysis, update the cache with the full data.
        queryClient.setQueryData(queryKey, data.analysis);
      } else if (data.analysisId) {
        // Otherwise, if a new analysis was started, set its status to pending.
        queryClient.setQueryData(queryKey, {
          id: data.analysisId,
          repositoryId: repository.id,
          owner: repository.owner.login,
          name: repository.name,
          fullName: repository.full_name,
          status: data.status || 'pending', // Use status from response, default to pending
          summary: null,
          metrics: null,
          fileIndex: null,
          createdAt: new Date().toISOString()
        });
      }
    },
  });


  // Poll analysis status with React Query (fallback)
  const useAnalysisPolling = (analysisId, enabled = false) => {
    return useQuery({
      queryKey: ['analysis-polling', analysisId],
      queryFn: async () => {
        const response = await fetch(`/api/repo/status/${analysisId}`);
        if (!response.ok) throw new Error('Failed to fetch analysis status');
        return response.json();
      },
      enabled: enabled && !!analysisId,
      refetchInterval: (data) => {
        // Stop polling if analysis is complete or failed
        if (data?.status === 'completed' || data?.status === 'failed') {
          return false;
        }
        return 2000; // Poll every 2 seconds
      },
      refetchOnWindowFocus: false,
      retry: 1,
    });
  };

  // Regenerate summary mutation
  const regenerateSummaryMutation = useMutation({
    mutationFn: async (analysisId) => {
      const response = await fetch('/api/repo/regenerate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analysisId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate summary');
      }

      return response.json();
    },
    onSuccess: (data, analysisId) => {
      // Invalidate all repository status queries to refetch fresh data
      queryClient.invalidateQueries({
        queryKey: ['repository-status'] // Invalidate all repository-status queries
      });
      
      // Also invalidate analysis polling if it exists
      queryClient.invalidateQueries({
        queryKey: ['analysis-polling']
      });
    },
  });

  // Helper functions
  const selectRepository = (repository) => {
    setSelectedRepository(repository);
    setActiveTab('overview');
    
    // Prefetch repository status
    if (repository) {
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.repositoryStatus(repository.owner.login, repository.name),
        queryFn: async () => {
          const response = await fetch(`/api/repo/status?owner=${repository.owner.login}&name=${repository.name}`);
          if (!response.ok) return null;
          const result = await response.json();
          return result.analysis || null;
        },
      });
    }
  };

  const clearSelection = () => {
    setSelectedRepository(null);
    setActiveTab('overview');
  };

  const startAnalysis = async (repository) => {
    if (!repository) return;
    
    setSelectedRepository(repository);
    return startAnalysisMutation.mutateAsync(repository);
  };

  const regenerateSummary = async (analysisId) => {
    return regenerateSummaryMutation.mutateAsync(analysisId);
  };

  return {
    // State
    selectedRepository,
    activeTab,
    setActiveTab,

    // Actions
    selectRepository,
    clearSelection,
    startAnalysis,
    regenerateSummary,

    // Hooks for components to use
    useRepositoryStatus,
    useAnalysisPolling,

    // Loading states
    isStartingAnalysis: startAnalysisMutation.isPending,
    isRegeneratingSummary: regenerateSummaryMutation.isPending,

    // Error states
    analysisError: startAnalysisMutation.error,
    regenerationError: regenerateSummaryMutation.error,

    // Query client for advanced usage
    queryClient,
  };
};

export default useRepositoryData;