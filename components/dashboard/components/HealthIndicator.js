'use client';

import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

/**
 * Health configuration object - shared across components
 */
const healthConfigs = {
  excellent: {
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500',
    icon: CheckCircle,
    label: 'Excellent',
    description: 'All systems operating optimally'
  },
  good: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-500',
    icon: CheckCircle,
    label: 'Good',
    description: 'Systems operating normally'
  },
  warning: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    dotColor: 'bg-yellow-500',
    icon: AlertTriangle,
    label: 'Warning',
    description: 'Some issues detected'
  },
  critical: {
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    icon: XCircle,
    label: 'Critical',
    description: 'Immediate attention required'
  },
  unknown: {
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-700',
    dotColor: 'bg-gray-400',
    icon: Clock,
    label: 'Unknown',
    description: 'Status unavailable'
  }
};

/**
 * Clean health status indicator component
 * Shows system/project health with appropriate colors and icons
 */
const HealthIndicator = ({ 
  health = 'good', 
  size = 'sm', // 'sm', 'md', 'lg'
  showLabel = true,
  className = ''
}) => {

  const sizeConfigs = {
    sm: {
      dot: 'w-2 h-2',
      icon: 'w-3 h-3',
      text: 'text-xs',
      padding: 'px-2 py-1'
    },
    md: {
      dot: 'w-3 h-3',
      icon: 'w-4 h-4',
      text: 'text-sm',
      padding: 'px-2.5 py-1.5'
    },
    lg: {
      dot: 'w-4 h-4',
      icon: 'w-5 h-5',
      text: 'text-base',
      padding: 'px-3 py-2'
    }
  };

  const config = healthConfigs[health] || healthConfigs.unknown;
  const sizeConfig = sizeConfigs[size] || sizeConfigs.sm;
  const Icon = config.icon;

  if (!showLabel) {
    return (
      <div className={`flex items-center ${className}`}>
        <motion.div
          className={`${sizeConfig.dot} rounded-full ${config.dotColor}`}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            repeatType: 'loop'
          }}
        />
      </div>
    );
  }

  return (
    <motion.div
      className={`
        inline-flex items-center space-x-2 
        ${config.bgColor} ${config.borderColor} border rounded-full
        ${sizeConfig.padding} ${className}
      `}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className={`${sizeConfig.dot} rounded-full ${config.dotColor}`}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ 
          duration: 2, 
          repeat: Infinity, 
          repeatType: 'loop'
        }}
      />
      <Icon className={`${sizeConfig.icon} ${config.color}`} />
      <span className={`${sizeConfig.text} font-medium ${config.color}`}>
        {config.label}
      </span>
    </motion.div>
  );
};

/**
 * Detailed health card component
 */
export const HealthCard = ({ 
  health = 'good', 
  title = 'System Health',
  description,
  metrics = [],
  className = ''
}) => {
  const config = healthConfigs[health] || healthConfigs.unknown;
  const Icon = config.icon;

  return (
    <motion.div
      className={`
        bg-white dark:bg-gray-800 rounded-lg border-2 
        ${config.borderColor} p-4 ${className}
      `}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${config.bgColor}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {description || config.description}
            </p>
          </div>
        </div>
        <HealthIndicator health={health} size="md" />
      </div>

      {/* Metrics */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {metrics.map((metric, index) => (
            <div key={index} className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{metric.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{metric.label}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default HealthIndicator;