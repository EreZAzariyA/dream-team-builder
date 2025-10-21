'use client';

import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import QuickNavigation from '../../../components/dashboard/sections/QuickNavigation';
import SystemOverview from '../../../components/dashboard/sections/SystemOverview';
import ActiveProjects from '../../../components/dashboard/sections/ActiveProjects';
import AgentStatus from '../../../components/dashboard/sections/AgentStatus';
import { useDashboardData } from '../../../components/dashboard/hooks/useDashboardData';

/**
 * Clean, modular dashboard page
 * Real data integration with modern UI components
 *
 * NOTE: useDashboardData is called ONCE here to avoid duplicate API calls
 * Data is passed down as props to child components
 */
const DashboardPage = () => {
  const { data: session } = useSession();

  // Fetch dashboard data ONCE at the parent level
  const dashboardData = useDashboardData();

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <motion.section
        className="space-y-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {getGreeting()}, {session?.user?.name?.split(' ')[0] || 'there'}! 👋
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Welcome to your BMAD Command Center
        </p>
      </motion.section>

      {/* Quick Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <QuickNavigation data={dashboardData} />
      </motion.div>

      {/* System Overview */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <SystemOverview data={dashboardData} />
      </motion.div>

      {/* Active Projects */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <ActiveProjects />
      </motion.div>

      {/* Agent Status */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <AgentStatus />
      </motion.div>
    </div>
  );
};

export default DashboardPage;