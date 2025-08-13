'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import * as LucideIcons from 'lucide-react';
import { ADMIN_NAV_ITEMS } from '../../lib/constants/admin';
import { USER_NAV_ITEMS } from '../../lib/constants/user';

const getIconComponent = (iconName) => {
  const IconComponent = LucideIcons[iconName];
  return IconComponent || LucideIcons.HelpCircle; // Fallback icon
};

// Base classes for navigation links
const navLinkClasses = "flex items-center space-x-3 px-4 py-2 rounded-md text-body font-medium transition-colors";
const activeNavLinkClasses = "bg-primary-50 text-primary-600 dark:bg-primary-500/20 dark:text-primary-300";
const inactiveNavLinkClasses = "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white";

const Sidebar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userRole = session?.user?.role || 'user'; // Assuming a 'role' field in your session user object

  const currentNavItems = userRole === 'admin' 
    ? Object.values(ADMIN_NAV_ITEMS) 
    : Object.values(USER_NAV_ITEMS);

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 px-4">
        <h1 className="text-h3 font-semibold text-primary dark:text-primary-400">Dream Team</h1>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {currentNavItems.map(item => {
          const IconComponent = getIconComponent(item.icon);
          const isActive = pathname === item.path;
          return (
            <Link key={item.label} href={item.path} className={`${navLinkClasses} ${isActive ? activeNavLinkClasses : inactiveNavLinkClasses}`}>
              <IconComponent className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-6 border-t border-gray-200 dark:border-gray-700">
        {/* Sign Out Button */}
        <button onClick={() => signOut({ callbackUrl: '/auth/signin' })} className={`flex items-center space-x-3 px-4 py-1 rounded-md text-body font-medium transition-colors ${inactiveNavLinkClasses} w-full`}>
          <LucideIcons.LogOut className="w-5 h-5 flex-shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;