'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';

// Global state to prevent multiple loads
let isThemeLoaded = false;
let loadPromise = null;

export function useUserTheme() {
  const { data: session, status } = useSession();
  const { setTheme } = useTheme();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Only load user theme preferences when authenticated and not already loaded
    if (status === 'authenticated' && session?.user && !isThemeLoaded && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      isThemeLoaded = true;
      loadUserThemePreference();
    }
  }, [status, session]);

  const loadUserThemePreference = async () => {
    // Prevent multiple simultaneous loads
    if (loadPromise) {
      return loadPromise;
    }

    loadPromise = (async () => {
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
        // Reset on error so it can be retried
        isThemeLoaded = false;
        hasLoadedRef.current = false;
      } finally {
        loadPromise = null;
      }
    })();

    return loadPromise;
  };

  const saveThemeToDatabase = useCallback(async (theme) => {
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
  }, [session?.user]);

  return {
    saveThemeToDatabase,
    isAuthenticated: status === 'authenticated'
  };
}

// Standalone function for components that only need to save theme
export function useSaveTheme() {
  const { data: session } = useSession();

  const saveThemeToDatabase = useCallback(async (theme) => {
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
  }, [session?.user]);

  return { saveThemeToDatabase };
}