'use client';

import React, { useState, useMemo, useCallback, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../common/Badge';
import { MessageSquare, Loader2, Clock, CheckCircle, AlertCircle, Bot } from 'lucide-react';
import MarkdownIt from 'markdown-it';

// Import sub-components
import AgentSidebar from './AgentSidebar';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';


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
  const [activeAgentId, setActiveAgentId] = useState(null);

  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }, []);

  const getAgentIcon = useCallback((agentId) => {
    if (agentId.includes('/') || agentId === 'various') return '🔄';

    const icons = {
      'analyst': '🧠',
      'pm': '📋',
      'architect': '🏗️',
      'ux-expert': '🎨',
      'dev': '🛠️',
      'qa': '🔍',
      'sm': '📊',
      'po': '✅',
      'system': '⚙️',
      'bmad-orchestrator': '🎭'
    };
    return icons[agentId] || '🤖';
  }, []);

  const getAgentRole = useCallback((agentId) => {
    const roles = {
      'analyst': 'Business Analyst',
      'pm': 'Product Manager',
      'architect': 'System Architect',
      'ux-expert': 'UX Designer',
      'dev': 'Developer',
      'qa': 'QA Engineer',
      'sm': 'Scrum Master',
      'po': 'Product Owner',
      'system': 'System',
      'bmad-orchestrator': 'BMad Orchestrator'
    };
    return roles[agentId] || 'AI Agent';
  }, []);

  // Extract workflow agents and prioritize them, with message activity tracking
  const detectedAgents = useMemo(() => {
    // Track message activity for all agents
    const agentActivity = new Map();
    
    // Add agents from messages
    messages.forEach(msg => {
      if (msg.from && msg.from !== 'User' && msg.from !== 'System' && msg.from !== 'BMAD System') {
        const agentId = msg.from.toLowerCase().replace(/\s+/g, '-');
        agentActivity.set(agentId, new Date(msg.timestamp || Date.now()));
      }
      if (msg.agentId && msg.agentId !== 'user' && msg.agentId !== 'system') {
        agentActivity.set(msg.agentId, new Date(msg.timestamp || Date.now()));
      }
    });
    
    // Add elicitation agent activity
    if (elicitationPrompt?.agentId) {
      agentActivity.set(elicitationPrompt.agentId, new Date());
      // Auto-set active agent for elicitation
      if (activeAgentId !== elicitationPrompt.agentId) {
        setActiveAgentId(elicitationPrompt.agentId);
      }
    }
    
    // Auto-set current agent as active if no active agent selected
    if (!activeAgentId && currentAgent) {
      setActiveAgentId(currentAgent);
    }
    
    // Prioritize workflow agents (activeAgents) and show them in order
    const workflowAgents = [];
    const additionalAgents = [];
    
    if (activeAgents && activeAgents.length > 0) {
      // Process workflow agents in order
      activeAgents.forEach(agent => {
        const agentId = typeof agent === 'string' ? agent : agent.id;
        const agentName = typeof agent === 'string' ? 
          (agentId.charAt(0).toUpperCase() + agentId.slice(1).replace(/-/g, ' ')) : 
          (agent.name || agentId);
        const agentStatus = typeof agent === 'object' ? agent.status : 'pending';
        
        workflowAgents.push({
          id: agentId,
          name: agentName,
          role: getAgentRole(agentId),
          icon: getAgentIcon(agentId),
          isActive: agentId === activeAgentId,
          isRecent: agentId === currentAgent && agentId !== activeAgentId,
          isCurrent: agentId === currentAgent,
          workflowStatus: agentStatus,
          lastActivity: agentActivity.get(agentId),
          order: activeAgents.indexOf(agent) + 1
        });
      });
    }
    
    // Add any additional agents from messages that aren't in workflow
    agentActivity.forEach((activity, agentId) => {
      const isInWorkflow = workflowAgents.some(wa => wa.id === agentId);
      if (!isInWorkflow) {
        additionalAgents.push({
          id: agentId,
          name: agentId.charAt(0).toUpperCase() + agentId.slice(1).replace(/-/g, ' '),
          role: getAgentRole(agentId),
          icon: getAgentIcon(agentId),
          isActive: agentId === activeAgentId,
          isRecent: false,
          isCurrent: false,
          workflowStatus: 'additional',
          lastActivity: activity,
          order: 999 // Show at end
        });
      }
    });
    
    // Combine workflow agents first (in order), then additional agents
    return [...workflowAgents, ...additionalAgents];
  }, [messages, elicitationPrompt, activeAgents, currentAgent, activeAgentId, getAgentRole, getAgentIcon]);

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
    const combined = [...messages];
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


  // Initialize markdown-it with safe HTML rendering
  const md = useMemo(() => new MarkdownIt({
    html: false,        // Disable HTML tags for security
    xhtmlOut: false,    // Use HTML5
    breaks: true,       // Convert '\n' in paragraphs into <br>
    linkify: true,      // Auto-detect and link URLs
    typographer: true   // Enable smart quotes and other typographic replacements
  }), []);

  const renderStructuredContent = (message) => {
    console.log({ message });
    
    if (!message.content && !message.summary && !message.structured) return 'No content available';
    
    // Handle elicitation messages directly and return rendered HTML
    if (message.isElicitation) {
      const htmlContent = md.render(message.content);
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none
            prose-headings:text-gray-900 dark:prose-headings:text-gray-100
            prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed
            prose-strong:text-gray-900 dark:prose-strong:text-gray-100
            prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-700
            prose-blockquote:border-l-blue-400 prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-900/20 prose-blockquote:text-blue-800 dark:prose-blockquote:text-blue-200
            prose-ul:text-gray-700 dark:prose-ul:text-gray-300
            prose-ol:text-gray-700 dark:prose-ol:text-gray-300
            prose-li:text-gray-700 dark:prose-li:text-gray-300
            prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      );
    }

    let contentToRender = ''; // Reset for non-elicitation messages

    if (message.structured && message.structured.response) {
      const { main_response, key_points, codeModifications } = message.structured.response;
      
      if (main_response) {
        contentToRender += main_response;
      }

      if (key_points && key_points.length > 0) {
        contentToRender += '\n\n**Key Points:**\n';
        key_points.forEach(point => {
          contentToRender += `- ${point}\n`;
        });
      }

      if (codeModifications && codeModifications.length > 0) {
        contentToRender += '\n\n**Code Modifications:**\n```json\n';
        contentToRender += JSON.stringify(codeModifications, null, 2);
        contentToRender += '\n```\n';
      }
    } else {
      // Fallback to existing logic for unstructured content
      let content = message.content || message.summary || '';
      if (typeof content === 'object') {
        if (content.userPrompt) {
          const currentStep = workflowInstance?.progress?.currentStep ?? content.context?.step ?? '?';
          const totalSteps = workflowInstance?.progress?.totalSteps ?? content.context?.totalSteps ?? '?';
          content = `🎯 **User Request:** ${content.userPrompt}\n\n📋 **Instructions:** ${content.instructions}\n\n📊 **Progress:** Step ${currentStep} of ${totalSteps}`;
        } 
        else if (content.summary && content.executionTime) {
          const time = Math.round(content.executionTime / 1000);
          content = `✅ **${content.summary}**\n\n⏱️ **Execution Time:** ${time}s\n📄 **Artifacts:** ${content.artifacts || 'None'}`;
        } else {
          content = content?.content || content?.message || JSON.stringify(content, null, 2);
        }
      }
      contentToRender = String(content);
    }
    
    // Convert markdown to HTML
    const htmlContent = md.render(contentToRender);
    
    return (
      <div 
        className="prose prose-sm dark:prose-invert max-w-none
          prose-headings:text-gray-900 dark:prose-headings:text-gray-100
          prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed
          prose-strong:text-gray-900 dark:prose-strong:text-gray-100
          prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
          prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-700
          prose-blockquote:border-l-blue-400 prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-900/20 prose-blockquote:text-blue-800 dark:prose-blockquote:text-blue-200
          prose-ul:text-gray-700 dark:prose-ul:text-gray-300
          prose-ol:text-gray-700 dark:prose-ol:text-gray-300
          prose-li:text-gray-700 dark:prose-li:text-gray-300
          prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  };

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
                    Talking with {activeAgentId.charAt(0).toUpperCase() + activeAgentId.slice(1)}
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
                  renderStructuredContent={renderStructuredContent}
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
                        {respondingAgent.replace(/-/g, ' ')}
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