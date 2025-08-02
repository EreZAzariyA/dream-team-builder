'use client';

import { motion } from 'framer-motion';
import { Workflow, GitBranch, Clock, Loader2 } from 'lucide-react';
import { useActiveWorkflows } from '../../lib/hooks/useActiveWorkflows';

const WorkflowCard = ({ workflow }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'initializing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const calculateProgress = () => {
    // Mock progress calculation based on status
    switch (workflow.status) {
      case 'completed': return 100;
      case 'running': return Math.floor(Math.random() * 60) + 20; // 20-80%
      case 'paused': return Math.floor(Math.random() * 40) + 10; // 10-50%
      case 'initializing': return Math.floor(Math.random() * 20); // 0-20%
      default: return 0;
    }
  };

  const getTimeRemaining = () => {
    const hours = Math.floor(Math.random() * 4) + 1;
    return `~${hours}h remaining`;
  };

  const progress = calculateProgress();
  const timeRemaining = getTimeRemaining();

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow duration-200"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Workflow className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{workflow.name || workflow.title}</h3>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(workflow.status)}`}>
          {workflow.status}
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{workflow.description}</p>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
        <div
          className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center space-x-1">
          <GitBranch className="w-3 h-3" />
          <span>{workflow.template || 'default'}</span>
        </div>
        <div className="flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>{timeRemaining}</span>
        </div>
      </div>
    </motion.div>
  );
};

const ActiveWorkflows = () => {
  const { data: workflows, isLoading, isError, error } = useActiveWorkflows();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Active Workflows</h2>
        <div className="flex justify-center items-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="ml-2 text-gray-600 dark:text-gray-400">Loading active workflows...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Active Workflows</h2>
        <div className="text-center text-red-500">
          <p>Error loading workflows: {error?.message || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  if (!workflows || workflows.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Active Workflows</h2>
        <div className="text-center py-8">
          <Workflow className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No active workflows found.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Workflows will appear here when you start them.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Active Workflows</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">{workflows.length} active</span>
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {workflows.map(workflow => (
          <WorkflowCard key={workflow.id || workflow._id} workflow={workflow} />
        ))}
      </div>
    </div>
  );
};

export default ActiveWorkflows;