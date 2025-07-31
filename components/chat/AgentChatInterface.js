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
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [onlineAgents, setOnlineAgents] = useState(new Set());
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Pusher connection for real-time chat
  const { connected: pusherConnected, connecting: pusherConnecting, error: pusherError, subscribeToWorkflow, sendMessage, pusher } = usePusherSimple();
  

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
            timestamp: new Date().toISOString(),
            type: 'agent'
          };
          setMessages(prev => [...prev, message]);
        });

        // Also listen for user messages (for testing)
        channel.bind('user-message', (data) => {
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

    // Add to local messages immediately
    setMessages(prev => [...prev, message]);

    // Send via Pusher API
    try {
      const success = await sendMessage(newMessage, {
        type: 'workflow',
        id: workflowId
      });
      
      if (success) {
        onMessageSent(message);
      }
    } catch (error) {
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
    <div className={`bg-white rounded-lg shadow-sm border flex flex-col ${className}`}>
      {/* Header */}
      <div className="border-b p-4 bg-blue-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Agent Chat</h3>
            <div className="flex items-center space-x-2 mt-1 text-sm text-gray-500">
              <span>Workflow: {workflowId}</span>
              <span className={`flex items-center ${
                pusherConnected ? 'text-green-600' : 
                pusherConnecting ? 'text-yellow-600' : 
                'text-red-600'
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
          
          <div className="text-sm text-gray-500">
            {onlineAgents.size} agents online
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Agent List Sidebar */}
        <div className="w-64 border-r bg-gray-50 flex flex-col">
          <div className="p-3 border-b bg-white">
            <h4 className="font-medium text-gray-900 text-sm">Agents</h4>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* All Agents Option */}
            <button
              onClick={() => setSelectedAgent(null)}
              className={`w-full text-left p-2 rounded text-sm transition-colors ${
                !selectedAgent
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
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
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
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
          <div className="p-3 border-b bg-gray-50">
            <div className="flex items-center">
              <span className="text-sm font-medium">
                {selectedAgent ? (
                  <>
                    <span className="mr-1">{selectedAgent.icon || '🤖'}</span>
                    {selectedAgent.name || selectedAgent.id}
                  </>
                ) : (
                  '💬 All Agents'
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
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-2">💬</div>
                <div>No messages yet</div>
                <div className="text-sm">Start a conversation with the agents</div>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage
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
function ChatMessage({ message, agents }) {
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

  const getAgentInfo = (agentId) => {
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
                {message.from === 'user' ? '👤' : getAgentInfo(message.from).icon}
              </span>
              <span className="text-sm font-medium">
                {message.from === 'user' ? 'You' : getAgentInfo(message.from).name}
              </span>
            </>
          )}
          
          {message.to && message.to !== 'all' && message.to !== 'user' && (
            <>
              <span className="text-xs text-gray-500">→</span>
              <span className="text-sm">
                {getAgentInfo(message.to).icon}
              </span>
              <span className="text-sm text-gray-600">
                {getAgentInfo(message.to).name}
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