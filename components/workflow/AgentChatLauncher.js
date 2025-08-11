'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Bot, Sparkles, Loader2 } from 'lucide-react';
import { AgentChat } from '../agent-chat';
import { useAgents } from '@/lib/hooks/useAgents';
import { getAgentStyle, getAgentDisplayName } from '@/lib/utils/agentHelpers';

/**
 * Agent Chat Launcher Component
 * 
 * Provides quick access to start conversations with BMAD agents
 * Features:
 * - Agent grid with persona information
 * - Quick chat initiation
 * - Agent status indicators
 * - Responsive design
 */

const AgentChatLauncher = ({ className = "" }) => {
  const [activeChat, setActiveChat] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  
  // Fetch agents using custom hook
  const { data: agents, isLoading, error } = useAgents();
  
  // Default quick actions for agents that might not have them defined
  const getDefaultQuickActions = (agentId) => {
    const defaultActions = {
      pm: ['Create PRD', 'Plan Roadmap', 'Analyze Requirements'],
      architect: ['Design Architecture', 'Tech Selection', 'System Review'],
      dev: ['Code Review', 'Debug Issue', 'Implement Feature'],
      'ux-expert': ['Design Review', 'User Research', 'UI Optimization'],
      qa: ['Test Plan', 'Quality Review', 'Bug Analysis'],
      analyst: ['Data Analysis', 'Market Research', 'Business Review'],
      po: ['Backlog Review', 'Story Creation', 'Stakeholder Sync'],
      sm: ['Sprint Planning', 'Team Sync', 'Process Review']
    };
    return defaultActions[agentId] || ['Get Help', 'Ask Question', 'Start Chat'];
  };

  const handleStartChat = (agent, initialMessage = null) => {
    // TODO: Use initialMessage when implementing chat initialization
    setSelectedAgent(agent);
    setActiveChat(agent.id);
  };

  const handleCloseChat = () => {
    setActiveChat(null);
    setSelectedAgent(null);
  };

  const handleQuickAction = (agent, action) => {
    const actionMessages = {
      'Create PRD': 'I need help creating a Product Requirements Document. Can you guide me through the process?',
      'Plan Roadmap': 'I want to plan a product roadmap. What should we consider?',
      'Analyze Requirements': 'I have some requirements that need analysis. Can you help me break them down?',
      'Design Architecture': 'I need to design a system architecture. Can you help me get started?',
      'Tech Selection': 'I need help selecting the right technologies for my project.',
      'System Review': 'Can you review my current system architecture and suggest improvements?',
      'Code Review': 'I have some code that needs review. Can you help me improve it?',
      'Debug Issue': 'I\'m facing a technical issue that needs debugging assistance.',
      'Implement Feature': 'I need help implementing a new feature. Can you guide me?',
      'Design Review': 'I have a design that needs UX review and feedback.',
      'User Research': 'I want to conduct user research. What approach should I take?',
      'UI Optimization': 'My interface needs optimization. Can you help improve it?',
      'Test Plan': 'I need to create a comprehensive test plan. Can you help?',
      'Quality Review': 'I want to review the quality of my project. What should I check?',
      'Bug Analysis': 'I have some bugs that need analysis and prioritization.',
      'Data Analysis': 'I have data that needs analysis and insights.',
      'Market Research': 'I need to conduct market research. Can you guide me?',
      'Business Review': 'I want to review my business model and strategy.',
      'Backlog Review': 'My product backlog needs review and prioritization.',
      'Story Creation': 'I need help creating user stories from requirements.',
      'Stakeholder Sync': 'I need to align with stakeholders. What should we discuss?',
      'Sprint Planning': 'I need help planning the next sprint. What should we focus on?',
      'Team Sync': 'Our team needs better coordination. Can you suggest improvements?',
      'Process Review': 'Our development process needs review and optimization.'
    };

    const message = actionMessages[action] || `I need help with ${action.toLowerCase()}.`;
    handleStartChat(agent, message);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex items-center justify-center min-h-96">
          <div className="flex items-center space-x-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-body text-gray-600 dark:text-gray-400">Loading agents...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-h4 text-red-800 dark:text-red-200 mb-2">Error Loading Agents</h3>
          <p className="text-body text-red-600 dark:text-red-400">{error.message}</p>
        </div>
      </div>
    );
  }

  // No agents state
  if (!agents || agents.length === 0) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center py-8">
          <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Agents Available</h3>
          <p className="text-gray-600 dark:text-gray-400">No AI agents are currently configured.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Chat with AI Agents</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Start a conversation with any of our {agents.length} specialized AI agents. Each agent has unique expertise and personality.
        </p>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {agents.map((agent) => {
          const agentStyle = getAgentStyle(agent.id);
          const quickActions = getDefaultQuickActions(agent.id);
          
          return (
            <motion.div
              key={agent.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`bg-white dark:bg-gray-800 border-2 ${agentStyle.borderColor} rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
            >
              {/* Agent Header */}
              <div className="flex items-center mb-3">
                <div className={`${agentStyle.bgColor} p-2 rounded-lg mr-3 flex items-center justify-center`}>
                  <span className="text-lg">{agent.icon}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{agent.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{agent.title}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
                {agent.description}
              </p>

              {/* Persona/Role */}
              <div className="flex items-center mb-3">
                <Sparkles size={14} className="text-gray-400 mr-1" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {agent.persona?.role || agent.persona?.style || 'AI Assistant'}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Quick Actions:</p>
                {quickActions.slice(0, 2).map((action, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickAction(agent, action);
                    }}
                    className={`block w-full text-left text-xs ${agentStyle.color} hover:opacity-80 hover:${agentStyle.bgColor} px-2 py-1 rounded transition-colors`}
                  >
                    {action}
                  </button>
                ))}
              </div>

              {/* Chat Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartChat(agent);
                }}
                className={`w-full mt-3 ${agentStyle.bgColor} ${agentStyle.color} border ${agentStyle.borderColor} px-3 py-2 rounded-lg text-sm font-medium hover:opacity-80 flex items-center justify-center space-x-2 transition-opacity`}
              >
                <MessageCircle size={16} />
                <span>Start Chat</span>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Feature Highlights */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-100">
        <h3 className="font-semibold text-gray-900 mb-3">Chat Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start space-x-3">
            <Bot className="text-blue-500 mt-1" size={20} />
            <div>
              <h4 className="font-medium text-gray-900">Persona-Driven</h4>
              <p className="text-sm text-gray-600">Each agent has a unique personality and expertise</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <MessageCircle className="text-purple-500 mt-1" size={20} />
            <div>
              <h4 className="font-medium text-gray-900">Real-Time</h4>
              <p className="text-sm text-gray-600">Live conversation with instant responses</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <Sparkles className="text-green-500 mt-1" size={20} />
            <div>
              <h4 className="font-medium text-gray-900">Context-Aware</h4>
              <p className="text-sm text-gray-600">Maintains conversation context and history</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Chat Interface */}
      {activeChat && selectedAgent && (
        <AgentChat
          agentId={activeChat}
          onClose={handleCloseChat}
          className="z-50"
        />
      )}
    </div>
  );
};

export default AgentChatLauncher;