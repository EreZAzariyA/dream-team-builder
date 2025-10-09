'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  LightBulbIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  CodeBracketIcon,
  ChartBarIcon,
  BugAntIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

/**
 * Repository Insights Component
 * Shows code quality insights, issues, suggestions, and analysis
 */
const RepoInsights = ({ repository, analysisData }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Load insights when component mounts
  useEffect(() => {
    if (analysisData?.id) {
      loadInsights();
    }
  }, [analysisData]);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/repo/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysisId: analysisData.id,
          repositoryId: repository.id
        })
      });

      const result = await response.json();
      if (result.success) {
        setInsights(result.insights);
      }
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInsightIcon = (type) => {
    const iconMap = {
      'bug': BugAntIcon,
      'security': ShieldCheckIcon,
      'performance': ChartBarIcon,
      'quality': CheckCircleIcon,
      'suggestion': LightBulbIcon,
      'warning': ExclamationTriangleIcon,
      'info': InformationCircleIcon
    };
    return iconMap[type] || InformationCircleIcon;
  };

  const getInsightColor = (type, severity = 'medium') => {
    const colorMap = {
      'bug': {
        low: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400',
        medium: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400',
        high: 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400'
      },
      'security': {
        low: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400',
        medium: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400',
        high: 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400'
      },
      'performance': 'text-purple-600 bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400',
      'quality': 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400',
      'suggestion': 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400',
      'warning': 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400',
      'info': 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    };
    
    const color = colorMap[type];
    return typeof color === 'object' ? color[severity] : color;
  };

  // Generate mock insights based on analysis data (replace with actual AI insights)
  const generateMockInsights = () => {
    if (!analysisData?.metrics) return null;

    const { metrics } = analysisData;
    const insights = {
      summary: {
        total: 0,
        critical: 0,
        warnings: 0,
        suggestions: 0
      },
      categories: {
        codeQuality: [],
        security: [],
        performance: [],
        maintainability: []
      },
      files: [],
      suggestions: []
    };

    // Code quality insights based on metrics
    if (metrics.totalLines > 100000) {
      insights.categories.maintainability.push({
        type: 'warning',
        severity: 'medium',
        title: 'Large Codebase',
        description: `Repository has ${metrics.totalLines.toLocaleString()} lines of code, which may impact maintainability.`,
        files: ['Multiple files'],
        suggestion: 'Consider breaking down into smaller modules or microservices.'
      });
      insights.summary.warnings++;
    }

    // Language diversity insight
    if (metrics.languageCount > 5) {
      insights.categories.maintainability.push({
        type: 'info',
        severity: 'low',
        title: 'Multi-Language Project',
        description: `Project uses ${metrics.languageCount} different programming languages.`,
        suggestion: 'Ensure consistent coding standards across all languages.'
      });
    }

    // Large files insight
    if (metrics.largestFiles && metrics.largestFiles.length > 0) {
      const largeFiles = metrics.largestFiles.filter(f => f.lines > 500);
      if (largeFiles.length > 0) {
        insights.categories.codeQuality.push({
          type: 'warning',
          severity: 'medium',
          title: 'Large Files Detected',
          description: `Found ${largeFiles.length} files with over 500 lines of code.`,
          files: largeFiles.slice(0, 3).map(f => f.path),
          suggestion: 'Consider refactoring large files into smaller, more focused modules.'
        });
        insights.summary.warnings++;
      }
    }

    // JavaScript/TypeScript specific insights
    const languages = metrics.languages || {};
    const hasJS = languages['JavaScript'] || languages['javascript'] || false;
    const hasTS = languages['TypeScript'] || languages['typescript'] || false;
    
    if (hasJS && !hasTS) {
      insights.categories.codeQuality.push({
        type: 'suggestion',
        severity: 'low',
        title: 'Consider TypeScript Migration',
        description: 'Project uses JavaScript but could benefit from TypeScript for better type safety.',
        suggestion: 'Gradual migration to TypeScript can improve code quality and developer experience.'
      });
      insights.summary.suggestions++;
    }

    // Test coverage suggestion
    const hasTests = metrics.languages && Object.keys(languages).some(lang => 
      lang.toLowerCase().includes('test') || lang.toLowerCase().includes('spec')
    ) || (metrics.largestFiles && metrics.largestFiles.some(file => 
      file.path.toLowerCase().includes('test') || file.path.toLowerCase().includes('spec')
    ));
    
    if (!hasTests) {
      insights.categories.codeQuality.push({
        type: 'warning',
        severity: 'high',
        title: 'No Test Files Detected',
        description: 'Repository appears to lack automated tests.',
        suggestion: 'Add unit tests and integration tests to improve code reliability.'
      });
      insights.summary.critical++;
    }

    // Documentation insight
    const hasReadme = metrics.largestFiles?.some(f => 
      f.path.toLowerCase().includes('readme')
    );
    
    if (!hasReadme) {
      insights.categories.maintainability.push({
        type: 'suggestion',
        severity: 'medium',
        title: 'Missing Documentation',
        description: 'No README file found in repository.',
        suggestion: 'Add a comprehensive README with setup instructions and project overview.'
      });
      insights.summary.suggestions++;
    }

    insights.summary.total = insights.summary.critical + insights.summary.warnings + insights.summary.suggestions;

    return insights;
  };

  const mockInsights = generateMockInsights();
  const displayInsights = insights || mockInsights;

  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'quality', name: 'Code Quality', icon: CheckCircleIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
    { id: 'performance', name: 'Performance', icon: ChartBarIcon },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Analyzing repository for insights...</p>
        </div>
      </div>
    );
  }

  if (!displayInsights) {
    return (
      <div className="text-center py-8">
        <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Unable to generate insights for this repository
        </p>
      </div>
    );
  }

  const renderInsightCard = (insight, index) => {
    const Icon = getInsightIcon(insight.type);
    const colorClass = getInsightColor(insight.type, insight.severity);

    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start space-x-3">
          <div className={`p-2 rounded-lg ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 dark:text-white">
                {insight.title}
              </h4>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                {insight.severity}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {insight.description}
            </p>
            
            {insight.files && insight.files.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Affected files:
                </p>
                <div className="space-y-1">
                  {insight.files.slice(0, 3).map((file, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                        {file}
                      </span>
                    </div>
                  ))}
                  {insight.files.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{insight.files.length - 3} more files
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {insight.suggestion && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-3">
                <div className="flex items-start space-x-2">
                  <LightBulbIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {insight.suggestion}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Issues</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayInsights.summary?.total || 0}
              </p>
            </div>
            <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Critical</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {displayInsights.summary?.critical || 0}
              </p>
            </div>
            <BugAntIcon className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Warnings</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {displayInsights.summary?.warnings || 0}
              </p>
            </div>
            <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Suggestions</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {displayInsights.summary?.suggestions || 0}
              </p>
            </div>
            <LightBulbIcon className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              All Insights
            </h3>
            {Object.values(displayInsights.categories || {})
              .flat()
              .map((insight, index) => renderInsightCard(insight, index))
            }
            
            {Object.values(displayInsights.categories || {}).flat().length === 0 && (
              <div className="text-center py-8">
                <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Great job! 
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  No major issues detected in your repository.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Code Quality Issues
            </h3>
            {displayInsights.categories?.codeQuality?.map((insight, index) => 
              renderInsightCard(insight, index)
            )}
            {!displayInsights.categories?.codeQuality?.length && (
              <p className="text-gray-600 dark:text-gray-400">No code quality issues found.</p>
            )}
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Security Insights
            </h3>
            {displayInsights.categories?.security?.map((insight, index) => 
              renderInsightCard(insight, index)
            )}
            {!displayInsights.categories?.security?.length && (
              <p className="text-gray-600 dark:text-gray-400">No security issues detected.</p>
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Performance Insights
            </h3>
            {displayInsights.categories?.performance?.map((insight, index) => 
              renderInsightCard(insight, index)
            )}
            {!displayInsights.categories?.performance?.length && (
              <p className="text-gray-600 dark:text-gray-400">No performance issues found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RepoInsights;