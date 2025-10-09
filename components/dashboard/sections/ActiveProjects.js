'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Eye, 
  Clock, 
  Users,
  MoreVertical,
  RefreshCw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import HealthIndicator from '../components/HealthIndicator';
import { useActiveProjects } from '../hooks/useDashboardData';

/**
 * Project card component
 */
const ProjectCard = ({ project }) => {
  const router = useRouter();

  const getStatusConfig = (status) => {
    switch (status) {
      case 'running':
      case 'active':
        return { 
          color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
          label: 'Running'
        };
      case 'paused':
        return { 
          color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
          label: 'Paused'
        };
      case 'planning':
        return { 
          color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
          label: 'Planning'
        };
      case 'completed':
        return { 
          color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
          label: 'Completed'
        };
      default:
        return { 
          color: 'text-gray-600 bg-gray-100 dark:bg-gray-900/30',
          label: 'Unknown'
        };
    }
  };

  const statusConfig = getStatusConfig(project.status);

  const handleViewProject = () => {
    if (project.workflowId && project.teamId) {
      router.push(`/agent-teams/${project.teamId}/${project.workflowId}/live`);
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Unknown';
    
    const now = new Date();
    const start = new Date(dateString);
    const diffMs = now - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:shadow-lg transition-all duration-300"
      whileHover={{ y: -2 }}
      layout
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{project.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {project.repository?.name || project.currentStep}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <HealthIndicator health={project.health} size="sm" />
          <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status and Progress */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatTimeAgo(project.startedAt)}
          </span>
        </div>

        {/* Progress Bar */}
        {project.progress !== undefined && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Progress</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{project.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Current Step */}
        {project.currentStep && (
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Current: {project.currentStep}</span>
          </div>
        )}
      </div>

      {/* Repository Info */}
      {project.repository && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-400 rounded-sm"></div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {project.repository.full_name}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {project.repository.description || 'No description'}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handleViewProject}
          className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Eye className="w-4 h-4" />
          <span>View Live</span>
        </button>
        
        <button className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          {project.status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>
    </motion.div>
  );
};

/**
 * Active projects section component
 */
const ActiveProjects = () => {
  const { projects, loading, error, refresh } = useActiveProjects();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (error) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Active Projects</h2>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">Failed to load active projects: {error}</p>
          <button 
            onClick={handleRefresh}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Active Projects</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {loading ? 'Loading...' : `${projects.length} active`}
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                <div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32 mb-1"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
                <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Projects</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Start by deploying an agent team or running a workflow
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </section>
  );
};

export default ActiveProjects;