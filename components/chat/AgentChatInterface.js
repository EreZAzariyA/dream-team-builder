/**
 * Agent Chat Interface
 * Interactive chat interface for agent communication during workflows
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePusherSimple } from '../../lib/pusher/SimplePusherClient';
import ChatMessage from './ChatMessage';

export default function AgentChatInterface({ 
  workflowId, 
  agents = [], 
  className = '',
  activeWorkflows = [],
  onMessageSent = () => {},
  onAgentSelected = () => {},
  onWorkflowSwitch = () => {}
}) {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentMessages, setAgentMessages] = useState({}); // Store messages per agent
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  const [onlineAgents] = useState(new Set());
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Get messages for current agent (or all agents if none selected)
  const getCurrentMessages = () => {
    const agentKey = selectedAgent?.id || 'all';
    return agentMessages[agentKey] || [];
  };

  // Add message to specific agent's conversation
  const addMessageToAgent = (message, targetAgentId = null) => {
    const agentKey = targetAgentId || selectedAgent?.id || 'all';
    setAgentMessages(prev => ({
      ...prev,
      [agentKey]: [...(prev[agentKey] || []), message]
    }));
  };

  // Load existing messages for the workflow
  const loadExistingMessages = async () => {
    if (!workflowId) return;
    
    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/chat/messages?workflowId=${workflowId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const messages = data.messages || [];
        
        // Group messages by agent
        const messagesByAgent = {};
        messages.forEach(msg => {
          // Handle the actual database structure
          let agentKey = 'all'; // default fallback
          
          if (msg.toAgent === 'user') {
            // Agent message to user - group by sender agent
            agentKey = msg.fromAgent || 'all';
          } else if (msg.fromAgent === 'user') {
            // User message to agent - group by target agent  
            agentKey = msg.toAgent || 'all';
          } else {
            // Inter-agent message - group by the conversation participants
            agentKey = msg.fromAgent || msg.toAgent || 'all';
          }
          
          
          if (!messagesByAgent[agentKey]) {
            messagesByAgent[agentKey] = [];
          }
          
          // Transform database message to component format
          const transformedMessage = {
            id: msg._id || msg.messageId || `msg-${Date.now()}-${Math.random()}`,
            from: msg.fromAgent === 'user' ? 'user' : (msg.fromAgent || 'agent'),
            to: msg.toAgent || 'user',
            content: typeof msg.content === 'string' 
              ? msg.content 
              : msg.content?.text || JSON.stringify(msg.content),
            timestamp: msg.timestamp || msg.createdAt,
            type: msg.fromAgent === 'user' ? 'user' : 'agent',
            agentName: msg.content?.data?.agentName || (msg.fromAgent !== 'user' ? msg.fromAgent : null),
            provider: msg.content?.data?.provider || msg.provider,
            structured: msg.content?.data?.structured
          };
          
          messagesByAgent[agentKey].push(transformedMessage);
        });
        
        // Sort messages by timestamp within each agent
        Object.keys(messagesByAgent).forEach(agentKey => {
          messagesByAgent[agentKey].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
          );
        });
        
        setAgentMessages(messagesByAgent);
      }
    } catch (error) {
      // Silently handle error - messages will remain empty
    } finally {
      setLoadingMessages(false);
    }
  };

  // Pusher connection for real-time chat
  const { connected: pusherConnected, connecting: pusherConnecting, error: pusherError, subscribeToWorkflow, sendMessage, pusher } = usePusherSimple();
  

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [agentMessages, selectedAgent]);

  // Load existing messages when workflow changes
  useEffect(() => {
    if (workflowId) {
      loadExistingMessages();
    }
  }, [workflowId]);

  // Pusher event handlers
  useEffect(() => {
    if (pusher && pusherConnected && workflowId) {
      // Join workflow channel
      const channel = subscribeToWorkflow(workflowId);
      
      if (channel) {
        // Handle incoming messages
        channel.bind('agent-message', (data) => {
          const message = {
            id: `agent-${Date.now()}`,
            from: data.agentId || 'agent',
            to: 'user',
            content: data.content || 'Agent response',
            timestamp: data.timestamp || new Date().toISOString(),
            type: 'agent',
            agentName: data.agentName,
            provider: data.provider,
            structured: data.structured
          };
          // Add message to the specific agent's conversation
          addMessageToAgent(message, data.agentId);
        });

        // Also listen for user messages (for testing)
        channel.bind('user-message', () => {
          // Handle user messages if needed
        });
      }

      return () => {
        if (pusher) {
          pusher.unsubscribe(`workflow-${workflowId}`);
        }
      };
    }
  }, [pusher, pusherConnected, workflowId, subscribeToWorkflow]);

  // Handle agent selection
  const handleAgentSelect = (agent) => {
    setSelectedAgent(agent);
    onAgentSelected(agent);
  };

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !pusherConnected) return;

    const message = {
      id: `user-${Date.now()}`,
      from: 'user',
      to: selectedAgent?.id || 'all',
      content: newMessage,
      timestamp: new Date().toISOString(),
      type: 'user'
    };

    // Add to local messages immediately for the current agent
    addMessageToAgent(message);

    // Send via Pusher API
    try {
      const success = await sendMessage(newMessage, {
        type: 'workflow',
        id: workflowId,
        targetAgent: selectedAgent?.id // Send the selected agent ID
      });
      
      if (success) {
        onMessageSent(message);
      }
    } catch {
      // Handle error silently or show user notification
    }

    setNewMessage('');
    inputRef.current?.focus();
  };

  // Handle enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center justify-between p-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agent Chat</h3>
            <div className="flex items-center space-x-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span className={`flex items-center ${
                pusherConnected ? 'text-green-600 dark:text-green-400' : 
                pusherConnecting ? 'text-yellow-600 dark:text-yellow-400' : 
                'text-red-600 dark:text-red-400'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-1 ${
                  pusherConnected ? 'bg-green-500 animate-pulse' : 
                  pusherConnecting ? 'bg-yellow-500 animate-spin' : 
                  'bg-red-500'
                }`}></div>
                {pusherConnected ? 'Connected' : 
                 pusherConnecting ? 'Connecting...' : 
                 pusherError ? `Error: ${pusherError.message || 'Connection failed'}` :
                 'Disconnected'}
              </span>
            </div>
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {onlineAgents.size} agents online
          </div>
        </div>

        {/* Workflow Tabs */}
        {activeWorkflows.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-gray-500 dark:text-gray-400 mr-2">Active Workflows:</span>
              <div className="flex flex-wrap gap-1">
                {activeWorkflows.slice(0, 4).map((workflow) => {
                  const wId = workflow.id || workflow._id;
                  const isActive = wId === workflowId;
                  return (
                    <button
                      key={wId}
                      onClick={() => onWorkflowSwitch(wId)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                          : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                      }`}
                      title={workflow.name || workflow.title || wId}
                    >
                      <span className="flex items-center space-x-1">
                        <span>{workflow.name || workflow.title || 'Workflow'}</span>
                        {isActive && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                      </span>
                    </button>
                  );
                })}
                {activeWorkflows.length > 4 && (
                  <span className="px-2 py-1 text-gray-400 text-xs">
                    +{activeWorkflows.length - 4} more
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Agent List Sidebar */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex flex-col">
          <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-600">
            <h4 className="font-medium text-gray-900 dark:text-white text-sm">Agents</h4>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {/* Section Title */}
            <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              All Agents ({agents.length})
            </div>
            
            <div className="px-2 pb-2 space-y-1">
              {/* Individual Agents */}
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleAgentSelect(agent)}
                  className={`w-full text-left p-2 rounded text-sm transition-colors ${
                    selectedAgent?.id === agent.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      onlineAgents.has(agent.id) ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    <span className="mr-1">{agent.icon || '🤖'}</span>
                    <span className="truncate">{agent.name || agent.id}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 ml-4">
                    {agent.title}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50/50 dark:bg-blue-900/15">
            <div className="flex items-center">
              {selectedAgent ? (
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  <span className="mr-1">{selectedAgent.icon || '🤖'}</span>
                  {selectedAgent.name || selectedAgent.id}
                  <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded-full">
                    {getCurrentMessages().length} messages
                  </span>
                </span>
              ) : (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Select an agent to start chatting
                </span>
              )}
              {selectedAgent && onlineAgents.has(selectedAgent.id) && (
                <span className="ml-2 flex items-center text-xs text-green-600">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></div>
                  Online
                </span>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!selectedAgent ? (
              <div className="text-center text-gray-500 py-16">
                <div className="text-6xl mb-4">🤖</div>
                <div className="text-lg font-medium mb-2">Choose an Agent</div>
                <div className="text-sm">
                  Select an agent from the list to start a conversation
                </div>
              </div>
            ) : getCurrentMessages().length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-2">💬</div>
                <div>No messages yet</div>
                <div className="text-sm">
                  Start a conversation with {selectedAgent.name || selectedAgent.id}
                </div>
              </div>
            ) : (
              getCurrentMessages().map((message) => (
                <div key={message.id} className={`flex w-full ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <ChatMessage
                    message={{
                      ...message,
                      sender: message.type === 'user' ? 'User' : (message.agentName || 'Agent'),
                      timestamp: new Date(message.timestamp).toLocaleTimeString()
                    }}
                  />
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  selectedAgent 
                    ? `Message ${selectedAgent.name || selectedAgent.id}...`
                    : "Select an agent to start chatting..."
                }
                className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700"
                disabled={!selectedAgent || !pusherConnected}
              />
              <button
                onClick={handleSendMessage}
                disabled={!selectedAgent || !newMessage.trim() || !pusherConnected}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
            
            {!pusherConnected && (
              <div className="text-xs text-red-500 mt-1">
                ⚠️ {pusherConnecting ? 'Connecting to chat server...' : 
                     pusherError ? `Connection error: ${pusherError.message || 'Unknown error'}` :
                     'Not connected to chat server'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}