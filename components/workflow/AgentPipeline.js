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

// BMAD Agent Definitions - UI METADATA ONLY
// TODO: Replace with API call to load agent definitions from .bmad-core folder
// These values should match the agent definitions in .bmad-core/agents/*.md
const BMAD_AGENT_INFO = {
  'analyst': { name: 'Mary - Business Analyst', icon: '🧠', color: 'blue', title: 'Market Research & Analysis' },
  'pm': { name: 'John - Product Manager', icon: '📋', color: 'purple', title: 'Product Requirements & Planning' },
  'architect': { name: 'System Architect', icon: '🏗️', color: 'cyan', title: 'Technical Architecture & Design' },
  'ux-expert': { name: 'UX Designer', icon: '🎨', color: 'pink', title: 'User Experience & Interface Design' },
  'dev': { name: 'Developer', icon: '🛠️', color: 'green', title: 'Code Implementation & Development' },
  'qa': { name: 'QA Engineer', icon: '🔍', color: 'orange', title: 'Quality Assurance & Testing' },
  'sm': { name: 'Scrum Master', icon: '📊', color: 'indigo', title: 'Story Creation & Sprint Planning' },
  'po': { name: 'Sarah - Product Owner', icon: '✅', color: 'emerald', title: 'Validation & Acceptance' },
  'system': { name: 'System', icon: '⚙️', color: 'gray', title: 'System Operations' },
  'bmad-orchestrator': { name: 'BMAD Orchestrator', icon: '🎭', color: 'violet', title: 'Team Coordination' }
};

const AgentPipeline = ({ 
  agents = [], 
  title = "BMAD Agent Pipeline",
  formatTimestamp,
  currentWorkflowStep = null,
  totalWorkflowSteps = null
}) => {
  // Get BMAD agent info
  const getBmadAgentInfo = (agentId) => {
    return BMAD_AGENT_INFO[agentId] || {
      name: agentId.charAt(0).toUpperCase() + agentId.slice(1),
      icon: '🤖',
      color: 'gray',
      title: 'AI Agent'
    };
  };

  // Get icon based on agent role (fallback for non-BMAD agents)
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

  // Get status-based styling
  const getAgentStatusStyle = (status) => {
    switch (status) {
      case 'active': return { 
        border: 'border-blue-500', 
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        pulse: 'animate-pulse-slow'
      };
      case 'completed': return {
        border: 'border-green-500',
        bg: 'bg-green-100 dark:bg-green-900/30', 
        text: 'text-green-700 dark:text-green-300',
        pulse: ''
      };
      case 'error': return {
        border: 'border-red-500',
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300', 
        pulse: ''
      };
      case 'waiting_for_input': return {
        border: 'border-amber-500',
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        pulse: 'animate-pulse'
      };
      default: return {
        border: 'border-gray-300 dark:border-gray-600',
        bg: 'bg-gray-100 dark:bg-gray-700',
        text: 'text-gray-600 dark:text-gray-400',
        pulse: ''
      };
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-500' };
      case 'completed': return { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500' };
      case 'error': return { bg: 'bg-red-500', text: 'text-white', border: 'border-red-500' };
      case 'waiting_for_input': return { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-500' };
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-blue-800 dark:text-blue-200">
            <User className="w-5 h-5 mr-2" />
            {title}
          </CardTitle>
          {currentWorkflowStep && totalWorkflowSteps && (
            <div className="text-sm text-blue-600 dark:text-blue-300">
              Step {currentWorkflowStep} of {totalWorkflowSteps}
            </div>
          )}
        </div>
        {agents.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-blue-600 dark:text-blue-300 mt-2">
            <span>👥 {agents.length} agents</span>
            <span>🔄 {agents.filter(a => a.status === 'active').length} active</span>
            <span>✅ {agents.filter(a => a.status === 'completed').length} completed</span>
            {agents.filter(a => a.status === 'waiting_for_input').length > 0 && (
              <span>⏳ {agents.filter(a => a.status === 'waiting_for_input').length} waiting for input</span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {agents.length > 0 ? (
          <div className="relative">
            {/* Horizontal flow container */}
            <div className="flex items-start justify-center relative pb-4 gap-4">
              {/* Connection line */}
              <div className="absolute top-6 left-6 right-6 h-0.5 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200 dark:from-blue-700 dark:via-blue-600 dark:to-blue-700" />
              
              {agents.map((agent, index) => {
                const bmadInfo = getBmadAgentInfo(agent.id);
                const RoleIcon = getAgentRoleIcon(agent.id);
                const statusStyle = getStatusColor(agent.status);
                const agentStatusStyle = getAgentStatusStyle(agent.status);
                const isActive = agent.status === 'active';
                const isCompleted = agent.status === 'completed';
                const isWaiting = agent.status === 'waiting_for_input';
                
                return (
                  <div key={`${agent.id}-${index}`} className="flex flex-col items-center relative z-10">
                    {/* Number badge with BMAD styling */}
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${statusStyle.bg} ${statusStyle.border} border-2 shadow-md relative transition-all duration-300 ${
                      isActive ? 'scale-105 shadow-lg animate-pulse-slow' : 
                      isWaiting ? 'animate-pulse' : ''
                    }`}>
                      {(isActive || isWaiting) && (
                        <div className={`absolute inset-0 rounded-full opacity-30 ${
                          isActive ? 'bg-blue-500' : 'bg-amber-500'
                        }`} />
                      )}
                      <div className="flex flex-col items-center">
                        <div className="text-lg mb-0.5">{bmadInfo.icon}</div>
                        <span className={`text-xs font-bold ${statusStyle.text}`}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                    
                    {/* Enhanced Agent card with BMAD info */}
                    <div className={`mt-3 bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 p-4 min-w-[140px] max-w-[160px] transition-all duration-300 ${
                      agentStatusStyle.border
                    } ${agentStatusStyle.pulse} ${
                      isActive ? 'shadow-lg transform -translate-y-1' : ''
                    }`}>
                      {/* BMAD Agent Header */}
                      <div className="text-center mb-3">
                        <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200 leading-tight mb-1">
                          {bmadInfo.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {bmadInfo.title}
                        </p>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          STEP {String(index + 1).padStart(2, '0')}
                          {totalWorkflowSteps && ` of ${totalWorkflowSteps}`}
                        </div>
                      </div>
                      
                      {/* Enhanced Status indicator */}
                      <div className="flex items-center justify-center mb-3">
                        <div className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${agentStatusStyle.bg} ${agentStatusStyle.text} ${agentStatusStyle.border}`}>
                          {getStatusIcon(agent.status)}
                          <span className="ml-1 capitalize font-semibold">
                            {agent.status === 'waiting_for_input' ? 'Waiting' : agent.status}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {isActive && agent.progress !== undefined && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-3 dark:bg-gray-700">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out" 
                            style={{ width: `${agent.progress}%` }}
                          ></div>
                          <div className="text-xs text-center mt-1 text-gray-500">
                            {agent.progress}%
                          </div>
                        </div>
                      )}
                      
                      {/* Enhanced Timestamp */}
                      {(agent.startTime || agent.endTime) && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
                          {agent.endTime 
                            ? `✅ Completed ${formatTimestamp(agent.endTime)}`
                            : agent.startTime 
                            ? `🚀 Started ${formatTimestamp(agent.startTime)}`
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
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No BMAD Agents Active
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              The workflow hasn't started yet or no agents are configured.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentPipeline;
export { AgentPipeline };