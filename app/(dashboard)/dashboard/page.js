'use client';

import HeroSection from '../../../components/dashboard/HeroSection';
import ActiveProjectsEnhanced from '../../../components/dashboard/ActiveProjectsEnhanced';
import SystemMetrics from '../../../components/dashboard/SystemMetrics';
import AgentStatusGrid from '../../../components/dashboard/AgentStatusGrid';
import RealTimeActivityFeed from '../../../components/dashboard/RealTimeActivityFeed';
import SmartInsights from '../../../components/dashboard/SmartInsights';

const DashboardPage = () => {
  return (
    <div className="space-y-6">
      {/* BMAD Command Center Hero */}
      <HeroSection />

      {/* Active Projects Enhanced */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Active Projects</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">Real-time monitoring</span>
        </div>
        <ActiveProjectsEnhanced />
      </div>

      {/* Agent Teams Collaboration */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Agent Teams</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">AI coordination</span>
        </div>
        <AgentStatusGrid />
      </div>

      {/* System Overview & Smart Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Performance</h3>
          </div>
          <SystemMetrics />
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Activity</h3>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <RealTimeActivityFeed />
          </div>
        </div>
      </div>

      {/* Smart Insights */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Smart Insights</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">AI recommendations</span>
        </div>
        <SmartInsights />
      </div>
    </div>
  );
};

export default DashboardPage;
