'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Code, FileText, GitCommit, Users, Zap, CheckCircle } from 'lucide-react';

const ActivityItem = ({ item, index }) => {
  const getActivityConfig = (type) => {
    switch (type) {
      case 'communication':
        return {
          icon: MessageSquare,
          color: 'bg-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          textColor: 'text-blue-700 dark:text-blue-300'
        };
      case 'commit':
        return {
          icon: GitCommit,
          color: 'bg-green-500',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          textColor: 'text-green-700 dark:text-green-300'
        };
      case 'artifact':
        return {
          icon: FileText,
          color: 'bg-purple-500',
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          textColor: 'text-purple-700 dark:text-purple-300'
        };
      case 'collaboration':
        return {
          icon: Users,
          color: 'bg-orange-500',
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          textColor: 'text-orange-700 dark:text-orange-300'
        };
      case 'completion':
        return {
          icon: CheckCircle,
          color: 'bg-emerald-500',
          bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
          textColor: 'text-emerald-700 dark:text-emerald-300'
        };
      default:
        return {
          icon: Zap,
          color: 'bg-gray-500',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          textColor: 'text-gray-700 dark:text-gray-300'
        };
    }
  };

  const config = getActivityConfig(item.type);
  const Icon = config.icon;

  return (
    <motion.div
      className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      whileHover={{ x: 4 }}
    >
      <div className={`p-2 rounded-full ${config.color} flex-shrink-0`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
          {item.text}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">{item.time}</p>
          {item.agent && (
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${config.bgColor} ${config.textColor}`}>
              {item.agent}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const RealTimeActivityFeed = () => {
  const [activities, setActivities] = useState([]);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    const initialActivities = [
      { 
        id: 1,
        type: 'communication', 
        text: 'PM Agent sent project requirements to Architect Agent', 
        time: '2m ago',
        agent: 'PM Agent'
      },
      { 
        id: 2,
        type: 'commit', 
        text: 'Developer Agent pushed authentication module updates', 
        time: '5m ago',
        agent: 'Dev Agent'
      },
      { 
        id: 3,
        type: 'artifact', 
        text: 'Architect Agent generated API documentation', 
        time: '8m ago',
        agent: 'Architect'
      },
      { 
        id: 4,
        type: 'completion', 
        text: 'QA Agent completed security testing phase', 
        time: '12m ago',
        agent: 'QA Agent'
      },
      { 
        id: 5,
        type: 'collaboration', 
        text: 'Team sync: All agents aligned on sprint goals', 
        time: '15m ago',
        agent: 'System'
      }
    ];

    setActivities(initialActivities);

    // Simulate real-time updates
    const interval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance of new activity
        const newActivity = {
          id: Date.now(),
          type: ['communication', 'commit', 'artifact', 'collaboration'][Math.floor(Math.random() * 4)],
          text: [
            'Security Agent completed vulnerability scan',
            'DevOps Agent deployed to staging environment',
            'UX Expert shared wireframe updates',
            'Data Architect optimized query performance'
          ][Math.floor(Math.random() * 4)],
          time: 'Just now',
          agent: ['Security', 'DevOps', 'UX Expert', 'Data Architect'][Math.floor(Math.random() * 4)]
        };

        setActivities(prev => [newActivity, ...prev.slice(0, 4)]);
      }
    }, 8000); // New activity every 8 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2">
      {/* Live indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {isLive ? 'Live Activity' : 'Activity Paused'}
          </span>
        </div>
        <span className="text-xs text-gray-500">{activities.length} recent</span>
      </div>

      {/* Activity list */}
      <AnimatePresence mode="popLayout">
        {activities.map((activity, index) => (
          <ActivityItem key={activity.id} item={activity} index={index} />
        ))}
      </AnimatePresence>

      {activities.length === 0 && (
        <div className="text-center py-8">
          <Zap className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No recent activity</p>
        </div>
      )}
    </div>
  );
};

export default RealTimeActivityFeed;