import { Bot, Code, TestTube, Palette, Briefcase, User, BarChart3, Users } from 'lucide-react';
import { getAgentDisplayName } from '@/lib/utils/agentHelpers';

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

const AgentList = ({ agents }) => {
  return (
    <div>
      <h4 className="text-body font-semibold text-gray-900 dark:text-white mb-3">Included Agents</h4>
      <div className="grid grid-cols-2 gap-2">
        {agents.map((agentId, index) => {
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
  );
};

export default AgentList;