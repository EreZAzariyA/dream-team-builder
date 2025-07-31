'use client';

import { useState } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import WorkflowLauncherModal from '../onboarding/WorkflowLauncherModal';

const FloatingActionButton = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleSelectTemplate = (template) => {
    console.log('Selected template:', template);
    setShowModal(false);
    setIsExpanded(false);
    // TODO: Navigate to workflow creation or start workflow
  };

  const handleStartFromScratch = () => {
    console.log('Starting from scratch');
    setShowModal(false);
    setIsExpanded(false);
    // TODO: Navigate to custom workflow creation
  };

  const quickActions = [
    {
      id: 'templates',
      label: 'Browse Templates',
      icon: Sparkles,
      color: 'bg-gradient-to-r from-blue-500 to-purple-600',
      hoverColor: 'hover:from-blue-600 hover:to-purple-700',
      onClick: () => setShowModal(true)
    },
    {
      id: 'scratch',
      label: 'Start from Scratch',
      icon: Plus,
      color: 'bg-gradient-to-r from-green-500 to-blue-500',
      hoverColor: 'hover:from-green-600 hover:to-blue-600',
      onClick: handleStartFromScratch
    }
  ];

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        {/* Quick Action Buttons */}
        <div className={`mb-4 space-y-3 transition-all duration-300 ${
          isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          {quickActions.map((action, index) => {
            const IconComponent = action.icon;
            return (
              <div
                key={action.id}
                className={`flex items-center justify-end transition-all duration-300 delay-${index * 50}`}
                style={{ transitionDelay: `${index * 50}ms` }}
              >
                <div className="mr-3 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {action.label}
                  </span>
                </div>
                <button
                  onClick={action.onClick}
                  className={`w-12 h-12 ${action.color} ${action.hoverColor} rounded-full shadow-lg text-white flex items-center justify-center transition-all duration-200 transform hover:scale-110 active:scale-95`}
                >
                  <IconComponent className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Main FAB */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-full shadow-xl text-white flex items-center justify-center transition-all duration-300 transform ${
            isExpanded ? 'rotate-45 scale-110' : 'hover:scale-110'
          } active:scale-95`}
        >
          {isExpanded ? (
            <X className="w-6 h-6" />
          ) : (
            <Plus className="w-6 h-6" />
          )}
        </button>

        {/* Backdrop */}
        {isExpanded && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm -z-10"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </div>

      {/* Workflow Launcher Modal */}
      <WorkflowLauncherModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setIsExpanded(false);
        }}
        onSelectTemplate={handleSelectTemplate}
        onStartFromScratch={handleStartFromScratch}
      />
    </>
  );
};

export default FloatingActionButton;