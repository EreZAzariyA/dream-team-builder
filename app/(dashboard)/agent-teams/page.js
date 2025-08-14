import { AgentTeamsPage } from '@/components/agent-teams';
import AtWork from '@/components/ui/AtWork';

export default function AgentTeamsPageWrapper() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    return (
      <AtWork 
        title="Agent Teams Feature"
        subtitle="We're working hard to bring you advanced multi-agent collaboration capabilities. This feature will be available soon!"
      />
    );
  }

  return <AgentTeamsPage />;
}