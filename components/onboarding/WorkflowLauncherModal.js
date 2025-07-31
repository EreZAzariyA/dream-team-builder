'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

async function fetchWorkflowTemplates() {
  const response = await fetch('/api/workflow-templates');
  if (!response.ok) {
    throw new Error('Failed to fetch workflow templates');
  }
  return response.json();
}

async function fetchBmadAgents() {
  const response = await fetch('/api/bmad/agents');
  if (!response.ok) {
    throw new Error('Failed to fetch BMAD agents');
  }
  return response.json();
}

export default function WorkflowLauncherModal({ isOpen, onClose, onSelectTemplate, onStartFromScratch, preselectedTemplate = null, isStarting = false }) {
  const [selectedTab, setSelectedTab] = useState('templates');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [workflowName, setWorkflowName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  // Set preselected template when modal opens
  useEffect(() => {
    if (isOpen && preselectedTemplate) {
      setSelectedTemplate(preselectedTemplate);
      setWorkflowName(`My ${preselectedTemplate.name} Project`);
    } else if (!isOpen) {
      setSelectedTemplate(null);
      setWorkflowName('');
      setProjectDescription('');
    }
  }, [isOpen, preselectedTemplate]);

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: fetchWorkflowTemplates,
    enabled: isOpen
  });

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['bmad-agents'],
    queryFn: fetchBmadAgents,
    enabled: isOpen
  });

  const templates = templatesData?.data || [];
  const agents = agentsData?.agents || [];

  // Predefined workflow templates for demonstration
  const predefinedTemplates = [
    {
      id: 'fullstack-app',
      name: 'Full-Stack Application',
      description: 'Complete web application with frontend, backend, and database',
      category: 'development',
      complexity: 'Advanced',
      estimatedTime: '25-30 minutes',
      agents: ['PM', 'Architect', 'Developer', 'QA'],
      icon: '🌐',
      color: 'blue',
      features: ['React Frontend', 'Node.js API', 'Database Design', 'Authentication']
    },
    {
      id: 'api-documentation',
      name: 'API Documentation',
      description: 'Comprehensive API documentation with interactive examples',
      category: 'documentation',
      complexity: 'Beginner',
      estimatedTime: '10-15 minutes',
      agents: ['PM', 'Developer', 'Technical Writer'],
      icon: '📚',
      color: 'green',
      features: ['OpenAPI Specs', 'Code Examples', 'Interactive Docs', 'Postman Collection']
    },
    {
      id: 'code-review',
      name: 'Code Review Process',
      description: 'Automated code analysis and review recommendations',
      category: 'quality',
      complexity: 'Intermediate',
      estimatedTime: '15-20 minutes',
      agents: ['Architect', 'Developer', 'QA', 'Security Expert'],
      icon: '🔍',
      color: 'purple',
      features: ['Static Analysis', 'Security Scan', 'Performance Review', 'Best Practices']
    },
    {
      id: 'mobile-app',
      name: 'Mobile Application',
      description: 'Cross-platform mobile app with React Native',
      category: 'development',
      complexity: 'Advanced',
      estimatedTime: '30-35 minutes',
      agents: ['PM', 'UX Expert', 'Developer', 'QA'],
      icon: '📱',
      color: 'indigo',
      features: ['React Native', 'Cross-platform', 'UI/UX Design', 'App Store Ready']
    },
    {
      id: 'data-analysis',
      name: 'Data Analysis Pipeline',
      description: 'Complete data processing and visualization workflow',
      category: 'analytics',
      complexity: 'Intermediate',
      estimatedTime: '20-25 minutes',
      agents: ['Data Analyst', 'Developer', 'UX Expert'],
      icon: '📊',
      color: 'orange',
      features: ['Data Processing', 'Visualizations', 'Reports', 'Dashboards']
    }
  ];

  const allTemplates = [...predefinedTemplates, ...templates];

  const categories = [
    { id: 'all', name: 'All Templates', icon: '🎯' },
    { id: 'development', name: 'Development', icon: '💻' },
    { id: 'documentation', name: 'Documentation', icon: '📚' },
    { id: 'quality', name: 'Quality Assurance', icon: '🔍' },
    { id: 'analytics', name: 'Analytics', icon: '📊' }
  ];

  const filteredTemplates = allTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getComplexityColor = (complexity) => {
    switch (complexity) {
      case 'Beginner': return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400';
      case 'Intermediate': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'Advanced': return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getTemplateColor = (color) => {
    const colors = {
      blue: 'from-blue-500 to-blue-600',
      green: 'from-green-500 to-green-600',
      purple: 'from-purple-500 to-purple-600',
      indigo: 'from-indigo-500 to-indigo-600',
      orange: 'from-orange-500 to-orange-600'
    };
    return colors[color] || colors.blue;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-6xl max-h-[90vh] mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Choose Your Starting Point</h2>
              <p className="text-blue-100 mt-1">Select a template or start from scratch</p>
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

        {/* Navigation Tabs */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-1">
            {[
              { id: 'templates', name: 'Template Gallery', icon: '📋' },
              { id: 'scratch', name: 'From Scratch', icon: '✨' },
              { id: 'recent', name: 'Recent Workflows', icon: '🕒' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedTab === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {selectedTab === 'templates' && (
            <div className="h-full flex">
              {/* Sidebar */}
              <div className="w-64 bg-gray-50 dark:bg-gray-900 p-4 border-r border-gray-200 dark:border-gray-700">
                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                    />
                    <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Categories</h3>
                  <div className="space-y-1">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedCategory === category.id
                            ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <span className="mr-2">{category.icon}</span>
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Template Grid */}
              <div className="flex-1 p-6 overflow-y-auto">
                {templatesLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:scale-105 ${
                          selectedTemplate?.id === template.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        {/* Template Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${getTemplateColor(template.color)} flex items-center justify-center text-white text-xl`}>
                            {template.icon}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getComplexityColor(template.complexity)}`}>
                            {template.complexity}
                          </span>
                        </div>

                        {/* Template Info */}
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{template.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{template.description}</p>

                        {/* Features */}
                        {template.features && (
                          <div className="mb-3">
                            <div className="flex flex-wrap gap-1">
                              {template.features.slice(0, 3).map((feature, idx) => (
                                <span key={idx} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded-full text-gray-600 dark:text-gray-400">
                                  {feature}
                                </span>
                              ))}
                              {template.features.length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded-full text-gray-600 dark:text-gray-400">
                                  +{template.features.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Agents & Time */}
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center">
                            <span className="mr-1">👥</span>
                            {template.agents?.length || 0} agents
                          </div>
                          <div className="flex items-center">
                            <span className="mr-1">⏱️</span>
                            {template.estimatedTime}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedTab === 'scratch' && (
            <div className="p-8 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-4xl text-white mx-auto mb-6">
                  ✨
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Start From Scratch</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Create a custom workflow by selecting your own agents and defining your project requirements.
                </p>
                <button
                  onClick={onStartFromScratch}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
                >
                  Start Custom Workflow
                </button>
              </div>
            </div>
          )}

          {selectedTab === 'recent' && (
            <div className="p-8 text-center">
              <div className="text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">🕒</div>
                <h3 className="text-xl font-semibold mb-2">No Recent Workflows</h3>
                <p>Your recent workflows will appear here once you start creating them.</p>
              </div>
            </div>
          )}
        </div>

        {/* Configuration Form - Show when template is selected */}
        {selectedTemplate && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Configure Your Workflow</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Workflow Name
                </label>
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder={`My ${selectedTemplate.name} Project`}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Description
                </label>
                <textarea
                  rows={3}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Describe your project requirements and goals..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selectedTemplate && (
                <span>Selected: <strong>{selectedTemplate.name}</strong></span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                disabled={isStarting}
              >
                Cancel
              </button>
              <button
                onClick={() => selectedTemplate && onSelectTemplate(selectedTemplate, workflowName, projectDescription)}
                disabled={!selectedTemplate || isStarting || !workflowName.trim()}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {isStarting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Starting Workflow...
                  </>
                ) : (
                  'Start Workflow'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}