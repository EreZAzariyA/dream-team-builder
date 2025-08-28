'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  StarIcon,
  EyeIcon,
  CodeBracketIcon,
  CalendarIcon,
  UserIcon,
  TagIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { CodeBracketSquareIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import FormattedAnalysisSummary from './FormattedAnalysisSummary';

const RepoOverview = ({ repository, analysisData, isAnalyzing, onRegenerateSummary, isRefreshingSummary }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getLanguageColor = (language) => {
    const colors = {
      'JavaScript': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      'TypeScript': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      'Python': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      'Java': 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
      'Go': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-300',
      'Rust': 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
      'C++': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
      'HTML': 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-300',
      'CSS': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300',
    };
    return colors[language] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };


  if (!repository) {
    return (
      <div className="text-center py-8">
        <CodeBracketIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">No repository selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Repository Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {repository.name}
            </h2>
            {repository.private && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                Private
              </span>
            )}
          </div>
          
          {repository.description && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {repository.description}
            </p>
          )}

          <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <UserIcon className="w-4 h-4" />
              <span>{repository.owner?.login}</span>
            </div>
            <div className="flex items-center space-x-1">
              <CalendarIcon className="w-4 h-4" />
              <span>Updated {formatDate(repository.updated_at)}</span>
            </div>
            {repository.language && (
              <div className="flex items-center space-x-1">
                <div className={`w-3 h-3 rounded-full bg-gray-400`}></div>
                <span>{repository.language}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
            {repository.stargazers_count > 0 ? (
              <StarIconSolid className="w-4 h-4 text-yellow-500" />
            ) : (
              <StarIcon className="w-4 h-4" />
            )}
            <span>{repository.stargazers_count?.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
            <EyeIcon className="w-4 h-4" />
            <span>{repository.watchers_count?.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
            <CodeBracketSquareIcon className="w-4 h-4" />
            <span>{repository.forks_count?.toLocaleString() || 0}</span>
          </div>
        </div>
      </div>

      {/* Analysis Loading State */}
      {isAnalyzing && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <div>
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Analyzing Repository
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                This may take a few moments depending on repository size...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          
          {/* AI Summary */}
          {analysisData.summary && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-3">
                <DocumentTextIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  AI Analysis Summary
                </h3>
                <button
                  onClick={onRegenerateSummary}
                  disabled={isRefreshingSummary}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRefreshingSummary ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowPathIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              <FormattedAnalysisSummary summary={analysisData.summary} />
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Files</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {analysisData.metrics?.fileCount?.toLocaleString() || 0}
                  </p>
                </div>
                <DocumentTextIcon className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Lines of Code</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {analysisData.metrics?.totalLines?.toLocaleString() || 0}
                  </p>
                </div>
                <CodeBracketIcon className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Languages</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {analysisData.metrics?.languageCount || 0}
                  </p>
                </div>
                <TagIcon className="w-8 h-8 text-purple-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Size</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {analysisData.metrics?.totalSize ? 
                      formatFileSize(analysisData.metrics.totalSize) : 
                      '0 B'
                    }
                  </p>
                </div>
                <ChartBarIcon className="w-8 h-8 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Language Distribution */}
          {analysisData.metrics?.languages && Object.keys(analysisData.metrics.languages).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Language Distribution
              </h3>
              <div className="space-y-3">
                {Object.entries(analysisData.metrics.languages)
                  .sort(([,a], [,b]) => b.percentage - a.percentage)
                  .slice(0, 10)
                  .map(([language, data]) => (
                  <div key={language} className="flex items-center space-x-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {language}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {data.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(data.percentage, 2)}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLanguageColor(language)}`}>
                      {data.lines.toLocaleString()} LOC
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Largest Files */}
          {analysisData.metrics?.largestFiles && analysisData.metrics.largestFiles.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Largest Files
              </h3>
              <div className="space-y-2">
                {analysisData.metrics.largestFiles.slice(0, 10).map((file, index) => (
                  <div key={file.path} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {file.path}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {file.language}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>{file.lines?.toLocaleString() || 0} lines</span>
                      <span>{formatFileSize(file.size || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* No Analysis State */}
      {!isAnalyzing && !analysisData && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-8 text-center">
          <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Repository Analysis
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Analysis will begin automatically after selecting this repository.
          </p>
          <div className="flex items-center justify-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <DocumentTextIcon className="w-4 h-4" />
              <span>File Analysis</span>
            </div>
            <div className="flex items-center space-x-2">
              <ChartBarIcon className="w-4 h-4" />
              <span>Code Metrics</span>
            </div>
            <div className="flex items-center space-x-2">
              <ClockIcon className="w-4 h-4" />
              <span>AI Summary</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(RepoOverview);