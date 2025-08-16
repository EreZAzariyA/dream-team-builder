'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Target,
  Users,
  ChevronRight,
  Star
} from 'lucide-react';

const InsightCard = ({ insight, index }) => {
  const getInsightConfig = (type) => {
    switch (type) {
      case 'optimization':
        return {
          icon: TrendingUp,
          color: 'from-green-500 to-emerald-600',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          textColor: 'text-green-700 dark:text-green-300',
          iconColor: 'text-green-600'
        };
      case 'recommendation':
        return {
          icon: Lightbulb,
          color: 'from-blue-500 to-purple-600',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          textColor: 'text-blue-700 dark:text-blue-300',
          iconColor: 'text-blue-600'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'from-yellow-500 to-orange-500',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          textColor: 'text-yellow-700 dark:text-yellow-300',
          iconColor: 'text-yellow-600'
        };
      case 'performance':
        return {
          icon: Target,
          color: 'from-purple-500 to-pink-600',
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          textColor: 'text-purple-700 dark:text-purple-300',
          iconColor: 'text-purple-600'
        };
      default:
        return {
          icon: Star,
          color: 'from-gray-500 to-gray-600',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          textColor: 'text-gray-700 dark:text-gray-300',
          iconColor: 'text-gray-600'
        };
    }
  };

  const config = getInsightConfig(insight.type);
  const Icon = config.icon;

  return (
    <motion.div
      className={`${config.bgColor} border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all duration-300`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -2 }}
    >
      <div className="flex items-start space-x-3">
        <div className={`p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm`}>
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className={`font-semibold ${config.textColor}`}>{insight.title}</h4>
            <div className="flex items-center space-x-1">
              <span className={`text-xs font-medium ${config.textColor} bg-white dark:bg-gray-800 px-2 py-1 rounded-full`}>
                {insight.priority}
              </span>
              <ChevronRight className={`w-4 h-4 ${config.iconColor}`} />
            </div>
          </div>
          <p className={`text-sm ${config.textColor} mb-3`}>{insight.description}</p>
          
          {insight.metrics && (
            <div className="flex items-center space-x-4 text-xs">
              {insight.metrics.map((metric, idx) => (
                <div key={idx} className="flex items-center space-x-1">
                  <span className={`font-medium ${config.textColor}`}>{metric.label}:</span>
                  <span className={`${config.textColor}`}>{metric.value}</span>
                </div>
              ))}
            </div>
          )}

          {insight.action && (
            <div className="mt-3">
              <button className={`text-xs font-medium ${config.textColor} hover:underline flex items-center space-x-1`}>
                <span>{insight.action}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const SmartInsights = () => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock insights data - in real app, fetch from AI analytics API
    const mockInsights = [
      {
        id: '1',
        type: 'optimization',
        priority: 'High',
        title: 'Workflow Optimization Opportunity',
        description: 'Dev and QA agents could work in parallel on the E-Commerce Platform project to reduce delivery time by 40%.',
        metrics: [
          { label: 'Time Saved', value: '2.5h' },
          { label: 'Efficiency', value: '+40%' }
        ],
        action: 'Optimize workflow sequence'
      },
      {
        id: '2',
        type: 'recommendation',
        priority: 'Medium',
        title: 'Template Suggestion',
        description: 'Based on your recent projects, the "API-First Development" template could accelerate your next backend project.',
        metrics: [
          { label: 'Match Score', value: '94%' },
          { label: 'Avg Speedup', value: '3x' }
        ],
        action: 'Explore template'
      },
      {
        id: '3',
        type: 'performance',
        priority: 'Medium',
        title: 'Agent Utilization Insight',
        description: 'UX Expert and DevOps Engineer agents are underutilized. Consider involving them in active projects.',
        metrics: [
          { label: 'Utilization', value: '23%' },
          { label: 'Available', value: '2 agents' }
        ],
        action: 'Assign new tasks'
      },
      {
        id: '4',
        type: 'warning',
        priority: 'Low',
        title: 'Code Review Backlog',
        description: 'Mobile Authentication project has pending security reviews that could delay deployment.',
        metrics: [
          { label: 'Pending', value: '3 reviews' },
          { label: 'Est. Delay', value: '1-2h' }
        ],
        action: 'Prioritize reviews'
      }
    ];

    setTimeout(() => {
      setInsights(mockInsights);
      setLoading(false);
    }, 800);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="text-center py-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Insights Available</h3>
        <p className="text-gray-600 dark:text-gray-400">Keep working on projects to generate AI-powered insights</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {insights.map((insight, index) => (
        <InsightCard key={insight.id} insight={insight} index={index} />
      ))}
    </div>
  );
};

export default SmartInsights;