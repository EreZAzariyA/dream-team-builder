'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, Zap, TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ icon, label, value, change, changeType, color, index }) => {
  const Icon = icon;
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    // Animate numeric values
    const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (!isNaN(numericValue)) {
      const timer = setTimeout(() => {
        setAnimatedValue(numericValue);
      }, index * 100);
      return () => clearTimeout(timer);
    }
  }, [value, index]);

  const getChangeIcon = () => {
    if (!change) return null;
    return changeType === 'increase' ? 
      <TrendingUp className="w-3 h-3" /> : 
      <TrendingDown className="w-3 h-3" />;
  };

  const getChangeColor = () => {
    if (!change) return '';
    return changeType === 'increase' ? 
      'text-green-600 dark:text-green-400' : 
      'text-red-600 dark:text-red-400';
  };

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-300"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -2 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-full ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {change && (
          <div className={`flex items-center space-x-1 text-xs font-medium ${getChangeColor()}`}>
            {getChangeIcon()}
            <span>{change}</span>
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">{label}</p>
        <motion.p 
          className="text-xl font-bold text-gray-900 dark:text-white"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.1 + 0.2 }}
        >
          {value}
        </motion.p>
      </div>

      {/* Progress bar for percentage values */}
      {value.includes('%') && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <motion.div
              className={`h-1.5 rounded-full ${color.replace('bg-', 'bg-').split(' ')[0]}`}
              initial={{ width: 0 }}
              animate={{ width: `${parseFloat(value)}%` }}
              transition={{ delay: index * 0.1 + 0.5, duration: 1 }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};

const SystemMetrics = () => {
  const stats = [
    { 
      icon: CheckCircle, 
      label: 'Success Rate', 
      value: '98.2%', 
      change: '+1.2%', 
      changeType: 'increase',
      color: 'bg-green-500'
    },
    { 
      icon: XCircle, 
      label: 'Failure Rate', 
      value: '1.8%', 
      change: '-0.5%', 
      changeType: 'decrease',
      color: 'bg-red-500'
    },
    { 
      icon: Clock, 
      label: 'Avg. Completion', 
      value: '12m 45s', 
      change: '-3.2%', 
      changeType: 'decrease',
      color: 'bg-blue-500'
    },
    { 
      icon: Zap, 
      label: 'Active Agents', 
      value: '8/10', 
      change: '',
      changeType: '',
      color: 'bg-purple-500'
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} index={index} />
      ))}
    </div>
  );
};

export default SystemMetrics;