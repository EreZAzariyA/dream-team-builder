'use client';

import SystemMetrics from '../../../components/dashboard/SystemMetrics';
import AgentStatusGrid from '../../../components/dashboard/AgentStatusGrid';
import ActiveWorkflows from '../../../components/dashboard/ActiveWorkflows';
import RealTimeActivityFeed from '../../../components/dashboard/RealTimeActivityFeed';

const DashboardPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-h4 font-semibold mb-4">System Metrics</h3>
        <SystemMetrics />
      </div>
      <div>
        <h3 className="text-h4 font-semibold mb-4">Agent Status</h3>
        <AgentStatusGrid />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h3 className="text-h4 font-semibold mb-4">Active Workflows</h3>
          <ActiveWorkflows />
        </div>
        <div>
          <h3 className="text-h4 font-semibold mb-4">Real-time Activity</h3>
          <RealTimeActivityFeed />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
