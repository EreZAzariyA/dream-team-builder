/**
 * Custom hook for workflow management using React Query
 * Handles workflow creation, resumption, closing, and state management with caching
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

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
      console.log('🔍 Fetching active workflows...');
      
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
          console.error('❌ Failed to fetch workflows:', response.status, errorText);
          throw new Error(`Failed to fetch active workflows: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        console.log('📋 Fetched workflows:', data.workflows?.length || 0, 'workflows');
        console.log('Workflow details:', data.workflows?.map(w => ({
          id: w.id || w._id,
          template: w.template,
          tags: w.metadata?.tags || w.tags,
          status: w.status
        })));
        return data.workflows || [];
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.error('❌ Workflow fetch timed out');
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
   * Get current workflow data
   */
  const currentWorkflow = activeWorkflows.find(w => 
    (w.id || w._id || w.workflowId) === activeWorkflowId
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
      const workflowId = data.workflowId;
      console.log('✅ New workflow created:', workflowId);
      
      // Clear the creating flag
      creatingWorkflow.current = false;
      
      // Update active workflow state
      setActiveWorkflowId(workflowId);
      
      // Invalidate and refetch active workflows
      queryClient.invalidateQueries({ queryKey: workflowKeys.byStatus('running') });
      queryClient.invalidateQueries({ queryKey: workflowKeys.all });
      
      // Optimistically add the new workflow to cache
      queryClient.setQueryData(workflowKeys.byStatus('running'), (old = []) => [
        ...old,
        { ...data, workflowId, status: 'running' }
      ]);
    },
    onError: (error) => {
      console.error('Failed to create workflow:', error);
      
      // Clear the creating flag
      creatingWorkflow.current = false;
      
      // Fallback: generate a temporary workflow ID
      const fallbackId = `${initialTemplate || 'workflow'}-${Date.now()}`;
      setActiveWorkflowId(fallbackId);
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
      console.log('🔴 Workflow closed:', workflowId);
      
      // Clear active workflow
      setActiveWorkflowId(null);
      
      // Update cache - remove from active workflows
      queryClient.setQueryData(workflowKeys.byStatus('running'), (old = []) =>
        old.filter(w => (w.workflowId || w.id) !== workflowId)
      );
      
      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: workflowKeys.all });
    },
    onError: (error) => {
      console.warn('Failed to update workflow status in database:', error);
      // Still close locally even if API fails
      setActiveWorkflowId(null);
    }
  });

  /**
   * Find existing workflow that matches current template
   * Handles both database workflows (_id) and BMAD in-memory workflows (id)
   */
  const findExistingWorkflow = useCallback((template) => {
    if (!template || !activeWorkflows?.length) return null;
    
    console.log('🔍 Looking for existing workflow with template:', template);
    console.log('Available workflows:', activeWorkflows.length, activeWorkflows.map(w => ({
      id: w.id || w._id || w.workflowId,
      name: w.name || w.title,
      status: w.status,
      template: w.template,
      tags: w.metadata?.tags || w.tags
    })));
    
    return activeWorkflows.find(w => {
      // Check workflow status (handle both database and BMAD formats)
      const isActiveStatus = w.status === 'running' || w.status === 'initializing' || w.status === 'paused';
      if (!isActiveStatus) return false;
      
      // Check template matching with multiple possible fields
      // Handle both database model (title, template, metadata.tags) and BMAD model (name, context.tags)
      const templateMatches = 
        // Direct template field match - handle database case where template is "greenfield-fullstack" but we're looking for "fullstack-app"
        w.template === template ||
        w.template === `greenfield-${template}` ||
        w.template?.includes(template) ||
        // Name/title contains template (case insensitive)
        w.name?.toLowerCase().includes(template.toLowerCase()) ||
        w.title?.toLowerCase().includes(template.toLowerCase()) ||
        // Tags contain template
        w.tags?.includes(template) ||
        w.metadata?.tags?.includes(template) ||
        w.context?.tags?.includes(template) ||
        // Metadata template field
        w.metadata?.template === template;
        
      if (templateMatches) {
        console.log('✅ Found matching workflow:', w.id || w._id || w.workflowId);
      }
        
      return templateMatches;
    });
  }, [activeWorkflows]);

  /**
   * Resume an existing workflow
   */
  const resumeWorkflow = useCallback((workflow) => {
    // Handle both database workflows (_id) and BMAD workflows (id)
    const workflowId = workflow.id || workflow._id || workflow.workflowId;
    console.log('🔄 Resuming existing workflow:', workflowId, 'name:', workflow.name || workflow.title);
    setActiveWorkflowId(workflowId);
    return workflowId;
  }, []);

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
      console.log('🔄 Found existing workflow, resuming:', existingWorkflow.workflowId || existingWorkflow.id);
      return resumeWorkflow(existingWorkflow);
    }
    
    // Check if we're already creating a workflow
    if (creatingWorkflow.current) {
      console.log('⏳ Workflow creation already in progress, skipping...');
      return null;
    }
    
    // Set flag to prevent multiple simultaneous creations
    creatingWorkflow.current = true;
    
    // Create new workflow if none exists
    const templateName = options.name || `${template} Workflow`;
    const workflowMessage = options.message || `Start ${templateName} for development project`;
    
    console.log('🚀 Creating new workflow for template:', template);
    
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
    console.log('🔄 Workflows loaded effect triggered:', {
      initialTemplate,
      hasSession: !!session,
      loadingActiveWorkflows,
      activeWorkflowId,
      initializationAttempted: initializationAttempted.current,
      creatingWorkflow: creatingWorkflow.current,
      activeWorkflowsCount: activeWorkflows.length
    });
    
    // Only proceed if we have all the required conditions and workflows are loaded
    if (!initialTemplate || !session || loadingActiveWorkflows || activeWorkflowId || initializationAttempted.current || creatingWorkflow.current) {
      console.log('⏸️ Skipping initialization due to conditions');
      return;
    }
    
    // Clear any existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Debounce the initialization to prevent rapid successive calls
    debounceTimer.current = setTimeout(() => {
      console.log('⏰ Checking for existing workflows after workflows loaded...');
      
      // Double-check conditions after debounce delay
      if (!activeWorkflowId && !creatingWorkflow.current && !initializationAttempted.current) {
        // Mark that we've attempted initialization to prevent re-runs
        initializationAttempted.current = true;
        
        console.log('🔍 Initializing workflow for template:', initialTemplate);
        
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
      } else {
        console.log('⏸️ Debounced check failed conditions');
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
    
    // Queries
    findExistingWorkflow,
    
    // Manual control (for external use)
    setActiveWorkflowId,
    
    // Query utilities
    refetchActiveWorkflows: () => queryClient.invalidateQueries({ queryKey: workflowKeys.byStatus('running') }),
    clearWorkflowCache: () => queryClient.removeQueries({ queryKey: workflowKeys.all })
  };
}