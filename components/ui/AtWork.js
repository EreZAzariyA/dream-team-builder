'use client';

import React from 'react';
import { Wrench, Zap, Clock, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const AtWork = ({ 
  title = "We're Working on Something Amazing", 
  subtitle = "This feature is currently under development",
  showBackButton = true 
}) => {
  const router = useRouter();

  const handleGoBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
      <div className="max-w-2xl mx-auto text-center">
        {/* Animated Icon */}
        <div className="relative mb-8 h-32 w-32 mx-auto">
          <div className="absolute inset-0 animate-ping">
            <div className="w-32 h-32 mx-auto bg-blue-100 dark:bg-blue-900 rounded-full opacity-20"></div>
          </div>
          <div className="relative w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-xl overflow-hidden">
            <Wrench className="w-16 h-16 text-white animate-bounce" />
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6 mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            {title}
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-lg mx-auto">
            {subtitle}
          </p>

          {/* Feature Highlights */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Enhanced Performance
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Optimizing for lightning-fast agent collaboration
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Real-time Updates
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Live workflow monitoring and instant notifications
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Wrench className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Advanced Tools
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                New agent capabilities and workflow templates
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {showBackButton && (
            <button
              onClick={handleGoBack}
              className="inline-flex items-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Go Back
            </button>
          )}
          
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Return to Dashboard
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Development Progress
          </p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            75% Complete - Coming Soon!
          </p>
        </div>
      </div>
    </div>
  );
};

export default AtWork;