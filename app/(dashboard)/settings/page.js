'use client';

import { useSearchParams } from 'next/navigation';
import SettingsLayout from '../../../components/settings/SettingsLayout';
import ApiKeysSettings from '../../../components/settings/ApiKeysSettings';
import ProfileSettings from '../../../components/settings/ProfileSettings';

const SettingsPage = () => {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'api-keys';

  const renderSettingsContent = () => {
    switch (currentTab) {
      case 'api-keys':
        return <ApiKeysSettings />;
      case 'profile':
        return <ProfileSettings />;
      case 'appearance':
        return (
          <div className="p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Appearance Settings
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Theme and display customization coming soon
              </p>
              <div className="w-16 h-16 mx-auto bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                <span className="text-2xl">🎨</span>
              </div>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Notification Settings
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Email and push notification preferences coming soon
              </p>
              <div className="w-16 h-16 mx-auto bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                <span className="text-2xl">🔔</span>
              </div>
            </div>
          </div>
        );
      case 'security':
        return (
          <div className="p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Security Settings
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Password and privacy settings coming soon
              </p>
              <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <span className="text-2xl">🔒</span>
              </div>
            </div>
          </div>
        );
      case 'advanced':
        return (
          <div className="p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Advanced Settings
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Developer and experimental features coming soon
              </p>
              <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚙️</span>
              </div>
            </div>
          </div>
        );
      default:
        return <ApiKeysSettings />;
    }
  };

  return (
    <SettingsLayout>
      {renderSettingsContent()}
    </SettingsLayout>
  );
};

export default SettingsPage;