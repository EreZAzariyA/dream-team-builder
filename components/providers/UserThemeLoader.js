'use client';

import { useUserTheme } from '../../lib/hooks/useUserTheme';

export default function UserThemeLoader({ children }) {
  // This component automatically loads user theme preferences
  useUserTheme();
  
  return children;
}