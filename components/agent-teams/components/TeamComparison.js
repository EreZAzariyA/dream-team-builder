const TeamComparison = ({ teams }) => {
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
            {teams.map((team) => (
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
  );
};

export default TeamComparison;