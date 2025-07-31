'use client';

import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

const AgentStatusCard = ({ agent }) => {
  // Maps agent status from data to the statuses defined in the UI/UX specification.
  const getSpecStatus = (status) => {
    switch (status) {
      case 'active':
        return 'active';
      case 'working':
        return 'busy';
      case 'idle':
      case 'completed':
        return 'available';
      case 'error':
        return 'error';
      default:
        return 'offline';
    }
  };

  const specStatus = getSpecStatus(agent.status);

  // Defines border and shadow styles based on the mapped specification status.
  const statusCardStyles = {
    active: 'border-status-active shadow-success',
    available: 'border-status-available',
    busy: 'border-status-busy shadow-warning',
    error: 'border-status-error shadow-error',
    offline: 'border-status-offline',
  };

  // Defines the color and animation for the status indicator dot.
  const statusDotStyles = {
    active: 'bg-status-active animate-pulse',
    available: 'bg-status-available',
    busy: 'bg-status-busy animate-pulse',
    error: 'bg-status-error',
    offline: 'bg-status-offline',
  };

  const cardClasses = statusCardStyles[specStatus] || statusCardStyles.offline;
  const dotClasses = statusDotStyles[specStatus] || statusDotStyles.offline;

  return (
    <motion.div
      className={`p-4 border rounded-lg ${cardClasses}`}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${dotClasses}`} />
          <h3 className="text-h5 font-semibold text-professional">{agent.name}</h3>
        </div>
        <span className={`status-indicator status-${specStatus}`}>{agent.status}</span>
      </div>
      <p className="text-body-small text-professional-muted truncate">{agent.currentTask}</p>
    </motion.div>
  );
};

const AgentStatusGrid = () => {
  const agents = [
    { id: 1, name: 'PM Agent', status: 'active', currentTask: 'Creating PRD for Project Phoenix' },
    { id: 2, name: 'Architect Agent', status: 'working', currentTask: 'Designing database schema' },
    { id: 3, name: 'Developer Agent', status: 'idle', currentTask: 'Awaiting tasks' },
    { id: 4, name: 'QA Agent', status: 'completed', currentTask: 'Test plan for feature X' },
    { id: 5, name: 'UX Expert', status: 'idle', currentTask: 'Awaiting tasks' },
    { id: 6, name: 'Data Architect', status: 'error', currentTask: 'Failed to connect to data source' },
    { id: 7, name: 'Security Analyst', status: 'active', currentTask: 'Scanning dependencies for vulnerabilities' },
    { id: 8, name: 'DevOps Engineer', status: 'idle', currentTask: 'Awaiting tasks' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {agents.map(agent => (
        <AgentStatusCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
};

export default AgentStatusGrid;