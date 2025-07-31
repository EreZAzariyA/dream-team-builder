'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { LayoutDashboard, Workflow, Bot, BarChart, Plug, BookOpen, User, MessageSquare, Activity, LogOut } from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', type: 'link' },
  { icon: Workflow, label: 'Workflows', href: '/workflows', type: 'link' },
  { icon: Bot, label: 'Agents', href: '/agents', type: 'link' },
  { icon: MessageSquare, label: 'Chat', href: '/chat', type: 'link' },
  { icon: BarChart, label: 'Analytics', href: '/analytics', type: 'link' },
  { icon: Activity, label: 'Monitoring', href: '/monitoring', type: 'link' },
  { icon: Plug, label: 'Integrations', href: '/integrations', type: 'link' },
  { icon: BookOpen, label: 'Docs', href: '/docs', type: 'link' },
  { icon: User, label: 'Profile', href: '/profile', type: 'link' },
  { icon: LogOut, label: 'Sign Out', onClick: () => signOut({ callbackUrl: '/auth/signin' }), type: 'button' },
];

// Base classes for navigation links
const navLinkClasses = "flex items-center space-x-3 px-4 py-2 rounded-md text-body font-medium transition-colors";
const activeNavLinkClasses = "bg-primary-50 text-primary-600 dark:bg-primary-500/20 dark:text-primary-300";
const inactiveNavLinkClasses = "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white";

const Sidebar = () => {
  const pathname = usePathname();

  return (
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
          const isActive = pathname === item.href;
          return (
            <Link key={item.label} href={item.href} className={`${navLinkClasses} ${isActive ? activeNavLinkClasses : inactiveNavLinkClasses}`}>
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
