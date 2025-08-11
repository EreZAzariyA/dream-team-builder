import TeamCard from './TeamCard';

const TeamGrid = ({ teams, onSelectWorkflow }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {teams.map((team) => (
        <TeamCard 
          key={team.id} 
          team={team} 
          onSelectWorkflow={onSelectWorkflow}
        />
      ))}
    </div>
  );
};

export default TeamGrid;