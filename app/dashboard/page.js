'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { LayoutDashboard, Workflow, Users, Settings, BarChart, LogOut, Bell, UserCircle, Sun, Moon } from 'lucide-react';
import SystemMetrics from '../../components/dashboard/SystemMetrics';
import AgentStatusGrid from '../../components/dashboard/AgentStatusGrid';
import ActiveWorkflows from '../../components/dashboard/ActiveWorkflows';
import RealTimeActivityFeed from '../../components/dashboard/RealTimeActivityFeed';

// A placeholder for a theme toggle hook
const useTheme = () => {
  // In a real app, this would come from a theme provider
  const theme = 'dark';
  const setTheme = (newTheme) => console.log(`Setting theme to ${newTheme}`);
  return { theme, setTheme };
};

const DashboardPage = () => {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '#', type: 'link' },
    { icon: Workflow, label: 'Workflows', href: '#', type: 'link' },
    { icon: Users, label: 'Agents', href: '#', type: 'link' },
    { icon: BarChart, label: 'Analytics', href: '#', type: 'link' },
    { icon: Settings, label: 'Settings', href: '#', type: 'link' },
    { icon: LogOut, label: 'Sign Out', onClick: () => signOut(), type: 'button' },
  ];

  // Base classes for navigation links
  const navLinkClasses = "flex items-center space-x-3 px-4 py-2 rounded-md text-body font-medium transition-colors";
  const activeNavLinkClasses = "bg-primary-50 text-primary-600 dark:bg-primary-500/20 dark:text-primary-300";
  const inactiveNavLinkClasses = "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white";


  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-professional">
      {/* Left Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 px-4">
          <h1 className="text-h3 font-semibold text-primary dark:text-primary-400">Dream Team</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map(item => {
            if (item.type === 'button') {
              return (
                <button key={item.label} onClick={item.onClick} className={`${navLinkClasses} ${inactiveNavLinkClasses} w-full`}>
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            }
            return (
              <Link key={item.label} href={item.href} className={`${navLinkClasses} ${item.label === 'Dashboard' ? activeNavLinkClasses : inactiveNavLinkClasses}`}>
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
          <div>
            <h2 className="text-h3 font-semibold text-professional">Dashboard</h2>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="btn-ghost p-2 rounded-full">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button className="btn-ghost p-2 rounded-full">
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <UserCircle className="w-8 h-8 text-gray-400" />
              <div>
                <p className="text-body-small font-medium text-professional">{session?.user?.name}</p>
                <p className="text-caption text-professional-muted">{session?.user?.email}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-h4 font-semibold mb-4">System Metrics</h3>
              <SystemMetrics />
            </div>
            <div>
              <h3 className="text-h4 font-semibold mb-4">Agent Status</h3>
              <AgentStatusGrid />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <h3 className="text-h4 font-semibold mb-4">Active Workflows</h3>
                <ActiveWorkflows />
              </div>
              <div>
                <h3 className="text-h4 font-semibold mb-4">Real-time Activity</h3>
                <RealTimeActivityFeed />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;