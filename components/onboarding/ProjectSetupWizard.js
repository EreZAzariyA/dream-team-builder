'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Check, Info } from 'lucide-react';

export default function ProjectSetupWizard({ isOpen, onClose, onComplete, selectedTemplate }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [formData, setFormData] = useState({
    projectName: '',
    projectDescription: '',
    projectType: '',
    existingSystem: '',
    technicalConstraints: '',
    successCriteria: '',
    timeline: '',
    teamSize: '',
    stakeholders: ''
  });

  const bmadSteps = [
    {
      id: 'project-basics',
      title: 'Project Basics',
      description: 'Essential information about your project',
      icon: '📋',
      fields: ['projectName', 'projectType', 'timeline'],
      required: ['projectName', 'projectType']
    },
    {
      id: 'system-context',
      title: 'System Context',
      description: 'Current system state and technical environment',
      icon: '🏗️',
      fields: ['existingSystem', 'technicalConstraints'],
      required: selectedTemplate?.category === 'brownfield' ? ['existingSystem'] : []
    },
    {
      id: 'requirements',
      title: 'Requirements & Goals',
      description: 'Detailed project requirements and success criteria',
      icon: '🎯',
      fields: ['projectDescription', 'successCriteria'],
      required: ['projectDescription', 'successCriteria']
    },
    {
      id: 'team-context',
      title: 'Team & Stakeholders',
      description: 'Team composition and key stakeholders',
      icon: '👥',
      fields: ['teamSize', 'stakeholders'],
      required: []
    }
  ];

  const projectTypes = [
    { id: 'web-app', name: 'Web Application', description: 'Full-stack web application' },
    { id: 'mobile-app', name: 'Mobile Application', description: 'Native or hybrid mobile app' },
    { id: 'api-service', name: 'API/Service', description: 'Backend API or microservice' },
    { id: 'desktop-app', name: 'Desktop Application', description: 'Desktop software application' },
    { id: 'integration', name: 'System Integration', description: 'Connecting existing systems' },
    { id: 'modernization', name: 'Legacy Modernization', description: 'Updating existing systems' },
    { id: 'other', name: 'Other', description: 'Custom project type' }
  ];

  const timelineOptions = [
    { id: '1-2weeks', name: '1-2 weeks', description: 'Quick prototype or small feature' },
    { id: '1-3months', name: '1-3 months', description: 'Medium-sized project or major feature' },
    { id: '3-6months', name: '3-6 months', description: 'Large project or complete system' },
    { id: '6months+', name: '6+ months', description: 'Enterprise-scale project' }
  ];

  const teamSizeOptions = [
    { id: 'solo', name: 'Solo Developer', description: 'Just me' },
    { id: 'small', name: '2-5 people', description: 'Small team' },
    { id: 'medium', name: '6-15 people', description: 'Medium team' },
    { id: 'large', name: '15+ people', description: 'Large team' }
  ];

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Pre-populate with template info
      if (selectedTemplate) {
        setFormData(prev => ({
          ...prev,
          projectName: `My ${selectedTemplate.name} Project`,
          projectType: selectedTemplate.category === 'brownfield' ? 'modernization' : 'web-app'
        }));
      }
    } else {
      setIsVisible(false);
      setCurrentStep(0);
    }
  }, [isOpen, selectedTemplate]);

  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleNext = () => {
    if (currentStep < bmadSteps.length - 1) {
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
    // Compile comprehensive project description
    const compiledDescription = compileProjectDescription();
    onComplete({
      ...formData,
      compiledDescription,
      template: selectedTemplate
    });
    setIsVisible(false);
    // Remove setTimeout for faster transition
    onClose();
  };

  const compileProjectDescription = () => {
    const parts = [];
    
    parts.push(`**Project Overview:**`);
    parts.push(`${formData.projectDescription}\n`);
    
    if (formData.projectType) {
      const typeInfo = projectTypes.find(t => t.id === formData.projectType);
      parts.push(`**Project Type:** ${typeInfo?.name} - ${typeInfo?.description}\n`);
    }
    
    if (formData.existingSystem) {
      parts.push(`**Current System State:**`);
      parts.push(`${formData.existingSystem}\n`);
    }
    
    if (formData.technicalConstraints) {
      parts.push(`**Technical Constraints:**`);
      parts.push(`${formData.technicalConstraints}\n`);
    }
    
    if (formData.successCriteria) {
      parts.push(`**Success Criteria:**`);
      parts.push(`${formData.successCriteria}\n`);
    }
    
    if (formData.timeline) {
      const timelineInfo = timelineOptions.find(t => t.id === formData.timeline);
      parts.push(`**Timeline:** ${timelineInfo?.name} - ${timelineInfo?.description}\n`);
    }
    
    if (formData.teamSize) {
      const teamInfo = teamSizeOptions.find(t => t.id === formData.teamSize);
      parts.push(`**Team Size:** ${teamInfo?.name} - ${teamInfo?.description}\n`);
    }
    
    if (formData.stakeholders) {
      parts.push(`**Key Stakeholders:**`);
      parts.push(`${formData.stakeholders}`);
    }
    
    return parts.join('\n');
  };

  const isStepComplete = (stepIndex) => {
    const step = bmadSteps[stepIndex];
    return step.required.every(fieldName => formData[fieldName]?.trim());
  };

  const canProceed = () => {
    return isStepComplete(currentStep);
  };

  const currentStepData = bmadSteps[currentStep];

  if (!isOpen || !isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">BMAD Project Setup</h2>
              <p className="text-emerald-100 mt-1">
                Comprehensive project planning for {selectedTemplate?.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Step {currentStep + 1} of {bmadSteps.length}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round(((currentStep + 1) / bmadSteps.length) * 100)}% Complete
            </span>
          </div>
          <div className="flex space-x-2">
            {bmadSteps.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                  index < currentStep
                    ? 'bg-green-500'
                    : index === currentStep
                    ? 'bg-blue-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          <div className="max-w-2xl mx-auto">
            {/* Step Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full flex items-center justify-center text-3xl text-white mx-auto mb-4">
                {currentStepData.icon}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {currentStepData.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {currentStepData.description}
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-6">
              {currentStepData.fields.includes('projectName') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={(e) => handleFieldChange('projectName', e.target.value)}
                    placeholder="Enter your project name"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}

              {currentStepData.fields.includes('projectType') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {projectTypes.map((type) => (
                      <label
                        key={type.id}
                        className={`relative flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                          formData.projectType === type.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="projectType"
                          value={type.id}
                          checked={formData.projectType === type.id}
                          onChange={(e) => handleFieldChange('projectType', e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {type.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {type.description}
                          </div>
                        </div>
                        {formData.projectType === type.id && (
                          <Check className="w-5 h-5 text-blue-500 flex-shrink-0 ml-2" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {currentStepData.fields.includes('timeline') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Expected Timeline
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {timelineOptions.map((option) => (
                      <label
                        key={option.id}
                        className={`relative flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                          formData.timeline === option.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="timeline"
                          value={option.id}
                          checked={formData.timeline === option.id}
                          onChange={(e) => handleFieldChange('timeline', e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {option.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {option.description}
                          </div>
                        </div>
                        {formData.timeline === option.id && (
                          <Check className="w-5 h-5 text-blue-500 flex-shrink-0 ml-2" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {currentStepData.fields.includes('existingSystem') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current System State {selectedTemplate?.category === 'brownfield' && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    rows={4}
                    value={formData.existingSystem}
                    onChange={(e) => handleFieldChange('existingSystem', e.target.value)}
                    placeholder="Describe the current system architecture, technology stack, known issues, and any technical debt..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>Brownfield projects:</strong> This information helps the Analyst agent understand constraints and integration points.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStepData.fields.includes('technicalConstraints') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Technical Constraints
                  </label>
                  <textarea
                    rows={3}
                    value={formData.technicalConstraints}
                    onChange={(e) => handleFieldChange('technicalConstraints', e.target.value)}
                    placeholder="Any technical limitations, required technologies, security requirements, performance needs, or compliance requirements..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}

              {currentStepData.fields.includes('projectDescription') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Detailed Project Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={formData.projectDescription}
                    onChange={(e) => handleFieldChange('projectDescription', e.target.value)}
                    placeholder="Provide a comprehensive description of what you want to build, including features, user types, business goals, and any specific requirements..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}

              {currentStepData.fields.includes('successCriteria') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Success Criteria <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={formData.successCriteria}
                    onChange={(e) => handleFieldChange('successCriteria', e.target.value)}
                    placeholder="How will you measure success? Include metrics, user outcomes, business goals, and definition of done..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}

              {currentStepData.fields.includes('teamSize') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Team Size
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {teamSizeOptions.map((option) => (
                      <label
                        key={option.id}
                        className={`relative flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                          formData.teamSize === option.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="teamSize"
                          value={option.id}
                          checked={formData.teamSize === option.id}
                          onChange={(e) => handleFieldChange('teamSize', e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {option.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {option.description}
                          </div>
                        </div>
                        {formData.teamSize === option.id && (
                          <Check className="w-5 h-5 text-blue-500 flex-shrink-0 ml-2" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {currentStepData.fields.includes('stakeholders') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Key Stakeholders
                  </label>
                  <textarea
                    rows={3}
                    value={formData.stakeholders}
                    onChange={(e) => handleFieldChange('stakeholders', e.target.value)}
                    placeholder="Who are the key decision makers, users, and stakeholders? Include their roles and interests in the project..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </button>

            <div className="flex items-center space-x-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {currentStepData.required.length > 0 && !canProceed() && (
                  <span>Required fields missing</span>
                )}
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {currentStep === bmadSteps.length - 1 ? (
                <>
                  Complete Setup
                  <Check className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}