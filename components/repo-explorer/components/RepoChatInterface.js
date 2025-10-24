'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  DocumentIcon,
  CodeBracketIcon,
  UserIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { useAgents } from '@/lib/hooks/useAgents';

/**
 * Build dynamic welcome message based on agent capabilities
 */
const buildWelcomeMessage = (agent, repository) => {
  // Try multiple paths to get agent data
  const agentName = agent.name || agent.agent?.name || agent.id;
  const agentTitle = agent.title || agent.agent?.title || 'AI Agent';
  const agentIcon = agent.icon || agent.agent?.icon || '🤖';
  const whenToUse = agent.whenToUse || agent.agent?.whenToUse;
  const commands = agent.commands || [];
  const persona = agent.persona || {};

  let message = `Hello! I'm **${agentName}** ${agentIcon}, your ${agentTitle}.\n\n`;
  message += `I'm here to help you explore and work with the **${repository.name}** repository.\n\n`;

  // Add "When to use" section if available
  if (whenToUse) {
    message += `**Use me for:** ${whenToUse}\n\n`;
  }

  // Add role/focus if available
  if (persona.role) {
    message += `**My expertise:** ${persona.role}\n\n`;
  }

  // Repository exploration capabilities (always available)
  message += `**What I can help with:**\n`;
  message += `- 📊 **Analyze code**: Explain functionality, structure, and technologies\n`;
  message += `- 📄 **Read files**: Show you specific file contents from the repository\n`;
  message += `- ✏️ **Make changes**: Modify code and create new files\n`;
  message += `- 🌿 **Git operations**: Create branches, commits, and push changes\n`;
  message += `- 🔀 **GitHub integration**: Create pull requests and manage issues\n\n`;

  // Add BMAD commands if available (commands is an array of objects)
  if (Array.isArray(commands) && commands.length > 0) {
    const commandNames = commands
      .map(cmd => Object.keys(cmd)[0])
      .filter(name => name && name !== 'help' && name !== 'exit'); // Exclude help and exit

    if (commandNames.length > 0) {
      const displayCommands = commandNames.slice(0, 5); // Show first 5 commands
      message += `**BMAD Commands** (type * prefix):\n`;
      displayCommands.forEach(cmd => {
        message += `- \`*${cmd}\`\n`;
      });
      if (commandNames.length > 5) {
        message += `- _...and ${commandNames.length - 5} more (type \`*help\` to see all)_\n`;
      }
      message += `\n`;
    }
  }

  // Suggested questions
  message += `**Try asking me:**\n`;
  message += `- "What does this repository do?"\n`;
  message += `- "Show me the package.json file"\n`;
  message += `- "Explain the main architecture"\n`;

  // Add agent-specific suggestions
  if (agent.id === 'architect') {
    message += `- "Create a full-stack architecture document"`;
  } else if (agent.id === 'analyst') {
    message += `- "Analyze the codebase and provide insights"`;
  } else if (agent.id === 'qa') {
    message += `- "Review the code quality and suggest improvements"`;
  } else if (agent.id === 'dev') {
    message += `- "Help me implement a new feature"`;
  } else {
    message += `- "Help me understand the codebase"`;
  }

  return message;
};

/**
 * Repository Chat Interface Component
 * AI-powered chat about repository code with file citations and BMAD agent personas
 */
const RepoChatInterface = ({ repository, analysisData }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const messagesEndRef = useRef(null);

  // Load agents using custom hook
  const { data: agents, isLoading: isLoadingAgents } = useAgents();

  // Set default agent when agents load
  useEffect(() => {
    if (agents && agents.length > 0 && !selectedAgent) {
      // Default to 'architect' agent for repository exploration and system design
      const defaultAgent = agents.find(a => a.id === 'architect') || agents[0];
      setSelectedAgent(defaultAgent);
    }
  }, [agents, selectedAgent]);

  // Initialize chat session
  useEffect(() => {
    initializeChatSession();
  }, [analysisData, selectedAgent]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeChatSession = async () => {
    if (!analysisData?.id || !selectedAgent) return;

    // Show loading state
    setIsLoading(true);
    setMessages([]);

    try {
      // Create session
      const sessionResponse = await fetch('/api/repo/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_session',
          analysisId: analysisData.id,
          repositoryId: repository.id,
          agentId: selectedAgent.id
        })
      });

      const sessionResult = await sessionResponse.json();
      if (sessionResult.success) {
        setSessionId(sessionResult.sessionId);

        // Generate AI welcome message
        const welcomeResponse = await fetch('/api/repo/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'generate_welcome',
            analysisId: analysisData.id,
            repositoryId: repository.id,
            agentId: selectedAgent.id
          })
        });

        const welcomeResult = await welcomeResponse.json();
        if (welcomeResult.success) {
          // Add AI-generated welcome message
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            agentId: selectedAgent.id,
            agentName: welcomeResult.agentName,
            agentIcon: welcomeResult.agentIcon,
            content: welcomeResult.welcomeMessage,
            timestamp: new Date(),
            citations: []
          }]);
        } else {
          // Fallback to static message if AI generation fails
          const welcomeContent = buildWelcomeMessage(selectedAgent, repository);
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            agentId: selectedAgent.id,
            agentName: selectedAgent.agent?.name || selectedAgent.id,
            agentIcon: selectedAgent.agent?.icon || '🤖',
            content: welcomeContent,
            timestamp: new Date(),
            citations: []
          }]);
        }
      }
    } catch (error) {
      console.error('Failed to initialize chat session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !sessionId || !selectedAgent) return;

    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Create placeholder for assistant message that will be streamed
    const assistantMessageId = `assistant_${Date.now()}`;
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      agentId: selectedAgent.id,
      agentName: selectedAgent.agent?.name || selectedAgent.id,
      agentIcon: selectedAgent.agent?.icon || '🤖',
      content: '',
      timestamp: new Date(),
      citations: [],
      toolResults: [],
      isStreaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch('/api/repo/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message: userMessage.content,
          analysisId: analysisData.id,
          agentId: selectedAgent.id
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataContent = line.slice(6).trim();

            // Skip [DONE] marker sent by AI SDK
            if (dataContent === '[DONE]') {
              continue;
            }

            try {
              const data = JSON.parse(dataContent);

              // Handle LangChain events
              if (data.type === 'text' && data.content) {
                // LangChain final text output
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: data.content, isStreaming: false }
                    : msg
                ));
              } else if (data.type === 'tool_call') {
                // LangChain tool execution
                const toolMessage = `\n🔧 ${data.toolName}`;
                const toolResult = data.toolResult ? ` ✅` : '...';
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: msg.content + toolMessage + toolResult,
                        toolResults: [...(msg.toolResults || []), {
                          toolName: data.toolName,
                          input: data.toolInput,
                          output: data.toolResult
                        }]
                      }
                    : msg
                ));
              }
              // Handle Vercel AI SDK events (legacy support)
              else if (data.type === 'text-delta' && data.delta) {
                // Append streaming text (AI SDK sends 'delta', not 'textDelta')
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + data.delta }
                    : msg
                ));
              } else if (data.type === 'tool-input-start' && data.toolName) {
                // Tool execution starting
                const toolMessage = `🔧 ${data.toolName}...`;
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + `\n${toolMessage}` }
                    : msg
                ));
              } else if (data.type === 'tool-output-available') {
                // Tool completed - show completion
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: msg.content + ' ✅',
                        toolResults: [...(msg.toolResults || []), { callId: data.toolCallId, output: data.output }]
                      }
                    : msg
                ));
              } else if (data.type === 'finish') {
                // Stream complete
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, isStreaming: false }
                    : msg
                ));
              } else if (data.type === 'error') {
                throw new Error(data.errorText || data.error || 'Streaming error');
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('Chat error:', error);

      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: 'I apologize, but I encountered an error while processing your message. Please try again.',
              isError: true,
              isStreaming: false
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const renderMessage = (message) => {
    const isUser = message.role === 'user';

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        {!isUser && (
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">
              {message.agentIcon || '🤖'}
            </div>
          </div>
        )}

        <div className={`max-w-3xl ${isUser ? 'order-first' : ''}`}>
          <div className={`px-4 py-2 rounded-lg ${
            isUser
              ? 'bg-blue-600 text-white'
              : message.isError
              ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
          }`}>
            <div className="prose prose-sm max-w-none">
              <div
                dangerouslySetInnerHTML={{
                  __html: message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n/g, '<br>')
                }}
              />
            </div>
          </div>

          {/* Tool Results */}
          {message.toolResults && message.toolResults.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.toolResults.map((toolResult, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={`border rounded-lg p-3 ${
                    toolResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <WrenchScrewdriverIcon className={`w-4 h-4 ${
                      toolResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      toolResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                    }`}>
                      {toolResult.tool}
                    </span>
                    {toolResult.success ? (
                      <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircleIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>

                  {toolResult.result && (
                    <div className={`text-sm ${
                      toolResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                    }`}>
                      {typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result, null, 2)}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Citations */}
          {message.citations && message.citations.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.citations.map((citation, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <DocumentIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        {citation.filePath}
                      </span>
                      {citation.lineStart && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          Lines {citation.lineStart}-{citation.lineEnd || citation.lineStart}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => copyToClipboard(citation.code)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                      title="Copy code"
                    >
                      <ClipboardDocumentIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {citation.code && (
                    <pre className="bg-gray-800 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                      <code>{citation.code}</code>
                    </pre>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{message.timestamp.toLocaleTimeString()}</span>
            {message.tokenUsage && (
              <span>{message.tokenUsage.total} tokens</span>
            )}
          </div>
        </div>

        {isUser && (
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  if (!analysisData) {
    return (
      <div className="text-center py-8">
        <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Repository analysis required for chat functionality
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Agent Sidebar */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Select Agent</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Choose an AI agent to chat with</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingAgents ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : agents && agents.length > 0 ? (
            <div className="space-y-1">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedAgent?.id === agent.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 border border-blue-300 dark:border-blue-700'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{agent.agent?.icon || '🤖'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.agent?.name || agent.id}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{agent.agent?.title || 'AI Agent'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
              No agents available
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{selectedAgent?.agent?.icon || '🤖'}</span>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {selectedAgent?.agent?.name || 'AI Agent'} - {repository.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedAgent?.agent?.title || 'Chat Assistant'}
                </p>
              </div>
            </div>
            <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
              {messages.length} messages
            </span>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence>
            {messages.map(renderMessage)}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-3"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">
                {selectedAgent?.agent?.icon || '🤖'}
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
          <div className="flex space-x-3">
            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Ask ${selectedAgent?.agent?.name || 'the agent'} anything about the code...`}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                rows="2"
                disabled={isLoading || !sessionId || !selectedAgent}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading || !sessionId || !selectedAgent}
              className={`px-4 py-2 rounded-lg flex items-center justify-center ${
                inputMessage.trim() && !isLoading && sessionId && selectedAgent
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              } transition-colors`}
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepoChatInterface;