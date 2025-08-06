'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { Activity } from 'lucide-react';

const ProgressOverview = ({ 
  progress = 0,
  agents = [],
  title = "Overall Progress",
  className = ""
}) => {
  const completedAgents = agents.filter(a => a.status === 'completed').length;
  const totalAgents = agents.length;

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
            {completedAgents} of {totalAgents} agents completed
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressOverview;