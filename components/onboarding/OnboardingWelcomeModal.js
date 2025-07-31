'use client';

import React, { useState, useEffect } from 'react';

export default function OnboardingWelcomeModal({ onClose, onStartTour, onQuickStart }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate modal entrance
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation
  };

  const handleStartTour = () => {
    setIsVisible(false);
    setTimeout(onStartTour, 300);
  };

  const handleQuickStart = () => {
    setIsVisible(false);
    setTimeout(onQuickStart, 300);
  };

  const features = [
    {
      icon: '🤖',
      title: 'AI Agent Collaboration',
      description: 'Watch specialized agents work together on your projects'
    },
    {
      icon: '📋',
      title: 'Workflow Templates',
      description: 'Pre-built workflows for common development tasks'
    },
    {
      icon: '⚡',
      title: 'Real-time Execution',
      description: 'See your documentation and code generated live'
    },
    {
      icon: '🔗',
      title: 'Seamless Integrations',
      description: 'Connect with GitHub, Slack, JIRA, and more'
    }
  ];

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
      isVisible ? 'bg-black bg-opacity-50 backdrop-blur-sm' : 'bg-transparent'
    }`}>
      <div className={`relative w-full max-w-4xl mx-4 transform transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'
      }`}>
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="relative px-8 py-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors"
              aria-label="Close welcome modal"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-3xl">
                🚀
              </div>
              <div>
                <h1 className="text-3xl font-bold">Welcome to Dream Team!</h1>
                <p className="text-blue-100 mt-1">Your AI-powered documentation assistant with autonomous agent workflows</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                What makes Dream Team special?
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    <div className="text-2xl flex-shrink-0">{feature.icon}</div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{feature.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Section */}
            <div className="mb-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">10+</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Specialized Agents</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">5+</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Workflow Templates</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">3+</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Platform Integrations</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleStartTour}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
              >
                <span className="flex items-center justify-center space-x-2">
                  <span>🎯</span>
                  <span>Take the 2-minute tour</span>
                </span>
              </button>
              
              <button
                onClick={handleQuickStart}
                className="px-8 py-3 border-2 border-blue-600 text-blue-600 dark:text-blue-400 font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transform hover:scale-105 transition-all duration-200"
              >
                <span className="flex items-center justify-center space-x-2">
                  <span>⚡</span>
                  <span>Jump to Quick Start</span>
                </span>
              </button>
            </div>

            <div className="text-center mt-4">
              <button
                onClick={handleClose}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}