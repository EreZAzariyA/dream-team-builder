'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';

// API functions
async function fetchIntegrations() {
  const response = await fetch('/api/integrations');
  if (!response.ok) {
    throw new Error('Failed to fetch integrations');
  }
  return response.json();
}

async function createIntegration(integrationData) {
  const response = await fetch('/api/integrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(integrationData)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create integration');
  }
  return response.json();
}

async function updateIntegration(id, integrationData) {
  const response = await fetch(`/api/integrations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(integrationData)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update integration');
  }
  return response.json();
}

async function deleteIntegration(id) {
  const response = await fetch(`/api/integrations/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete integration');
  }
  return response.json();
}

async function testIntegration(id, action, data) {
  const response = await fetch(`/api/integrations/${id}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to test integration');
  }
  return response.json();
}

export function useIntegrations() {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  // Fetch integrations query
  const {
    data,
    error,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['integrations'],
    queryFn: fetchIntegrations,
  });

  // Create integration mutation
  const createMutation = useMutation({
    mutationFn: createIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries(['integrations']);
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Integration created successfully!', type: 'success' },
      });
    },
    onError: (err) => {
      dispatch({
        type: 'ui/showToast',
        payload: { message: err.message, type: 'error' },
      });
    },
  });

  // Update integration mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => updateIntegration(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['integrations']);
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Integration updated successfully!', type: 'success' },
      });
    },
    onError: (err) => {
      dispatch({
        type: 'ui/showToast',
        payload: { message: err.message, type: 'error' },
      });
    },
  });

  // Delete integration mutation
  const deleteMutation = useMutation({
    mutationFn: deleteIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries(['integrations']);
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Integration deleted successfully!', type: 'success' },
      });
    },
    onError: (err) => {
      dispatch({
        type: 'ui/showToast',
        payload: { message: err.message, type: 'error' },
      });
    },
  });

  // Test integration mutation
  const testMutation = useMutation({
    mutationFn: ({ id, action, data }) => testIntegration(id, action, data),
    onSuccess: (result) => {
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Integration test successful!', type: 'success' },
      });
      return result;
    },
    onError: (err) => {
      dispatch({
        type: 'ui/showToast',
        payload: { message: `Test failed: ${err.message}`, type: 'error' },
      });
      throw err;
    },
  });

  return {
    // Data
    integrations: data?.data?.integrations || [],
    availablePlugins: data?.data?.availablePlugins || [],
    
    // Loading states
    isLoading,
    error,
    
    // Actions
    createIntegration: createMutation.mutate,
    createIntegrationAsync: createMutation.mutateAsync,
    updateIntegration: updateMutation.mutate,
    deleteIntegration: deleteMutation.mutate,
    testIntegration: testMutation.mutate,
    refetch,
    
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isTesting: testMutation.isPending,
    
    // Raw mutations for advanced usage
    createMutation,
    updateMutation,
    deleteMutation,
    testMutation,
  };
}