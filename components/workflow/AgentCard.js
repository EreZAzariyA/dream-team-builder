'use client';

import { 
  Clock, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  User,
  Activity,
  MessageSquare
} from 'lucide-react';
import { Badge } from '../common/Badge';

/**
 * Agent Card Component
 * Professional display of agent status with real-time updates
 * Based on design system specifications from front-end-spec.md
 */
const AgentCard = ({ 
  agent, 
  isActive = false, 
  isCompleted = false, 
  isNext = false,
  onClick,
  showTimestamps = true,
  compact = false 
}) => {
  // Agent role colors based on design system
  const getAgentColor = (agentId) => {
    const colors = {
      'pm': { primary: '#8b5cf6', bg: '#f3f4f6', text: '#7c3aed', bgHover: '#ede9fe' },
      'architect': { primary: '#06b6d4', bg: '#ecfeff', text: '#0891b2', bgHover: '#cffafe' },
      'developer': { primary: '#10b981', bg: '#ecfdf5', text: '#059669', bgHover: '#d1fae5' },
      'qa': { primary: '#f59e0b', bg: '#fffbeb', text: '#d97706', bgHover: '#fef3c7' },
      'ux-expert': { primary: '#ec4899', bg: '#fdf2f8', text: '#db2777', bgHover: '#fce7f3' },
      'data-architect': { primary: '#7c3aed', bg: '#f5f3ff', text: '#6d28d9', bgHover: '#ede9fe' }
    };
    return colors[agentId] || { primary: '#6b7280', bg: '#f9fafb', text: '#4b5563', bgHover: '#f3f4f6' };
  };

  const getAgentIcon = (status) => {
    switch (status) {
      case 'active': return <Play className="w-4 h-4 text-green-500 animate-pulse" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const colors = getAgentColor(agent.id);
  const cardClasses = `
    relative group cursor-pointer transition-all duration-300 rounded-lg border-2 p-4
    ${isActive 
      ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700 shadow-lg scale-[1.02]' 
      : isCompleted
      ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
      : isNext
      ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700'
      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
    }
    ${onClick ? 'hover:shadow-lg hover:scale-[1.01]' : ''}
    ${compact ? 'p-3' : 'p-4'}
  `;

  return (
    <div className={cardClasses.trim()} onClick={onClick}>
      {/* Active indicator pulse */}
      {isActive && (
        <div className="absolute inset-0 rounded-lg border-2 border-green-400 animate-ping opacity-75" />
      )}
      
      <div className="flex items-center space-x-4">
        {/* Agent Avatar */}
        <div className="relative">
          <div 
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${compact ? 'w-10 h-10' : 'w-12 h-12'}`}
            style={{ backgroundColor: colors.bg }}
          >
            {getAgentIcon(agent.status)}
          </div>
          
          {/* Status indicator dot */}
          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${
            isActive ? 'bg-green-500 animate-pulse' : 
            isCompleted ? 'bg-blue-500' : 
            agent.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
          }`} />
        </div>

        {/* Agent Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className={`font-semibold text-gray-800 dark:text-gray-200 ${compact ? 'text-sm' : 'text-base'}`}>
              {agent.name}
            </h3>
            <Badge className={`text-xs ${getStatusColor(agent.status)}`}>
              {agent.status}
            </Badge>
          </div>

          {/* Agent Description */}
          {!compact && agent.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {agent.description}
            </p>
          )}

          {/* Timestamps */}
          {showTimestamps && (agent.startTime || agent.endTime) && (
            <div className="text-xs text-gray-500 space-y-1">
              {agent.startTime && (
                <div className="flex items-center">
                  <Play className="w-3 h-3 mr-1" />
                  Started: {formatTimestamp(agent.startTime)}
                </div>
              )}
              {agent.endTime && (
                <div className="flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Completed: {formatTimestamp(agent.endTime)}
                </div>
              )}
            </div>
          )}

          {/* Progress indicator for active agents */}
          {isActive && (
            <div className="mt-2">
              <div className="flex items-center text-xs text-green-600 dark:text-green-400">
                <Activity className="w-3 h-3 mr-1 animate-pulse" />
                Processing...
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-1">
                <div className="bg-green-500 h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        {!compact && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <MessageSquare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        )}
      </div>

      {/* Next indicator */}
      {isNext && (
        <div className="absolute -right-2 top-1/2 transform -translate-y-1/2">
          <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentCard;