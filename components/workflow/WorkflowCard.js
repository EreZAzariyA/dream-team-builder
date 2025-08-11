'use client'

import { ArrowRight } from "lucide-react";
import { Badge } from "../common/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "../common/Card";


export const WorkflowCard = ({ isLoading = false, workflow = {} }) => {

  const getUniqueAgents = (sequence) => {
    if (!sequence) return [];
    const agents = sequence.reduce((acc, step) => {
      if (step.agent) {
        acc.push(...step.agent.split('/'));
      }
      return acc;
    }, []);
    return [...new Set(agents)];
  };

  if (isLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800 shadow-md animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          <div className="flex flex-wrap gap-2 mt-4">
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get workflow type styling
  const getWorkflowTypeColor = (type) => {
    switch (type) {
      case 'brownfield': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'greenfield': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  return (
    <Card className="bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group border-l-4 border-primary-500">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-h4 text-gray-800 dark:text-white">{workflow.name}</CardTitle>
          {workflow.type && (
            <Badge className={getWorkflowTypeColor(workflow.type)}>
              {workflow.type}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-body text-gray-600 dark:text-gray-400 mb-4">{workflow.description}</p>
        
        {/* BMAD Method Agents */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            BMAD Agents
          </h4>
          <div className="flex flex-wrap gap-2">
            {getUniqueAgents(workflow.sequence).map((agent) => (
              <Badge key={agent} variant="secondary" className="text-xs">
                {agent}
              </Badge>
            ))}
          </div>
        </div>

        {/* Workflow Stats */}
        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-4">
          <span>{workflow.sequence?.length || 0} steps</span>
          {workflow.project_types && (
            <>
              <span className="mx-2">•</span>
              <span>{workflow.project_types.join(', ')}</span>
            </>
          )}
        </div>
        
        <div className="flex justify-end items-center">
          <span className="text-sm font-medium text-primary-600 dark:text-primary-400 group-hover:underline">
            Launch BMAD Workflow
          </span>
          <ArrowRight className="w-4 h-4 ml-2 text-primary-600 dark:text-primary-400 group-hover:translate-x-1 transition-transform" />
        </div>
      </CardContent>
    </Card>
  );
};