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

  const bmadFeatures = [
    {
      icon: '📋',
      title: 'Project Brief & Requirements',
      description: 'Work with the Analyst agent to define your project scope and create comprehensive PRDs'
    },
    {
      icon: '🏗️',
      title: 'Architecture Planning',
      description: 'Collaborate with the Architect agent to design robust system architecture'
    },
    {
      icon: '⚡',
      title: 'Two-Phase Development',
      description: 'Web UI for strategic planning, then IDE integration for hands-on development'
    },
    {
      icon: '🔄',
      title: 'Agent Orchestration',
      description: 'PM, Dev, QA, and specialized agents work together following BMAD methodology'
    }
  ];

  const bmadPhases = [
    {
      phase: 'Planning Phase',
      description: 'Work with agents to create Project Brief, PRD, and Architecture documents',
      icon: '🎯',
      color: 'from-blue-500 to-purple-500'
    },
    {
      phase: 'Development Phase',
      description: 'Move to IDE for story creation, coding, and quality assurance',
      icon: '⚒️',
      color: 'from-green-500 to-teal-500'
    }
  ];

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
      isVisible ? 'bg-gray-900 bg-opacity-20 dark:bg-black dark:bg-opacity-30 backdrop-blur-sm' : 'bg-transparent'
    }`}>
      <div className={`relative w-full max-w-2xl mx-4 h-[80vh] transform transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'
      }`}>
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full">
          {/* Header */}
          <div className="relative px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white flex-shrink-0">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors"
              aria-label="Close welcome modal"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-2xl">
                🎯
              </div>
              <div>
                <h1 className="text-2xl font-bold">Welcome to BMAD System!</h1>
                <p className="text-blue-100 text-sm">Breakthrough Method for Agile AI-Driven Development</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
            {/* BMAD Two-Phase Overview */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                The BMAD Two-Phase Approach
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {bmadPhases.map((phase, index) => (
                  <div key={index} className={`relative p-4 bg-gradient-to-r ${phase.color} rounded-xl text-white overflow-hidden`}>
                    <div className="absolute top-2 right-2 text-3xl opacity-20">{phase.icon}</div>
                    <div className="relative">
                      <h3 className="text-base font-bold mb-1">{phase.phase}</h3>
                      <p className="text-xs opacity-90">{phase.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BMAD Key Features */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                What makes BMAD different?
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bmadFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="text-lg flex-shrink-0">{feature.icon}</div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm">{feature.title}</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BMAD Agent Team Stats */}
            <div className="mb-4 p-4 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700">
              <div className="text-center mb-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Your BMAD Agent Team</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">Specialized AI agents following proven methodologies</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">8</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Core Agents</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">4</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Workflow Types</div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">Brownfield, Greenfield, Service, UI</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">2</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Development Phases</div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">Planning & Implementation</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">∞</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Project Types</div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">Full-stack, APIs, Features</div>
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
                  <span>Learn BMAD Method (3 min)</span>
                </span>
              </button>
              
              <button
                onClick={handleQuickStart}
                className="px-8 py-3 border-2 border-emerald-600 text-emerald-600 dark:text-emerald-400 font-medium rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transform hover:scale-105 transition-all duration-200"
              >
                <span className="flex items-center justify-center space-x-2">
                  <span>🚀</span>
                  <span>Start Your First Project</span>
                </span>
              </button>
            </div>

            {/* Info callout */}
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <div className="flex items-start space-x-3">
                <span className="text-amber-500 text-xl">💡</span>
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-200">New to BMAD?</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Take the tour to understand the two-phase approach: Web UI planning followed by IDE development. 
                    This ensures structured, high-quality project delivery.
                  </p>
                </div>
              </div>
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