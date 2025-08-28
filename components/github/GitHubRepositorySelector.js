/**
 * GitHub Repository Selector Component
 * Allows users to browse and select GitHub repositories with analysis status indicators
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { 
  MagnifyingGlassIcon,
  StarIcon,
  CodeBracketIcon,
  ClockIcon,
  UserIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import CreateRepositoryModal from './CreateRepositoryModal';

const GitHubRepositorySelector = ({ 
  onRepositorySelect,
  selectedRepository = null,
  workflowType = 'brownfield-fullstack',
  disabled = false
}) => {
  const { data: session } = useSession();
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('updated');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [repositoryStatus, setRepositoryStatus] = useState({});
  const [recentlyAnalyzed, setRecentlyAnalyzed] = useState([]);
  const [showRecentSection, setShowRecentSection] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  
  // Cache and debounce refs
  const repositoryCache = useRef({});
  const debounceTimeout = useRef(null);

  // Load repository analysis status
  const loadRepositoryStatus = async (repos) => {
    if (!repos || repos.length === 0) return;
    
    setLoadingStatus(true);
    try {
      const response = await fetch('/api/repo/bulk-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repositories: repos }),
      });

      if (response.ok) {
        const data = await response.json();
        setRepositoryStatus(data.statusMap || {});
        setRecentlyAnalyzed(data.recentlyAnalyzed || []);
      }
    } catch (error) {
      console.error('Failed to load repository status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  // Fetch repositories from GitHub API
  const fetchRepositories = useCallback(async (resetPage = false) => {
    if (!session?.user || loading) return;

    setLoading(true);
    setError(null);
    
    const currentPage = resetPage ? 1 : page;
    
    try {
      const params = new URLSearchParams({
        type: filterType,
        sort: sortBy,
        per_page: '20',
        page: currentPage.toString()
      });

      // Add enhance=false to avoid hitting rate limits initially
      params.append('enhance', 'false');
      
      const response = await fetch(`/api/github/repositories?${params}`);
      const data = await response.json();

      if (!data.success) {
        // Handle rate limit errors gracefully
        if (data.code === 'RATE_LIMIT_EXCEEDED') {
          throw new Error(`GitHub API rate limit exceeded. Please wait ${Math.ceil(data.retryAfter/60)} minutes.`);
        }
        throw new Error(data.message || 'Failed to fetch repositories');
      }

      const newRepositories = data.repositories || [];
      
      if (resetPage) {
        setRepositories(newRepositories);
        // Only load status for new repositories if we don't have many yet
        if (newRepositories.length <= 20) {
          await loadRepositoryStatus(newRepositories);
          
          // Cache the results
          const cacheKey = `${filterType}-${sortBy}`;
          repositoryCache.current[cacheKey] = {
            data: newRepositories,
            status: repositoryStatus,
            timestamp: Date.now()
          };
        }
      } else {
        setRepositories(prevRepositories => {
          const allRepos = [...prevRepositories, ...newRepositories];
          // Only load status when we have a manageable number of repos
          if (allRepos.length <= 40) {
            loadRepositoryStatus(newRepositories); // Only check status for new repos
          }
          return allRepos;
        });
      }
      
      setHasMore(newRepositories.length === 20);
      if (resetPage) setPage(2);
      else setPage(prev => prev + 1);
      
    } catch (err) {
      console.error('Error fetching repositories:', err);
      
      // More user-friendly error messages
      let errorMessage = err.message;
      if (err.message.includes('rate limit')) {
        errorMessage = `${err.message} Try refreshing the page in a few minutes.`;
      } else if (err.message.includes('authentication')) {
        errorMessage = 'Please sign out and sign back in to refresh your GitHub access.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [session?.user, filterType, sortBy]); // Removed 'loading' and 'page' from dependencies

  // Debounced fetch function
  const debouncedFetch = useCallback(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    debounceTimeout.current = setTimeout(() => {
      if (session?.user) {
        // Check cache first
        const cacheKey = `${filterType}-${sortBy}`;
        if (repositoryCache.current[cacheKey] && Date.now() - repositoryCache.current[cacheKey].timestamp < 60000) {
          // Use cached data if less than 1 minute old
          setRepositories(repositoryCache.current[cacheKey].data);
          setRepositoryStatus(repositoryCache.current[cacheKey].status || {});
          return;
        }
        
        setRepositories([]);
        setPage(1);
        fetchRepositories(true);
      }
    }, 300); // 300ms debounce
  }, [session?.user, filterType, sortBy, fetchRepositories]);

  // Initial load with debounce
  useEffect(() => {
    debouncedFetch();
    
    // Cleanup timeout on unmount
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [debouncedFetch]);

  // Filter repositories by search query
  const filteredRepositories = repositories.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle repository selection
  const handleRepositorySelect = (repository) => {
    if (disabled) return;
    onRepositorySelect(repository);
  };

  // Load more repositories
  const loadMore = () => {
    if (hasMore && !loading) {
      fetchRepositories();
    }
  };

  // Handle successful repository creation
  const handleRepositoryCreated = (newRepository) => {
    fetchRepositories(true);
    if (newRepository) {
      handleRepositorySelect(newRepository);
    }
  };

  if (!session?.user) {
    return (
      <div className="text-center py-8">
        <CodeBracketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Please sign in with GitHub to select repositories</p>
      </div>
    );
  }

  if (!session.user.githubAccessToken) {
    return (
      <div className="text-center py-8">
        <CodeBracketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">GitHub integration required to access repositories</p>
        <p className="text-sm text-gray-500 mt-2">Please connect your GitHub account in the integrations page</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header with Search and Filters */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Select Repository</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={disabled}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon className="-ml-0.5 mr-2 h-4 w-4" />
            Create New Repository
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={disabled}
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={disabled}
          >
            <option value="all">All repositories</option>
            <option value="owner">Owned by me</option>
            <option value="collaborator">Collaborator</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={disabled}
          >
            <option value="updated">Recently updated</option>
            <option value="created">Recently created</option>
            <option value="pushed">Recently pushed</option>
            <option value="full_name">Name</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={() => fetchRepositories(true)}
                className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recently Analyzed Section */}
      {recentlyAnalyzed.length > 0 && (
        <div className="border-b border-gray-200">
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => setShowRecentSection(!showRecentSection)}
          >
            <div className="flex items-center space-x-2">
              <DocumentTextIcon className="h-5 w-5 text-blue-600" />
              <h4 className="font-medium text-gray-900">
                Recently Analyzed ({recentlyAnalyzed.length})
              </h4>
            </div>
            {showRecentSection ? (
              <ChevronDownIcon className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-gray-400" />
            )}
          </div>
          
          {showRecentSection && (
            <div className="pb-2">
              {recentlyAnalyzed.slice(0, 5).map((repo) => (
                <RecentRepositoryItem 
                  key={repo.repositoryId || `${repo.owner}/${repo.name}`}
                  repository={repo}
                  onSelect={() => {
                    const fullRepo = repositories.find(r => 
                      r.id?.toString() === repo.repositoryId || r.full_name === repo.fullName
                    );
                    if (fullRepo) {
                      handleRepositorySelect(fullRepo);
                    }
                  }}
                  selected={selectedRepository?.full_name === repo.fullName}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Repositories Section */}
      <div className="">
        {recentlyAnalyzed.length > 0 && (
          <div className="flex items-center space-x-2 p-4 pb-2 border-b border-gray-100">
            <CodeBracketIcon className="h-5 w-5 text-gray-600" />
            <h4 className="font-medium text-gray-900">All Repositories</h4>
          </div>
        )}
        
        <div className="max-h-96 overflow-y-auto">
          {filteredRepositories.length === 0 && !loading && (
            <div className="text-center py-8">
              <CodeBracketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchQuery ? 'No repositories match your search' : 'No repositories found'}
              </p>
            </div>
          )}

          {filteredRepositories.map((repository) => {
            const repoKey = repository.id?.toString();
            const status = repositoryStatus[repoKey] || repositoryStatus[repository.full_name];
            
            return (
              <RepositoryItem
                key={repository.id}
                repository={repository}
                selected={selectedRepository?.id === repository.id}
                onSelect={() => handleRepositorySelect(repository)}
                disabled={disabled}
                workflowType={workflowType}
                analysisStatus={status}
                loadingStatus={loadingStatus}
              />
            );
          })}

          {hasMore && !loading && filteredRepositories.length > 0 && (
            <div className="p-4 text-center border-t">
              <button
                onClick={loadMore}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-500"
                disabled={disabled}
              >
                Load more repositories
              </button>
            </div>
          )}

          {loading && (
            <div className="p-4 text-center">
              <div className="inline-flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Loading repositories...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Repository Modal */}
      <CreateRepositoryModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleRepositoryCreated}
      />
    </div>
  );
};

// Recent Repository Item Component
const RecentRepositoryItem = ({ repository, selected, onSelect, disabled }) => {
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  return (
    <div
      className={`
        px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-l-4
        ${selected ? 'bg-blue-50 border-l-blue-500' : 'border-l-transparent'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {repository.fullName}
            </h4>
            <span className="text-xs text-gray-500">
              {formatTimeAgo(repository.analyzedAt)}
            </span>
          </div>
          {repository.metrics && (
            <div className="flex items-center space-x-3 text-xs text-gray-500">
              <span>{repository.metrics.fileCount?.toLocaleString()} files</span>
              <span>{repository.metrics.totalLines?.toLocaleString()} LOC</span>
              <span>{repository.metrics.languageCount} languages</span>
            </div>
          )}
        </div>
        <div className="ml-2">
          <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            View Analysis
          </button>
        </div>
      </div>
    </div>
  );
};

// Repository Item Component
const RepositoryItem = ({ repository, selected, onSelect, disabled, workflowType, analysisStatus, loadingStatus }) => {
  const bmadContext = repository.bmad_context || {};
  const isWorkflowReady = bmadContext.workflow_ready;
  const hasExistingArtifacts = bmadContext.has_existing_artifacts;
  const suggestedWorkflow = bmadContext.suggested_workflow;
  const complexity = bmadContext.estimated_complexity;

  const getWorkflowCompatibility = () => {
    if (hasExistingArtifacts) {
      return {
        status: 'warning',
        message: 'Contains existing BMAD artifacts',
        icon: ExclamationTriangleIcon
      };
    }
    
    if (suggestedWorkflow === workflowType) {
      return {
        status: 'recommended',
        message: `Recommended for ${workflowType}`,
        icon: CheckCircleIcon
      };
    }
    
    return {
      status: 'compatible',
      message: 'Compatible with workflow',
      icon: InformationCircleIcon
    };
  };

  const compatibility = getWorkflowCompatibility();

  // Analysis status badge
  const getAnalysisStatus = () => {
    if (loadingStatus) {
      return {
        status: 'loading',
        icon: ArrowPathIcon,
        color: 'bg-gray-100 text-gray-600',
        text: 'Checking...'
      };
    }
    
    if (!analysisStatus) {
      return {
        status: 'not-analyzed',
        icon: null,
        color: 'bg-gray-100 text-gray-600',
        text: 'Not analyzed'
      };
    }

    switch (analysisStatus.status) {
      case 'completed':
        const timeAgo = formatTimeAgo(analysisStatus.analyzedAt);
        return {
          status: 'completed',
          icon: CheckCircleIcon,
          color: 'bg-green-100 text-green-700',
          text: `Analyzed ${timeAgo}`,
          metrics: analysisStatus.metrics
        };
      case 'processing':
      case 'pending':
        return {
          status: 'processing',
          icon: ArrowPathIcon,
          color: 'bg-yellow-100 text-yellow-700',
          text: 'Analyzing...'
        };
      case 'failed':
        return {
          status: 'failed',
          icon: ExclamationTriangleIcon,
          color: 'bg-red-100 text-red-700',
          text: 'Analysis failed'
        };
      default:
        return {
          status: 'not-analyzed',
          icon: null,
          color: 'bg-gray-100 text-gray-600',
          text: 'Not analyzed'
        };
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return '1d ago';
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  };

  const analysisInfo = getAnalysisStatus();

  return (
    <div
      className={`
        p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors
        ${selected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {repository.name}
            </h3>
            <span className="text-xs text-gray-500">
              by {repository.owner.login}
            </span>
            {repository.private && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                Private
              </span>
            )}
          </div>

          {repository.description && (
            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
              {repository.description}
            </p>
          )}

          <div className="flex items-center space-x-4 text-xs text-gray-500">
            {repository.language && (
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-1 ${getLanguageColor(repository.language)}`}></div>
                {repository.language}
              </div>
            )}
            <div className="flex items-center">
              <StarIconSolid className="h-3 w-3 mr-1 text-yellow-400" />
              {repository.stargazers_count || 0}
            </div>
            <div className="flex items-center">
              <ClockIcon className="h-3 w-3 mr-1" />
              {formatDate(repository.updated_at)}
            </div>
            <div>
              {formatSize(repository.size)}
            </div>
          </div>
        </div>

        {/* Right Side - Analysis Status */}
        <div className="flex flex-col items-end space-y-2 ml-4">
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${analysisInfo.color}`}>
            {analysisInfo.icon && (
              <analysisInfo.icon className={`h-3 w-3 mr-1 ${analysisInfo.status === 'processing' ? 'animate-spin' : ''}`} />
            )}
            {analysisInfo.text}
          </div>
          
          {analysisInfo.metrics && (
            <div className="text-xs text-gray-500 text-right">
              <div>{analysisInfo.metrics.fileCount?.toLocaleString() || 0} files</div>
              <div>{analysisInfo.metrics.totalLines?.toLocaleString() || 0} LOC</div>
            </div>
          )}
          
          <div className="text-xs">
            {analysisInfo.status === 'completed' ? (
              <span className="text-blue-600 font-medium">View Analysis</span>
            ) : analysisInfo.status === 'not-analyzed' ? (
              <span className="text-green-600 font-medium">Analyze</span>
            ) : analysisInfo.status === 'failed' ? (
              <span className="text-orange-600 font-medium">Retry</span>
            ) : (
              <span className="text-gray-500">Processing...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

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

export default GitHubRepositorySelector;