'use client';

import React, { useState, useMemo, useCallback, memo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../common/Card';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../common/Badge';
import { Bot, User, MessageSquare, Loader2, Clock, CheckCircle, AlertCircle, Send } from 'lucide-react';
import MarkdownIt from 'markdown-it';


const WorkflowChat = memo(({ 
  messages = [], 
  isConnected = false, 
  onSendMessage, 
  loading = false,
  title = "Live Communication",
  elicitationPrompt = null,
  allowFreeChat = true,
  workflowInstance = null
}) => {
  const [freeMessage, setFreeMessage] = useState('');

  const handleFreeChatSubmit = useCallback(() => {
    if (!freeMessage.trim() || !onSendMessage) return;
    onSendMessage(freeMessage.trim());
    setFreeMessage('');
  }, [freeMessage, onSendMessage]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFreeChatSubmit();
    }
  }, [handleFreeChatSubmit]);

  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }, []);

  const getMessageIcon = useCallback((message) => {
    const isUser = message.from === 'User';
    const isSystem = message.from === 'System' || message.from === 'BMAD System';
    
    if (isUser) return <User className="w-4 h-4" />;
    if (isSystem) return <MessageSquare className="w-4 h-4" />;
    return <Bot className="w-4 h-4" />;
  }, []);

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
    if (!message.content && !message.summary && !message.structured) return 'No content available';
    
    let contentToRender = '';

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
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            {title}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {messages.length}
            </Badge>
            <div className={`flex items-center gap-1 text-xs ${
              isConnected 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              {isConnected ? 'Live' : 'Offline'}
            </div>
          </div>
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Real-time communication with AI agents and system updates
        </p>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <div className="h-[500px] bg-gray-50 dark:bg-gray-900 overflow-hidden">
          <ScrollArea className="h-full p-4">
            {messages.length === 0 && !elicitationPrompt && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No messages yet
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Agent communication will appear here in real-time
                  </p>
                </div>
              </div>
            )}

            {messages.map((message, index) => {
              const isUser = message.from === 'User' || message.from === 'user';
              const isSystem = message.from === 'System' || message.from === 'BMAD System' || message.from === 'system';
              
              return (
                <div
                  key={message.id || index}
                  className={`mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isUser 
                        ? 'bg-blue-600 text-white' 
                        : isSystem 
                          ? 'bg-gray-600 text-white'
                          : 'bg-green-600 text-white'
                    }`}>
                      {getMessageIcon(message)}
                    </div>

                    {/* Message Content */}
                    <div
                      className={`rounded-2xl p-4 ${
                        isUser 
                          ? 'bg-blue-600 text-white rounded-br-md' 
                          : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-bl-md shadow-sm'
                      }`}
                    >
                      {/* Header */}
                      <div className={`flex items-center gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-xs font-medium ${
                          isUser ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {isUser ? 'You' : isSystem ? 'System' : (message.from?.charAt(0).toUpperCase() + message.from?.slice(1) || 'Agent')}
                        </span>
                        {message.type && (
                          <Badge variant="outline" className={`text-xs ${
                            isUser ? 'border-blue-300 text-blue-100' : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400'
                          }`}>
                            {message.type.replace(/-/g, ' ')}
                          </Badge>
                        )}
                        {message.status && getStatusIcon(message.status)}
                      </div>

                      {/* Content */}
                      <div className="text-sm leading-relaxed">
                        {renderStructuredContent(message)}
                      </div>

                      {/* Timestamp */}
                      <div className={`text-xs mt-2 ${
                        isUser 
                          ? 'text-blue-200 text-right' 
                          : 'text-gray-500 dark:text-gray-400 text-left'
                      }`}>
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Enhanced Elicitation Interface */}
            {elicitationPrompt && (
              <div className="mb-6 flex justify-center">
                <div className="w-full max-w-4xl">
                  {/* Elicitation Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                          <Bot className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">
                            {elicitationPrompt?.agentId?.charAt(0).toUpperCase() + elicitationPrompt?.agentId?.slice(1) || 'Agent'} needs your input
                          </h3>
                          <p className="text-blue-100 text-sm">
                            {elicitationPrompt?.sectionTitle || 'Additional Information Required'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-white/20 text-white border-white/30">
                          <Clock className="w-3 h-3 mr-1" />
                          Workflow Paused
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Elicitation Content */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-0 p-6">
                    <div className="mb-6">
                      <div className="prose prose-sm dark:prose-invert max-w-none
                        prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-headings:mb-3
                        prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-4
                        prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-strong:font-semibold
                        prose-ul:text-gray-700 dark:prose-ul:text-gray-300 prose-ul:mb-4
                        prose-ol:text-gray-700 dark:prose-ol:text-gray-300 prose-ol:mb-4  
                        prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-li:mb-1
                        prose-blockquote:border-l-blue-400 prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-900/20 
                        prose-blockquote:text-blue-800 dark:prose-blockquote:text-blue-200 prose-blockquote:py-3 prose-blockquote:px-4
                        prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-code:bg-gray-100 dark:prose-code:bg-gray-700 
                        prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm"
                        dangerouslySetInnerHTML={{ 
                          __html: md.render(elicitationPrompt?.instruction || 'Please provide additional information to continue.') 
                        }}
                      />
                    </div>

                    {/* Response Section */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <User className="w-5 h-5 text-blue-600" />
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          Your Response
                        </h4>
                      </div>
                      
                      <div className="text-center py-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <MessageSquare className="w-5 h-5 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                              Ready for your response
                            </span>
                          </div>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Use the chat input below to provide your detailed response to continue the workflow
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Workflow Context Footer */}
                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 border-t-0 rounded-b-xl p-3">
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <CheckCircle className="w-3 h-3" />
                      <span>Once you submit your response, the workflow will continue automatically</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loading && (
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

      {/* Enhanced Free Chat Input */}
      {allowFreeChat && (
        <CardFooter className="border-t bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10 p-4">
          <div className="space-y-3">
            {/* Chat Status Indicator */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1 ${
                  isConnected 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}></div>
                  {isConnected ? 'Connected to workflow agents' : 'Disconnected'}
                </div>
                {elicitationPrompt && (
                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <AlertCircle className="w-3 h-3" />
                    <span>Response Mode</span>
                  </div>
                )}
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                {freeMessage.length}/500 characters
              </div>
            </div>

            {/* Chat Input */}
            <div className="flex w-full gap-3">
              <div className="flex-1 relative">
                <textarea
                  className="w-full p-3 pr-12 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 
                    text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                    transition-all duration-200 resize-none min-h-[44px] max-h-[120px] text-sm leading-relaxed
                    placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder={isConnected 
                    ? elicitationPrompt 
                      ? "💬 Respond to the agent's question above or ask something else..." 
                      : "Ask questions, provide feedback, or chat with the agents..."
                    : "Connecting to workflow agents..."
                  }
                  value={freeMessage}
                  onChange={(e) => setFreeMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={!isConnected || loading}
                  maxLength={500}
                  rows={1}
                />
                {/* Character limit indicator */}
                {freeMessage.length > 400 && (
                  <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    {500 - freeMessage.length}
                  </div>
                )}
              </div>
              
              <button
                onClick={handleFreeChatSubmit}
                disabled={!freeMessage.trim() || !isConnected || loading}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                  text-white rounded-lg transition-all duration-200 disabled:from-gray-400 disabled:to-gray-500 
                  disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-md hover:shadow-lg
                  min-w-[100px] justify-center"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {elicitationPrompt ? 'Respond' : 'Send'}
                  </>
                )}
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {elicitationPrompt ? (
                /* Elicitation Response Quick Actions */
                <>
                  <button
                    onClick={() => setFreeMessage("I need more details about this requirement before I can provide a comprehensive response.")}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 
                      text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ❓ Need Clarification
                  </button>
                  <button
                    onClick={() => setFreeMessage("Based on the project goals, here are the key requirements and user perspectives I can identify:")}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 
                      text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📋 Provide Requirements
                  </button>
                  <button
                    onClick={() => setFreeMessage("Let me address each perspective you mentioned:")}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 
                      text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🎯 Address Points
                  </button>
                </>
              ) : (
                /* Regular Chat Quick Actions */
                <>
                  <button
                    onClick={() => setFreeMessage("What's the current status of the workflow?")}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 
                      text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📊 Check Status
                  </button>
                  <button
                    onClick={() => setFreeMessage("Can you explain what you're currently working on?")}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 
                      text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    💬 Ask for Details
                  </button>
                  <button
                    onClick={() => setFreeMessage("I have additional requirements to add.")}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 
                      text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ➕ Add Requirements
                  </button>
                  <button
                    onClick={() => setFreeMessage("Can you provide a summary of what we've discussed so far?")}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 
                      text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📝 Get Summary
                  </button>
                </>
              )}
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Press Enter to send • Shift+Enter for new line • Use quick actions for common requests
            </div>
          </div>
        </CardFooter>
      )}

    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  return (
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.isConnected === nextProps.isConnected &&
    prevProps.loading === nextProps.loading &&
    prevProps.title === nextProps.title &&
    prevProps.allowFreeChat === nextProps.allowFreeChat &&
    JSON.stringify(prevProps.elicitationPrompt) === JSON.stringify(nextProps.elicitationPrompt) &&
    prevProps.messages === nextProps.messages // Reference equality for messages array
  );
});

WorkflowChat.displayName = 'WorkflowChat';

export default WorkflowChat;