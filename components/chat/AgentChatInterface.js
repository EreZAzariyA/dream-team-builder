/**
 * Agent Chat Interface
 * Interactive chat interface for agent communication during workflows
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePusherSimple } from '../../lib/pusher/SimplePusherClient';

export default function AgentChatInterface({ 
  workflowId, 
  agents = [], 
  className = '',
  onMessageSent = () => {},
  onAgentSelected = () => {} 
}) {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentMessages, setAgentMessages] = useState({}); // Store messages per agent
  const [newMessage, setNewMessage] = useState('');
  
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
    console.log('Adding message to agent:', agentKey, message);
    setAgentMessages(prev => {
      const updated = {
        ...prev,
        [agentKey]: [...(prev[agentKey] || []), message]
      };
      console.log('Updated agentMessages:', updated);
      return updated;
    });
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
            provider: data.provider
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
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agent Chat</h3>
            <div className="flex items-center space-x-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span>Workflow: {workflowId}</span>
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
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Agent List Sidebar */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex flex-col">
          <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-600">
            <h4 className="font-medium text-gray-900 dark:text-white text-sm">Agents</h4>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* All Agents Option */}
            <button
              onClick={() => setSelectedAgent(null)}
              className={`w-full text-left p-2 rounded text-sm transition-colors ${
                !selectedAgent
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <div className="flex items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                All Agents
              </div>
            </button>

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

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50/50 dark:bg-blue-900/15">
            <div className="flex items-center">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {selectedAgent ? (
                  <>
                    <span className="mr-1">{selectedAgent.icon || '🤖'}</span>
                    {selectedAgent.name || selectedAgent.id}
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded-full">
                      {getCurrentMessages().length} messages
                    </span>
                  </>
                ) : (
                  <>
                    💬 All Agents
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded-full">
                      {getCurrentMessages().length} messages
                    </span>
                  </>
                )}
              </span>
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
            {getCurrentMessages().length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-2">💬</div>
                <div>No messages yet</div>
                <div className="text-sm">
                  {selectedAgent 
                    ? `Start a conversation with ${selectedAgent.name || selectedAgent.id}` 
                    : "Start a conversation with the agents"
                  }
                </div>
              </div>
            ) : (
              getCurrentMessages().map((message) => (
                <AgentChatMessage
                  key={message.id}
                  message={message}
                  agents={agents}
                />
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
                    : "Message all agents..."
                }
                className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!pusherConnected}
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || !pusherConnected}
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

// Individual Chat Message Component
function AgentChatMessage({ message, agents }) {
  const getMessageStyle = () => {
    switch (message.type) {
      case 'user':
        return 'bg-blue-100 text-blue-900 ml-12';
      case 'agent':
        return 'bg-gray-100 text-gray-900 mr-12';
      case 'system':
        return 'bg-yellow-50 text-yellow-800 mx-8';
      case 'status':
        return 'bg-green-50 text-green-800 mx-8 text-center';
      case 'inter-agent':
        return 'bg-purple-50 text-purple-800 mx-8';
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  const getAgentInfo = (agentId, message = null) => {
    // First try to get agent info from message if provided
    if (message && message.agentName) {
      return { 
        id: agentId, 
        name: message.agentName, 
        icon: '🤖' // Could enhance this later
      };
    }
    
    // Fall back to agents array lookup
    const agent = agents.find(a => a.id === agentId);
    return agent || { id: agentId, name: agentId, icon: '🤖' };
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`p-3 rounded-lg ${getMessageStyle()}`}>
      {/* Message Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          {message.from !== 'system' && (
            <>
              <span className="text-sm">
                {message.from === 'user' ? '👤' : getAgentInfo(message.from, message).icon}
              </span>
              <span className="text-sm font-medium">
                {message.from === 'user' ? 'You' : getAgentInfo(message.from, message).name}
              </span>
            </>
          )}
          
          {message.to && message.to !== 'all' && message.to !== 'user' && (
            <>
              <span className="text-xs text-gray-500">→</span>
              <span className="text-sm">
                {getAgentInfo(message.to, message).icon}
              </span>
              <span className="text-sm text-gray-600">
                {getAgentInfo(message.to, message).name}
              </span>
            </>
          )}
        </div>
        
        <span className="text-xs text-gray-500">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {/* Message Content */}
      <div className="text-sm">
        {message.content}
      </div>
    </div>
  );
}