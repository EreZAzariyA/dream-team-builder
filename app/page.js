'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

export default function DashboardRedirect() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return; // Do nothing while session is loading

    if (session) {
      const userRole = session.user?.role || 'user';
      if (userRole === 'admin') {
        router.replace('/admin/dashboard');
      } else {
        // Redirect regular users to their main dashboard page
        // Assuming /workflows-new is a good default for regular users
        router.replace('/workflows-new'); 
      }
    } else {
      // If not authenticated, redirect to sign-in page
      router.replace('/auth/signin');
    }
  }, [session, status, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
      </div>
    </div>
  );
}
