import TeamCard from './TeamCard';

const TeamGrid = ({ teams, onSelectWorkflow, onGitHubDeploy }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {teams.map((team) => (
        <TeamCard 
          key={team.id} 
          team={team} 
          onSelectWorkflow={onSelectWorkflow}
          onGitHubDeploy={onGitHubDeploy}
        />
      ))}
    </div>
  );
};

export default TeamGrid;