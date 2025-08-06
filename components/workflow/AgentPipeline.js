'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  User,
  ArrowRight,
  Settings,
  Palette,
  Code,
  TestTube,
  Briefcase,
  Users,
  Wrench,
  CheckSquare
} from 'lucide-react';

const AgentPipeline = ({ 
  agents = [], 
  title = "Agent Pipeline",
  formatTimestamp 
}) => {
  // Get icon based on agent role
  const getAgentRoleIcon = (agentId) => {
    const iconMap = {
      'pm': Briefcase,
      'architect': Settings,
      'ux-expert': Palette,
      'developer': Code,
      'dev': Code,
      'qa': TestTube,
      'po': CheckSquare,
      'sm': Users,
      'analyst': Settings
    };
    return iconMap[agentId] || Wrench;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-500' };
      case 'completed': return { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500' };
      case 'error': return { bg: 'bg-red-500', text: 'text-white', border: 'border-red-500' };
      default: return { bg: 'bg-gray-300', text: 'text-gray-600', border: 'border-gray-300' };
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <Play className="w-3 h-3" />;
      case 'completed': return <CheckCircle className="w-3 h-3" />;
      case 'error': return <AlertCircle className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 border-0 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-blue-800 dark:text-blue-200">
          <User className="w-5 h-5 mr-2" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {agents.length > 0 ? (
          <div className="relative">
            {/* Horizontal flow container */}
            <div className="flex items-start justify-center relative pb-4 gap-4">
              {/* Connection line */}
              <div className="absolute top-6 left-6 right-6 h-0.5 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200 dark:from-blue-700 dark:via-blue-600 dark:to-blue-700" />
              
              {agents.map((agent, index) => {
                const RoleIcon = getAgentRoleIcon(agent.id);
                const statusStyle = getStatusColor(agent.status);
                const isActive = agent.status === 'active';
                const isCompleted = agent.status === 'completed';
                
                return (
                  <div key={`${agent.id}-${index}`} className="flex flex-col items-center relative z-10">
                    {/* Number badge */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${statusStyle.bg} ${statusStyle.border} border-2 shadow-md relative transition-all duration-300 ${isActive ? 'scale-105 shadow-lg animate-pulse-slow' : ''}`}>
                      {isActive && (
                        <div className="absolute inset-0 rounded-full bg-blue-500 opacity-30" />
                      )}
                      <div className="flex flex-col items-center">
                        <span className={`text-xs font-bold ${statusStyle.text}`}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                    
                    {/* Agent card */}
                    <div className={`mt-3 bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 p-3 min-w-[120px] max-w-[130px] transition-all duration-300 ${
                      isActive 
                        ? 'border-blue-500 shadow-lg transform -translate-y-1' 
                        : isCompleted
                        ? 'border-green-500'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}>
                      {/* Role icon */}
                      <div className="flex justify-center mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isActive ? 'bg-blue-100 text-blue-600' :
                          isCompleted ? 'bg-green-100 text-green-600' :
                          'bg-gray-100 text-gray-600'
                        } dark:bg-opacity-20`}>
                          <RoleIcon className="w-4 h-4" />
                        </div>
                      </div>
                      
                      {/* Agent name */}
                      <div className="text-center mb-2">
                        <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200 leading-tight">
                          {agent.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          STEP {String(index + 1).padStart(2, '0')}
                        </p>
                      </div>
                      
                      {/* Status indicator */}
                      <div className="flex items-center justify-center">
                        <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          isActive 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                            : isCompleted
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {getStatusIcon(agent.status)}
                          <span className="ml-1 capitalize">{agent.status}</span>
                        </div>
                      </div>
                      {/* Progress Bar */}
                      {isActive && agent.progress !== undefined && (
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-2 dark:bg-gray-700">
                          <div 
                            className="bg-blue-600 h-1 rounded-full transition-all duration-500 ease-out" 
                            style={{ width: `${agent.progress}%` }}
                          ></div>
                        </div>
                      )}
                      
                      {/* Timestamp */}
                      {(agent.startTime || agent.endTime) && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
                          {agent.endTime 
                            ? `Completed ${formatTimestamp(agent.endTime)}`
                            : agent.startTime 
                            ? `Started ${formatTimestamp(agent.startTime)}`
                            : ''
                          }
                        </div>
                      )}
                    </div>
                    
                    {/* Arrow connector */}
                    {index < agents.length - 1 && (
                      <div className="absolute top-6 -right-5 z-20">
                        <ArrowRight className="w-3 h-3 text-blue-400 dark:text-blue-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No agents configured for this workflow
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentPipeline;