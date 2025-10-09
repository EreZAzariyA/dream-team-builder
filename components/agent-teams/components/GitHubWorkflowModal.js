'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Layers, Star, Lightbulb, Filter, Github, FolderOpen, GitBranch } from 'lucide-react';
import { useSession } from 'next-auth/react';

const GitHubWorkflowModal = ({ team, isOpen, onClose, onDeploy }) => {
  const { data: session } = useSession();
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [selectedRepository, setSelectedRepository] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [projectContext, setProjectContext] = useState({
    type: '',
    scope: '',
    targetBranch: 'main'
  });
  const [filteredWorkflows, setFilteredWorkflows] = useState([]);

  const hasWorkflows = team?.workflows && team.workflows.length > 0;

  // Fetch user's repositories when modal opens
  useEffect(() => {
    if (isOpen && session?.accessToken) {
      fetchRepositories();
    } else if (!isOpen) {
      // Reset state when modal closes
      setRepositories([]);
      setSelectedRepository(null);
      setFilteredWorkflows([]);
    }
  }, [isOpen, session?.accessToken]);

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
              projectContext: {
                ...projectContext,
                githubMode: true
              }
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
    }
  }, [isOpen, team?.workflows, projectContext]);

  const fetchRepositories = async () => {
    if (!session?.accessToken) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/github/repositories', {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRepositories(data.repositories || []);
      } else {
        console.error('Failed to fetch repositories');
        setRepositories([]);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
      setRepositories([]);
    } finally {
      setLoading(false);
    }
  };

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleDeploy = () => {
    if (!selectedRepository) return;
    
    const deploymentContext = {
      ...projectContext,
      githubMode: true,
      repository: selectedRepository,
      team: team
    };
    
    onDeploy(team, selectedWorkflow, deploymentContext);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            {/* GitHub Team Context */}
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/20 flex items-center justify-center">
              <span className="text-xl">🐙</span>
            </div>
            <div>
              <h2 className="text-h2 text-gray-900 dark:text-white">Deploy to GitHub Repository</h2>
              <p className="text-body text-gray-600 dark:text-gray-400">
                Choose repository and workflow for <span className="font-medium">{team?.name} + GitHub</span>
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
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
          
            {/* Repository Selection */}
            <div>
              <h3 className="text-h4 text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Github className="w-5 h-5 text-slate-600" />
                Select Repository
              </h3>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading repositories...</p>
                </div>
              ) : repositories.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">No repositories found</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Make sure you have GitHub access configured</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {repositories.slice(0, 8).map(repo => (
                    <RepositoryCard
                      key={repo.id}
                      repository={repo}
                      isSelected={selectedRepository?.id === repo.id}
                      onSelect={setSelectedRepository}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Project Context Form */}
            {selectedRepository && (
              <div>
                <h3 className="text-h4 text-gray-900 dark:text-white mb-3">Project Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Target Branch
                    </label>
                    <div className="relative">
                      <GitBranch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={projectContext.targetBranch}
                        onChange={(e) => setProjectContext({ ...projectContext, targetBranch: e.target.value })}
                        placeholder="main"
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Repository Context Preview */}
                {selectedRepository && (
                  <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Github className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Selected Repository</span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      <strong>{selectedRepository.full_name}</strong>
                      {selectedRepository.description && (
                        <p className="mt-1">{selectedRepository.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span>Language: {selectedRepository.language || 'Not specified'}</span>
                        <span>Branch: {projectContext.targetBranch}</span>
                        <span>{selectedRepository.private ? 'Private' : 'Public'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Workflows Section */}
            {selectedRepository && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-h4 text-gray-900 dark:text-white">
                    Available Workflows ({filteredWorkflows.length})
                  </h3>
                </div>

                {/* Smart recommendations */}
                {projectContext.type && (
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start space-x-3">
                    <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      Showing {filteredWorkflows.length} GitHub-optimized workflow{filteredWorkflows.length !== 1 ? 's' : ''} for &quot;{projectContext.type}&quot;
                      {filteredWorkflows.some(w => w.recommended) && (
                        <span className="block mt-1 font-medium">⭐ Recommended workflows are highlighted</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Handle different states */}
                {!hasWorkflows ? (
                  <EmptyWorkflowsState team={team} onDeploy={handleDeploy} />
                ) : filteredWorkflows.length === 0 ? (
                  <NoMatchingWorkflowsState 
                    onClearFilters={() => setProjectContext({ type: '', scope: '', targetBranch: 'main' })}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {filteredWorkflows.map(workflow => (
                      <GitHubWorkflowCard
                        key={workflow.id}
                        workflow={workflow}
                        team={team}
                        repository={selectedRepository}
                        isSelected={selectedWorkflow?.id === workflow.id}
                        onSelect={setSelectedWorkflow}
                      />
                    ))}
                  </div>
                )}

                {/* Workflow Preview */}
                {selectedWorkflow && (
                  <div className="mt-4">
                    <GitHubWorkflowPreview 
                      workflow={selectedWorkflow}
                      repository={selectedRepository}
                      targetBranch={projectContext.targetBranch}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Back to Teams
          </button>
          
          <button 
            onClick={handleDeploy}
            disabled={!selectedRepository || (hasWorkflows && !selectedWorkflow)}
            className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              selectedRepository && (!hasWorkflows || selectedWorkflow)
                ? 'text-slate-700 bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800 border-2 hover:opacity-80'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Github className="w-4 h-4" />
            Deploy to Repository
            {selectedWorkflow && ` with ${selectedWorkflow.name}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper components
const RepositoryCard = ({ repository, isSelected, onSelect }) => (
  <div 
    className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
      isSelected 
        ? 'border-slate-300 bg-slate-50 dark:bg-slate-900/20 shadow-md'
        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
    }`}
    onClick={() => onSelect(repository)}
  >
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{repository.name}</h4>
      <div className="flex items-center gap-1">
        {repository.private && (
          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">Private</span>
        )}
      </div>
    </div>
    
    {repository.description && (
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{repository.description}</p>
    )}
    
    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      <span>{repository.language || 'No language'}</span>
      <span>Updated {new Date(repository.updated_at).toLocaleDateString()}</span>
    </div>
  </div>
);

const EmptyWorkflowsState = ({ team, onDeploy }) => (
  <div className="text-center py-12">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-4">
      <Star className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
    </div>
    <h3 className="text-h4 text-gray-900 dark:text-white mb-2">GitHub Story Development</h3>
    <p className="text-body text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
      {team?.name} will work directly with your repository on individual stories and tasks.
      Perfect for agile development with existing requirements.
    </p>
    <button 
      onClick={onDeploy}
      className="px-6 py-3 rounded-lg font-medium text-slate-700 bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800 border-2 hover:opacity-80 transition-opacity flex items-center gap-2"
    >
      <Github className="w-4 h-4" />
      Deploy for Repository Stories
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
      No GitHub-compatible workflows match your current project settings.
    </p>
    <button 
      onClick={onClearFilters}
      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
    >
      Clear Filters
    </button>
  </div>
);

const GitHubWorkflowCard = ({ workflow, team, repository, isSelected, onSelect }) => (
  <div 
    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
      isSelected 
        ? 'border-slate-300 bg-slate-50 dark:bg-slate-900/20 shadow-md'
        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
    }`}
    onClick={() => onSelect(workflow)}
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Github className="w-4 h-4 text-slate-600" />
        <h4 className="text-body font-semibold text-gray-900 dark:text-white">{workflow.name}</h4>
      </div>
      {workflow.recommended && (
        <div className="flex items-center space-x-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full">
          <Star className="w-3 h-3" />
          <span>Recommended</span>
        </div>
      )}
    </div>
    
    <p className="text-body-small text-gray-600 dark:text-gray-400 mb-4">{workflow.description}</p>
    
    {/* GitHub integration indicators */}
    <div className="mb-3 flex flex-wrap gap-1">
      <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">Repository Analysis</span>
      <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">Automated Commits</span>
      {repository?.language && (
        <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">{repository.language}</span>
      )}
    </div>
    
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

const GitHubWorkflowPreview = ({ workflow, repository, targetBranch }) => (
  <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-lg">
    <h4 className="text-body font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
      <Github className="w-4 h-4 text-slate-600" />
      GitHub Workflow Preview
    </h4>
    <div className="space-y-3">
      <div>
        <strong className="text-body-small text-gray-700 dark:text-gray-300">Repository Integration:</strong>
        <p className="text-body-small text-gray-600 dark:text-gray-400 mt-1">
          Will analyze <strong>{repository.full_name}</strong> and work on branch <strong>{targetBranch}</strong>
        </p>
      </div>
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
      {workflow.agents?.length > 0 && (
        <div>
          <strong className="text-body-small text-gray-700 dark:text-gray-300">Agents Involved:</strong>
          <div className="flex flex-wrap gap-1 mt-1">
            {workflow.agents.map(agent => (
              <span key={agent} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded">
                {agent}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

export default GitHubWorkflowModal;