'use client';

import React, { useState, useEffect } from 'react';

export default function OnboardingTour({ isActive, onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const bmadTourSteps = [
    {
      id: 'bmad-overview',
      title: '🎯 Welcome to BMAD Method',
      content: 'BMAD (Breakthrough Method for Agile AI-Driven Development) follows a proven two-phase approach: Strategic Planning in Web UI, then Implementation in your IDE.',
      target: '.dashboard-main',
      position: 'bottom',
      phase: 'Introduction'
    },
    {
      id: 'phase-1-planning',
      title: '📋 Phase 1: Strategic Planning',
      content: 'Start here in the Web UI to work with Analyst, PM, and Architect agents. Create your Project Brief, PRD, and Architecture documents before any coding begins.',
      target: '.workflow-templates, .quick-start-guide',
      position: 'top',
      phase: 'Planning'
    },
    {
      id: 'project-description',
      title: '📝 Describe Your Project',
      content: 'BMAD requires project descriptions before workflow execution. The Analyst agent will help you define scope, requirements, and technical constraints.',
      target: '.chat-interface, .workflow-initiator',
      position: 'left',
      phase: 'Planning'
    },
    {
      id: 'agent-collaboration',
      title: '🤝 Multi-Agent Workflow',
      content: 'Watch as specialized agents collaborate: Analyst → PM → Architect → PO. Each agent builds on the previous work, ensuring comprehensive planning.',
      target: '.monitoring-link, .system-health',
      position: 'right',
      phase: 'Planning'
    },
    {
      id: 'document-validation',
      title: '✅ Document Validation',
      content: 'The PO (Product Owner) agent validates all planning documents for completeness and integration safety before moving to development phase.',
      target: '.workflow-progress',
      position: 'bottom',
      phase: 'Planning'
    },
    {
      id: 'phase-2-development',
      title: '⚒️ Phase 2: IDE Development',
      content: 'After planning is complete, you\'ll move to your IDE (like Cursor) where SM, Dev, and QA agents handle story creation, coding, and quality assurance.',
      target: '.integrations-link',
      position: 'bottom',
      phase: 'Development'
    },
    {
      id: 'structured-approach',
      title: '🏗️ Why This Structure Works',
      content: 'BMAD\'s two-phase approach prevents common issues: incomplete requirements, technical debt, and scope creep. Plan thoroughly, then execute with confidence.',
      target: '.dashboard-main',
      position: 'center',
      phase: 'Methodology'
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

  const tourSteps = bmadTourSteps; // Use BMAD tour steps
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
          {/* Phase indicator */}
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-3 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {currentStepData.phase} Phase
          </div>
          
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
            <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm">BMAD Tip</h4>
            <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
              {currentStep === 0 && "BMAD prevents 80% of common development issues through structured planning"}
              {currentStep === 1 && "Never skip to coding - proper planning saves weeks of rework"}
              {currentStep === 2 && "Always provide detailed project context for better agent collaboration"}
              {currentStep === 3 && "Each agent builds on previous work - watch the handoff messages"}
              {currentStep === 4 && "PO validation catches integration issues before development starts"}
              {currentStep === 5 && "IDE phase uses your planning documents to generate precise stories"}
              {currentStep === 6 && "This methodology scales from solo projects to enterprise teams"}
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