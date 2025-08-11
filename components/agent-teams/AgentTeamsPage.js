'use client';

import { useAgentTeamsData } from './hooks/useAgentTeamsData';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import PageHeader from './components/PageHeader';
import TeamGrid from './components/TeamGrid';
import TeamComparison from './components/TeamComparison';

const AgentTeamsPage = () => {
  const { teamConfigs, loading, error } = useAgentTeamsData();

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader />
      <TeamGrid teams={teamConfigs} />
      <TeamComparison teams={teamConfigs} />
    </div>
  );
};

export default AgentTeamsPage;