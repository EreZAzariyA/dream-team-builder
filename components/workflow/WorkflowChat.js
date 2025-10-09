'use client';

import React, { useMemo, useCallback, memo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../common/Badge';
import { MessageSquare, Loader2, Clock, CheckCircle, AlertCircle, Bot } from 'lucide-react';

// Import sub-components
import AgentSidebar from './AgentSidebar';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import MessageRenderer from './MessageRenderer';

// Import utilities and hooks
import { getAgentIcon, getAgentDisplayName, normalizeAgentId } from '@/lib/utils/agentUtils';
import { useWorkflowAgents } from './useWorkflowAgents';


const WorkflowChat = memo(({ 
  messages = [], 
  isConnected = false, 
  onSendMessage, 
  loading = false,
  waitingForAgent = false,
  respondingAgent = null,
  title = "Live Communication",
  elicitationPrompt = null,
  allowFreeChat = true,
  workflowInstance = null,
  activeAgents = [],
  currentAgent = null
}) => {
  // Use custom hook for agent management
  const { detectedAgents, activeAgentId } = useWorkflowAgents({
    messages,
    elicitationPrompt,
    activeAgents,
    currentAgent
  });

  // Simplified format timestamp helper
  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }, []);


  // Convert elicitation to a natural message
  const elicitationAsMessage = useMemo(() => {
    if (!elicitationPrompt) return null;
    
    return {
      id: `elicitation-${Date.now()}`,
      from: elicitationPrompt.agentId || 'Agent',
      agentId: elicitationPrompt.agentId,
      content: elicitationPrompt.instruction || 'I need your input to continue.',
      timestamp: new Date().toISOString(),
      type: 'elicitation',
      isElicitation: true
    };
  }, [elicitationPrompt]);

  // Combine messages with elicitation
  const allMessages = useMemo(() => {
    // Filter out internal system messages that shouldn't be displayed to users
    const displayableMessages = messages.filter(message => {
      // SIMPLIFIED: Show all messages except internal system completion messages
      // This fixes the issue where user messages weren't appearing
      if (message.to === 'system' && message.type === 'completion') {
        return false; // Hide internal system messages
      }
      
      return true; // Show everything else
    });
    
    const combined = [...displayableMessages];
    if (elicitationAsMessage) {
      combined.push(elicitationAsMessage);
    }
    return combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [messages, elicitationAsMessage]);

  const getStatusIcon = useCallback((status) => {
    switch (status) {
      case 'active': return <Loader2 className="w-3 h-3 animate-spin text-green-500" />;
      case 'completed': return <CheckCircle className="w-3 h-3 text-blue-500" />;
      case 'error': return <AlertCircle className="w-3 h-3 text-red-500" />;
      default: return <Clock className="w-3 h-3 text-gray-400" />;
    }
  }, []);

  return (
    <Card className="h-full flex flex-col lg:flex-row">
      {/* Agent Sidebar */}
      <AgentSidebar
        detectedAgents={detectedAgents}
        isConnected={isConnected}
        currentAgent={currentAgent}
      />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              {title}
              {activeAgentId && (
                <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                  <span className="text-lg">{getAgentIcon(activeAgentId)}</span>
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Talking with {getAgentDisplayName(activeAgentId)}
                  </span>
                </div>
              )}
            </div>
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {allMessages.length}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 p-0">
          <div className="h-[500px] bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <ScrollArea className="h-full p-4">
              {allMessages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Ready for conversation
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Agents will appear in the sidebar when they become active
                    </p>
                  </div>
                </div>
              )}

              {currentAgent === 'various' && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="font-semibold mb-2">Select the next agent:</h4>
                  {/* Placeholder for agent selection UI */}
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-blue-500 text-white rounded-md">Analyst</button>
                    <button className="px-4 py-2 bg-blue-500 text-white rounded-md">PM</button>
                    <button className="px-4 py-2 bg-blue-500 text-white rounded-md">Architect</button>
                  </div>
                </div>
              )}

              {allMessages.map((message, index) => (
                <MessageBubble
                  key={message.id || index}
                  message={message}
                  index={index}
                  getAgentIcon={getAgentIcon}
                  formatTimestamp={formatTimestamp}
                  renderStructuredContent={(msg) => <MessageRenderer message={msg} workflowInstance={workflowInstance} />}
                  getStatusIcon={getStatusIcon}
                />
              ))}

              {/* Show typing indicator when waiting for agent response */}
              {waitingForAgent && respondingAgent && (
                <div className="flex justify-start mb-6">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 max-w-[80%] border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getAgentIcon(respondingAgent)}</span>
                      <span className="text-sm font-medium capitalize">
                        {getAgentDisplayName(respondingAgent)}
                      </span>
                      <div className="flex gap-1 ml-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {elicitationPrompt ? 'Processing your response...' : 'Thinking...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Fallback loading indicator */}
              {loading && !waitingForAgent && (
                <div className="flex justify-start mb-6">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 max-w-[80%] border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4" />
                      <span className="text-sm font-medium">Agent</span>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Processing workflow...</p>
                  </div>
                </div>
              )}
          </ScrollArea>
        </div>
      </CardContent>

      {/* Chat Input */}
      <ChatInput
        isConnected={isConnected}
        loading={loading || waitingForAgent}
        elicitationPrompt={elicitationPrompt}
        onSendMessage={onSendMessage}
        allowFreeChat={allowFreeChat}
        waitingForAgent={waitingForAgent}
        respondingAgent={respondingAgent}
      />
    </div>

    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  return (
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.isConnected === nextProps.isConnected &&
    prevProps.loading === nextProps.loading &&
    prevProps.waitingForAgent === nextProps.waitingForAgent &&
    prevProps.respondingAgent === nextProps.respondingAgent &&
    prevProps.title === nextProps.title &&
    prevProps.allowFreeChat === nextProps.allowFreeChat &&
    JSON.stringify(prevProps.elicitationPrompt) === JSON.stringify(nextProps.elicitationPrompt) &&
    prevProps.messages === nextProps.messages && // Reference equality for messages array
    prevProps.activeAgents === nextProps.activeAgents && // Reference equality for activeAgents array
    prevProps.currentAgent === nextProps.currentAgent
  );
});

WorkflowChat.displayName = 'WorkflowChat';

export default WorkflowChat;