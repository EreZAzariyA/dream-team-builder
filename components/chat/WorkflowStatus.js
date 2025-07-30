/**
 * Workflow Status Component
 * Displays real-time workflow progress and agent status
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

const WorkflowStatus = ({ workflowId, onWorkflowComplete }) => {
  const [expandedView, setExpandedView] = useState(false);

  // Fetch workflow status with polling for real-time updates
  const { data: workflowData, isLoading, error } = useQuery({
    queryKey: ['workflow-status', workflowId],
    queryFn: async () => {
      const response = await fetch(`/api/bmad/workflow/${workflowId}`);
      if (!response.ok) throw new Error('Failed to fetch workflow status');
      return response.json();
    },
    refetchInterval: 2000, // Poll every 2 seconds for real-time updates
    enabled: !!workflowId
  });

  const workflow = workflowData?.workflow;

  // Handle workflow completion
  useEffect(() => {
    if (workflow?.status === 'completed' && onWorkflowComplete) {
      setTimeout(() => {
        onWorkflowComplete();
      }, 3000); // Auto-hide after 3 seconds
    }
  }, [workflow?.status, onWorkflowComplete]);

  if (isLoading) {
    return (
      <div className="border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
        <div className="p-3 flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-blue-700 dark:text-blue-300">Loading workflow status...</span>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
        <div className="p-3 flex items-center space-x-2">
          <span className="text-red-500">⚠️</span>
          <span className="text-sm text-red-700 dark:text-red-300">
            Error loading workflow status
          </span>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'text-blue-600 dark:text-blue-400';
      case 'completed': return 'text-green-600 dark:text-green-400';
      case 'paused': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'cancelled': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'paused': return '⏸️';
      case 'error': return '❌';
      case 'cancelled': return '🚫';
      default: return '⏳';
    }
  };

  const progressPercentage = workflow.totalSteps > 0 
    ? Math.round((workflow.currentStep / workflow.totalSteps) * 100)
    : 0;

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
      <div className="p-3">
        {/* Main Status Bar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getStatusIcon(workflow.status)}</span>
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {workflow.name || 'BMAD Workflow'}
              </h4>
              <p className={`text-xs capitalize ${getStatusColor(workflow.status)}`}>
                {workflow.status}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {workflow.currentStep}/{workflow.totalSteps}
            </span>
            <button
              onClick={() => setExpandedView(!expandedView)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              {expandedView ? '▼' : '▶'} Details
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Current Agent */}
        {workflow.currentAgent && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-gray-600 dark:text-gray-400">Active Agent:</span>
            <span className="text-blue-600 dark:text-blue-400 font-medium capitalize">
              {workflow.currentAgent}
            </span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        )}

        {/* Expanded View */}
        {expandedView && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
            {/* Workflow Timeline */}
            {workflow.communication?.timeline && (
              <div>
                <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Recent Activity:
                </h5>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {workflow.communication.timeline.slice(-3).map((event, index) => (
                    <div key={index} className="flex items-center space-x-2 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {event.summary}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent Status */}
            {workflow.agents && Object.keys(workflow.agents).length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agent Status:
                </h5>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(workflow.agents).map(([agentId, agent]) => (
                    <div
                      key={agentId}
                      className={`px-2 py-1 rounded text-xs flex items-center space-x-1 ${
                        agent.workflowStatus === 'active' 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : agent.workflowStatus === 'completed'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <span>{agent.icon || '🤖'}</span>
                      <span className="capitalize">{agentId}</span>
                      {agent.workflowStatus === 'active' && (
                        <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-gray-600 dark:text-gray-400">Messages</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {workflow.communication?.messageCount || 0}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-600 dark:text-gray-400">Artifacts</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {workflow.artifactCount || 0}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-600 dark:text-gray-400">Runtime</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {workflow.startTime ? 
                    Math.round((new Date() - new Date(workflow.startTime)) / 1000 / 60) + 'm'
                    : '0m'
                  }
                </div>
              </div>
            </div>

            {/* Workflow Completed Message */}
            {workflow.status === 'completed' && (
              <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded p-2">
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-green-600 dark:text-green-400">🎉</span>
                  <span className="text-green-800 dark:text-green-300 font-medium">
                    Workflow completed successfully!
                  </span>
                </div>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                  All agents have finished their tasks. Check the messages above for results and artifacts.
                </p>
              </div>
            )}

            {/* Error Message */}
            {workflow.status === 'error' && workflow.errors && workflow.errors.length > 0 && (
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded p-2">
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-red-600 dark:text-red-400">⚠️</span>
                  <span className="text-red-800 dark:text-red-300 font-medium">
                    Workflow Error
                  </span>
                </div>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                  {workflow.errors[workflow.errors.length - 1]?.error || 'An error occurred during workflow execution.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowStatus;