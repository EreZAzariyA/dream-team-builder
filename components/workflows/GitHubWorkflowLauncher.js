/**
 * GitHub-Integrated Workflow Launcher
 * Combines repository selection, workflow configuration, and launch
 * Following the GitHub-first BMAD methodology
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline';
import GitHubRepositorySelector from '../github/GitHubRepositorySelector';
import RepositoryContextPreview from '../github/RepositoryContextPreview';

const GitHubWorkflowLauncher = ({ 
  initialWorkflowTemplate = 'brownfield-fullstack',
  onWorkflowStarted,
  className = ""
}) => {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRepository, setSelectedRepository] = useState(null);
  const [workflowConfig, setWorkflowConfig] = useState({
    template: initialWorkflowTemplate,
    name: '',
    description: '',
    userPrompt: ''
  });
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState(null);

  const steps = [
    { id: 1, name: 'Select Repository', icon: CodeBracketIcon },
    { id: 2, name: 'Review Context', icon: CheckCircleIcon },
    { id: 3, name: 'Configure Workflow', icon: ClockIcon },
    { id: 4, name: 'Launch', icon: PlayIcon }
  ];

  // Auto-populate workflow config when repository is selected
  useEffect(() => {
    if (selectedRepository) {
      const repositoryName = selectedRepository.name;
      const repositoryType = selectedRepository.bmad_context?.suggested_workflow || initialWorkflowTemplate;
      
      setWorkflowConfig(prev => ({
        ...prev,
        template: repositoryType,
        name: prev.name || `${repositoryName} Enhancement`,
        description: prev.description || `BMAD workflow for ${selectedRepository.full_name}`,
        userPrompt: prev.userPrompt || `I want to enhance the ${repositoryName} project. Please analyze the existing codebase and help me implement improvements.`
      }));
    }
  }, [selectedRepository, initialWorkflowTemplate]);

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleLaunchWorkflow = async () => {
    if (!selectedRepository || !workflowConfig.userPrompt.trim()) {
      setError('Please select a repository and provide a project prompt');
      return;
    }

    setLaunching(true);
    setError(null);

    try {
      const launchPayload = {
        userPrompt: workflowConfig.userPrompt.trim(),
        name: workflowConfig.name,
        description: workflowConfig.description,
        githubRepository: {
          id: selectedRepository.id,
          owner: selectedRepository.owner.login,
          name: selectedRepository.name,
          full_name: selectedRepository.full_name,
          html_url: selectedRepository.html_url,
          clone_url: selectedRepository.clone_url,
          default_branch: selectedRepository.default_branch,
          private: selectedRepository.private
        }
      };

      const response = await fetch(`/api/workflows/${workflowConfig.template}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(launchPayload)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || result.message || 'Failed to launch workflow');
      }

      // Successful launch
      if (onWorkflowStarted) {
        onWorkflowStarted(result);
      }

      // Navigate to live workflow page (using 'github' as teamId for GitHub-launched workflows)
      router.push(`/agent-teams/github/${result.workflowInstanceId}/live`);

    } catch (err) {
      console.error('Workflow launch error:', err);
      setError(err.message);
    } finally {
      setLaunching(false);
    }
  };

  const isStepComplete = (stepId) => {
    switch (stepId) {
      case 1: return selectedRepository !== null;
      case 2: return selectedRepository !== null;
      case 3: return workflowConfig.userPrompt.trim().length > 0;
      case 4: return false; // Launch step is never "complete" until launched
      default: return false;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedRepository !== null;
      case 2: return selectedRepository !== null;
      case 3: return workflowConfig.userPrompt.trim().length > 0;
      case 4: return workflowConfig.userPrompt.trim().length > 0;
      default: return false;
    }
  };

  if (!session?.user) {
    return (
      <div className={`max-w-4xl mx-auto p-6 ${className}`}>
        <div className="text-center py-12">
          <CodeBracketIcon className="h-16 w-16 text-gray-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">GitHub Authentication Required</h2>
          <p className="text-gray-600 mb-8">
            Please sign in with GitHub to launch workflows with repository integration.
          </p>
          <button
            onClick={() => router.push('/auth/signin')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In with GitHub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-6xl mx-auto p-6 ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Launch GitHub-Integrated Workflow
        </h1>
        <p className="text-gray-600">
          Select a repository, review its context, and launch an AI-powered development workflow
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <nav aria-label="Progress">
          <ol className="flex items-center justify-between">
            {steps.map((step, stepIdx) => (
              <li key={step.id} className="flex items-center">
                <div className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 
                    ${currentStep >= step.id 
                      ? 'bg-blue-600 border-blue-600 text-white' 
                      : isStepComplete(step.id)
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'border-gray-300 text-gray-500'
                    }
                  `}>
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'}`}>
                      {step.name}
                    </p>
                  </div>
                </div>
                {stepIdx < steps.length - 1 && (
                  <div className="flex-1 mx-4 h-0.5 bg-gray-200">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        currentStep > step.id ? 'bg-blue-600' : 'bg-transparent'
                      }`}
                    />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg border border-gray-200 min-h-96">
        {currentStep === 1 && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Select GitHub Repository
            </h2>
            <p className="text-gray-600 mb-6">
              Choose the repository you want to enhance with BMAD AI agents
            </p>
            <GitHubRepositorySelector
              onRepositorySelect={setSelectedRepository}
              selectedRepository={selectedRepository}
              workflowType={workflowConfig.template}
            />
          </div>
        )}

        {currentStep === 2 && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Review Repository Context
            </h2>
            <p className="text-gray-600 mb-6">
              Understanding your project structure and existing code
            </p>
            <RepositoryContextPreview repository={selectedRepository} />
          </div>
        )}

        {currentStep === 3 && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Configure Workflow
            </h2>
            <p className="text-gray-600 mb-6">
              Set up your project goals and AI agent instructions
            </p>
            
            <div className="space-y-6">
              {/* Workflow Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workflow Template
                </label>
                <select
                  value={workflowConfig.template}
                  onChange={(e) => setWorkflowConfig(prev => ({ ...prev, template: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="brownfield-fullstack">Brownfield Full-Stack</option>
                  <option value="brownfield-backend">Brownfield Backend</option>
                  <option value="brownfield-frontend">Brownfield Frontend</option>
                  <option value="brownfield-api">Brownfield API</option>
                  <option value="greenfield-fullstack">Greenfield Full-Stack</option>
                </select>
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={workflowConfig.name}
                  onChange={(e) => setWorkflowConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter a descriptive name for your project"
                />
              </div>

              {/* Project Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Description
                </label>
                <textarea
                  value={workflowConfig.description}
                  onChange={(e) => setWorkflowConfig(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of your project goals"
                />
              </div>

              {/* User Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Instructions <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={workflowConfig.userPrompt}
                  onChange={(e) => setWorkflowConfig(prev => ({ ...prev, userPrompt: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe what you want to accomplish with this project. The AI agents will use these instructions to understand your goals and create a development plan..."
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Be specific about features, improvements, or changes you want to implement
                </p>
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Launch Workflow
            </h2>
            <p className="text-gray-600 mb-6">
              Review your configuration and launch the AI-powered development workflow
            </p>
            
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Workflow Summary</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Repository:</span>
                    <span className="ml-2 text-gray-600">{selectedRepository?.full_name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Template:</span>
                    <span className="ml-2 text-gray-600">{workflowConfig.template}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Project:</span>
                    <span className="ml-2 text-gray-600">{workflowConfig.name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Target Branch:</span>
                    <span className="ml-2 text-gray-600">{selectedRepository?.default_branch || 'main'}</span>
                  </div>
                </div>
              </div>

              {/* Launch Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleLaunchWorkflow}
                  disabled={launching || !canProceed()}
                  className="px-8 py-4 bg-blue-600 text-white text-lg font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  {launching ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Launching Workflow...
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-5 w-5 mr-2" />
                      Launch Workflow
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          <ChevronLeftIcon className="h-5 w-5 mr-1" />
          Previous
        </button>

        <button
          onClick={handleNext}
          disabled={currentStep === steps.length || !canProceed()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          Next
          <ChevronRightIcon className="h-5 w-5 ml-1" />
        </button>
      </div>
    </div>
  );
};

export default GitHubWorkflowLauncher;