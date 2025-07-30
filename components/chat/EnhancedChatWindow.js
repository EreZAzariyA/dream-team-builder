/**
 * Enhanced Chat Window with Real-time BMAD Integration
 * Combines existing chat functionality with live workflow visualization and agent communication
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import ChatWindow from './ChatWindow';
import LiveWorkflowVisualization from '../workflow/LiveWorkflowVisualization';
import AgentChatInterface from './AgentChatInterface';
import { useWebSocket } from '../../lib/websocket/WebSocketClient';

export default function EnhancedChatWindow({ className = '' }) {
  const { data: session } = useSession();
  const [activeWorkflowId, setActiveWorkflowId] = useState(null);
  const [showVisualization, setShowVisualization] = useState(false);
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [viewMode, setViewMode] = useState('chat'); // chat, split, visualization
  const [agents, setAgents] = useState([]);

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

  // WebSocket connection for system-wide updates
  const { client: wsClient, connected: wsConnected } = useWebSocket({
    url: 'ws://localhost:8080',
    token: session?.accessToken || 'test-token',
    userId: session?.user?.id || 'anonymous'
  });

  // Handle workflow start from regular chat
  const handleWorkflowStarted = (workflowId) => {
    setActiveWorkflowId(workflowId);
    setShowVisualization(true);
    setShowAgentChat(true);
    
    // Subscribe to the new workflow
    if (wsClient && wsConnected) {
      wsClient.subscribeToWorkflow(workflowId);
    }
  };

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
    } else {
      setShowVisualization(false);
      setShowAgentChat(false);
    }
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header Controls */}
      <div className="border-b bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Dream Team Chat
            </h2>
            {activeWorkflowId && (
              <div className="flex items-center space-x-2 mt-1 text-sm text-gray-500">
                <span>Active Workflow: {activeWorkflowId}</span>
                {wsConnected && (
                  <span className="flex items-center text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                    Live
                  </span>
                )}
              </div>
            )}
          </div>

          {/* View Mode Controls */}
          <div className="flex items-center space-x-2">
            {activeWorkflowId && (
              <>
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                  {[
                    { mode: 'chat', label: 'Chat', icon: '💬' },
                    { mode: 'split', label: 'Split', icon: '📊' },
                    { mode: 'visualization', label: 'Viz', icon: '🔍' }
                  ].map(({ mode, label, icon }) => (
                    <button
                      key={mode}
                      onClick={() => handleViewModeChange(mode)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center space-x-1 ${
                        viewMode === mode
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <span>{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setActiveWorkflowId(null);
                    setShowVisualization(false);
                    setShowAgentChat(false);
                    setViewMode('chat');
                  }}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border rounded"
                >
                  ✕ Close Workflow
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'chat' || !activeWorkflowId ? (
          /* Full Chat Mode */
          <div className="flex-1">
            <ChatWindow 
              onWorkflowStarted={handleWorkflowStarted}
              className="h-full"
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
                  className="h-full"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Status Bar */}
      <div className="border-t bg-gray-50 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <span>
              Agents: {agents.length} available
            </span>
            {wsConnected ? (
              <span className="flex items-center text-green-600">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></div>
                Real-time connected
              </span>
            ) : (
              <span className="flex items-center text-red-600">
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
      {activeWorkflowId && viewMode === 'chat' && (
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
      {showVisualization && viewMode === 'chat' && (
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

      {showAgentChat && viewMode === 'chat' && (
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
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}