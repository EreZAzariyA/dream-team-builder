'use client'

import { useState } from "react";
import { ArrowRight, Clock, Users, Zap, CheckCircle, AlertTriangle } from "lucide-react";
import { Badge } from "../common/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "../common/Card";

const AGENT_ICONS = {
  'analyst': '🧠',
  'pm': '📋',
  'architect': '🏗️', 
  'ux-expert': '🎨',
  'dev': '🛠️',
  'qa': '🔍',
  'sm': '📊',
  'po': '✅',
  'system': '⚙️',
  'bmad-orchestrator': '🎭'
};

const AGENT_ROLES = {
  'analyst': 'Business Analyst',
  'pm': 'Product Manager', 
  'architect': 'System Architect',
  'ux-expert': 'UX Designer',
  'dev': 'Developer',
  'qa': 'QA Engineer',
  'sm': 'Scrum Master',
  'po': 'Product Owner',
  'system': 'System',
  'bmad-orchestrator': 'BMad Orchestrator'
};

export const BmadTemplateCard = ({ 
  template, 
  isLoading = false, 
  onSelect = () => {},
  selected = false,
  launching = false 
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (isLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800 shadow-md animate-pulse">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 mb-6"></div>
          
          <div className="flex gap-4 mb-4">
            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </div>
          
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  // Get workflow type styling
  const getWorkflowTypeColor = (type) => {
    switch (type) {
      case 'brownfield': 
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700';
      case 'greenfield': 
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-700';
      default: 
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700';
    }
  };

  // Get complexity styling
  const getComplexityColor = (complexity) => {
    switch (complexity) {
      case 'Simple': 
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700';
      case 'Moderate': 
        return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700';
      case 'Complex': 
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700';
      default: 
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-700';
    }
  };

  const borderColor = selected 
    ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800' 
    : template.type === 'brownfield' 
      ? 'border-amber-300 dark:border-amber-700' 
      : 'border-green-300 dark:border-green-700';

  return (
    <Card 
      className={`
        bg-white dark:bg-gray-800 shadow-md transition-all duration-300 group 
        border-l-4 ${borderColor} relative overflow-hidden
        ${selected ? 'shadow-lg ring-2 ring-primary-200 dark:ring-primary-800' : ''}
        ${launching ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:shadow-xl transform hover:scale-105'}
      `}
      onClick={() => {
        if (!launching) {
          console.log('Card clicked!', template.id);
          onSelect(template);
        }
      }}
    >
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-5 transform translate-x-16 -translate-y-16">
        <div className="text-6xl">
          {template.type === 'brownfield' ? '🔧' : '🚀'}
        </div>
      </div>

      <CardHeader className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-bold text-gray-800 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {template.name}
            </CardTitle>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={`text-xs font-semibold border ${getWorkflowTypeColor(template.type)}`}>
                {template.type === 'brownfield' ? '🔧 Brownfield' : '🚀 Greenfield'}
              </Badge>
              <Badge className={`text-xs border ${getComplexityColor(template.complexity)}`}>
                {template.complexity === 'Simple' && <CheckCircle className="w-3 h-3 mr-1" />}
                {template.complexity === 'Moderate' && <Zap className="w-3 h-3 mr-1" />}
                {template.complexity === 'Complex' && <AlertTriangle className="w-3 h-3 mr-1" />}
                {template.complexity}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
          {template.description}
        </p>
        
        {/* Workflow Stats */}
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{template.estimatedTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{template.agents.length} agents</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4" />
            <span>{template.stepCount} steps</span>
          </div>
        </div>

        {/* Project Types */}
        {template.project_types && template.project_types.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Project Types
            </div>
            <div className="flex flex-wrap gap-1">
              {template.project_types.slice(0, 3).map((type, index) => (
                <Badge key={index} variant="outline" className="text-xs px-2 py-1">
                  {type}
                </Badge>
              ))}
              {template.project_types.length > 3 && (
                <Badge variant="outline" className="text-xs px-2 py-1">
                  +{template.project_types.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* BMAD Agents Pipeline */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Agent Pipeline ({template.agents.length} agents)
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {template.agents.slice(0, 6).map((agent, index) => (
              <div key={agent} className="flex items-center gap-1 flex-shrink-0">
                <div 
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm border-2 border-white dark:border-gray-800 shadow-sm"
                  title={`${AGENT_ROLES[agent] || agent}: ${AGENT_ICONS[agent] || '🤖'}`}
                >
                  {AGENT_ICONS[agent] || '🤖'}
                </div>
                {index < Math.min(template.agents.length - 1, 5) && (
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                )}
              </div>
            ))}
            {template.agents.length > 6 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs text-gray-600 dark:text-gray-400 border-2 border-white dark:border-gray-800">
                  +{template.agents.length - 6}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div 
          className={`flex justify-center items-center py-3 px-4 rounded-lg transition-all duration-200 ${
            launching 
              ? 'bg-gray-400 text-white cursor-not-allowed' 
              : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 transform hover:scale-105 group-hover:shadow-md cursor-pointer'
          }`}
        >
          {launching ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              <span className="font-medium">Starting Workflow...</span>
            </>
          ) : (
            <>
              <span className="font-medium">
                {template.type === 'brownfield' ? 'Enhance Existing Project' : 'Start New Project'}
              </span>
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </div>

        {/* Additional Details Toggle */}
        {(template.decision_guidance?.when_to_use || template.handoff_prompts) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            className="mt-3 text-xs text-primary-600 dark:text-primary-400 hover:underline w-full text-center"
          >
            {showDetails ? 'Hide Details' : 'Show More Details'}
          </button>
        )}

        {/* Expanded Details */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs">
            {template.decision_guidance?.when_to_use && (
              <div className="mb-3">
                <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">When to Use:</div>
                <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                  {template.decision_guidance.when_to_use.map((use, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{use}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Selection Indicator */}
      {selected && (
        <div className="absolute top-4 right-4 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
          <CheckCircle className="w-4 h-4 text-white" />
        </div>
      )}
    </Card>
  );
};