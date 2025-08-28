/**
 * Repository Context Preview Component
 * Displays detailed information about a selected GitHub repository
 * Helps users understand the project structure before starting a workflow
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  CodeBracketIcon,
  DocumentTextIcon,
  CogIcon,
  UserGroupIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  StarIcon,
  EyeIcon,
  FolderIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const RepositoryContextPreview = ({ 
  repository, 
  onClose,
  className = ""
}) => {
  const [repositoryContext, setRepositoryContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (repository) {
      fetchRepositoryContext();
    }
  }, [repository]);

  const fetchRepositoryContext = async () => {
    if (!repository) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/github/repositories/${repository.owner.login}/${repository.name}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch repository context');
      }
      
      setRepositoryContext(data.context);
    } catch (err) {
      console.error('Error fetching repository context:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!repository) {
    return (
      <div className={`bg-gray-50 rounded-lg border border-gray-200 p-8 text-center ${className}`}>
        <CodeBracketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Select a repository to view its context</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-8 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="text-center text-gray-600">Loading repository context...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg border border-red-200 p-8 ${className}`}>
        <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-600 text-center mb-4">{error}</p>
        <button
          onClick={fetchRepositoryContext}
          className="mx-auto block px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BookOpenIcon },
    { id: 'structure', name: 'Structure', icon: FolderIcon },
    { id: 'development', name: 'Development', icon: CogIcon },
    { id: 'activity', name: 'Activity', icon: ChartBarIcon },
    { id: 'bmad', name: 'BMAD Analysis', icon: CheckCircleIcon }
  ];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {repository.full_name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {repository.description || 'No description available'}
            </p>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center">
              <StarIconSolid className="h-4 w-4 mr-1 text-yellow-400" />
              {repository.stargazers_count || 0}
            </div>
            <div className="flex items-center">
              <EyeIcon className="h-4 w-4 mr-1" />
              {repository.watchers_count || 0}
            </div>
            <a
              href={repository.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-500"
            >
              View on GitHub →
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center py-3 border-b-2 font-medium text-sm transition-colors
                  ${isActive 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {activeTab === 'overview' && (
          <OverviewTab repository={repository} context={repositoryContext} />
        )}
        {activeTab === 'structure' && (
          <StructureTab context={repositoryContext} />
        )}
        {activeTab === 'development' && (
          <DevelopmentTab context={repositoryContext} />
        )}
        {activeTab === 'activity' && (
          <ActivityTab context={repositoryContext} />
        )}
        {activeTab === 'bmad' && (
          <BmadAnalysisTab context={repositoryContext} />
        )}
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ repository, context }) => (
  <div className="space-y-6">
    {/* Basic Information */}
    <div>
      <h3 className="text-sm font-medium text-gray-900 mb-3">Repository Information</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Language:</span>
          <span className="ml-2 font-medium">{repository.language || 'Not specified'}</span>
        </div>
        <div>
          <span className="text-gray-500">Default Branch:</span>
          <span className="ml-2 font-medium">{repository.default_branch}</span>
        </div>
        <div>
          <span className="text-gray-500">Size:</span>
          <span className="ml-2 font-medium">{formatSize(repository.size)}</span>
        </div>
        <div>
          <span className="text-gray-500">Last Updated:</span>
          <span className="ml-2 font-medium">{formatDate(repository.updated_at)}</span>
        </div>
      </div>
    </div>

    {/* Languages */}
    {context?.repository?.languages && Object.keys(context.repository.languages).length > 0 && (
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">Languages</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(context.repository.languages)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([language, bytes]) => (
              <span
                key={language}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                <div className={`w-2 h-2 rounded-full mr-1 ${getLanguageColor(language)}`}></div>
                {language}
              </span>
            ))}
        </div>
      </div>
    )}

    {/* Topics */}
    {repository.topics && repository.topics.length > 0 && (
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">Topics</h3>
        <div className="flex flex-wrap gap-2">
          {repository.topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              {topic}
            </span>
          ))}
        </div>
      </div>
    )}

    {/* README Preview */}
    {context?.documentation?.readme && (
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">README Preview</h3>
        <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700 max-h-32 overflow-y-auto">
          <pre className="whitespace-pre-wrap">
            {context.documentation.readme.content.substring(0, 500)}
            {context.documentation.readme.content.length > 500 && '...'}
          </pre>
        </div>
      </div>
    )}
  </div>
);

// Structure Tab Component
const StructureTab = ({ context }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-medium text-gray-900">Repository Structure</h3>
    {context?.structure ? (
      <div className="text-sm">
        <FileTree items={context.structure.slice(0, 20)} />
        {context.structure.length > 20 && (
          <p className="text-gray-500 mt-2">... and {context.structure.length - 20} more items</p>
        )}
      </div>
    ) : (
      <p className="text-gray-500 text-sm">Structure information not available</p>
    )}
  </div>
);

// Development Tab Component
const DevelopmentTab = ({ context }) => (
  <div className="space-y-6">
    {context?.development && (
      <>
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Development Environment</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Framework:</span>
              <span className="ml-2 font-medium">{context.development.framework}</span>
            </div>
            <div>
              <span className="text-gray-500">Build System:</span>
              <span className="ml-2 font-medium">{context.development.build_system}</span>
            </div>
            <div>
              <span className="text-gray-500">Testing Framework:</span>
              <span className="ml-2 font-medium">{context.development.testing_framework}</span>
            </div>
          </div>
        </div>

        {context.development.package_managers.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Package Managers</h3>
            <div className="flex flex-wrap gap-2">
              {context.development.package_managers.map((pm) => (
                <span
                  key={pm}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                >
                  {pm}
                </span>
              ))}
            </div>
          </div>
        )}
      </>
    )}
  </div>
);

// Activity Tab Component
const ActivityTab = ({ context }) => (
  <div className="space-y-6">
    {context?.activity && (
      <>
        {/* Recent Commits */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Commits</h3>
          <div className="space-y-2">
            {context.activity.recent_commits.slice(0, 5).map((commit) => (
              <div key={commit.sha} className="flex items-start space-x-3 text-sm">
                <div className="flex-shrink-0 w-16 text-gray-500 font-mono">
                  {commit.sha}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 truncate">{commit.message.split('\n')[0]}</p>
                  <p className="text-gray-500">
                    by {commit.author} • {formatDate(commit.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contributors */}
        {context.activity.contributors.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Contributors</h3>
            <div className="flex flex-wrap gap-3">
              {context.activity.contributors.slice(0, 8).map((contributor) => (
                <div key={contributor.login} className="flex items-center space-x-2">
                  <img
                    src={contributor.avatar_url}
                    alt={contributor.login}
                    className="h-6 w-6 rounded-full"
                  />
                  <span className="text-sm text-gray-700">{contributor.login}</span>
                  <span className="text-xs text-gray-500">({contributor.contributions})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )}
  </div>
);

// BMAD Analysis Tab Component
const BmadAnalysisTab = ({ context }) => (
  <div className="space-y-6">
    {context?.bmad_analysis && (
      <>
        {/* Workflow Recommendation */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Workflow Recommendation</h3>
          <div className="bg-blue-50 rounded-md p-3">
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-blue-500 mr-2" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {context.bmad_analysis.workflow_recommendation.template}
                </p>
                <p className="text-sm text-blue-700">
                  {context.bmad_analysis.workflow_recommendation.reason}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Complexity Assessment */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Complexity Assessment</h3>
          <div className={`
            inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
            ${context.bmad_analysis.complexity_assessment === 'high' ? 'bg-red-100 text-red-800' :
              context.bmad_analysis.complexity_assessment === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'}
          `}>
            {context.bmad_analysis.complexity_assessment.charAt(0).toUpperCase() + 
             context.bmad_analysis.complexity_assessment.slice(1)} Complexity
          </div>
        </div>

        {/* Setup Requirements */}
        {context.bmad_analysis.setup_requirements.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Setup Requirements</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              {context.bmad_analysis.setup_requirements.map((requirement, index) => (
                <li key={index} className="flex items-center">
                  <div className="w-1 h-1 bg-gray-400 rounded-full mr-2"></div>
                  {requirement}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Existing BMAD Artifacts Warning */}
        {context.bmad_analysis.existing_bmad_artifacts && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Existing BMAD Artifacts Found
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  This repository already contains BMAD workflow artifacts. 
                  Consider using an enhancement-focused workflow instead.
                </p>
              </div>
            </div>
          </div>
        )}
      </>
    )}
  </div>
);

// File Tree Component
const FileTree = ({ items, depth = 0 }) => (
  <div className={depth > 0 ? 'ml-4' : ''}>
    {items.map((item, index) => (
      <div key={`${item.path}-${index}`} className="py-0.5">
        <div className="flex items-center text-sm">
          <FolderIcon className={`h-4 w-4 mr-2 ${item.type === 'dir' ? 'text-blue-500' : 'text-gray-400'}`} />
          <span className="text-gray-700">{item.name}</span>
          {item.size && (
            <span className="ml-auto text-xs text-gray-500">
              {formatSize(Math.floor(item.size / 1024))}
            </span>
          )}
        </div>
        {item.children && item.children.length > 0 && (
          <FileTree items={item.children.slice(0, 5)} depth={depth + 1} />
        )}
      </div>
    ))}
  </div>
);

// Helper Functions
function getLanguageColor(language) {
  const colors = {
    'JavaScript': 'bg-yellow-400',
    'TypeScript': 'bg-blue-500',
    'Python': 'bg-green-500',
    'Java': 'bg-orange-500',
    'Go': 'bg-cyan-400',
    'Rust': 'bg-orange-600',
    'PHP': 'bg-purple-500',
    'Ruby': 'bg-red-500',
    'C#': 'bg-purple-600',
    'C++': 'bg-blue-600',
    'C': 'bg-gray-600',
    'Swift': 'bg-orange-400',
    'Kotlin': 'bg-purple-400',
    'Dart': 'bg-blue-400'
  };
  return colors[language] || 'bg-gray-400';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatSize(sizeKb) {
  if (sizeKb < 1024) return `${sizeKb} KB`;
  if (sizeKb < 1024 * 1024) return `${Math.round(sizeKb / 1024)} MB`;
  return `${Math.round(sizeKb / (1024 * 1024))} GB`;
}

export default RepositoryContextPreview;