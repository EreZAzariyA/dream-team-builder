/**
 * BMAD Workflow Initiator Component
 * Integrates with existing chat system to start BMAD workflows
 */

'use client';

import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useMutation, useQuery } from '@tanstack/react-query';

export default function WorkflowInitiator({ onWorkflowStarted, className = '' }) {
  const [userPrompt, setUserPrompt] = useState('');
  const [selectedSequence, setSelectedSequence] = useState('FULL_STACK');
  const [workflowName, setWorkflowName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.ui.auth);

  // Fetch available agents and sequences
  const { data: agentsData, isLoading: loadingAgents } = useQuery({
    queryKey: ['bmad-agents'],
    queryFn: async () => {
      const response = await fetch('/api/bmad/agents');
      if (!response.ok) throw new Error('Failed to fetch agents');
      return response.json();
    }
  });

  // Start workflow mutation
  const startWorkflowMutation = useMutation({
    mutationFn: async (workflowData) => {
      const response = await fetch('/api/bmad/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start workflow');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Reset form
      setUserPrompt('');
      setWorkflowName('');
      setShowAdvanced(false);
      
      // Dispatch to Redux store
      dispatch({
        type: 'workflow/started',
        payload: {
          workflowId: data.workflowId,
          status: data.status,
          timestamp: new Date()
        }
      });
      
      // Notify parent component
      onWorkflowStarted?.(data);
      
      // Show success message
      dispatch({
        type: 'ui/showNotification',
        payload: {
          type: 'success',
          message: 'BMAD workflow started successfully!',
          duration: 5000
        }
      });
    },
    onError: (error) => {
      dispatch({
        type: 'ui/showNotification',
        payload: {
          type: 'error',
          message: error.message || 'Failed to start workflow',
          duration: 8000
        }
      });
    }
  });

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!userPrompt.trim() || userPrompt.trim().length < 10) {
      dispatch({
        type: 'ui/showNotification',
        payload: {
          type: 'warning',
          message: 'Please enter a detailed prompt (at least 10 characters)',
          duration: 5000
        }
      });
      return;
    }

    const workflowData = {
      userPrompt: userPrompt.trim(),
      name: workflowName.trim() || `Workflow - ${new Date().toLocaleDateString()}`,
      sequence: selectedSequence,
      priority: 'normal',
      tags: ['user-initiated']
    };

    startWorkflowMutation.mutate(workflowData);
  }, [userPrompt, workflowName, selectedSequence, dispatch, startWorkflowMutation]);

  const isSubmitDisabled = !userPrompt.trim() || userPrompt.trim().length < 10 || startWorkflowMutation.isPending;

  return (
    <div className={`bmad-workflow-initiator ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Main Prompt Input */}
        <div className="space-y-2">
          <label htmlFor="userPrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Describe what you want to build or achieve
          </label>
          <textarea
            id="userPrompt"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="E.g., I want to build a task management app with user authentication, task creation, and real-time updates..."
            className="w-full min-h-[120px] p-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-500 dark:placeholder:text-gray-400
                       resize-y transition-all duration-200"
            disabled={startWorkflowMutation.isPending}
          />
          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
            <span>{userPrompt.length} characters</span>
            <span className={userPrompt.length >= 10 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
              Minimum 10 characters
            </span>
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
        >
          <span>{showAdvanced ? '▼' : '▶'}</span>
          <span>Advanced Options</span>
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            {/* Workflow Name */}
            <div className="space-y-2">
              <label htmlFor="workflowName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Workflow Name (Optional)
              </label>
              <input
                id="workflowName"
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="My Project Workflow"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={startWorkflowMutation.isPending}
              />
            </div>

            {/* Workflow Sequence */}
            <div className="space-y-2">
              <label htmlFor="sequence" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Workflow Sequence
              </label>
              <select
                id="sequence"
                value={selectedSequence}
                onChange={(e) => setSelectedSequence(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={startWorkflowMutation.isPending || loadingAgents}
              >
                {loadingAgents ? (
                  <option>Loading sequences...</option>
                ) : (
                  agentsData?.sequences?.map(seq => (
                    <option key={seq.id} value={seq.id}>
                      {seq.name} ({seq.steps.length} steps)
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Sequence Preview */}
            {agentsData?.sequences && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sequence Preview:
                </span>
                <div className="flex flex-wrap gap-2">
                  {agentsData.sequences
                    .find(seq => seq.id === selectedSequence)
                    ?.steps.map((step, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-xs text-blue-800 dark:text-blue-200"
                      >
                        <span>{index + 1}.</span>
                        <span>{step.role}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                     text-white font-medium rounded-lg transition-colors duration-200
                     focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {startWorkflowMutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Starting Workflow...</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>Start BMAD Workflow</span>
            </>
          )}
        </button>

        {/* System Status */}
        {agentsData?.system && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            BMAD System: {agentsData.system.status} • {agentsData.system.agentsLoaded} agents loaded
          </div>
        )}
      </form>
    </div>
  );
}