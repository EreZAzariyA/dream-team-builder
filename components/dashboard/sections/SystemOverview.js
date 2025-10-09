'use client';

import { 
  Activity, 
  Users, 
  Target, 
  Clock,
  TrendingUp,
  Server
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import HealthIndicator, { HealthCard } from '../components/HealthIndicator';
import { useDashboardData } from '../hooks/useDashboardData';

/**
 * System overview section with real metrics
 */
const SystemOverview = () => {
  const { 
    activeProjects, 
    agentTeams, 
    repositories,
    systemHealth, 
    successRate, 
    totalDeployments,
    loading 
  } = useDashboardData();

  const metrics = [
    {
      icon: Activity,
      label: 'Active Projects',
      value: activeProjects,
      trend: null, // Could add trend calculation later
      color: 'blue',
      format: 'number'
    },
    {
      icon: Users,
      label: 'Agent Teams',
      value: agentTeams,
      trend: null,
      color: 'purple',
      format: 'number'
    },
    {
      icon: Target,
      label: 'Success Rate',
      value: successRate,
      trend: 2.5, // Example trend
      color: 'green',
      format: 'percentage'
    },
    {
      icon: Server,
      label: 'Total Deployments',
      value: totalDeployments,
      trend: null,
      color: 'orange',
      format: 'number'
    }
  ];

  const healthMetrics = [
    { label: 'Uptime', value: '99.9%' },
    { label: 'Response', value: '< 2s' }
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">System Overview</h2>
        <HealthIndicator health={systemHealth} size="md" />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <MetricCard
            key={metric.label}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            trend={metric.trend}
            color={metric.color}
            format={metric.format}
            loading={loading}
          />
        ))}
      </div>

      {/* System Health Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
            <div className="space-y-4">
              {/* Success Rate Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Success Rate</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{successRate}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${successRate}%` }}
                  />
                </div>
              </div>

              {/* Active Projects Bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Projects</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{activeProjects}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(activeProjects * 10, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <HealthCard
            health={systemHealth}
            title="System Status"
            metrics={healthMetrics}
          />
        </div>
      </div>
    </section>
  );
};

export default SystemOverview;