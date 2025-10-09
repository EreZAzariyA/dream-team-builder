'use client';

import { motion } from 'framer-motion';
import { 
  User, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Zap,
  RefreshCw,
  Users
} from 'lucide-react';
import { useAgentStatus } from '../hooks/useDashboardData';
import { useState } from 'react';

/**
 * Individual agent status card
 */
const AgentCard = ({ agent, index }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'working':
        return {
          color: 'bg-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-700 dark:text-blue-300',
          icon: Zap,
          label: 'Working',
          animate: true
        };
      case 'completed':
        return {
          color: 'bg-green-500',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          textColor: 'text-green-700 dark:text-green-300',
          icon: CheckCircle,
          label: 'Completed',
          animate: false
        };
      case 'error':
        return {
          color: 'bg-red-500',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-700 dark:text-red-300',
          icon: AlertTriangle,
          label: 'Error',
          animate: true
        };
      case 'idle':
      default:
        return {
          color: 'bg-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-gray-200 dark:border-gray-700',
          textColor: 'text-gray-600 dark:text-gray-400',
          icon: User,
          label: 'Available',
          animate: false
        };
    }
  };

  const config = getStatusConfig(agent.status);
  const StatusIcon = config.icon;

  const formatLastActive = (dateString) => {
    if (!dateString) return 'Never';
    
    const now = new Date();
    const lastActive = new Date(dateString);
    const diffMs = now - lastActive;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours > 24) return `${Math.floor(diffHours / 24)}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  return (
    <motion.div
      className={`
        ${config.bgColor} ${config.borderColor} border-2 rounded-xl p-4 
        hover:shadow-lg transition-all duration-300 h-full flex flex-col
      `}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2, scale: 1.02 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <motion.div
            className={`w-3 h-3 rounded-full ${config.color}`}
            animate={config.animate ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <StatusIcon className={`w-4 h-4 ${config.textColor}`} />
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${config.bgColor} ${config.textColor}`}>
          {config.label}
        </span>
      </div>

      {/* Agent Info */}
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
          {agent.name}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {agent.teamName || agent.type}
        </p>
        
        {agent.currentTask && (
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 font-medium">
            {agent.currentTask}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>{formatLastActive(agent.lastActive)}</span>
        </div>
        {agent.teamId && (
          <span className="font-medium">Team: {agent.teamId.slice(-4)}</span>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Agent status overview section
 */
const AgentStatus = () => {
  const { agents, loading, refresh } = useAgentStatus();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Group agents by status for summary
  const agentStats = agents.reduce((acc, agent) => {
    acc[agent.status] = (acc[agent.status] || 0) + 1;
    return acc;
  }, {});

  const getStatusSummary = () => {
    const working = agentStats.working || 0;
    const idle = agentStats.idle || 0;
    const completed = agentStats.completed || 0;
    const error = agentStats.error || 0;

    return { working, idle, completed, error, total: agents.length };
  };

  const stats = getStatusSummary();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Agent Status</h2>
        <div className="flex items-center space-x-3">
          {/* Status Summary */}
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-gray-600 dark:text-gray-400">{stats.working} working</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full" />
              <span className="text-gray-600 dark:text-gray-400">{stats.idle} idle</span>
            </div>
            {stats.error > 0 && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-gray-600 dark:text-gray-400">{stats.error} error</span>
              </div>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full" />
                  <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
                </div>
                <div className="w-16 h-5 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Agents</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Deploy an agent team to see agent status here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent, index) => (
            <AgentCard key={agent.id} agent={agent} index={index} />
          ))}
        </div>
      )}
    </section>
  );
};

export default AgentStatus;