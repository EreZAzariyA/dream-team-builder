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

/**
 * Repository Chat Interface Component
 * AI-powered chat about repository code with file citations
 */
const RepoChatInterface = ({ repository, analysisData }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  // Initialize chat session
  useEffect(() => {
    initializeChatSession();
  }, [analysisData]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeChatSession = async () => {
    if (!analysisData?.id) return;

    try {
      const response = await fetch('/api/repo/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_session',
          analysisId: analysisData.id,
          repositoryId: repository.id
        })
      });

      const result = await response.json();
      if (result.success) {
        setSessionId(result.sessionId);
        
        // Add welcome message
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: `Hello! I'm here to help you explore and work with the **${repository.name}** repository. I can answer questions about the code, make changes, and perform git operations.

**What I can do:**
- **Analyze code**: Explain functionality, structure, and technologies
- **Read files**: Show you specific file contents  
- **Make changes**: Modify code and create new files
- **Git operations**: Create branches, commits, and push changes
- **GitHub integration**: Create pull requests

**Try asking me:**
- "What does this repository do?"
- "Show me the package.json file"
- "Add a new feature to improve error handling"
- "Create a new branch for my changes"
- "Fix any bugs you find and commit the changes"`,
          timestamp: new Date(),
          citations: []
        }]);
      }
    } catch (error) {
      console.error('Failed to initialize chat session:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !sessionId) return;

    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/repo/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_message',
          sessionId,
          message: userMessage.content,
          analysisId: analysisData.id
        })
      });

      const result = await response.json();
      
      if (result.success) {
        const assistantMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          citations: result.citations || [],
          toolResults: result.toolResults || [],
          tokenUsage: result.tokenUsage
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your message. Please try again.',
        timestamp: new Date(),
        citations: [],
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
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
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <CpuChipIcon className="w-4 h-4 text-white" />
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
    <div className="flex flex-col h-96">
      
      {/* Chat Header */}
      <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <ChatBubbleLeftRightIcon className="w-5 h-5 text-gray-500" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            Chat with AI about {repository.name}
          </h3>
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
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <CpuChipIcon className="w-4 h-4 text-white" />
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
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about the code..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              rows="2"
              disabled={isLoading || !sessionId}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading || !sessionId}
            className={`px-4 py-2 rounded-lg flex items-center justify-center ${
              inputMessage.trim() && !isLoading && sessionId
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
  );
};

export default RepoChatInterface;