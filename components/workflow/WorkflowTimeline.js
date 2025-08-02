
'use client';

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUpdateHistory } from '../../lib/store/slices/realtimeSlice';
import { 
  Clock, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  User,
  Calendar,
  Timer,
  Target,
  Eye,
  Settings,
  TrendingUp,
  Zap
} from 'lucide-react';
import { Badge } from '../common/Badge';

/**
 * Enhanced Workflow Timeline Component
 * Professional visualization of multi-agent workflow progress
 * Supports Technical View, Business View, and Error Recovery View
 */
const WorkflowTimeline = ({ 
  workflowId,
  agents = [], 
  viewMode: propViewMode = 'technical',
  showEstimates = true,
  compact = false 
}) => {
  const [viewMode, setViewMode] = useState(propViewMode);
  const events = useSelector(selectUpdateHistory(workflowId));

  // Agent role colors based on design system
  const getAgentColor = (agentId) => {
    const colors = {
      'pm': { primary: '#8b5cf6', bg: '#f3f4f6', text: '#7c3aed' },
      'architect': { primary: '#06b6d4', bg: '#ecfeff', text: '#0891b2' },
      'developer': { primary: '#10b981', bg: '#ecfdf5', text: '#059669' },
      'qa': { primary: '#f59e0b', bg: '#fffbeb', text: '#d97706' },
      'ux-expert': { primary: '#ec4899', bg: '#fdf2f8', text: '#db2777' },
      'data-architect': { primary: '#7c3aed', bg: '#f5f3ff', text: '#6d28d9' }
    };
    return colors[agentId] || { primary: '#6b7280', bg: '#f9fafb', text: '#4b5563' };
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'workflow_start':
      case 'workflow-update':
        return <Play className="w-4 h-4 text-white" />;
      case 'agent_active':
      case 'agent-activated':
        return <Play className="w-4 h-4 text-white animate-pulse" />;
      case 'agent_completed':
      case 'agent-completed':
        return <CheckCircle className="w-4 h-4 text-white" />;
      case 'agent_message':
      case 'workflow-message':
        return <Zap className="w-4 h-4 text-white" />;
      case 'agent_output':
        return <Target className="w-4 h-4 text-white" />;
      case 'workflow_progress':
        return <TrendingUp className="w-4 h-4 text-white" />;
      case 'agent_error':
        return <AlertCircle className="w-4 h-4 text-white" />;
      default:
        return <Clock className="w-4 h-4 text-white opacity-60" />;
    }
  };

  const getEventColor = (eventType) => {
    switch (eventType) {
      case 'workflow_start':
      case 'workflow-update':
        return '#0066CC';
      case 'agent_active':
      case 'agent-activated':
        return '#10B981';
      case 'agent_completed':
      case 'agent-completed':
        return '#06B6D4';
      case 'agent_message':
      case 'workflow-message':
        return '#8B5CF6';
      case 'agent_error':
        return '#EF4444';
      default:
        return '#6B7280';
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

  const getEstimatedDuration = (agentId) => {
    const estimates = {
      'pm': '5-10 min',
      'architect': '10-15 min',
      'ux-expert': '8-12 min',
      'developer': '15-25 min',
      'qa': '8-15 min',
      'data-architect': '10-20 min'
    };
    return estimates[agentId] || '5-15 min';
  };

  const ViewModeSelector = () => (
    <div className="flex items-center space-x-2 mb-4">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">View:</span>
      {['technical', 'business', 'error-recovery'].map((mode) => (
        <button
          key={mode}
          onClick={() => setViewMode(mode)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            viewMode === mode
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {mode.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </button>
      ))}
    </div>
  );

  const BusinessViewContent = ({ event }) => (
    <div>
      <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
        {event.businessPhase || event.description || event.updateType || 'Business Event'}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {event.businessDescription || 'Business impact and milestone progress'}
      </p>
      <div className="flex items-center space-x-4 text-xs text-gray-500">
        {event.businessImpact && (
          <div className="flex items-center">
            <Target className="w-3 h-3 mr-1" />
            {event.businessImpact}
          </div>
        )}
        {showEstimates && event.agent && (
          <div className="flex items-center">
            <Timer className="w-3 h-3 mr-1" />
            Est: {getEstimatedDuration(event.agent)}
          </div>
        )}
      </div>
    </div>
  );

  const TechnicalViewContent = ({ event }) => (
    <div>
      <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
        {event.description || event.updateType || 'Technical Event'}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {event.technicalDescription || 'Technical execution details'}
      </p>
      <div className="flex items-center space-x-4 text-xs text-gray-500">
        {event.agent && (
          <div className="flex items-center">
            <User className="w-3 h-3 mr-1" />
            {event.agent}
          </div>
        )}
        {event.from && event.to && (
          <div className="flex items-center">
            <Zap className="w-3 h-3 mr-1" />
            {event.from} → {event.to}
          </div>
        )}
      </div>
    </div>
  );

  const ErrorRecoveryViewContent = ({ event }) => (
    <div>
      <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
        {event.description || event.updateType || 'System Event'}
      </h3>
      {event.type?.includes('error') && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-2">
          <p className="text-sm text-red-800 dark:text-red-200 mb-2">
            {event.error || 'An error occurred during execution'}
          </p>
          <div className="flex space-x-2">
            <button className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors">
              Retry
            </button>
            <button className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors">
              Skip
            </button>
          </div>
        </div>
      )}
      {event.checkpoints && (
        <div className="text-xs text-gray-500">
          <div className="flex items-center mb-1">
            <Target className="w-3 h-3 mr-1" />
            Checkpoints available
          </div>
        </div>
      )}
    </div>
  );

  const renderTimelineEvent = (event, index) => {
    const eventColor = getEventColor(event.type);
    const isLast = index === events.length - 1;

    return (
      <li key={event.messageId || index} className="relative mb-6 ml-6">
        {/* Timeline line */}
        {!isLast && (
          <div className="absolute left-[-3px] top-8 w-0.5 h-16 bg-gray-200 dark:bg-gray-700" />
        )}

        {/* Timeline node */}
        <div 
          className="absolute flex items-center justify-center w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 shadow-lg -left-4"
          style={{ backgroundColor: eventColor }}
        >
          {getEventIcon(event.type)}
        </div>

        {/* Event content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow">
          {/* Content based on view mode */}
          {viewMode === 'business' && <BusinessViewContent event={event} />}
          {viewMode === 'technical' && <TechnicalViewContent event={event} />}
          {viewMode === 'error-recovery' && <ErrorRecoveryViewContent event={event} />}

          {/* Event timestamp */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <time className="text-xs text-gray-500 dark:text-gray-400">
              {formatTimestamp(event.receivedAt || event.timestamp)}
            </time>
            <Badge className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              {event.type?.replace(/[_-]/g, ' ') || 'event'}
            </Badge>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            Workflow Timeline
          </h2>
        </div>
        
        {/* Event count */}
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {events.length} events
        </Badge>
      </div>

      {/* View mode selector */}
      <ViewModeSelector />

      {/* Timeline content */}
      {events.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">No events in timeline yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            Workflow events will appear here in real-time
          </p>
        </div>
      ) : (
        <ol className="relative space-y-0">
          {events.map((event, index) => renderTimelineEvent(event, index))}
        </ol>
      )}

      {/* Timeline footer */}
      {viewMode === 'business' && events.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Target className="w-4 h-4 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Workflow Progress Summary
              </span>
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-400">
              {events.filter(e => e.type?.includes('completed')).length} milestones completed
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowTimeline;
