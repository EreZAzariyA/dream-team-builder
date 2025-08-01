/**
 * Enhanced Chat Window with Real-time BMAD Integration
 * Combines existing chat functionality with live workflow visualization and agent communication
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import ChatWindow from './ChatWindow';
import LiveWorkflowVisualization from '../workflow/LiveWorkflowVisualization';
import AgentChatInterface from './AgentChatInterface';
import ConfirmationModal from '../common/ConfirmationModal';
import { usePusherSimple } from '../../lib/pusher/SimplePusherClient';
import { useWorkflow } from '../../lib/hooks/useWorkflow';

export default function EnhancedChatWindow({ className = '', initialTemplate }) {
  const { data: session } = useSession();
  
  // Use the workflow hook for all workflow management
  const {
    activeWorkflowId,
    currentWorkflow,
    activeWorkflows,
    loading: workflowLoading,
    error: workflowError,
    closeWorkflow,
    switchToWorkflow,
    setActiveWorkflowId
  } = useWorkflow(initialTemplate);
  
  const [showVisualization, setShowVisualization] = useState(false);
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [viewMode, setViewMode] = useState('agent-chat'); // agent-chat, traditional-chat, split, visualization
  const [agents, setAgents] = useState([]);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

  // Handle close workspace confirmation
  const handleCloseWorkspace = () => {
    setShowCloseConfirmation(true);
  };

  const confirmCloseWorkspace = () => {
    closeWorkflow(); // Use the hook's closeWorkflow function
    setShowVisualization(false);
    setShowAgentChat(false);
    setViewMode('agent-chat');
    setShowCloseConfirmation(false);
  };

  const cancelCloseWorkspace = () => {
    setShowCloseConfirmation(false);
  };

  // Load available agents
  const { data: agentsData } = useQuery({
    queryKey: ['bmad-agents'],
    queryFn: async () => {
      const response = await fetch('/api/bmad/test');
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json();
      return data.agents || [];
    }
  });

  useEffect(() => {
    if (agentsData) {
      setAgents(agentsData);
    }
  }, [agentsData]);

  // Pusher connection for system-wide updates
  const { connected: pusherConnected, pusher: pusherClient } = usePusherSimple();

  // Handle workflow start from regular chat
  const handleWorkflowStarted = (workflowId) => {
    setActiveWorkflowId(workflowId);
    setShowVisualization(true);
    setShowAgentChat(true);
  };
  
  // Handle workflow state changes and Pusher subscriptions
  useEffect(() => {
    if (activeWorkflowId && pusherClient && pusherConnected) {
      const channelName = `workflow-${activeWorkflowId}`;
      pusherClient.subscribe(channelName);
      
      return () => {
        pusherClient.unsubscribe(channelName);
      };
    }
  }, [activeWorkflowId, pusherClient, pusherConnected]);

  // Handle view mode changes
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    
    // Auto-show panels based on mode
    if (mode === 'visualization') {
      setShowVisualization(true);
      setShowAgentChat(false);
    } else if (mode === 'split') {
      setShowVisualization(true);
      setShowAgentChat(true);
    } else if (mode === 'agent-chat') {
      setShowVisualization(false);
      setShowAgentChat(false);
    } else if (mode === 'traditional-chat') {
      setShowVisualization(false);
      setShowAgentChat(false);
    }
  };

  return (
    <div className={`h-full flex flex-col relative ${className}`}>
      {/* Floating View Mode Controls - Only show when workflow is active */}
      {activeWorkflowId && (
        <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
        <div className="flex space-x-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-gray-200 dark:border-gray-700">
          {[
            { mode: 'agent-chat', label: 'Agents', icon: '🤖' },
            { mode: 'traditional-chat', label: 'Chat', icon: '💬' },
            ...(activeWorkflowId ? [
              { mode: 'split', label: 'Split', icon: '📊' },
              { mode: 'visualization', label: 'Viz', icon: '🔍' }
            ] : [])
          ].map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => handleViewModeChange(mode)}
              className={`px-2 py-1 text-xs rounded-md transition-colors flex items-center space-x-1 ${
                viewMode === mode
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={label}
            >
              <span>{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {activeWorkflowId && (
          <button
            onClick={handleCloseWorkspace}
            className="px-2 py-1 text-xs text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors shadow-lg"
            title="Close Workflow"
          >
            ✕
          </button>
        )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {!activeWorkflowId ? (
          /* No Workflow Lock Screen */
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center max-w-md mx-auto p-8">
              <div className="mb-8">
                <div className="w-24 h-24 mx-auto mb-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <div className="text-4xl">🔒</div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Workflow Required
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                  To start chatting with AI agents, you need an active workflow. 
                  Workflows provide context and structure for meaningful conversations with your AI team.
                </p>
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={() => window.location.href = '/workflows'}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <span>🚀</span>
                  <span>Browse Workflows</span>
                </button>
                
                <button
                  onClick={() => window.location.href = '/workflows/new'}
                  className="w-full px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <span>✨</span>
                  <span>Create New Workflow</span>
                </button>
              </div>
              
              <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start space-x-3">
                  <div className="text-blue-500 mt-0.5">💡</div>
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">What are workflows?</p>
                    <p>Workflows define your project goals, team structure, and agent responsibilities. They help AI agents understand their roles and collaborate effectively on your projects.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'agent-chat' ? (
          /* Agent Chat Mode with Agents List */
          <div className="flex-1 flex">
            <div className="flex-1">
              <AgentChatInterface
                workflowId={activeWorkflowId}
                agents={agents}
                activeWorkflows={activeWorkflows}
                className="h-full"
                onWorkflowSwitch={switchToWorkflow}
              />
            </div>
          </div>
        ) : viewMode === 'traditional-chat' ? (
          /* Traditional Chat Mode */
          <div className="flex-1">
            <ChatWindow 
              onWorkflowStarted={handleWorkflowStarted}
              className="h-full"
              initialTemplate={initialTemplate}
              pusherClient={pusherClient}
              pusherConnected={pusherConnected}
            />
          </div>
        ) : viewMode === 'visualization' ? (
          /* Full Visualization Mode */
          <div className="flex-1 p-4">
            <LiveWorkflowVisualization 
              workflowId={activeWorkflowId}
              className="h-full"
            />
          </div>
        ) : viewMode === 'split' ? (
          /* Split View Mode */
          <div className="flex-1 flex">
            {/* Left Panel - Chat */}
            <div className="flex-1 border-r">
              <ChatWindow 
                onWorkflowStarted={handleWorkflowStarted}
                className="h-full"
                compact={true}
                pusherClient={pusherClient}
                pusherConnected={pusherConnected}
              />
            </div>

            {/* Right Panel - Visualization and Agent Chat */}
            <div className="flex-1 flex flex-col">
              {/* Top - Visualization */}
              <div className="flex-1 p-4">
                <LiveWorkflowVisualization 
                  workflowId={activeWorkflowId}
                  className="h-full"
                />
              </div>

              {/* Bottom - Agent Chat */}
              <div className="h-80 border-t">
                <AgentChatInterface
                  workflowId={activeWorkflowId}
                  agents={agents}
                  activeWorkflows={activeWorkflows}
                  className="h-full"
                  onWorkflowSwitch={switchToWorkflow}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Status Bar */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span>
              Agents: {agents.length} available
            </span>
            {pusherConnected ? (
              <span className="flex items-center text-green-600 dark:text-green-400">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></div>
                Real-time connected
              </span>
            ) : (
              <span className="flex items-center text-red-600 dark:text-red-400">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1"></div>
                Real-time disconnected
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {session?.user ? (
              <span>Signed in as {session.user.email}</span>
            ) : (
              <span>Not signed in</span>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Buttons */}
      {activeWorkflowId && viewMode === 'traditional-chat' && (
        <div className="fixed bottom-6 right-6 flex flex-col space-y-2">
          <button
            onClick={() => setShowVisualization(!showVisualization)}
            className="w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
            title="Toggle Workflow Visualization"
          >
            📊
          </button>
          
          <button
            onClick={() => setShowAgentChat(!showAgentChat)}
            className="w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-colors flex items-center justify-center"
            title="Toggle Agent Chat"
          >
            🤖
          </button>
        </div>
      )}

      {/* Floating Panels */}
      {showVisualization && viewMode === 'traditional-chat' && (
        <div className="fixed bottom-20 right-6 w-96 h-96 bg-white rounded-lg shadow-xl border z-50">
          <div className="flex items-center justify-between p-3 border-b">
            <h4 className="font-medium">Workflow Progress</h4>
            <button
              onClick={() => setShowVisualization(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="h-80">
            <LiveWorkflowVisualization 
              workflowId={activeWorkflowId}
              className="h-full"
            />
          </div>
        </div>
      )}

      {showAgentChat && viewMode === 'traditional-chat' && (
        <div className="fixed bottom-20 left-6 w-96 h-96 bg-white rounded-lg shadow-xl border z-50">
          <div className="flex items-center justify-between p-3 border-b">
            <h4 className="font-medium">Agent Communication</h4>
            <button
              onClick={() => setShowAgentChat(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="h-80">
            <AgentChatInterface
              workflowId={activeWorkflowId}
              agents={agents}
              activeWorkflows={activeWorkflows}
              className="h-full"
              onWorkflowSwitch={switchToWorkflow}
            />
          </div>
        </div>
      )}

      {/* Close Workflow Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCloseConfirmation}
        onClose={cancelCloseWorkspace}
        onConfirm={confirmCloseWorkspace}
        title="Close Workspace"
        message="Are you sure you want to close this workspace? Any unsaved changes or ongoing agent conversations will be lost. This action cannot be undone."
        confirmText="Close Workspace"
        cancelText="Keep Working"
        variant="warning"
        icon={LogOut}
      />
    </div>
  );
}