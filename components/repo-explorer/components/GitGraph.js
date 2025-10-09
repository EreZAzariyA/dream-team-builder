'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  ClockIcon,
  UserIcon,
  CodeBracketIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeBracketSquareIcon
} from '@heroicons/react/24/outline';

/**
 * Git Graph Component
 * Displays repository commits, branches, and git history visualization
 */
export const GitGraph = ({ repository, analysisData }) => {
  const [gitData, setGitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [expandedCommits, setExpandedCommits] = useState(new Set());
  const [viewMode, setViewMode] = useState('commits'); // commits, branches, graph

  useEffect(() => {
    if (repository && !selectedBranch) {
      // First load: get repository info to determine default branch
      loadRepositoryInfo();
    } else if (repository && selectedBranch) {
      // Subsequent loads: load git data for selected branch
      loadGitData();
    }
  }, [repository, selectedBranch]);

  const loadRepositoryInfo = async () => {
    if (!repository) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Loading repository info for:', repository.owner.login, repository.name);
      const response = await fetch(`/api/github/repositories/${repository.owner.login}/${repository.name}`);
      if (!response.ok) {
        throw new Error('Failed to fetch repository info');
      }

      const repoData = await response.json();
      console.log('Repository data received:', repoData);
      const defaultBranch = repoData.context?.git?.default_branch || 'main';
      console.log('Default branch detected:', defaultBranch);
      
      setSelectedBranch(defaultBranch);
    } catch (error) {
      console.error('Error loading repository info:', error);
      // Fallback to master since the error logs showed main was not found
      setSelectedBranch('master');
    }
  };

  const loadGitData = async () => {
    if (!repository) return;

    setLoading(true);
    setError(null);

    try {
      // Load commits and branches in parallel
      const [commitsResponse, branchesResponse] = await Promise.all([
        fetch(`/api/github/git/commits?owner=${repository.owner.login}&repo=${repository.name}&branch=${selectedBranch}&per_page=30`),
        fetch(`/api/github/repositories/${repository.owner.login}/${repository.name}`)
      ]);

      if (!commitsResponse.ok) {
        throw new Error('Failed to fetch git data');
      }

      const commitsData = await commitsResponse.json();
      const repoData = branchesResponse.ok ? await branchesResponse.json() : null;

      setGitData({
        commits: commitsData.data?.commits || [],
        branches: repoData?.context?.git?.branches || [],
        repository: commitsData.data?.repository
      });

    } catch (error) {
      console.error('Error loading git data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCommitExpansion = (sha) => {
    const newExpanded = new Set(expandedCommits);
    if (newExpanded.has(sha)) {
      newExpanded.delete(sha);
    } else {
      newExpanded.add(sha);
    }
    setExpandedCommits(newExpanded);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getBranchColor = (branchName) => {
    const colors = {
      'main': 'bg-blue-500',
      'master': 'bg-blue-500',
      'develop': 'bg-green-500',
      'development': 'bg-green-500',
      'staging': 'bg-yellow-500',
      'production': 'bg-red-500'
    };
    
    // Hash branch name to get consistent color
    let hash = 0;
    for (let i = 0; i < branchName.length; i++) {
      hash = branchName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorOptions = ['bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500'];
    
    return colors[branchName] || colorOptions[Math.abs(hash) % colorOptions.length];
  };

  if (loading || !selectedBranch) {
    return (
      <div className="p-8 text-center">
        <ArrowPathIcon className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          {!selectedBranch ? 'Detecting repository branch...' : 'Loading Git history...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <ExclamationTriangleIcon className="w-8 h-8 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 dark:text-red-400 mb-4">Failed to load Git data</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
        <button 
          onClick={loadGitData}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!gitData?.commits?.length && !gitData?.branches?.length) {
    return (
      <div className="p-8 text-center">
        <CodeBracketSquareIcon className="w-8 h-8 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">No Git history found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <CodeBracketSquareIcon className="w-5 h-5 mr-2" />
            Git History
          </h3>
          {gitData?.repository && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {gitData.repository}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {/* View Mode Selector */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {[
              { id: 'commits', label: 'Commits', icon: ClockIcon },
              { id: 'branches', label: 'Branches', icon: CodeBracketIcon }
            ].map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
                    viewMode === mode.id
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          {/* Branch Selector */}
          {gitData?.branches?.length > 1 && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {gitData.branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {viewMode === 'commits' && (
          <motion.div
            key="commits"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {gitData?.commits?.map((commit, index) => (
              <motion.div
                key={commit.sha}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start space-x-4">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      {index < gitData.commits.length - 1 && (
                        <div className="w-px h-8 bg-gray-200 dark:bg-gray-600 mt-2"></div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Commit Message */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                            {commit.message.split('\n')[0]}
                          </p>
                          {commit.message.split('\n').length > 1 && (
                            <button
                              onClick={() => toggleCommitExpansion(commit.sha)}
                              className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 mt-1 flex items-center"
                            >
                              {expandedCommits.has(commit.sha) ? (
                                <ChevronDownIcon className="w-3 h-3 mr-1" />
                              ) : (
                                <ChevronRightIcon className="w-3 h-3 mr-1" />
                              )}
                              Show more
                            </button>
                          )}
                        </div>
                        <div className="ml-4 flex items-center space-x-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {commit.sha.substring(0, 7)}
                          </span>
                          <a
                            href={commit.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </a>
                        </div>
                      </div>

                      {/* Expanded Message */}
                      {expandedCommits.has(commit.sha) && commit.message.split('\n').length > 1 && (
                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                          <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                            {commit.message.split('\n').slice(1).join('\n').trim()}
                          </pre>
                        </div>
                      )}

                      {/* Author and Date */}
                      <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-1">
                          {commit.author?.avatar_url ? (
                            <img
                              src={commit.author.avatar_url}
                              alt={commit.author.name}
                              className="w-4 h-4 rounded-full"
                            />
                          ) : (
                            <UserIcon className="w-4 h-4" />
                          )}
                          <span>{commit.author?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <ClockIcon className="w-4 h-4" />
                          <span>{formatDate(commit.date)}</span>
                        </div>
                        {commit.stats && (
                          <div className="flex items-center space-x-1">
                            <CodeBracketIcon className="w-4 h-4" />
                            <span>
                              +{commit.stats.additions || 0} -{commit.stats.deletions || 0}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {viewMode === 'branches' && (
          <motion.div
            key="branches"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {gitData?.branches?.map((branch) => (
              <motion.div
                key={branch.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className={`w-3 h-3 rounded-full ${getBranchColor(branch.name)}`}></div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{branch.name}</h4>
                  {branch.name === selectedBranch && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  {branch.commit && (
                    <>
                      <div className="font-mono">
                        Latest: {branch.commit.sha?.substring(0, 7)}
                      </div>
                      {branch.commit.author && (
                        <div>By {branch.commit.author.name}</div>
                      )}
                    </>
                  )}
                </div>

                {branch.name !== selectedBranch && (
                  <button
                    onClick={() => setSelectedBranch(branch.name)}
                    className="mt-3 w-full px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    View Commits
                  </button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GitGraph;