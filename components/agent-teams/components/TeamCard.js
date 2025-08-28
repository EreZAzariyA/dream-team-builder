'use client'

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import AgentList from './AgentList';
import WorkflowList from './WorkflowList';
import { ArrowRight, Zap, Github } from 'lucide-react';
import { getTeamStyle, isTeamGitHubCompatible, getTeamGitHubCapabilities } from '../../../lib/utils/agentHelpers';

const TeamCard = ({ team, onSelectWorkflow, onGitHubDeploy }) => {
  const { data: session } = useSession();
  const [githubMode, setGithubMode] = useState(false);
  
  // Get dynamic team styling based on GitHub mode
  const teamStyle = getTeamStyle(team.id, githubMode);
  const isGitHubCompatible = isTeamGitHubCompatible(team);
  const hasGitHubAccess = session?.accessToken; // GitHub OAuth check
  const githubCapabilities = getTeamGitHubCapabilities(team);
  
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 ${teamStyle.borderColor} p-6 hover:shadow-md transition-all flex flex-col h-full`}
    >
      {/* Card Content */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-lg ${teamStyle.bgColor} flex items-center justify-center`}>
              <span className="text-2xl">{teamStyle.emoji}</span>
            </div>
            <div>
              <h3 className="text-h3 text-gray-900 dark:text-white">{teamStyle.name}</h3>
              <p className="text-body-small text-gray-500 dark:text-gray-400">
                {team.agents.length} agent{team.agents.length !== 1 ? 's' : ''}
                {team.workflows && ` • ${team.workflows.length} workflow${team.workflows.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          
          {/* GitHub Mode Toggle */}
          {isGitHubCompatible && hasGitHubAccess && (
            <div className="flex flex-col items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={githubMode}
                  onChange={(e) => setGithubMode(e.target.checked)}
                  className="w-4 h-4 text-slate-600 bg-gray-100 border-gray-300 rounded focus:ring-slate-500 focus:ring-2"
                />
                <div className="flex items-center gap-1">
                  <Github className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-600">GitHub</span>
                </div>
              </label>
              {githubMode && (
                <div className="mt-1 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded">
                  Repository Integration
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-body text-gray-600 dark:text-gray-400 mb-4">
          {teamStyle.description}
        </p>

        {/* GitHub Capabilities */}
        {githubMode && githubCapabilities.length > 0 && (
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Github className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">GitHub Capabilities</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {githubCapabilities.map((capability) => (
                <span 
                  key={capability}
                  className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded"
                >
                  {capability.replace('-', ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <AgentList agents={team.agents} />
          <WorkflowList workflows={team.workflows} />
        </div>
      </div>

      {/* Deploy Button Fixed at Bottom */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        {team.workflows && team.workflows.length > 0 ? (
          <button 
            onClick={() => githubMode ? onGitHubDeploy?.(team) : onSelectWorkflow(team)}
            className={`w-full px-4 py-2 rounded-lg border-2 ${teamStyle.borderColor} ${teamStyle.color} ${teamStyle.bgColor} hover:opacity-80 transition-all font-medium text-center flex items-center justify-center space-x-2`}
          >
            {githubMode ? (
              <>
                <Github className="w-4 h-4" />
                <span>Deploy to GitHub Repo</span>
              </>
            ) : (
              <>
                <span>Choose Process & Deploy</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <Zap className="w-4 h-4" />
              <span>{githubMode ? 'GitHub Story Development' : 'Story-Driven Development'}</span>
            </div>
            <button 
              onClick={() => githubMode ? onGitHubDeploy?.(team) : onSelectWorkflow(team)}
              className={`w-full px-4 py-2 rounded-lg border-2 ${teamStyle.borderColor} ${teamStyle.color} ${teamStyle.bgColor} hover:opacity-80 transition-all font-medium text-center flex items-center justify-center space-x-2`}
            >
              {githubMode ? (
                <>
                  <Github className="w-4 h-4" />
                  <span>Deploy to Repository</span>
                </>
              ) : (
                <>
                  <span>Deploy for Stories</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamCard;