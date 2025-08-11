/**
 * Custom hook for workflow management using React Query
 * Handles workflow creation, resumption, closing, and state management with caching
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { WorkflowId } from '../utils/workflowId.js';

// Query keys for React Query caching
export const workflowKeys = {
  all: ['workflows'],
  active: () => [...workflowKeys.all, 'active'],
  byStatus: (status) => [...workflowKeys.all, 'status', status],
  byId: (id) => [...workflowKeys.all, 'id', id],
  byTemplate: (template) => [...workflowKeys.all, 'template', template],
};

export function useWorkflow(initialTemplate = null) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [activeWorkflowId, setActiveWorkflowId] = useState(null);
  
  // Refs to prevent race conditions and multiple simultaneous operations
  const creatingWorkflow = useRef(false);
  const initializationAttempted = useRef(false);
  const debounceTimer = useRef(null);

  /**
   * Fetch active workflows with React Query
   */
  const {
    data: activeWorkflows = [],
    isLoading: loadingActiveWorkflows,
    error: activeWorkflowsError
  } = useQuery({
    queryKey: workflowKeys.byStatus('running'),
    queryFn: async () => {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch('/api/workflows/active?status=running&limit=10', {
          credentials: 'include', // Include cookies for NextAuth session
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch active workflows: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        return data.workflows || [];
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timed out - server may be overloaded');
        }
        throw error;
      }
    },
    enabled: !!session?.user, // Only fetch when user is authenticated and session is loaded
    retry: 2,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute to keep workflows up-to-date
  });

  /**
   * Get current workflow data with standardized ID comparison
   */
  const currentWorkflow = activeWorkflows.find(w => 
    WorkflowId.equals(w, activeWorkflowId)
  );

  /**
   * Create new workflow mutation
   */
  const createWorkflowMutation = useMutation({
    mutationFn: async ({ templateName, workflowMessage, options = {} }) => {
      const response = await fetch('/api/bmad/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: workflowMessage,
          name: templateName,
          description: `Template-based workflow: ${templateName}`,
          sequence: options.sequence || 'FULL_STACK',
          priority: options.priority || 'medium',
          tags: options.tags || ['template', initialTemplate]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create workflow: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      const workflowId = WorkflowId.extract(data) || data.workflowId;
      
      if (!workflowId) {
        console.error('No valid workflow ID returned from creation:', data);
        creatingWorkflow.current = false;
        return;
      }
      
      // Clear the creating flag
      creatingWorkflow.current = false;
      
      // Update active workflow state with validated ID
      setActiveWorkflowId(workflowId);
      
      // More targeted cache invalidation to prevent over-fetching
      queryClient.invalidateQueries({ 
        queryKey: workflowKeys.byStatus('running'),
        exact: true 
      });
      
      // Optimistically add the new workflow to cache with normalized structure
      queryClient.setQueryData(workflowKeys.byStatus('running'), (old = []) => {
        const normalizedWorkflow = {
          ...data,
          id: workflowId, // Ensure consistent ID field
          workflowId, // Keep for backward compatibility
          status: 'running'
        };
        
        // Prevent duplicates
        const filtered = old.filter(w => !WorkflowId.equals(w, workflowId));
        return [...filtered, normalizedWorkflow];
      });
    },
    onError: (error) => {
      console.error('Workflow creation failed:', error);
      
      // Clear the creating flag
      creatingWorkflow.current = false;
      
      // Don't create fallback IDs as they can cause downstream issues
      // Instead, let the UI handle the error state properly
      // If absolutely needed for offline functionality, use proper temporary ID
      if (error.name === 'NetworkError' || error.message.includes('offline')) {
        const fallbackId = WorkflowId.createTemporary(initialTemplate || 'workflow');
        setActiveWorkflowId(fallbackId);
        console.warn('Using temporary workflow ID due to network error:', fallbackId);
      }
    }
  });

  /**
   * Close workflow mutation
   */
  const closeWorkflowMutation = useMutation({
    mutationFn: async (workflowId) => {
      const response = await fetch('/api/bmad/workflow', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          action: 'cancel'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to close workflow');
      }
      
      return response.json();
    },
    onSuccess: (data, workflowId) => {
      // Clear active workflow
      setActiveWorkflowId(null);
      
      // Update cache - remove from active workflows using standardized comparison
      queryClient.setQueryData(workflowKeys.byStatus('running'), (old = []) =>
        old.filter(w => !WorkflowId.equals(w, workflowId))
      );
      
      // More targeted invalidation
      queryClient.invalidateQueries({ 
        queryKey: workflowKeys.byStatus('running'),
        exact: true 
      });
    },
    onError: () => {
      // Still close locally even if API fails
      setActiveWorkflowId(null);
    }
  });

  /**
   * Find existing workflow that matches current template
   * Improved template matching with better error handling
   */
  const findExistingWorkflow = useCallback((template) => {
    if (!template || !activeWorkflows?.length) return null;
    
    try {
      return activeWorkflows.find(w => {
        // Validate workflow object
        if (!w || typeof w !== 'object') return false;
        
        // Check workflow status (handle both database and BMAD formats)
        const validStatuses = ['running', 'initializing', 'paused', 'active'];
        const isActiveStatus = validStatuses.includes(w.status);
        if (!isActiveStatus) return false;
        
        // Normalize template for comparison
        const normalizedTemplate = template.toLowerCase().trim();
        
        // Check template matching with multiple possible fields
        const templateMatches = [
          // Direct template field matches
          w.template === template,
          w.template === `greenfield-${template}`,
          w.template?.toLowerCase().includes(normalizedTemplate),
          
          // Name/title matches (case insensitive)
          w.name?.toLowerCase().includes(normalizedTemplate),
          w.title?.toLowerCase().includes(normalizedTemplate),
          
          // Tags array matches
          Array.isArray(w.tags) && w.tags.some(tag => 
            tag?.toLowerCase().includes(normalizedTemplate)
          ),
          Array.isArray(w.metadata?.tags) && w.metadata.tags.some(tag => 
            tag?.toLowerCase().includes(normalizedTemplate)
          ),
          Array.isArray(w.context?.tags) && w.context.tags.some(tag => 
            tag?.toLowerCase().includes(normalizedTemplate)
          ),
          
          // Metadata template field
          w.metadata?.template === template
        ].some(Boolean);
        
        return templateMatches;
      });
    } catch (error) {
      console.error('Error in findExistingWorkflow:', error);
      return null;
    }
  }, [activeWorkflows]);

  /**
   * Resume an existing workflow with standardized ID handling
   */
  const resumeWorkflow = useCallback((workflow) => {
    const workflowId = WorkflowId.extract(workflow);
    
    if (!workflowId) {
      console.error('Cannot resume workflow: invalid or missing ID', workflow);
      return null;
    }
    
    setActiveWorkflowId(workflowId);
    
    // Update the workflow in cache to mark it as active
    queryClient.setQueryData(workflowKeys.byStatus('running'), (old = []) => {
      return old.map(w => 
        WorkflowId.equals(w, workflowId) 
          ? { ...w, status: 'running', lastAccessed: new Date().toISOString() }
          : w
      );
    });
    
    return workflowId;
  }, [queryClient]);

  /**
   * Start or resume workflow based on template
   */
  const startOrResumeWorkflow = useCallback(async (template, options = {}) => {
    if (!template || loadingActiveWorkflows || creatingWorkflow.current) {
      return null;
    }
    
    // First, check for existing workflow
    const existingWorkflow = findExistingWorkflow(template);
    
    if (existingWorkflow) {
      return resumeWorkflow(existingWorkflow);
    }
    
    // Check if we're already creating a workflow
    if (creatingWorkflow.current) {
      return null;
    }
    
    // Set flag to prevent multiple simultaneous creations
    creatingWorkflow.current = true;
    
    // Create new workflow if none exists
    const templateName = options.name || `${template} Workflow`;
    const workflowMessage = options.message || `Start ${templateName} for development project`;
    
    createWorkflowMutation.mutate({
      templateName,
      workflowMessage,
      options: {
        sequence: options.sequence,
        priority: options.priority,
        tags: ['template', template, ...(options.tags || [])]
      }
    });
    
    return null; // Will be set by mutation onSuccess
  }, [findExistingWorkflow, resumeWorkflow, createWorkflowMutation, loadingActiveWorkflows]);

  /**
   * Close current workflow
   */
  const closeWorkflow = useCallback(() => {
    if (activeWorkflowId) {
      closeWorkflowMutation.mutate(activeWorkflowId);
    }
  }, [activeWorkflowId, closeWorkflowMutation]);

  /**
   * Initialize workflow when workflows are loaded and conditions are met
   */
  useEffect(() => {
    // Only proceed if we have all the required conditions and workflows are loaded
    if (!initialTemplate || !session || loadingActiveWorkflows || activeWorkflowId || initializationAttempted.current || creatingWorkflow.current) {
      return;
    }
    
    // Clear any existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Debounce the initialization to prevent rapid successive calls
    debounceTimer.current = setTimeout(() => {
      // Double-check conditions after debounce delay
      if (!activeWorkflowId && !creatingWorkflow.current && !initializationAttempted.current) {
        // Mark that we've attempted initialization to prevent re-runs
        initializationAttempted.current = true;
        
        // Parse URL parameters for template details
        const urlParams = new URLSearchParams(window.location.search);
        const templateName = urlParams.get('name') || `${initialTemplate} Workflow`;
        const templateCategory = urlParams.get('category') || 'development';
        const templateAgents = urlParams.get('agents')?.split(',') || ['pm', 'architect', 'dev'];
        
        startOrResumeWorkflow(initialTemplate, {
          name: templateName,
          message: `Start ${templateName} workflow for ${templateCategory} project using agents: ${templateAgents.join(', ')}`,
          tags: ['template', initialTemplate, templateCategory]
        });
      }
    }, 300); // Reduced debounce delay since workflows are already loaded
    
    // Cleanup function
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [initialTemplate, session, loadingActiveWorkflows, activeWorkflowId, activeWorkflows.length, startOrResumeWorkflow]);
  
  /**
   * Reset initialization flag when template changes or when workflow is closed
   */
  useEffect(() => {
    if (!activeWorkflowId) {
      initializationAttempted.current = false;
      creatingWorkflow.current = false;
    }
  }, [activeWorkflowId]);
  
  /**
   * Reset initialization flag when template changes
   */
  useEffect(() => {
    initializationAttempted.current = false;
    creatingWorkflow.current = false;
  }, [initialTemplate]);

  return {
    // State
    activeWorkflowId,
    currentWorkflow,
    activeWorkflows,
    isActive: !!activeWorkflowId,
    
    // Loading states
    loading: loadingActiveWorkflows || createWorkflowMutation.isPending || closeWorkflowMutation.isPending,
    loadingCreate: createWorkflowMutation.isPending,
    loadingClose: closeWorkflowMutation.isPending,
    loadingActiveWorkflows,
    
    // Error states
    error: activeWorkflowsError || createWorkflowMutation.error || closeWorkflowMutation.error,
    createError: createWorkflowMutation.error,
    closeError: closeWorkflowMutation.error,
    
    // Actions
    createWorkflow: (templateName, workflowMessage, options) => 
      createWorkflowMutation.mutate({ templateName, workflowMessage, options }),
    closeWorkflow,
    resumeWorkflow,
    startOrResumeWorkflow,
    switchToWorkflow: (workflowId) => setActiveWorkflowId(workflowId),
    
    // Queries
    findExistingWorkflow,
    
    // Manual control (for external use)
    setActiveWorkflowId,
    
    // Query utilities
    refetchActiveWorkflows: () => queryClient.invalidateQueries({ queryKey: workflowKeys.byStatus('running') }),
    clearWorkflowCache: () => queryClient.removeQueries({ queryKey: workflowKeys.all })
  };
}