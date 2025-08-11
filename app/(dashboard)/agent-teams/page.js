'use client';

import { useState, useEffect } from 'react';
import { Users, Rocket, Zap, Wrench, Bot, Code, TestTube, Palette, Briefcase, User, BarChart3, Loader2 } from 'lucide-react';
import { getAgentStyle, getTeamStyle, getAgentDisplayName } from '@/lib/utils/agentHelpers';

const agentIcons = {
  'bmad-orchestrator': Bot,
  'analyst': BarChart3,
  'pm': Briefcase,
  'ux-expert': Palette,
  'architect': Code,
  'po': User,
  'sm': Users,
  'dev': Code,
  'qa': TestTube,
  '*': Users
};

const agentNames = {
  '*': 'All Agents'
};

const AgentTeamsPage = () => {
  const [teamConfigs, setTeamConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAgentTeams = async () => {
      try {
        const response = await fetch('/api/agent-teams');
        const result = await response.json();
        
        if (result.success) {
          // Enhance the data with UI styling from helpers
          const enhancedTeams = result.data.map(team => ({
            ...team,
            ...getTeamStyle(team.id)
          }));
          setTeamConfigs(enhancedTeams);
        } else {
          setError('Failed to load agent teams');
        }
      } catch (err) {
        setError('Error fetching agent teams: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAgentTeams();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-body text-gray-600 dark:text-gray-400">Loading agent teams...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-h4 text-red-800 dark:text-red-200 mb-2">Error Loading Agent Teams</h3>
        <p className="text-body text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  const getBestUseCase = (teamId) => {
    const useCases = {
      'team-all': 'Complete development projects',
      'team-fullstack': 'Full-stack applications',
      'team-ide-minimal': 'Simple IDE workflows',
      'team-no-ui': 'Backend services'
    };
    return useCases[teamId] || 'Various development tasks';
  };
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 className="text-h1 mb-4">Agent Teams</h1>
        <p className="text-body text-gray-600 dark:text-gray-400">
          Pre-configured agent team bundles for different development scenarios. Each team includes specific agents and workflows optimized for particular use cases.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {teamConfigs.map((team) => {
          return (
            <div
              key={team.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 ${team.borderColor} p-6 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className={`p-3 rounded-lg ${team.bgColor} flex items-center justify-center`}>
                  <span className="text-2xl">{team.emoji}</span>
                </div>
                <div>
                  <h3 className="text-h3 text-gray-900 dark:text-white">{team.name}</h3>
                  <p className="text-body-small text-gray-500 dark:text-gray-400">
                    {team.agents.length} agent{team.agents.length !== 1 ? 's' : ''}
                    {team.workflows && ` • ${team.workflows.length} workflow${team.workflows.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              <p className="text-body text-gray-600 dark:text-gray-400 mb-6">
                {team.description}
              </p>

              <div className="space-y-4">
                <div>
                  <h4 className="text-body font-semibold text-gray-900 dark:text-white mb-3">Included Agents</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {team.agents.map((agentId, index) => {
                      const AgentIcon = agentIcons[agentId] || Bot;
                      return (
                        <div
                          key={`${agentId}-${index}`}
                          className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <AgentIcon className="w-4 h-4 text-gray-500" />
                          <span className="text-caption text-gray-700 dark:text-gray-300">
                            {getAgentDisplayName(agentId)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {team.workflows && (
                  <div>
                    <h4 className="text-body font-semibold text-gray-900 dark:text-white mb-3">Available Workflows</h4>
                    <div className="space-y-1">
                      {team.workflows.map((workflow, index) => (
                        <div
                          key={`${workflow}-${index}`}
                          className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-caption text-gray-600 dark:text-gray-400"
                        >
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          {workflow.replace('.yaml', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button className={`w-full px-4 py-2 rounded-lg border-2 ${team.borderColor} ${team.color} ${team.bgColor} hover:opacity-80 transition-opacity font-medium text-center`}>
                    Deploy {team.name}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-h3 text-gray-900 dark:text-white mb-4">Team Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left p-3 text-body font-semibold text-gray-900 dark:text-white">Team</th>
                <th className="text-left p-3 text-body font-semibold text-gray-900 dark:text-white">Agents</th>
                <th className="text-left p-3 text-body font-semibold text-gray-900 dark:text-white">Workflows</th>
                <th className="text-left p-3 text-body font-semibold text-gray-900 dark:text-white">Best For</th>
              </tr>
            </thead>
            <tbody>
              {teamConfigs.map((team) => (
                <tr key={team.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{team.emoji}</span>
                      <span className="text-body text-gray-900 dark:text-white">{team.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-body-small text-gray-600 dark:text-gray-400">
                    {team.agents.length} agents
                  </td>
                  <td className="p-3 text-body-small text-gray-600 dark:text-gray-400">
                    {team.workflows ? `${team.workflows.length} workflows` : 'None'}
                  </td>
                  <td className="p-3 text-body-small text-gray-600 dark:text-gray-400">
{getBestUseCase(team.id)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AgentTeamsPage;