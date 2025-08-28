'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Layers, Star, Lightbulb, Filter } from 'lucide-react';

const WorkflowSelectionModal = ({ team, isOpen, onClose, onDeploy }) => {
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [projectContext, setProjectContext] = useState({
    type: '',
    scope: ''
  });
  const [filteredWorkflows, setFilteredWorkflows] = useState([]);

  const hasWorkflows = team?.workflows && team.workflows.length > 0;

  // Fetch filtered workflows when modal opens or project context changes
  useEffect(() => {
    if (isOpen && team?.workflows?.length > 0) {
      const fetchFilteredWorkflows = async () => {
        try {
          const response = await fetch('/api/workflows/filtered', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workflowFiles: team.workflows,
              projectContext: projectContext
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setFilteredWorkflows(data.workflows);
            } else {
              console.warn('Failed to fetch filtered workflows:', data.error);
              setFilteredWorkflows([]);
            }
          }
        } catch (error) {
          console.warn('Error fetching filtered workflows:', error);
          setFilteredWorkflows([]);
        }
      };
      
      fetchFilteredWorkflows();
    } else if (!isOpen) {
      // Reset workflows when modal closes
      setFilteredWorkflows([]);
    }
  }, [isOpen, team?.workflows, projectContext]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden scroll-smooth">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            {/* Team Context */}
            <div className={`p-2 rounded-lg ${team?.bgColor || 'bg-gray-50'} flex items-center justify-center`}>
              <span className="text-xl">{team?.emoji || '🤖'}</span>
            </div>
            <div>
              <h2 className="text-h2 text-gray-900 dark:text-white">Choose Development Process</h2>
              <p className="text-body text-gray-600 dark:text-gray-400">
                Select a workflow for <span className="font-medium">{team?.name}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div 
          className="flex-1 overflow-y-auto scroll-smooth"
          style={{ 
            WebkitOverflowScrolling: 'touch', // For iOS smooth scrolling
            scrollBehavior: 'smooth',
            scrollPaddingTop: '1rem',
            willChange: 'scroll-position',
            overscrollBehavior: 'contain',
            // Additional smooth scrolling optimizations
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
          }}
        >
          <div className="p-6">
          
          {/* Project Context Form */}
          <div className="mb-6">
            <h3 className="text-h4 text-gray-900 dark:text-white mb-3">Tell us about your project</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Type
                </label>
                <select
                  value={projectContext.type}
                  onChange={(e) => setProjectContext({ ...projectContext, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select project type...</option>
                  <option value="web-app">Web Application</option>
                  <option value="saas">SaaS Product</option>
                  <option value="rest-api">REST API</option>
                  <option value="microservice">Microservice</option>
                  <option value="enterprise-app">Enterprise Application</option>
                  <option value="prototype">Prototype/MVP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Scope
                </label>
                <select
                  value={projectContext.scope}
                  onChange={(e) => setProjectContext({ ...projectContext, scope: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select scope...</option>
                  <option value="mvp">MVP / Prototype</option>
                  <option value="feature">Feature Addition</option>
                  <option value="enterprise">Enterprise Application</option>
                  <option value="modernization">Modernization</option>
                </select>
              </div>
            </div>
            
            {/* Smart recommendations */}
            {projectContext.type && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start space-x-3">
                <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  Showing {filteredWorkflows.length} workflow{filteredWorkflows.length !== 1 ? 's' : ''} optimized for &quot;{projectContext.type}&quot;
                  {filteredWorkflows.some(w => w.recommended) && (
                    <span className="block mt-1 font-medium">⭐ Recommended workflows are highlighted</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Workflows Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h4 text-gray-900 dark:text-white">
                Available Workflows ({filteredWorkflows.length})
              </h3>
            </div>

            {/* Handle different states */}
            {!hasWorkflows ? (
              <EmptyWorkflowsState team={team} onDeploy={() => onDeploy(team, null, projectContext)} />
            ) : filteredWorkflows.length === 0 ? (
              <NoMatchingWorkflowsState 
                onClearFilters={() => setProjectContext({ type: '', scope: '' })}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {filteredWorkflows.map(workflow => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    team={team}
                    isSelected={selectedWorkflow?.id === workflow.id}
                    onSelect={setSelectedWorkflow}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Workflow Preview */}
          {selectedWorkflow && (
            <div className="mt-4">
              <WorkflowPreview 
                workflow={selectedWorkflow}
              />
            </div>
          )}
          </div>
        </div>

        {/* Modal Footer - Always show for consistent layout */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Back to Teams
          </button>
          
          {hasWorkflows ? (
            <button 
              onClick={() => onDeploy(team, selectedWorkflow, projectContext)}
              disabled={!selectedWorkflow}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                selectedWorkflow 
                  ? `${team?.color || 'text-blue-600'} ${team?.bgColor || 'bg-blue-50'} ${team?.borderColor || 'border-blue-200'} border-2 hover:opacity-80`
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Deploy {team?.name}
              {selectedWorkflow && ` with ${selectedWorkflow.name}`}
            </button>
          ) : (
            <button 
              onClick={() => onDeploy(team, null, projectContext)}
              className={`px-6 py-2 rounded-lg font-medium ${team?.color || 'text-blue-600'} ${team?.bgColor || 'bg-blue-50'} ${team?.borderColor || 'border-blue-200'} border-2 hover:opacity-80 transition-opacity`}
            >
              Deploy {team?.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper components
const EmptyWorkflowsState = ({ team, onDeploy }) => (
  <div className="text-center py-12">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-4">
      <Star className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
    </div>
    <h3 className="text-h4 text-gray-900 dark:text-white mb-2">Story-Driven Development</h3>
    <p className="text-body text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
      {team?.name} works on individual user stories without predefined workflows.
      Perfect for agile development with existing requirements.
    </p>
    <button 
      onClick={onDeploy}
      className={`px-6 py-3 rounded-lg font-medium ${team?.color || 'text-blue-600'} ${team?.bgColor || 'bg-blue-50'} ${team?.borderColor || 'border-blue-200'} border-2 hover:opacity-80 transition-opacity`}
    >
      Deploy for Story Development
    </button>
  </div>
);

const NoMatchingWorkflowsState = ({ onClearFilters }) => (
  <div className="text-center py-12">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
      <Filter className="w-8 h-8 text-gray-400" />
    </div>
    <h3 className="text-h4 text-gray-900 dark:text-white mb-2">No Matching Workflows</h3>
    <p className="text-body text-gray-600 dark:text-gray-400 mb-6">
      No workflows match your current project settings.
    </p>
    <button 
      onClick={onClearFilters}
      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
    >
      Clear Filters
    </button>
  </div>
);

const WorkflowCard = ({ workflow, team, isSelected, onSelect }) => (
  <div 
    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
      isSelected 
        ? `${team?.borderColor || 'border-blue-200'} ${team?.bgColor || 'bg-blue-50'} shadow-md`
        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
    }`}
    onClick={() => onSelect(workflow)}
  >
    <div className="flex items-center justify-between mb-3">
      <h4 className="text-body font-semibold text-gray-900 dark:text-white">{workflow.name}</h4>
      {workflow.recommended && (
        <div className="flex items-center space-x-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full">
          <Star className="w-3 h-3" />
          <span>Recommended</span>
        </div>
      )}
    </div>
    
    <p className="text-body-small text-gray-600 dark:text-gray-400 mb-4">{workflow.description}</p>
    
    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      <div className="flex items-center space-x-1">
        <Clock className="w-3 h-3" />
        <span>{workflow.estimatedDuration}</span>
      </div>
      <div className="flex items-center space-x-1">
        <Layers className="w-3 h-3" />
        <span>{workflow.steps} steps</span>
      </div>
    </div>
    {workflow.complexity && (
      <div className="mt-2 text-xs">
        <span className={`inline-block px-2 py-1 rounded ${
          workflow.complexity === 'Simple' ? 'bg-green-100 text-green-800' :
          workflow.complexity === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {workflow.complexity}
        </span>
      </div>
    )}
  </div>
);

const WorkflowPreview = ({ workflow }) => (
  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
    <h4 className="text-body font-semibold text-gray-900 dark:text-white mb-3">Workflow Preview</h4>
    <div className="space-y-3">
      <div>
        <strong className="text-body-small text-gray-700 dark:text-gray-300">Process:</strong>
        <p className="text-body-small text-gray-600 dark:text-gray-400 mt-1">{workflow.description}</p>
      </div>
      <div className="flex items-center justify-between text-body-small">
        <div>
          <strong className="text-gray-700 dark:text-gray-300">Duration:</strong>
          <span className="text-gray-600 dark:text-gray-400 ml-1">{workflow.estimatedDuration}</span>
        </div>
        <div>
          <strong className="text-gray-700 dark:text-gray-300">Steps:</strong>
          <span className="text-gray-600 dark:text-gray-400 ml-1">{workflow.steps}</span>
        </div>
        <div>
          <strong className="text-gray-700 dark:text-gray-300">Complexity:</strong>
          <span className="text-gray-600 dark:text-gray-400 ml-1">{workflow.complexity}</span>
        </div>
      </div>
      <div>
        <strong className="text-body-small text-gray-700 dark:text-gray-300">Project Types:</strong>
        <div className="flex flex-wrap gap-1 mt-1">
          {workflow.projectTypes?.slice(0, 4).map(type => (
            <span key={type} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded">
              {type}
            </span>
          ))}
          {workflow.projectTypes?.length > 4 && (
            <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded">
              +{workflow.projectTypes.length - 4} more
            </span>
          )}
        </div>
      </div>
      {workflow.agents?.length > 0 && (
        <div>
          <strong className="text-body-small text-gray-700 dark:text-gray-300">Agents Involved:</strong>
          <div className="flex flex-wrap gap-1 mt-1">
            {workflow.agents.map(agent => (
              <span key={agent} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded">
                {agent}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

// All workflow data processing and filtering is now handled server-side via /api/bmad/workflows/filtered
// TODO: Replace with dynamic YAML parsing from .bmad-core/workflows/ files
const formatWorkflowName = (filename) => {
  return filename
    .replace('.yaml', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

const getWorkflowDescription = (filename) => {
  // TODO: Parse from actual YAML workflow.description field
  const descriptions = {
    'greenfield-fullstack.yaml': 'Build full-stack applications from concept to development with comprehensive planning.',
    'greenfield-service.yaml': 'Develop backend services and APIs from scratch with focus on architecture and scalability.',
    'greenfield-ui.yaml': 'Create user interfaces and frontend applications with focus on UX and design.',
    'brownfield-fullstack.yaml': 'Enhance existing full-stack applications with new features and improvements.',
    'brownfield-service.yaml': 'Extend and modernize existing backend services and APIs.',
    'brownfield-ui.yaml': 'Improve and add features to existing user interfaces and frontend applications.'
  };
  return descriptions[filename] || 'A structured development workflow optimized for your team.';
};

const getWorkflowType = (filename) => {
  // TODO: Parse from actual YAML workflow.type field
  if (filename.includes('greenfield')) return 'greenfield';
  if (filename.includes('brownfield')) return 'brownfield';
  return 'standard';
};

const getWorkflowSteps = (filename) => {
  // TODO: Parse from actual YAML workflow.sequence length
  const stepCounts = {
    'greenfield-fullstack.yaml': 8,
    'greenfield-service.yaml': 6,
    'greenfield-ui.yaml': 6,
    'brownfield-fullstack.yaml': 7,
    'brownfield-service.yaml': 5,
    'brownfield-ui.yaml': 5
  };
  return stepCounts[filename] || 5;
};

const getProjectTypes = (filename) => {
  // Fallback project types if metadata not loaded yet
  // These are based on actual YAML files in .bmad-core/workflows/
  const projectTypes = {
    'greenfield-fullstack.yaml': ['web-app', 'saas', 'enterprise-app', 'prototype', 'mvp'],
    'greenfield-service.yaml': ['rest-api', 'graphql-api', 'microservice', 'backend-service', 'api-prototype', 'simple-service'],
    'greenfield-ui.yaml': ['web-app', 'saas', 'prototype'],
    'brownfield-fullstack.yaml': ['feature-addition', 'refactoring', 'modernization', 'integration-enhancement'],
    'brownfield-service.yaml': ['rest-api', 'microservice'],
    'brownfield-ui.yaml': ['web-app', 'saas']
  };
  return projectTypes[filename] || ['web-app'];
};

// Calculate recommendation score based on project context
const getWorkflowRecommendationScore = (workflow, projectContext) => {
  let score = 0;
  
  // Base score for project type match
  if (workflow.projectTypes.includes(projectContext.type)) {
    score += 0.6;
  }
  
  // Additional scoring based on project type and workflow type combinations
  // Based on actual .bmad-core/workflows/ analysis
  const perfectMatches = {
    'rest-api': ['greenfield-service', 'brownfield-service'],
    'graphql-api': ['greenfield-service'],
    'microservice': ['greenfield-service', 'brownfield-service'], 
    'backend-service': ['greenfield-service'],
    'api-prototype': ['greenfield-service'],
    'simple-service': ['greenfield-service'],
    'web-app': ['greenfield-fullstack', 'brownfield-fullstack', 'greenfield-ui', 'brownfield-ui'],
    'saas': ['greenfield-fullstack', 'brownfield-fullstack', 'greenfield-ui'],
    'enterprise-app': ['greenfield-fullstack', 'brownfield-fullstack'],
    'prototype': ['greenfield-fullstack', 'greenfield-ui'],
    'mvp': ['greenfield-fullstack'],
    'feature-addition': ['brownfield-fullstack', 'brownfield-ui'],
    'refactoring': ['brownfield-fullstack'],
    'modernization': ['brownfield-fullstack'],
    'integration-enhancement': ['brownfield-fullstack']
  };
  
  if (perfectMatches[projectContext.type]?.includes(workflow.type)) {
    score += 0.3;
  }
  
  // Scope-based scoring
  if (projectContext.scope) {
    const scopeMatches = {
      'mvp': ['greenfield'],
      'feature': ['brownfield'],
      'enterprise': ['fullstack'],
      'modernization': ['brownfield']
    };
    
    const preferredTypes = scopeMatches[projectContext.scope] || [];
    if (preferredTypes.some(type => workflow.type.includes(type))) {
      score += 0.1;
    }
  }
  
  return Math.min(score, 1.0); // Cap at 1.0
};

export default WorkflowSelectionModal;