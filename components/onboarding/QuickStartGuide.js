'use client';

import React, { useState } from 'react';

export default function QuickStartGuide({ onStartWorkflow, isCollapsed: initialCollapsed = false }) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [hoveredStep, setHoveredStep] = useState(null);

  const steps = [
    {
      id: 'choose-template',
      number: 1,
      icon: '📝',
      title: 'Choose Workflow Template',
      description: 'Pick from 5 proven workflows designed for common development tasks',
      examples: ['Full-Stack Development', 'API Documentation', 'Code Review', 'Project Planning'],
      color: 'blue',
      estimatedTime: '30 seconds'
    },
    {
      id: 'configure-agents',
      number: 2,
      icon: '⚡',
      title: 'Configure Agents',
      description: 'Select which AI agents will work on your project',
      examples: ['PM (Planning)', 'Architect (Design)', 'Developer (Code)', 'QA (Testing)'],
      color: 'purple',
      estimatedTime: '1 minute'
    },
    {
      id: 'launch-workflow',
      number: 3,
      icon: '🎯',
      title: 'Launch Workflow',
      description: 'Describe your project and watch our agents collaborate',
      examples: ['Natural language prompts', 'Project requirements', 'Technical specifications'],
      color: 'green',
      estimatedTime: '15-30 minutes'
    }
  ];

  const getStepColors = (color) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        icon: 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400',
        number: 'bg-blue-600 text-white',
        text: 'text-blue-600 dark:text-blue-400'
      },
      purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-200 dark:border-purple-800',
        icon: 'bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-400',
        number: 'bg-purple-600 text-white',
        text: 'text-purple-600 dark:text-purple-400'
      },
      green: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-800',
        icon: 'bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-400',
        number: 'bg-green-600 text-white',
        text: 'text-green-600 dark:text-green-400'
      }
    };
    return colors[color];
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden quick-start-guide">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-xl">
              🚀
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Create your first BMAD workflow in 3 simple steps
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Get started with AI-powered development in under 5 minutes
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-white hover:bg-opacity-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label={isCollapsed ? 'Expand guide' : 'Collapse guide'}
          >
            <svg 
              className={`w-5 h-5 text-gray-600 dark:text-gray-400 transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`transition-all duration-300 overflow-hidden ${isCollapsed ? 'max-h-0' : 'max-h-96'}`}>
        <div className="p-6">
          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {steps.map((step, index) => {
              const colors = getStepColors(step.color);
              const isHovered = hoveredStep === step.id;
              
              return (
                <div
                  key={step.id}
                  className={`relative p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer transform ${
                    isHovered ? 'scale-105 shadow-lg' : 'hover:scale-102'
                  } ${colors.bg} ${colors.border}`}
                  onMouseEnter={() => setHoveredStep(step.id)}
                  onMouseLeave={() => setHoveredStep(null)}
                >
                  {/* Connection Line */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-gray-300 dark:bg-gray-600 z-10" />
                  )}
                  
                  {/* Step Number */}
                  <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${colors.number}`}>
                    {step.number}
                  </div>
                  
                  {/* Step Icon */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-3 ${colors.icon}`}>
                    {step.icon}
                  </div>
                  
                  {/* Step Content */}
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {step.description}
                  </p>
                  
                  {/* Examples */}
                  <div className="space-y-1">
                    {step.examples.slice(0, isHovered ? step.examples.length : 2).map((example, idx) => (
                      <div key={idx} className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <div className="w-1 h-1 bg-gray-400 rounded-full mr-2" />
                        {example}
                      </div>
                    ))}
                  </div>
                  
                  {/* Estimated Time */}
                  <div className={`mt-3 text-xs font-medium ${colors.text}`}>
                    ⏱️ {step.estimatedTime}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Benefits Section */}
          <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center">
              <span className="mr-2">✨</span>
              What you&apos;ll get:
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center text-yellow-800 dark:text-yellow-200">
                <span className="mr-2">📄</span>
                Generated docs
              </div>
              <div className="flex items-center text-yellow-800 dark:text-yellow-200">
                <span className="mr-2">💻</span>
                Starter code
              </div>
              <div className="flex items-center text-yellow-800 dark:text-yellow-200">
                <span className="mr-2">🧪</span>
                Test plans
              </div>
              <div className="flex items-center text-yellow-800 dark:text-yellow-200">
                <span className="mr-2">🎨</span>
                UI designs
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="text-center">
            <button
              onClick={onStartWorkflow}
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <span className="mr-3 text-xl">🚀</span>
              <span>Start Your First Workflow</span>
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No credit card required • Free to start • 5-minute setup
            </p>
          </div>

          {/* Quick Links */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-center space-x-6 text-sm">
              <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center">
                <span className="mr-1">📹</span>
                Watch demo
              </button>
              <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center">
                <span className="mr-1">📚</span>
                View examples
              </button>
              <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center">
                <span className="mr-1">❓</span>
                Get help
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}