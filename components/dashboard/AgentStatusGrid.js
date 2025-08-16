'use client';

import { motion } from 'framer-motion';
import { User, Clock, CheckCircle, AlertTriangle, Zap } from 'lucide-react';

const AgentStatusCard = ({ agent, index }) => {
  // Maps agent status to modern design system
  const getStatusConfig = (status) => {
    switch (status) {
      case 'active':
        return {
          color: 'bg-green-500',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          textColor: 'text-green-700 dark:text-green-300',
          dotColor: 'bg-green-500',
          icon: Zap,
          label: 'Active',
          animate: true
        };
      case 'working':
        return {
          color: 'bg-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-700 dark:text-blue-300',
          dotColor: 'bg-blue-500',
          icon: Clock,
          label: 'Working',
          animate: true
        };
      case 'idle':
      case 'completed':
        return {
          color: 'bg-gray-500',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-gray-200 dark:border-gray-700',
          textColor: 'text-gray-600 dark:text-gray-400',
          dotColor: 'bg-gray-400',
          icon: CheckCircle,
          label: status === 'completed' ? 'Completed' : 'Available',
          animate: false
        };
      case 'error':
        return {
          color: 'bg-red-500',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-700 dark:text-red-300',
          dotColor: 'bg-red-500',
          icon: AlertTriangle,
          label: 'Error',
          animate: true
        };
      default:
        return {
          color: 'bg-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-gray-200 dark:border-gray-700',
          textColor: 'text-gray-500 dark:text-gray-500',
          dotColor: 'bg-gray-400',
          icon: User,
          label: 'Offline',
          animate: false
        };
    }
  };

  const config = getStatusConfig(agent.status);
  const StatusIcon = config.icon;

  return (
    <motion.div
      className={`${config.bgColor} ${config.borderColor} border-2 rounded-xl p-4 hover:shadow-lg transition-all duration-300 h-full flex flex-col justify-between min-h-0`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -2, scale: 1.02 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${config.color}`}>
            <StatusIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{agent.name}</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${config.animate ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-2 flex-1">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Current Task:</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{agent.currentTask}</p>
      </div>

      {/* Task Progress Indicator */}
      {(agent.status === 'working' || agent.status === 'active') && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Progress</span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
              {agent.status === 'active' ? Math.floor(Math.random() * 40) + 50 : Math.floor(Math.random() * 30) + 60}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <motion.div
              className={`h-1.5 rounded-full ${config.color} shadow-sm`}
              initial={{ width: 0 }}
              animate={{ width: `${agent.status === 'active' ? Math.floor(Math.random() * 40) + 50 : Math.floor(Math.random() * 30) + 60}%` }}
              transition={{ delay: index * 0.1 + 0.5, duration: 1.5, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Error indicator for error status */}
      {agent.status === 'error' && (
        <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            <span className="text-xs font-medium text-red-600">Requires attention</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const AgentStatusGrid = () => {
  const agents = [
    { id: 1, name: 'PM Agent', status: 'active', currentTask: 'Creating PRD for Project Phoenix with detailed requirements analysis' },
    { id: 2, name: 'Architect Agent', status: 'working', currentTask: 'Designing microservices architecture and database schema optimization' },
    { id: 3, name: 'Developer Agent', status: 'idle', currentTask: 'Awaiting new development tasks' },
    { id: 4, name: 'QA Agent', status: 'completed', currentTask: 'Comprehensive test plan created for authentication feature' },
    { id: 5, name: 'UX Expert', status: 'idle', currentTask: 'Ready for user experience design tasks' },
    { id: 6, name: 'Data Architect', status: 'error', currentTask: 'Connection failed - troubleshooting data source integration' },
    { id: 7, name: 'Security Analyst', status: 'active', currentTask: 'Running vulnerability scans on dependencies and API endpoints' },
    { id: 8, name: 'DevOps Engineer', status: 'idle', currentTask: 'Standing by for deployment and infrastructure tasks' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr">
      {agents.map((agent, index) => (
        <AgentStatusCard key={agent.id} agent={agent} index={index} />
      ))}
    </div>
  );
};

export default AgentStatusGrid;