'use client';

import React, { useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Bell, UserCircle, Sun, Moon } from 'lucide-react';
import AIProviderStatus from '../system/AIProviderStatus';

// Page mapping (moved outside component to prevent recreation)
const PAGE_MAP = {
  '/dashboard': 'Dashboard',
  '/workflows': 'Workflows',
  '/agents': 'Agents',
  '/analytics': 'Analytics',
  '/monitoring': 'Monitoring',
  '/integrations': 'Integrations',
  '/docs': 'Documentation',
  '/settings': 'Settings'
};

// A placeholder for a theme toggle hook (memoized)
const useTheme = () => {
  const theme = 'dark';
  const setTheme = useCallback((newTheme) => {
    console.log(`Setting theme to ${newTheme}`);
  }, []);
  return { theme, setTheme };
};

const Header = () => {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  // Memoize page title calculation
  const pageTitle = useMemo(() => {
    return PAGE_MAP[pathname] || 'Dream Team';
  }, [pathname]);

  // Memoize theme toggle handler
  const handleThemeToggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      <div>
        <h2 className="text-h3 font-semibold text-professional">{pageTitle}</h2>
      </div>
      <div className="flex items-center space-x-4">
        {/* AI Provider Status Indicator */}
        <AIProviderStatus />
        
        <button onClick={handleThemeToggle} className="btn-ghost p-2 rounded-full">
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
  );
};

export default Header;
