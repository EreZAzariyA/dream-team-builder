'use client';

import React, { useState, useCallback, memo, useEffect } from 'react';
import { CardFooter } from '../common/Card';
import { Send, Loader2, AlertCircle, Terminal, Hash } from 'lucide-react';

const ChatInput = memo(({ 
  isConnected = false,
  loading = false,
  elicitationPrompt = null,
  onSendMessage,
  allowFreeChat = true,
  waitingForAgent = false,
  respondingAgent = null,
  currentAgent = null,
  activeAgents = []
}) => {
  const [freeMessage, setFreeMessage] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  // Removed selectedCommandParameters - no longer needed with direct API execution

  // BMAD Agent Commands state
  const [bmadCommands, setBmadCommands] = useState({});
  const [isLoadingCommands, setIsLoadingCommands] = useState(true);
  const [errorLoadingCommands, setErrorLoadingCommands] = useState(null);

  useEffect(() => {
    const fetchCommands = async () => {
      try {
        const response = await fetch('/api/bmad/commands/metadata');
        if (!response.ok) {
          throw new Error('Failed to fetch BMAD commands');
        }
        const data = await response.json();
        setBmadCommands(data.commands);
      } catch (error) {
        console.error('Error fetching BMAD commands:', error);
        setErrorLoadingCommands(error);
      } finally {
        setIsLoadingCommands(false);
      }
    };
    fetchCommands();
  }, []);

  // BMAD Agent Commands
  const BMAD_COMMANDS = bmadCommands;

  const handleFreeChatSubmit = useCallback(async () => {
    if (!freeMessage.trim() || !onSendMessage) return;
    
    const message = freeMessage.trim();
    const bmadCommand = parseBmadCommand(message);
    
    // Clear input immediately for better UX
    setFreeMessage('');
    setShowCommandPalette(false);
    
    if (bmadCommand.isBmadCommand) {
      // Handle BMAD command execution
      await handleBmadCommandExecution(bmadCommand, message);
    } else {
      // Handle regular chat message
      onSendMessage(message);
    }
  }, [freeMessage, onSendMessage]);

  // Parse BMAD command syntax - UPDATED for real API
  const parseBmadCommand = useCallback((text) => {
    // BMAD command format: @agent *command
    const bmadPattern = /^@(\w+)\s*\*(\w+(?:-\w+)*)\s*(.*)?$/;
    const match = text.match(bmadPattern);
    
    if (match) {
      const [, agent, command, context] = match;
      return {
        isBmadCommand: true,
        agent: agent,
        command: command,
        context: context?.trim() || '',
        raw: text
      };
    }
    
    return { isBmadCommand: false };
  }, []);

  // Legacy detect function for UI hints
  const detectBmadCommand = useCallback((text) => {
    const parsed = parseBmadCommand(text);
    if (parsed.isBmadCommand) {
      return {
        isBmadCommand: true,
        type: 'agent_command',
        syntax: text
      };
    }
    if (text.startsWith('@')) {
      return {
        isBmadCommand: true,
        type: 'partial_agent',
        syntax: text
      };
    }
    return { isBmadCommand: false };
  }, [parseBmadCommand]);

  // Execute BMAD command through API
  const handleBmadCommandExecution = useCallback(async (bmadCommand, originalMessage) => {
    console.log('🎯 Executing BMAD command:', bmadCommand);
    
    try {
      // Send original message to show in chat
      onSendMessage(originalMessage);
      
      // Execute BMAD command via API
      const response = await fetch('/api/bmad/commands/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent: bmadCommand.agent,
          command: bmadCommand.command,
          context: {
            userPrompt: originalMessage,
            additionalContext: bmadCommand.context
          },
          workflowId: `chat-${Date.now()}`, // Generate workflow ID for tracking
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('BMAD command failed:', errorData);
        
        // Send error message to chat
        onSendMessage(`❌ BMAD Error: ${errorData.error}${errorData.debug ? `\n\nDebug: ${JSON.stringify(errorData.debug, null, 2)}` : ''}`);
        return;
      }

      const result = await response.json();
      console.log('✅ BMAD command result:', result);
      
      // Handle different response types
      await handleBmadResponse(result);
      
    } catch (error) {
      console.error('Error executing BMAD command:', error);
      onSendMessage(`❌ Failed to execute BMAD command: ${error.message}`);
    }
  }, [onSendMessage]);

  // Handle BMAD API responses
  const handleBmadResponse = useCallback(async (response) => {
    const { result, agent, command } = response;
    
    switch (result.type) {
      case 'agent_response':
        // Standard agent response
        onSendMessage(`🤖 **${result.agentName || agent}**: ${result.message}`);
        break;
        
      case 'elicitation_request':
        // DYNAMIC: Show 1-9 options OR free text based on elicitation type
        let elicitationMessage = `🤖 **${result.agentName || agent}**: ${result.message}`;
        
        // Check if this requires numbered selection (1-9 options)
        if (result.requiresNumberedSelection && result.options && result.options.length > 0) {
          // MODE: 1-9 Numbered Selection
          elicitationMessage += '\n\n**Options:**';
          result.options.forEach((option) => {
            elicitationMessage += `\n${option.number}. ${option.text}`;
          });
          elicitationMessage += '\n\n*Select 1-9 or type your question/feedback:*';
        } else {
          // MODE: Free Text Input
          elicitationMessage += '\n\n*Please provide your answer in natural text:*';
        }
        
        onSendMessage(elicitationMessage);
        break;
        
      case 'document_created':
        // Document generation completed
        onSendMessage(`📄 **${result.agentName || agent}**: ${result.message}\n\n**Document:** ${result.documentPath}\n**Type:** ${result.documentType}`);
        break;
        
      case 'execution_error':
        // Agent execution failed
        onSendMessage(`❌ **${result.agentName || agent}**: ${result.message}\n\n**Error:** ${result.details}\n\n**Suggestions:**\n${result.suggestions?.map(s => `• ${s}`).join('\n') || 'Try again or use *help command'}`);
        break;
        
      case 'error':
        // System error
        onSendMessage(`🚨 **System Error**: ${result.message}\n\n**Details:** ${result.details}\n\n**Suggested Actions:**\n${result.suggestedActions?.map(s => `• ${s}`).join('\n') || ''}`);
        break;
        
      default:
        // Fallback for unknown response types
        onSendMessage(`🤖 **${result.agentName || agent}**: ${result.message || 'Command executed successfully'}`);
        
        if (result.rawResult) {
          console.log('Raw BMAD result:', result.rawResult);
        }
        break;
    }
  }, [onSendMessage]);

  // Handle command palette selection
  const handleCommandSelect = useCallback((agentId, commandName) => {
    const selectedAgent = BMAD_COMMANDS[agentId];
    if (selectedAgent) {
      // Set BMAD command format: @agent *command
      const agentIdClean = agentId.replace('@', ''); // Remove @ if present
      setFreeMessage(`@${agentIdClean} *${commandName}`);
    }
    setShowCommandPalette(false);
  }, [BMAD_COMMANDS]);

  // Filter commands based on search - Updated for new API structure
  const getFilteredCommands = useCallback(() => {
    if (!commandFilter) return BMAD_COMMANDS;
    
    const filtered = {};
    Object.entries(BMAD_COMMANDS).forEach(([key, agent]) => {
      if (agent.name.toLowerCase().includes(commandFilter.toLowerCase()) ||
          key.toLowerCase().includes(commandFilter.toLowerCase()) ||
          agent.commands.some(cmd => 
            (typeof cmd === 'string' && cmd.toLowerCase().includes(commandFilter.toLowerCase())) ||
            (typeof cmd === 'object' && cmd.name && cmd.name.toLowerCase().includes(commandFilter.toLowerCase()))
          )) {
        filtered[key] = agent;
      }
    });
    return filtered;
  }, [commandFilter, BMAD_COMMANDS]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showCommandPalette) {
        setShowCommandPalette(false);
      } else {
        handleFreeChatSubmit();
      }
    }
    if (e.key === 'Escape') {
      setShowCommandPalette(false);
    }
    // Show command palette with Ctrl+Space or when typing @
    if ((e.ctrlKey && e.code === 'Space') || freeMessage.endsWith('@')) {
      setShowCommandPalette(true);
    }
  }, [handleFreeChatSubmit, showCommandPalette, freeMessage]);

  const currentCommand = detectBmadCommand(freeMessage);

  if (!allowFreeChat) {
    return null;
  }

  return (
    <CardFooter className="border-t bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10 p-4">
      <div className="w-full space-y-3">
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
            {waitingForAgent && respondingAgent && (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="capitalize">{respondingAgent.replace(/-/g, ' ')} is responding...</span>
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
            <div className="relative">
              <textarea
                className={`w-full p-3 pr-12 border-2 rounded-lg bg-white dark:bg-gray-700 
                  text-gray-900 dark:text-gray-100 focus:ring-2 transition-all duration-200 resize-none min-h-[44px] max-h-[120px] text-sm leading-relaxed
                  placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                  currentCommand.isBmadCommand 
                    ? 'border-purple-400 focus:ring-purple-500 focus:border-purple-500 bg-purple-50 dark:bg-purple-900/10'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder={
                  !isConnected 
                    ? "Connecting to workflow agents..."
                    : waitingForAgent && respondingAgent
                      ? `⏳ ${respondingAgent.charAt(0).toUpperCase() + respondingAgent.slice(1).replace(/-/g, ' ')} is responding...`
                      : elicitationPrompt 
                        ? "💬 Respond to the agent's question above or ask something else..." 
                        : "Try @pm *create-prd or just chat with the agents... (Ctrl+Space for commands)"
                }
                value={freeMessage}
                onChange={(e) => {
                  setFreeMessage(e.target.value);
                }}
                onKeyPress={handleKeyPress}
                disabled={!isConnected || loading}
                maxLength={500}
                rows={1}
              />
              
              {/* Command Indicator */}
              {currentCommand.isBmadCommand && (
                <div className="absolute top-2 right-14 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                  <Terminal className="w-3 h-3" />
                  <span>BMAD Command</span>
                </div>
              )}
              
              {/* Character limit indicator */}
              {freeMessage.length > 400 && (
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                  {500 - freeMessage.length}
                </div>
              )}
            </div>

            {/* Command parameters removed - now handled through conversational workflow */}

            {/* Command Palette */}
            {showCommandPalette && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">BMAD Agent Commands</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Search agents or commands..."
                    value={commandFilter}
                    onChange={(e) => setCommandFilter(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                {isLoadingCommands ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    Loading commands...
                  </div>
                ) : errorLoadingCommands ? (
                  <div className="p-4 text-center text-red-500 dark:text-red-400">
                    Error loading commands: {errorLoadingCommands.message}
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto">
                    {Object.entries(getFilteredCommands()).map(([agentId, agent]) => (
                      <div key={agentId} className="p-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{agent.icon}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{agent.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{agent.description}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 ml-6">
                          {agent.commands.map((command) => {
                            const commandName = typeof command === 'string' ? command : command.name;
                            const commandDesc = typeof command === 'object' ? command.description : '';
                            
                            return (
                              <button
                                key={commandName}
                                onClick={() => handleCommandSelect(agentId, commandName)}
                                className="px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                                title={commandDesc}
                              >
                                *{commandName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-2 text-xs text-gray-500 dark:text-gray-400 text-center border-t border-gray-200 dark:border-gray-700">
                  Press Escape to close • Click command to use
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            {/* Command Palette Toggle */}
            <button
              onClick={() => setShowCommandPalette(!showCommandPalette)}
              disabled={!isConnected || loading}
              className={`px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-1 ${
                showCommandPalette 
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="BMAD Command Palette (Ctrl+Space)"
            >
              <Terminal className="w-4 h-4" />
            </button>
            
            {/* Send Button */}
            <button
              onClick={handleFreeChatSubmit}
              disabled={!freeMessage.trim() || !isConnected || loading}
              className={`px-5 py-2 rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-md hover:shadow-lg min-w-[100px] justify-center ${
                currentCommand.isBmadCommand
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white disabled:from-gray-400 disabled:to-gray-500'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white disabled:from-gray-400 disabled:to-gray-500'
              }`}
            >
              {loading || waitingForAgent ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {waitingForAgent ? 'Waiting...' : 'Sending...'}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {currentCommand.isBmadCommand 
                    ? 'Execute' 
                    : elicitationPrompt 
                      ? 'Respond' 
                      : 'Send'
                  }
                </>
              )}
            </button>
          </div>
        </div>

        {/* BMAD Command Help */}
        {currentCommand.isBmadCommand && (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-800 dark:text-purple-300">BMAD Command Detected</span>
            </div>
            <div className="text-xs text-purple-700 dark:text-purple-300">
              {currentCommand.type === 'agent_call' && 'Calling a specific BMAD agent'}
              {currentCommand.type === 'command' && 'Executing an agent command'}
              • Use @agent *command format • Example: @pm *create-prd
            </div>
          </div>
        )}

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
            /* BMAD Commands Quick Actions */
            <>
              <button
                onClick={() => setFreeMessage('@pm *help')}
                disabled={!isConnected || loading}
                className="px-3 py-1 text-xs bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 
                  text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📋 @pm *help
              </button>
              <button
                onClick={() => setFreeMessage('@architect *help')}
                disabled={!isConnected || loading}
                className="px-3 py-1 text-xs bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 
                  text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🏗️ @architect *help
              </button>
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
            </>
          )}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Enter to send • Shift+Enter for new line • Ctrl+Space for BMAD commands • @ for agents, * for commands
        </div>
      </div>
    </CardFooter>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;