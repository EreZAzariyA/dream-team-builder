/**
 * Live Workflow Visualization
 * Real-time interactive workflow progress display with agent communication
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePusher } from '../../lib/pusher/PusherClient';

export default function LiveWorkflowVisualization({ workflowId, className = '' }) {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [viewMode, setViewMode] = useState('timeline'); // timeline, network, details
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const timelineRef = useRef(null);
  const networkRef = useRef(null);

  // Get workflow status with real-time updates
  const { data: workflowData, isLoading } = useQuery({
    queryKey: ['workflow-status', workflowId],
    queryFn: async () => {
      const response = await fetch(`/api/bmad/workflow/${workflowId}`);
      if (!response.ok) throw new Error('Failed to fetch workflow');
      return response.json();
    },
    refetchInterval: 2000, // Fallback polling
    enabled: !!workflowId
  });

  // Pusher connection for real-time updates
  const { client: pusherClient, connected: pusherConnected } = usePusher({
    token: 'test-token', // In production, use actual auth token
    userId: 'user-1'
  });

  // Subscribe to workflow updates via Pusher
  useEffect(() => {
    if (pusherClient && pusherConnected && workflowId) {
      pusherClient.subscribeToWorkflow(workflowId);

      const unsubscribes = [
        pusherClient.on('workflow_update', (data) => {
          console.log('Workflow update:', data);
          // Trigger query invalidation for real-time updates
        }),
        
        pusherClient.on('agent_activated', (data) => {
          console.log('Agent activated:', data);
          if (isAutoScrolling) {
            scrollToLatestActivity();
          }
        }),
        
        pusherClient.on('agent_completed', (data) => {
          console.log('Agent completed:', data);
          if (isAutoScrolling) {
            scrollToLatestActivity();
          }
        }),
        
        pusherClient.on('workflow_message', (data) => {
          console.log('Workflow message:', data);
        })
      ];

      return () => {
        pusherClient.unsubscribeFromWorkflow(workflowId);
        unsubscribes.forEach(unsub => unsub());
      };
    }
  }, [pusherClient, pusherConnected, workflowId, isAutoScrolling]);

  // Auto-scroll to latest activity
  const scrollToLatestActivity = () => {
    if (viewMode === 'timeline' && timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-gray-50 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!workflowData?.success) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="text-red-600">
          ❌ Failed to load workflow visualization
        </div>
      </div>
    );
  }

  const workflow = workflowData.workflow;

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Workflow Visualization
            </h3>
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
              <span>ID: {workflow.id}</span>
              <span className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-1 ${getStatusColor(workflow.status)}`}></div>
                {workflow.status}
              </span>
              {pusherConnected && (
                <span className="flex items-center text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                  Live
                </span>
              )}
            </div>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {['timeline', 'network', 'details'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === mode
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
          <span>Step {workflow.currentStep + 1} of {workflow.totalSteps}</span>
          <span>{Math.round(((workflow.currentStep + 1) / workflow.totalSteps) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              workflow.status === 'error' ? 'bg-red-500' :
              workflow.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${((workflow.currentStep + 1) / workflow.totalSteps) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Auto-scroll toggle */}
      <div className="px-4 py-2 border-b bg-gray-50">
        <label className="flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            checked={isAutoScrolling}
            onChange={(e) => setIsAutoScrolling(e.target.checked)}
            className="rounded"
          />
          <span>Auto-scroll to latest activity</span>
        </label>
      </div>

      {/* Visualization Content */}
      <div className="p-4" style={{ minHeight: '400px' }}>
        {viewMode === 'timeline' && (
          <TimelineView
            workflow={workflow}
            selectedAgent={selectedAgent}
            onAgentSelect={setSelectedAgent}
            ref={timelineRef}
          />
        )}
        
        {viewMode === 'network' && (
          <NetworkView
            workflow={workflow}
            selectedAgent={selectedAgent}
            onAgentSelect={setSelectedAgent}
            ref={networkRef}
          />
        )}
        
        {viewMode === 'details' && (
          <DetailsView
            workflow={workflow}
            selectedAgent={selectedAgent}
          />
        )}
      </div>
    </div>
  );
}

// Timeline View Component
const TimelineView = React.forwardRef(({ workflow, selectedAgent, onAgentSelect }, ref) => {
  const timeline = workflow.communication?.timeline || [];
  
  return (
    <div ref={ref} className="max-h-96 overflow-y-auto space-y-3">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Communication Timeline</h4>
      
      {timeline.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-2">⏳</div>
          <div>Waiting for workflow activity...</div>
        </div>
      ) : (
        timeline.map((event, index) => (
          <div key={index} className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-1">
              <div className={`w-3 h-3 rounded-full ${getEventColor(event.type)}`}></div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">
                  {formatEventTitle(event)}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(event.timestamp)}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 mt-1">
                {event.summary || formatEventDescription(event)}
              </div>
              
              {event.participants && (
                <div className="flex items-center space-x-1 mt-2">
                  {event.participants.map((participant, i) => (
                    <button
                      key={i}
                      onClick={() => onAgentSelect(participant)}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        selectedAgent === participant
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {participant}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
});

TimelineView.displayName = 'TimelineView';

// Network View Component  
const NetworkView = React.forwardRef(({ workflow, selectedAgent, onAgentSelect }, ref) => {
  const agents = workflow.agents || {};
  
  return (
    <div ref={ref} className="h-96">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Agent Network</h4>
      
      <div className="grid grid-cols-3 gap-4 h-full">
        {Object.entries(agents).map(([agentId, agent]) => (
          <div
            key={agentId}
            onClick={() => onAgentSelect(agentId)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedAgent === agentId
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-center">
              <div className="text-2xl mb-2">{agent.icon || '🤖'}</div>
              <div className="font-medium text-sm">{agent.name || agentId}</div>
              <div className="text-xs text-gray-500 mt-1">{agent.title}</div>
              
              <div className={`inline-block px-2 py-1 mt-2 text-xs rounded-full ${
                getAgentStatusStyle(agent.workflowStatus || agent.status)
              }`}>
                {agent.workflowStatus || agent.status || 'idle'}
              </div>
              
              {agent.startTime && (
                <div className="text-xs text-gray-400 mt-1">
                  Started: {formatTime(agent.startTime)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

NetworkView.displayName = 'NetworkView';

// Details View Component
const DetailsView = ({ workflow, selectedAgent }) => {
  const stats = workflow.communication?.statistics || {};
  
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Workflow Details</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs text-gray-500">Start Time</div>
            <div className="font-medium">{formatTime(workflow.startTime)}</div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs text-gray-500">Current Agent</div>
            <div className="font-medium">{workflow.currentAgent || 'None'}</div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs text-gray-500">Messages</div>
            <div className="font-medium">{workflow.messageCount || 0}</div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs text-gray-500">Artifacts</div>
            <div className="font-medium">{workflow.artifactCount || 0}</div>
          </div>
        </div>
      </div>
      
      {selectedAgent && workflow.agents?.[selectedAgent] && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Selected Agent: {selectedAgent}
          </h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-xs text-gray-600">
              {JSON.stringify(workflow.agents[selectedAgent], null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      {stats.messagesByType && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Message Statistics</h4>
          <div className="space-y-2">
            {Object.entries(stats.messagesByType).map(([type, count]) => (
              <div key={type} className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-600">{type}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions
function getStatusColor(status) {
  switch (status) {
    case 'running': return 'bg-blue-500';
    case 'completed': return 'bg-green-500';
    case 'error': return 'bg-red-500';
    case 'paused': return 'bg-yellow-500';
    default: return 'bg-gray-500';
  }
}

function getEventColor(eventType) {
  switch (eventType) {
    case 'activation': return 'bg-blue-500';
    case 'completion': return 'bg-green-500';
    case 'error': return 'bg-red-500';
    case 'inter_agent': return 'bg-purple-500';
    default: return 'bg-gray-500';
  }
}

function getAgentStatusStyle(status) {
  switch (status) {
    case 'active': return 'bg-blue-100 text-blue-700';
    case 'completed': return 'bg-green-100 text-green-700';
    case 'error': return 'bg-red-100 text-red-700';
    case 'paused': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function formatEventTitle(event) {
  switch (event.type) {
    case 'activation': return `Agent Activated`;
    case 'completion': return `Task Completed`;
    case 'error': return `Error Occurred`;
    case 'inter_agent': return `Agent Communication`;
    default: return event.type;
  }
}

function formatEventDescription(event) {
  return `${event.from || 'System'} → ${event.to || 'System'}`;
}

function formatTime(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleTimeString();
}