'use client';

import { useState, useEffect } from 'react';
import { Terminal, HelpCircle, FileText, Zap } from 'lucide-react';

/**
 * AgentCommands Component
 * Shows the agent's actual commands from their YAML definition
 * instead of generic quick actions
 */
const AgentCommands = ({ agent, isLoading, newMessage, onCommandSelect }) => {
  const [commands, setCommands] = useState([]);
  const [loadingCommands, setLoadingCommands] = useState(false);

  // Load agent commands when agent changes
  useEffect(() => {
    if (agent?.id && !isLoading) {
      loadAgentCommands(agent.id);
    }
  }, [agent?.id, isLoading]);

  const loadAgentCommands = async (agentId) => {
    setLoadingCommands(true);
    try {
      const response = await fetch(`/api/bmad/agents/${agentId}/commands`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.commands) {
          // Take top 4 most useful commands for quick access
          const topCommands = data.commands
            .filter(cmd => cmd.name !== 'exit' && cmd.name !== 'yolo') // Skip utility commands
            .slice(0, 4);
          setCommands(topCommands);
        }
      }
    } catch (error) {
      console.error('Failed to load agent commands:', error);
      // Fallback to common commands
      setCommands([
        { name: 'help', description: 'Show available commands' },
        { name: 'create', description: 'Create new document' }
      ]);
    } finally {
      setLoadingCommands(false);
    }
  };

  const handleCommandClick = (commandName) => {
    onCommandSelect(`*${commandName}`);
  };

  const getCommandIcon = (commandName) => {
    if (commandName.includes('help')) return <HelpCircle size={12} />;
    if (commandName.includes('create')) return <FileText size={12} />;
    if (commandName.includes('execute') || commandName.includes('run')) return <Zap size={12} />;
    return <Terminal size={12} />;
  };

  const getCommandEmoji = (commandName) => {
    if (commandName.includes('help')) return '❓';
    if (commandName.includes('github-workflow') || commandName.includes('github')) return '🚀';
    if (commandName.includes('create')) return '📝';
    if (commandName.includes('prd')) return '📋';
    if (commandName.includes('architecture')) return '🏗️';
    if (commandName.includes('epic')) return '🎯';
    if (commandName.includes('story')) return '📖';
    if (commandName.includes('doc')) return '📄';
    if (commandName.includes('research')) return '🔍';
    if (commandName.includes('checklist')) return '✅';
    return '⚡';
  };

  // Don't show if loading, has message, or no agent
  if (!agent || isLoading || newMessage.length > 0 || loadingCommands) {
    return null;
  }

  // Show fallback commands if we couldn't load agent-specific ones
  const displayCommands = commands.length > 0 ? commands : [
    { name: 'help', description: 'Show available commands' },
    { name: 'create', description: 'Create new document' }
  ];

  return (
    <div className="px-3 pb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          {agent.name}'s Commands
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Prefix with *
        </span>
      </div>
      
      <div className="flex space-x-2 overflow-x-auto">
        {displayCommands.map((command, index) => (
          <button
            key={index}
            onClick={() => handleCommandClick(command.name)}
            className="flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-all duration-200 group"
            title={command.description}
          >
            <span className="text-sm">{getCommandEmoji(command.name)}</span>
            <span className="font-medium">*{command.name}</span>
          </button>
        ))}
        
        {/* Always show help command if not already included */}
        {!displayCommands.some(cmd => cmd.name === 'help') && (
          <button
            onClick={() => handleCommandClick('help')}
            className="flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all duration-200"
            title="Show all available commands"
          >
            <span className="text-sm">❓</span>
            <span className="font-medium">*help</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AgentCommands;