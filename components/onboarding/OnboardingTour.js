'use client';

import React, { useState, useEffect } from 'react';

export default function OnboardingTour({ isActive, onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const tourSteps = [
    {
      id: 'dashboard-overview',
      title: '🏠 Your Mission Control Center',
      content: 'This is your dashboard - your central hub for managing AI workflows, monitoring system health, and accessing all Dream Team features.',
      target: '.dashboard-main',
      position: 'bottom'
    },
    {
      id: 'bmad-chat',
      title: '💬 Where the Magic Happens',
      content: 'The BMAD chat interface is where you interact with AI agents. Simply describe your project and watch specialized agents collaborate to build it.',
      target: '.chat-interface, .workflow-initiator',
      position: 'left'
    },
    {
      id: 'workflow-templates',
      title: '📋 Pre-built Workflows',
      content: 'Access proven workflow templates for common tasks like full-stack development, API documentation, and code reviews.',
      target: '.workflow-templates, .quick-start-guide',
      position: 'top'
    },
    {
      id: 'real-time-monitoring',
      title: '📊 Watch Your Agents Work',
      content: 'Monitor your workflows in real-time, see which agents are active, and track progress as documents and code are generated.',
      target: '.monitoring-link, .system-health',
      position: 'right'
    },
    {
      id: 'integrations-hub',
      title: '🔗 Connect Your Tools',
      content: 'Integrate with GitHub, Slack, JIRA, and other tools to automatically share workflow results and keep your team in sync.',
      target: '.integrations-link',
      position: 'bottom'
    }
  ];

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
      // Focus management for accessibility
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isActive]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(onSkip, 300);
  };

  const currentStepData = tourSteps[currentStep];

  if (!isActive || !isVisible) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-75 backdrop-blur-sm" />
      
      {/* Spotlight effect - highlights the target element */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute bg-white bg-opacity-10 rounded-lg shadow-2xl"
          style={{
            // This would be dynamically positioned based on the target element
            // For now, we'll show a generic spotlight
            top: '20%',
            left: '20%',
            right: '20%',
            height: '300px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)'
          }}
        />
      </div>

      {/* Tour Step Card */}
      <div className="absolute z-10 max-w-md p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl transform transition-all duration-300"
           style={{
             // Position would be calculated based on target element and preferred position
             top: '50%',
             left: '50%',
             transform: 'translate(-50%, -50%)'
           }}>
        
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Step {currentStep + 1} of {tourSteps.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Skip tour
            </button>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            {currentStepData.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            {currentStepData.content}
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            ← Previous
          </button>

          <div className="flex space-x-2">
            {tourSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep 
                    ? 'bg-blue-600' 
                    : index < currentStep 
                      ? 'bg-green-500' 
                      : 'bg-gray-300 dark:bg-gray-600'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
          >
            {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next →'}
          </button>
        </div>
      </div>

      {/* Floating Tips */}
      <div className="absolute bottom-6 left-6 max-w-xs p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start space-x-2">
          <div className="text-blue-600 dark:text-blue-400">💡</div>
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm">Pro Tip</h4>
            <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
              {currentStep === 0 && "You can always return to this dashboard from anywhere in the app"}
              {currentStep === 1 && "Try starting with 'Create a full-stack application' to see all agents in action"}
              {currentStep === 2 && "Workflow templates save time and ensure best practices"}
              {currentStep === 3 && "Real-time monitoring helps you understand what each agent is doing"}
              {currentStep === 4 && "Integrations keep your team automatically updated on progress"}
            </p>
          </div>
        </div>
      </div>

      {/* Keyboard Navigation Hint */}
      <div className="absolute bottom-6 right-6 text-xs text-gray-400 dark:text-gray-500">
        <div className="flex items-center space-x-4">
          <span>Use ← → arrow keys to navigate</span>
          <span>Press ESC to skip</span>
        </div>
      </div>
    </div>
  );
}

// Hook for keyboard navigation
export function useOnboardingTourKeyboard(isActive, onNext, onPrevious, onSkip) {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event) => {
      switch (event.key) {
        case 'ArrowRight':
        case ' ':
          event.preventDefault();
          onNext();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          onPrevious();
          break;
        case 'Escape':
          event.preventDefault();
          onSkip();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onNext, onPrevious, onSkip]);
}