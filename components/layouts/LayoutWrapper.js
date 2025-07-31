'use client';

import { usePathname } from 'next/navigation';
import DashboardLayout from './DashboardLayout';

const LayoutWrapper = ({ children }) => {
  const pathname = usePathname();
  
  // Pages that should NOT use the dashboard layout
  const excludedPaths = [
    '/auth/signin',
    '/auth/signup', 
    '/auth/error',
    '/auth/welcome',
    '/' // Landing page
  ];
  
  // Check if current path should be excluded from dashboard layout
  const shouldExclude = excludedPaths.some(path => pathname === path);
  
  // If excluded, render children directly
  if (shouldExclude) {
    return <>{children}</>;
  }
  
  // Otherwise, wrap with dashboard layout
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
};

export default LayoutWrapper;