'use client';

import {
  FolderOpen,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  Search
} from 'lucide-react';
import NavigationCard from '../components/NavigationCard';

/**
 * Clean navigation section
 * Replaces the old GitHub launcher overlay
 *
 * @param {Object} data - Dashboard data passed from parent
 */
const QuickNavigation = ({ data = {} }) => {
  const { activeProjects = 0, agentTeams = 0, loading = false } = data;

  const navigationItems = [
    {
      icon: FolderOpen,
      title: 'Repository Workflows',
      description: 'Analyze repos and run AI workflows',
      href: '/repo-explorer',
      color: 'blue',
      count: loading ? null : activeProjects
    },
    {
      icon: Users,
      title: 'Agent Teams',
      description: 'Deploy and manage agent teams',
      href: '/agent-teams',
      color: 'purple',
      count: loading ? null : agentTeams
    },
    {
      icon: MessageSquare,
      title: 'Agent Chat',
      description: 'Direct conversations with agents',
      href: '/agent-chat',
      color: 'green'
    },
    {
      icon: BarChart3,
      title: 'Analytics',
      description: 'System insights and performance',
      href: '/analytics',
      color: 'orange'
    }
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quick Actions</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Choose your workflow</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {navigationItems.map((item, index) => (
          <NavigationCard
            key={item.href}
            icon={item.icon}
            title={item.title}
            description={item.description}
            href={item.href}
            color={item.color}
            count={item.count}
            isActive={item.count > 0}
          />
        ))}
      </div>
    </section>
  );
};

export default QuickNavigation;