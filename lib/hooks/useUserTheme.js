'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';

export function useUserTheme() {
  const { data: session, status } = useSession();
  const { setTheme } = useTheme();

  useEffect(() => {
    // Only load user theme preferences when authenticated
    if (status === 'authenticated' && session?.user) {
      loadUserThemePreference();
    }
  }, [status, session, setTheme]);

  const loadUserThemePreference = async () => {
    try {
      const response = await fetch('/api/user/preferences');
      
      if (response.ok) {
        const data = await response.json();
        const userTheme = data.preferences?.theme;
        
        if (userTheme && ['light', 'dark', 'system'].includes(userTheme)) {
          console.log('Loading user theme preference from DB:', userTheme);
          setTheme(userTheme);
        }
      }
    } catch (error) {
      console.error('Error loading user theme preference:', error);
    }
  };

  const saveThemeToDatabase = async (theme) => {
    if (!session?.user) return;

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme }),
      });

      if (response.ok) {
        console.log('Theme saved to database:', theme);
      } else {
        console.error('Failed to save theme to database');
      }
    } catch (error) {
      console.error('Error saving theme to database:', error);
    }
  };

  return {
    saveThemeToDatabase,
    isAuthenticated: status === 'authenticated'
  };
}