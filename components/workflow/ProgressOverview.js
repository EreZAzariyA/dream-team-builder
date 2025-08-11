'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { Activity, CheckCircle, Play, Clock, XCircle } from 'lucide-react';

const ProgressOverview = ({
  currentStepIndex = 0,
  totalWorkflowSteps = 0,
  workflowSteps = [], // New prop: array of step details
  title = "Overall Progress",
  className = ""
}) => {
  const progress = totalWorkflowSteps > 0 ? ((currentStepIndex + 1) / totalWorkflowSteps) * 100 : 0;

  const getStepStatusIcon = (stepIndex) => {
    if (stepIndex < currentStepIndex) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (stepIndex === currentStepIndex) {
      return <Play className="w-4 h-4 text-blue-500 animate-pulse" />;
    } else {
      return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStepStatusColor = (stepIndex) => {
    if (stepIndex < currentStepIndex) {
      return 'bg-green-100 dark:bg-green-900/30';
    } else if (stepIndex === currentStepIndex) {
      return 'bg-blue-100 dark:bg-blue-900/30';
    } else {
      return 'bg-gray-100 dark:bg-gray-700';
    }
  };

  return (
    <Card className={`border-l-4 border-blue-500 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="w-5 h-5 mr-2 text-blue-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Workflow Completion
            </span>
            <span className="text-sm font-bold text-blue-600">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Step {currentStepIndex + 1} of {totalWorkflowSteps}
          </div>

          {/* Detailed Step Progress */}
          {workflowSteps.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Workflow Steps:</h4>
              <div className="space-y-2">
                {workflowSteps.map((step, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center gap-3 p-3 rounded-lg border ${getStepStatusColor(index)} ${index === currentStepIndex ? 'border-blue-500' : 'border-gray-200 dark:border-gray-600'}`}
                  >
                    <div className="flex-shrink-0">
                      {getStepStatusIcon(index)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {step.stepName || `Step ${index + 1}`}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Agent: {step.agentId} {step.command && `(${step.command})`}
                      </p>
                    </div>
                    {index === currentStepIndex && (
                      <span className="text-xs text-blue-600 dark:text-blue-400">Active</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressOverview;