'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Clean metric display card component
 * Shows real system metrics with trend indicators
 */
const MetricCard = ({ 
  icon: Icon, 
  label, 
  value, 
  trend = null, 
  color = 'blue',
  loading = false,
  format = 'number' // 'number', 'percentage', 'time', 'text'
}) => {
  const colorSchemes = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
      icon: 'text-blue-600 dark:text-blue-400'
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-300',
      icon: 'text-green-600 dark:text-green-400'
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      text: 'text-orange-700 dark:text-orange-300',
      icon: 'text-orange-600 dark:text-orange-400'
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-300',
      icon: 'text-red-600 dark:text-red-400'
    }
  };

  const scheme = colorSchemes[color] || colorSchemes.blue;

  // Format value based on type
  const formatValue = (val) => {
    if (loading) return '...';
    if (val === null || val === undefined) return '—';
    
    switch (format) {
      case 'percentage':
        return `${val}%`;
      case 'time':
        return `${val}s`;
      case 'text':
        return val;
      default:
        return typeof val === 'number' ? val.toLocaleString() : val;
    }
  };

  // Get trend color and icon
  const getTrendConfig = () => {
    if (!trend || trend === 0) return null;
    
    const isPositive = trend > 0;
    return {
      color: isPositive ? 'text-green-600' : 'text-red-600',
      icon: isPositive ? TrendingUp : TrendingDown,
      value: Math.abs(trend)
    };
  };

  const trendConfig = getTrendConfig();

  return (
    <motion.div
      className={`
        bg-white dark:bg-gray-800 rounded-lg border-2 
        ${scheme.border} p-4 hover:shadow-md transition-all duration-300
      `}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Icon */}
          <div className={`p-2 rounded-full ${scheme.bg}`}>
            <Icon className={`w-4 h-4 ${scheme.icon}`} />
          </div>
          
          {/* Label and Value */}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
            <p className={`text-xl font-bold ${loading ? 'animate-pulse' : ''} text-gray-900 dark:text-white`}>
              {formatValue(value)}
            </p>
          </div>
        </div>

        {/* Trend Indicator */}
        {trendConfig && (
          <div className={`flex items-center space-x-1 ${trendConfig.color}`}>
            <trendConfig.icon className="w-4 h-4" />
            <span className="text-sm font-medium">{trendConfig.value}%</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MetricCard;