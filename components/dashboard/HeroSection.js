'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Rocket, 
  Play, 
  FileText, 
  Users, 
  Zap, 
  Clock,
  TrendingUp,
  Brain
} from 'lucide-react';
import { motion } from 'framer-motion';

const QuickActionCard = ({ icon: Icon, title, description, action, color, onClick }) => (
  <motion.div
    className={`bg-gradient-to-br ${color} p-4 rounded-xl cursor-pointer group hover:shadow-lg transition-all duration-300`}
    whileHover={{ scale: 1.02, y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-2">
      <Icon className="w-6 h-6 text-white group-hover:scale-110 transition-transform duration-300" />
      <span className="text-xs bg-white bg-opacity-20 text-white px-2 py-1 rounded-full">
        {action}
      </span>
    </div>
    <h3 className="text-base font-bold text-white mb-1">{title}</h3>
    <p className="text-xs text-white text-opacity-90">{description}</p>
  </motion.div>
);

const ContextCard = ({ icon: Icon, label, value, trend, color }) => (
  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div className={`p-1.5 rounded-full ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
      {trend && (
        <div className={`flex items-center space-x-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          <TrendingUp className={`w-3 h-3 ${trend > 0 ? '' : 'rotate-180'}`} />
          <span className="text-xs font-medium">{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
  </div>
);

const HeroSection = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [greeting, setGreeting] = useState('');
  const [contextData, setContextData] = useState({
    activeProjects: 0,
    agentsWorking: 0,
    completionRate: 0,
    avgResponseTime: '0s'
  });

  useEffect(() => {
    // Set dynamic greeting based on time
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    // Mock context data - in real app, fetch from API
    setContextData({
      activeProjects: Math.floor(Math.random() * 5) + 1,
      agentsWorking: Math.floor(Math.random() * 8) + 2,
      completionRate: Math.floor(Math.random() * 20) + 85,
      avgResponseTime: `${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 9)}s`
    });
  }, []);

  const quickActions = [
    {
      icon: Rocket,
      title: 'Start New Project',
      description: 'Launch a BMAD workflow with AI agents',
      action: 'Create',
      color: 'from-blue-500 to-purple-600',
      onClick: () => router.push('/agent-teams?mode=new')
    },
    {
      icon: Play,
      title: 'Resume Work',
      description: 'Continue your active projects',
      action: 'Resume',
      color: 'from-green-500 to-emerald-600',
      onClick: () => router.push('/agent-teams')
    },
    {
      icon: FileText,
      title: 'Browse Templates',
      description: 'Explore pre-built project workflows',
      action: 'Explore',
      color: 'from-orange-500 to-red-500',
      onClick: () => router.push('/agent-teams?tab=templates')
    },
    {
      icon: Users,
      title: 'Agent Chat',
      description: 'Collaborate directly with AI agents',
      action: 'Chat',
      color: 'from-indigo-500 to-blue-600',
      onClick: () => router.push('/agent-chat')
    }
  ];

  const contextCards = [
    {
      icon: Rocket,
      label: 'Active Projects',
      value: contextData.activeProjects,
      trend: Math.random() > 0.5 ? Math.floor(Math.random() * 15) + 5 : -(Math.floor(Math.random() * 10) + 2),
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
    },
    {
      icon: Brain,
      label: 'Agents Working',
      value: contextData.agentsWorking,
      trend: Math.random() > 0.3 ? Math.floor(Math.random() * 20) + 10 : -(Math.floor(Math.random() * 5) + 1),
      color: 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'
    },
    {
      icon: TrendingUp,
      label: 'Success Rate',
      value: `${contextData.completionRate}%`,
      trend: Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 2 : -(Math.floor(Math.random() * 3) + 1),
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400'
    },
    {
      icon: Zap,
      label: 'Avg Response',
      value: contextData.avgResponseTime,
      trend: Math.random() > 0.4 ? -(Math.floor(Math.random() * 10) + 5) : Math.floor(Math.random() * 8) + 3,
      color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400'
    }
  ];

  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Welcome Header */}
      <div className="mb-4">
        <motion.h1 
          className="text-2xl font-bold text-gray-900 dark:text-white mb-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          {greeting}, {session?.user?.name || 'Developer'}! 👋
        </motion.h1>
        <motion.p 
          className="text-sm text-gray-600 dark:text-gray-400"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          Ready to build something amazing with your AI agent team?
        </motion.p>
      </div>

      {/* Context Cards */}
      <motion.div 
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {contextCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
          >
            <ContextCard {...card} />
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
            >
              <QuickActionCard {...action} />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default HeroSection;