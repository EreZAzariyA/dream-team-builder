'use client';

import React, { memo } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../common/Badge';
import { Users, Circle, Bot, Clock, CheckCircle, Play, Pause } from 'lucide-react';

const AgentSidebar = memo(({ 
  detectedAgents = [], 
  isConnected = false, 
  currentAgent = null
}) => {

  // Get workflow status styling and icon
  const getWorkflowStatusInfo = (status) => {
    switch (status) {
      case 'active':
        return {
          icon: <Play className="w-3 h-3" />,
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          textColor: 'text-green-800 dark:text-green-200',
          borderColor: 'border-green-200 dark:border-green-700',
          label: 'Active'
        };
      case 'completed':
        return {
          icon: <CheckCircle className="w-3 h-3" />,
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          textColor: 'text-blue-800 dark:text-blue-200',
          borderColor: 'border-blue-200 dark:border-blue-700',
          label: 'Completed'
        };
      case 'waiting_for_input':
        return {
          icon: <Pause className="w-3 h-3" />,
          bgColor: 'bg-amber-100 dark:bg-amber-900/30',
          textColor: 'text-amber-800 dark:text-amber-200',
          borderColor: 'border-amber-200 dark:border-amber-700',
          label: 'Waiting for Input'
        };
      case 'pending':
        return {
          icon: <Clock className="w-3 h-3" />,
          bgColor: 'bg-gray-100 dark:bg-gray-900/30',
          textColor: 'text-gray-600 dark:text-gray-400',
          borderColor: 'border-gray-200 dark:border-gray-700',
          label: 'Pending'
        };
      case 'additional':
        return {
          icon: <Circle className="w-3 h-3" />,
          bgColor: 'bg-purple-100 dark:bg-purple-900/30',
          textColor: 'text-purple-600 dark:text-purple-400',
          borderColor: 'border-purple-200 dark:border-purple-700',
          label: 'From Messages'
        };
      default:
        return {
          icon: <Circle className="w-3 h-3" />,
          bgColor: 'bg-gray-100 dark:bg-gray-900/30',
          textColor: 'text-gray-600 dark:text-gray-400',
          borderColor: 'border-gray-200 dark:border-gray-700',
          label: 'Unknown'
        };
    }
  };
  return (
    <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Workflow Agents</h3>
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {detectedAgents.length}
          </Badge>
        </div>
        <div className={`flex items-center gap-1 text-xs ${
          isConnected 
            ? 'text-green-600 dark:text-green-400' 
            : 'text-red-600 dark:text-red-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}></div>
          {isConnected ? 'Connected to workflow' : 'Disconnected'}
        </div>
      </div>

      {/* Agent List */}
      <ScrollArea className="h-auto p-2">
        {detectedAgents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Bot className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No active agents yet
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {detectedAgents
              .filter(agent => agent.order && agent.order < 999) // Only show workflow agents
              .sort((a, b) => (a.order || 0) - (b.order || 0)) // Sort by workflow order
              .map((agent) => {
                // Determine agent status based on current workflow position
                const isCurrentAgent = agent.id === currentAgent;
                const agentStatus = isCurrentAgent ? 'active' : 'pending';
                const statusInfo = getWorkflowStatusInfo(agentStatus);
              
              return (
                <div
                  key={agent.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                    isCurrentAgent
                      ? `${statusInfo.bgColor} border-2 ${statusInfo.borderColor} shadow-sm`
                      : `bg-white dark:bg-gray-800 border ${statusInfo.borderColor}`
                  }`}
                >
                  {/* Order number for workflow agents */}
                  {agent.order && agent.order < 999 && (
                    <div className="flex-shrink-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrentAgent
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}>
                        {agent.order}
                      </div>
                    </div>
                  )}

                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-semibold transition-all duration-200 ${
                      isCurrentAgent
                        ? 'bg-gradient-to-br from-green-500 to-blue-500 shadow-lg'
                        : 'bg-gradient-to-br from-gray-400 to-gray-500'
                    }`}>
                      {agent.id.includes('/') || agent.id === 'various' ? '🔄' : agent.icon}
                    </div>
                    
                    {/* Status indicator badge */}
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-md text-white text-xs">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        isCurrentAgent ? 'bg-green-500' : 'bg-gray-400'
                      }`}>
                        {statusInfo.icon}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {agent.id.includes('/') ? agent.id.split('/').map(a => a.trim()).join(' or ') : agent.name}
                      </h4>
                      
                      {/* Workflow status badge */}
                      <Badge className={`${statusInfo.bgColor} ${statusInfo.textColor} text-xs border-0`}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {agent.id === 'various' ? 'Dynamic Selection' : agent.role}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
});

AgentSidebar.displayName = 'AgentSidebar';

export default AgentSidebar;