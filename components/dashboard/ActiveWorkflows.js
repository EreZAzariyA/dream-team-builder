'use client';

import { motion } from 'framer-motion';
import { Workflow, GitBranch, Clock } from 'lucide-react';

const WorkflowCard = ({ workflow }) => {
  return (
    <motion.div
      className="card-interactive p-4"
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Workflow className="w-5 h-5 text-primary-600 dark:text-primary-300" />
          <h3 className="text-h5 font-semibold text-professional">{workflow.name}</h3>
        </div>
        <span className={`status-${workflow.status}`}>{workflow.status}</span>
      </div>
      <p className="text-body-small text-professional-muted mb-3">{workflow.description}</p>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
        <div
          className="bg-green-500 h-2 rounded-full"
          style={{ width: `${workflow.progress}%` }}
        ></div>
      </div>
      <div className="flex items-center justify-between text-caption text-professional-subtle">
        <div className="flex items-center space-x-1">
          <GitBranch className="w-3 h-3" />
          <span>{workflow.branch}</span>
        </div>
        <div className="flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>{workflow.timeRemaining}</span>
        </div>
      </div>
    </motion.div>
  );
};

const ActiveWorkflows = () => {
  const workflows = [
    { id: 1, name: 'Project Phoenix', description: 'Implement new auth system', progress: 75, status: 'active', branch: 'feature/auth', timeRemaining: '2 days' },
    { id: 2, name: 'Project Chimera', description: 'Refactor legacy API endpoints', progress: 40, status: 'working', branch: 'refactor/api', timeRemaining: '5 days' },
    { id: 3, name: 'Project Hydra', description: 'Onboarding flow UI/UX improvements', progress: 90, status: 'completed', branch: 'feature/onboarding', timeRemaining: 'Done' },
  ];

  return (
    <div className="space-y-4">
      {workflows.map(workflow => (
        <WorkflowCard key={workflow.id} workflow={workflow} />
      ))}
    </div>
  );
};

export default ActiveWorkflows;