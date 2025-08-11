'use client';

import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Zap, 
  RefreshCw, 
  ArrowRight, 
  CheckCircle, 
  AlertTriangle,
  User,
  Bot,
  Terminal,
  FileText,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { Badge } from '../common/Badge';
import BmadAgentSelector from './BmadAgentSelector';
import BmadAgentCommandInterface from './BmadAgentCommandInterface';

const BmadAgentInterface = ({ 
  className = "",
  onWorkflowStart = null,
  onDocumentCreated = null,
  workflowId = null
}) => {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [elicitationPrompt, setElicitationPrompt] = useState(null);

  const generateConversationId = () => {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleCommandExecute = async (executionContext) => {
    setIsExecuting(true);
    const startTime = Date.now();

    // If this is a new conversation, generate an ID
    if (!conversationId) {
      setConversationId(generateConversationId());
    }

    try {
      console.log('🚀 Executing BMAD command:', executionContext);
      
      const response = await fetch('/api/bmad/commands/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent: executionContext.agent.id,
          command: executionContext.command.id,
          context: {
            userPrompt: executionContext.parameters.context || `@${executionContext.agent.id} *${executionContext.command.id}`,
            template: executionContext.parameters.template,
            file: executionContext.parameters.file,
            ...executionContext.parameters
          },
          workflowId: workflowId,
          conversationId: conversationId || generateConversationId()
        })
      });

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      if (result.success) {
        // Handle successful command execution
        const executionRecord = {
          id: `exec_${Date.now()}`,
          agent: executionContext.agent,
          command: executionContext.command,
          result: result.result,
          success: true,
          executedAt: new Date().toISOString(),
          executionTime,
          conversationId: result.conversationId || conversationId
        };

        setExecutionHistory(prev => [executionRecord, ...prev.slice(0, 9)]);

        // Handle different result types
        if (result.result?.type === 'elicitation_request') {
          // Agent is requesting user input
          setElicitationPrompt({
            agent: executionContext.agent,
            command: executionContext.command,
            message: result.result.message,
            options: result.result.options,
            conversationId: result.conversationId || conversationId
          });
          setCurrentConversation({
            agent: executionContext.agent,
            command: executionContext.command,
            messages: [
              {
                role: 'assistant',
                content: result.result.message,
                options: result.result.options,
                timestamp: new Date().toISOString()
              }
            ]
          });
        } else if (result.result?.type === 'document_created') {
          // Document was created successfully
          setCurrentConversation({
            agent: executionContext.agent,
            command: executionContext.command,
            completed: true,
            result: result.result
          });
          
          if (onDocumentCreated) {
            onDocumentCreated(result.result);
          }
        } else {
          // Standard agent response
          setCurrentConversation({
            agent: executionContext.agent,
            command: executionContext.command,
            messages: [
              {
                role: 'assistant',
                content: result.result.message || 'Command executed successfully',
                timestamp: new Date().toISOString()
              }
            ]
          });
        }

        // If this started a workflow, notify parent
        if (onWorkflowStart && result.workflowId) {
          onWorkflowStart({
            workflowId: result.workflowId,
            agent: executionContext.agent,
            command: executionContext.command
          });
        }

      } else {
        // Handle execution error
        const errorRecord = {
          id: `exec_${Date.now()}`,
          agent: executionContext.agent,
          command: executionContext.command,
          error: result.error || 'Command execution failed',
          success: false,
          executedAt: new Date().toISOString(),
          executionTime
        };

        setExecutionHistory(prev => [errorRecord, ...prev.slice(0, 9)]);
        setElicitationPrompt(null);
      }

    } catch (error) {
      console.error('Error executing BMAD command:', error);
      
      const errorRecord = {
        id: `exec_${Date.now()}`,
        agent: executionContext.agent,
        command: executionContext.command,
        error: error.message || 'Network error',
        success: false,
        executedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime
      };

      setExecutionHistory(prev => [errorRecord, ...prev.slice(0, 9)]);
      setElicitationPrompt(null);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleElicitationResponse = async (response) => {
    if (!elicitationPrompt || !response.trim()) return;

    setIsExecuting(true);

    try {
      // Continue the conversation with agent
      const continueResponse = await fetch('/api/bmad/commands/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent: elicitationPrompt.agent.id,
          command: 'continue-conversation',
          context: {
            userResponse: response.trim(),
            conversationId: elicitationPrompt.conversationId
          },
          workflowId: workflowId,
          conversationId: elicitationPrompt.conversationId
        })
      });

      const result = await continueResponse.json();

      if (result.success) {
        // Add user message to conversation
        setCurrentConversation(prev => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: 'user',
              content: response.trim(),
              timestamp: new Date().toISOString()
            }
          ]
        }));

        // Handle agent's response
        if (result.result?.type === 'elicitation_request') {
          // Agent has another question
          setElicitationPrompt({
            ...elicitationPrompt,
            message: result.result.message,
            options: result.result.options
          });
          
          setCurrentConversation(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: 'assistant',
                content: result.result.message,
                options: result.result.options,
                timestamp: new Date().toISOString()
              }
            ]
          }));
        } else {
          // Conversation completed
          setElicitationPrompt(null);
          setCurrentConversation(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: 'assistant',
                content: result.result.message || 'Conversation completed',
                timestamp: new Date().toISOString()
              }
            ],
            completed: true,
            result: result.result
          }));

          if (result.result?.type === 'document_created' && onDocumentCreated) {
            onDocumentCreated(result.result);
          }
        }
      }

    } catch (error) {
      console.error('Error continuing conversation:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleNewConversation = () => {
    setCurrentConversation(null);
    setElicitationPrompt(null);
    setConversationId(null);
  };

  const renderConversation = () => {
    if (!currentConversation) return null;

    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-3">
            <MessageSquare className="w-5 h-5" />
            <div className="flex items-center gap-2">
              <span>Conversation with {currentConversation.agent.name}</span>
              <Badge className="text-xs">
                {currentConversation.command.name}
              </Badge>
              {currentConversation.completed && (
                <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Completed
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {currentConversation.messages?.map((message, index) => (
              <div key={index} className={`flex items-start gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : ''
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user' 
                    ? 'bg-primary-100 dark:bg-primary-900/30' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  ) : (
                    <span className="text-sm">{currentConversation.agent.icon}</span>
                  )}
                </div>
                <div className={`flex-1 ${
                  message.role === 'user' ? 'text-right' : ''
                }`}>
                  <div className={`inline-block p-3 rounded-lg text-sm ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-none'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none'
                  }`}>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.options && message.options.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <div className="text-xs opacity-75 mb-1">Options:</div>
                        {message.options.map((option, optIndex) => (
                          <div key={optIndex} className="text-xs opacity-90">
                            {optIndex + 1}. {option}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {isExecuting && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {currentConversation.agent.name} is thinking...
                </div>
              </div>
            )}
          </div>

          {/* Elicitation Input */}
          {elicitationPrompt && !currentConversation.completed && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <div className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                {elicitationPrompt.agent.name} is waiting for your response:
              </div>
              <ElicitationInput
                prompt={elicitationPrompt}
                onResponse={handleElicitationResponse}
                disabled={isExecuting}
              />
            </div>
          )}

          {/* New Conversation Button */}
          {currentConversation.completed && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleNewConversation}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Start New Conversation
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderExecutionHistory = () => {
    if (executionHistory.length === 0) return null;

    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Recent Commands
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {executionHistory.slice(0, 5).map((record) => (
              <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-600 flex items-center justify-center">
                    {record.agent.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {record.agent.name} • {record.command.name}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(record.executedAt).toLocaleString()} • {record.executionTime}ms
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {record.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={className}>
      {/* Agent Selector */}
      <BmadAgentSelector
        selectedAgent={selectedAgent}
        onAgentSelect={setSelectedAgent}
        className="mb-6"
      />

      {/* Command Interface */}
      {selectedAgent && (
        <BmadAgentCommandInterface
          agent={selectedAgent}
          onCommandExecute={handleCommandExecute}
          isExecuting={isExecuting}
          className="mb-6"
        />
      )}

      {/* Active Conversation */}
      {renderConversation()}

      {/* Execution History */}
      {renderExecutionHistory()}
    </div>
  );
};

// Component for handling elicitation input
const ElicitationInput = ({ prompt, onResponse, disabled }) => {
  const [response, setResponse] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (response.trim() && !disabled) {
      onResponse(response);
      setResponse('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {prompt.options && prompt.options.length > 0 ? (
        // Numbered options - user can type number or full response
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            Type the number of your choice or your detailed response:
          </div>
          <input
            type="text"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Enter 1, 2, 3... or type your response"
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
      ) : (
        // Free text input
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Type your response..."
          disabled={disabled}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      )}
      <button
        type="submit"
        disabled={disabled || !response.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
      >
        {disabled ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ArrowRight className="w-4 h-4" />
        )}
        Send Response
      </button>
    </form>
  );
};

export default BmadAgentInterface;