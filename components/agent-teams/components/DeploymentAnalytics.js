'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Calendar
} from 'lucide-react';

/**
 * Deployment Analytics Component
 * Shows analytics for user's agent team deployments using existing data
 */
const DeploymentAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30d'); // 7d, 30d, 90d

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`/api/agent-teams/analytics?range=${timeRange}`);
        const result = await response.json();
        
        if (result.success) {
          setAnalytics(result.analytics);
        } else {
          setError(result.error || 'Failed to load analytics');
        }
      } catch (err) {
        setError('Error fetching analytics: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">Error loading analytics</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return null;
  }

  const getSuccessRate = () => {
    const total = analytics.summary.total;
    const successful = analytics.summary.successful;
    return total > 0 ? Math.round((successful / total) * 100) : 0;
  };

  const getSuccessRateColor = () => {
    const rate = getSuccessRate();
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return (
    <Card>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                Deployment Analytics
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Your deployment insights and trends
              </p>
            </div>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {[
              { value: '7d', label: '7 days' },
              { value: '30d', label: '30 days' },
              { value: '90d', label: '90 days' }
            ].map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  timeRange === range.value
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Total Deployments
              </span>
            </div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {analytics.summary.total}
            </div>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Success Rate
              </span>
            </div>
            <div className={`text-2xl font-bold ${getSuccessRateColor()}`}>
              {getSuccessRate()}%
            </div>
          </div>

          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                Avg Duration
              </span>
            </div>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {formatDuration(analytics.summary.avgDuration)}
            </div>
          </div>

          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                Active Now
              </span>
            </div>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {analytics.summary.active}
            </div>
          </div>
        </div>

        {/* Popular Teams */}
        {analytics.popularTeams && analytics.popularTeams.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
              Most Used Teams
            </h3>
            <div className="space-y-2">
              {analytics.popularTeams.slice(0, 3).map((team, index) => (
                <div key={team._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      #{index + 1}
                    </div>
                    <div>
                      <span className="font-medium text-gray-800 dark:text-white">
                        {team._id}
                      </span>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {team.count} deployment{team.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                    {Math.round((team.count / analytics.summary.total) * 100)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {analytics.recentActivity && analytics.recentActivity.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
              Recent Activity
            </h3>
            <div className="space-y-2">
              {analytics.recentActivity.slice(0, 3).map((activity) => (
                <div key={activity._id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.deployment?.status === 'completed' ? 'bg-green-500' :
                      activity.deployment?.status === 'failed' ? 'bg-red-500' :
                      activity.deployment?.status === 'active' ? 'bg-blue-500' :
                      'bg-gray-400'
                    }`} />
                    <div>
                      <span className="font-medium text-gray-800 dark:text-white">
                        {activity.name}
                      </span>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {activity.teamId} • {new Date(activity.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <Badge className={`${
                    activity.deployment?.status === 'completed' ? 'bg-green-100 text-green-800' :
                    activity.deployment?.status === 'failed' ? 'bg-red-100 text-red-800' :
                    activity.deployment?.status === 'active' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {activity.deployment?.status || 'pending'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {analytics.summary.total === 0 && (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">
              No Data Available
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Deploy your first agent team to see analytics here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeploymentAnalytics;