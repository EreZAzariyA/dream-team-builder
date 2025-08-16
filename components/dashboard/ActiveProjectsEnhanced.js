'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  MoreVertical, 
  Clock, 
  Users, 
  Target,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Eye
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const ProjectHealthIndicator = ({ health }) => {
  const getHealthConfig = (health) => {
    switch (health) {
      case 'excellent':
        return { color: 'bg-green-500', label: 'Excellent', textColor: 'text-green-600' };
      case 'good':
        return { color: 'bg-blue-500', label: 'Good', textColor: 'text-blue-600' };
      case 'warning':
        return { color: 'bg-yellow-500', label: 'Needs Attention', textColor: 'text-yellow-600' };
      case 'critical':
        return { color: 'bg-red-500', label: 'Critical', textColor: 'text-red-600' };
      default:
        return { color: 'bg-gray-400', label: 'Unknown', textColor: 'text-gray-600' };
    }
  };

  const config = getHealthConfig(health);

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${config.color} animate-pulse`}></div>
      <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
    </div>
  );
};

const ProjectCard = ({ project }) => {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'paused': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'planning': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'review': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const handleProjectAction = (action) => {
    switch (action) {
      case 'view':
        router.push(`/agent-teams/${project.teamId}/${project.workflowId}/live`);
        break;
      case 'pause':
        // Handle pause logic
        console.log('Pausing project:', project.id);
        break;
      case 'resume':
        // Handle resume logic
        console.log('Resuming project:', project.id);
        break;
    }
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
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
            {project.status}
          </div>
          <ProjectHealthIndicator health={project.health} />
        </div>
        <div className="flex items-center space-x-2">
          {project.status === 'running' && (
            <button
              onClick={() => handleProjectAction('pause')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Pause project"
            >
              <Pause className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          )}
          {project.status === 'paused' && (
            <button
              onClick={() => handleProjectAction('resume')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Resume project"
            >
              <Play className="w-4 h-4 text-green-600" />
            </button>
          )}
          <button
            onClick={() => handleProjectAction('view')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="View project"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
        </div>
      </div>

      {/* Project Info */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {project.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {project.description}
        </p>
        
        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Progress</span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">{project.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${project.progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 mb-1">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {project.activeAgents}
            </span>
          </div>
          <span className="text-xs text-gray-500">Agents</span>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 mb-1">
            <Target className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {project.tasksCompleted}/{project.totalTasks}
            </span>
          </div>
          <span className="text-xs text-gray-500">Tasks</span>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 mb-1">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {project.timeRemaining}
            </span>
          </div>
          <span className="text-xs text-gray-500">ETA</span>
        </div>
      </div>

      {/* Next Action */}
      {project.nextAction && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Next Action</span>
          </div>
          <p className="text-xs text-blue-800 dark:text-blue-200">
            {project.nextAction}
          </p>
        </div>
      )}

      {/* Timeline Preview */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
        >
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Recent Activity</h4>
          <div className="space-y-2">
            {project.recentActivity?.map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 text-xs">
                <div className={`w-2 h-2 rounded-full ${activity.type === 'success' ? 'bg-green-500' : activity.type === 'info' ? 'bg-blue-500' : 'bg-yellow-500'}`}></div>
                <span className="text-gray-600 dark:text-gray-400">{activity.time}</span>
                <span className="text-gray-900 dark:text-white">{activity.message}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
      >
        {isExpanded ? 'Show Less' : 'Show Timeline'}
      </button>
    </motion.div>
  );
};

const ActiveProjectsEnhanced = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data - in real app, fetch from API
    const mockProjects = [
      {
        id: '1',
        name: 'E-Commerce Platform',
        description: 'Full-stack e-commerce solution with React and Node.js',
        status: 'running',
        health: 'excellent',
        progress: 75,
        activeAgents: 5,
        tasksCompleted: 12,
        totalTasks: 16,
        timeRemaining: '2h 30m',
        nextAction: 'Review payment integration by Dev agent',
        teamId: 'team-1',
        workflowId: 'workflow-1',
        recentActivity: [
          { time: '2m ago', message: 'QA agent completed payment testing', type: 'success' },
          { time: '15m ago', message: 'Dev agent pushed payment module', type: 'info' },
          { time: '1h ago', message: 'Architect reviewed security implementation', type: 'info' }
        ]
      },
      {
        id: '2', 
        name: 'API Documentation Portal',
        description: 'Interactive documentation site for REST APIs',
        status: 'planning',
        health: 'good',
        progress: 25,
        activeAgents: 3,
        tasksCompleted: 3,
        totalTasks: 12,
        timeRemaining: '4h 15m',
        nextAction: 'Define API endpoints with Analyst agent',
        teamId: 'team-2',
        workflowId: 'workflow-2',
        recentActivity: [
          { time: '5m ago', message: 'PM agent created project roadmap', type: 'success' },
          { time: '30m ago', message: 'Analyst gathering requirements', type: 'info' }
        ]
      },
      {
        id: '3',
        name: 'Mobile Authentication',
        description: 'Biometric authentication for mobile banking app',
        status: 'review',
        health: 'warning',
        progress: 90,
        activeAgents: 2,
        tasksCompleted: 9,
        totalTasks: 10,
        timeRemaining: '30m',
        nextAction: 'Security review pending by Architect agent',
        teamId: 'team-3',
        workflowId: 'workflow-3',
        recentActivity: [
          { time: '10m ago', message: 'Security scan identified minor issues', type: 'warning' },
          { time: '45m ago', message: 'Dev agent completed implementation', type: 'success' }
        ]
      }
    ];

    setTimeout(() => {
      setProjects(mockProjects);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
        <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Projects</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Start your first BMAD project to see it here</p>
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Create New Project
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {projects.map((project, index) => (
        <motion.div
          key={project.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <ProjectCard project={project} />
        </motion.div>
      ))}
    </div>
  );
};

export default ActiveProjectsEnhanced;