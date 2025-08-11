import AgentList from './AgentList';
import WorkflowList from './WorkflowList';

const TeamCard = ({ team }) => {
  return (
    <div
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
        <AgentList agents={team.agents} />
        <WorkflowList workflows={team.workflows} />

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button className={`w-full px-4 py-2 rounded-lg border-2 ${team.borderColor} ${team.color} ${team.bgColor} hover:opacity-80 transition-opacity font-medium text-center`}>
            Deploy {team.name}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamCard;