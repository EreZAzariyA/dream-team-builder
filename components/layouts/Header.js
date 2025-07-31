'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Bell, UserCircle, Sun, Moon } from 'lucide-react';

// A placeholder for a theme toggle hook
const useTheme = () => {
  // In a real app, this would come from a theme provider
  const theme = 'dark';
  const setTheme = (newTheme) => console.log(`Setting theme to ${newTheme}`);
  return { theme, setTheme };
};

const Header = () => {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  const getPageTitle = () => {
    const pageMap = {
      '/dashboard': 'Dashboard',
      '/workflows': 'Workflows',
      '/agents': 'Agents',
      '/analytics': 'Analytics',
      '/integrations': 'Integrations',
      '/docs': 'Documentation',
      '/settings': 'Settings'
    };
    return pageMap[pathname] || 'Dream Team';
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      <div>
        <h2 className="text-h3 font-semibold text-professional">{getPageTitle()}</h2>
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
  );
};

export default Header;
