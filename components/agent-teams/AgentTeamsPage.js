'use client';

import { useState } from 'react';
import { useAgentTeamsData } from './hooks/useAgentTeamsData';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import PageHeader from './components/PageHeader';
import TeamGrid from './components/TeamGrid';
import TeamComparison from './components/TeamComparison';
import WorkflowSelectionModal from './components/WorkflowSelectionModal';

const AgentTeamsPage = () => {
  const { teamConfigs, loading, error } = useAgentTeamsData();
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
    setIsWorkflowModalOpen(true);
  };

  const handleModalClose = () => {
    setIsWorkflowModalOpen(false);
    setSelectedTeam(null);
  };

  const handleDeploy = (team, workflow, projectContext) => {
    // TODO: Implement deployment logic
    console.log('Deploying:', { team, workflow, projectContext });
    handleModalClose();
    
    // For now, show success message
    alert(`Successfully deployed ${team.name}${workflow ? ` with ${workflow.name}` : ' for story-driven development'}!`);
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader />
      <TeamGrid teams={teamConfigs} onSelectWorkflow={handleTeamSelect} />
      <TeamComparison teams={teamConfigs} />
      
      <WorkflowSelectionModal
        team={selectedTeam}
        isOpen={isWorkflowModalOpen}
        onClose={handleModalClose}
        onDeploy={handleDeploy}
      />
    </div>
  );
};

export default AgentTeamsPage;