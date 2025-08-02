'use client';

import { useSession } from 'next-auth/react';


const SettingsPage = () => {
  const { data: session } = useSession();
  const userRole = session?.user?.role || 'user';

  return (
    <div className="p-6">
        <h1 className="text-h1">Settings</h1>
        <p className="text-body">This is the shared Settings page.</p>
        {userRole === 'admin' ? (
          <p className="text-body-medium text-blue-600">You are an Admin. Admin-specific settings will appear here.</p>
        ) : (
          <p className="text-body-medium text-green-600">You are a regular user. User-specific settings will appear here.</p>
        )}
    </div>
  );
};

export default SettingsPage;