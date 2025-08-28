'use client';

import React from 'react';
import { Badge } from '../../common/Badge';
import { Activity, Wifi, WifiOff, Zap, Github, ExternalLink } from 'lucide-react';

const WorkflowHeader = ({ 
  workflowInstance, 
  realTimeData, 
  onTriggerDemo,
  formatTimestamp 
}) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // Check if this is a GitHub-integrated workflow
  const isGitHubWorkflow = workflowInstance.workflow?.metadata?.github || 
                          workflowInstance.workflow?.metadata?.team?.mode === 'github-team';
  const githubInfo = workflowInstance.workflow?.metadata?.github;
  const teamInfo = workflowInstance.workflow?.metadata?.team;

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3 mb-2">
          {isGitHubWorkflow && (
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">
              <Github className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">GitHub Integration</span>
            </div>
          )}
          {teamInfo && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-800 rounded-md">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Team: {teamInfo.name}</span>
            </div>
          )}
        </div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          {workflowInstance.workflow?.name || 'Live Workflow'}
        </h1>
        
        {/* GitHub Repository Info */}
        {isGitHubWorkflow && githubInfo && (
          <div className="flex items-center mt-2 gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Github className="w-4 h-4" />
              <span>Repository:</span>
              <a 
                href={githubInfo.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <span className="font-medium">{githubInfo.owner}/{githubInfo.name}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>Branch:</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{githubInfo.targetBranch}</span>
            </div>
          </div>
        )}
        
        <div className="flex items-center mt-3 space-x-6">
          <div className="flex items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mr-2">Status:</p>
            <Badge className={getStatusColor(workflowInstance.status)}>
              <Activity className="w-3 h-3 mr-1" />
              {workflowInstance.status}
            </Badge>
          </div>
          <div className="flex items-center">
            {realTimeData.isConnected ? (
              <Wifi className="w-4 h-4 text-green-500 mr-2" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500 mr-2" />
            )}
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {realTimeData.isConnected ? 'Live Updates Active' : 'Connection Lost'}
            </span>
          </div>
          {/* GitHub Capabilities indicator */}
          {isGitHubWorkflow && githubInfo?.capabilities && (
            <div className="flex items-center">
              <Github className="w-4 h-4 text-slate-500 mr-2" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {githubInfo.capabilities.length} GitHub capabilities active
              </span>
            </div>
          )}
          {realTimeData.lastUpdate && (
            <div className="text-sm text-gray-500">
              Last update: {formatTimestamp(realTimeData.lastUpdate)}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onTriggerDemo}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex items-center"
      >
        <Zap className="w-4 h-4 mr-2" />
        Test Real-time
      </button>
    </div>
  );
};

export default WorkflowHeader;