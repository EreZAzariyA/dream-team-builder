'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Key, 
  User, 
  Palette, 
  Bell, 
  Shield, 
  Settings as SettingsIcon,
  ChevronRight
} from 'lucide-react';

const SettingsLayout = ({ children }) => {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'api-keys';
  
  const settingsCategories = [
    {
      id: 'api-keys',
      name: 'API Keys',
      description: 'AI provider configurations',
      icon: <Key className="w-5 h-5" />,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      priority: 'high'
    },
    {
      id: 'profile',
      name: 'Profile',
      description: 'Personal information',
      icon: <User className="w-5 h-5" />,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900',
      priority: 'medium'
    },
    {
      id: 'appearance',
      name: 'Appearance',
      description: 'Theme and display',
      icon: <Palette className="w-5 h-5" />,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900',
      priority: 'medium'
    },
    {
      id: 'notifications',
      name: 'Notifications',
      description: 'Email and push settings',
      icon: <Bell className="w-5 h-5" />,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900',
      priority: 'low'
    },
    {
      id: 'security',
      name: 'Security',
      description: 'Password and privacy',
      icon: <Shield className="w-5 h-5" />,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900',
      priority: 'high'
    },
    {
      id: 'advanced',
      name: 'Advanced',
      description: 'Developer settings',
      icon: <SettingsIcon className="w-5 h-5" />,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-900',
      priority: 'low'
    }
  ];

  const handleTabChange = (tabId) => {
    const url = new URL(window.location);
    url.searchParams.set('tab', tabId);
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account, preferences, and integrations
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-2">
              <nav className="space-y-1">
                {settingsCategories.map((category) => {
                  const isActive = currentTab === category.id;
                  
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleTabChange(category.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-lg transition-all duration-200 text-left group ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isActive ? category.bgColor : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          <span className={isActive ? category.color : 'text-gray-500 dark:text-gray-400'}>
                            {category.icon}
                          </span>
                        </div>
                        <div>
                          <h3 className={`font-medium ${
                            isActive 
                              ? 'text-blue-900 dark:text-blue-100' 
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {category.name}
                          </h3>
                          <p className={`text-sm ${
                            isActive 
                              ? 'text-blue-700 dark:text-blue-300' 
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {category.description}
                          </p>
                        </div>
                      </div>
                      
                      <ChevronRight className={`w-4 h-4 ${
                        isActive 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-gray-400 group-hover:text-gray-600'
                      }`} />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Quick Setup
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                Get started with essential configurations
              </p>
              <button 
                onClick={() => handleTabChange('api-keys')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Configure AI Providers
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsLayout;