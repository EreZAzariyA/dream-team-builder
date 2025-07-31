'use client';

import { useState } from 'react';
import { PlusCircle, Search, Filter, MoreVertical, Play, Pause, Archive } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const workflows = [
  { id: 1, name: 'Project Phoenix - PRD to Code', status: 'In Progress', agents: ['PM', 'Architect', 'Developer'], template: 'fullstack-app', progress: 75 },
  { id: 2, name: 'Security Audit - Web App', status: 'Completed', agents: ['Security Analyst', 'QA'], template: 'code-review', progress: 100 },
  { id: 3, name: 'Onboard New User - Flow Design', status: 'Paused', agents: ['UX Expert'], template: 'mobile-app', progress: 45 },
  { id: 4, name: 'API Documentation Update', status: 'In Progress', agents: ['PM', 'Developer', 'Technical Writer'], template: 'api-documentation', progress: 60 },
  { id: 5, name: 'Sales Data Analysis', status: 'Completed', agents: ['Data Analyst', 'Developer', 'UX Expert'], template: 'data-analysis', progress: 100 },
];

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

const WorkflowsPage = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');

  const categories = [
    { id: 'all', name: 'All Templates', icon: '🎯' },
    { id: 'development', name: 'Development', icon: '💻' },
    { id: 'documentation', name: 'Documentation', icon: '📚' },
    { id: 'quality', name: 'Quality Assurance', icon: '🔍' },
    { id: 'analytics', name: 'Analytics', icon: '📊' }
  ];

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || workflow.status.toLowerCase().replace(' ', '-') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredTemplates = predefinedTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(templateSearchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(templateSearchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'Completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'Paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getTemplateInfo = (templateId) => {
    return predefinedTemplates.find(t => t.id === templateId);
  };

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

  const handleSelectTemplate = (template) => {
    // Navigate to chat route with template information
    const templateParams = new URLSearchParams({
      template: template.id,
      name: template.name,
      category: template.category,
      complexity: template.complexity,
      agents: template.agents.join(','),
      features: template.features?.join(',') || ''
    });
    
    router.push(`/chat?${templateParams.toString()}`);
  };

  return (
    <div className="flex h-full">
      {/* Template Sidebar */}
      <div className="w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-h3 text-gray-900 dark:text-white font-semibold mb-2">Templates</h2>
          <p className="text-body-small text-gray-600 dark:text-gray-400">
            Browse and start new workflows
          </p>
        </div>

        {/* Template Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={templateSearchQuery}
              onChange={(e) => setTemplateSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex-1 p-4">
          <h3 className="text-body-small font-semibold text-gray-900 dark:text-white mb-3">Categories</h3>
          <div className="space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-body-small transition-colors ${
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-h1 text-gray-900 dark:text-white">Workflows</h1>
              <p className="text-body text-gray-600 dark:text-gray-400 mt-1">
                Manage and monitor your AI agent workflows
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <Link 
                href="/chat"
                className="btn-primary"
              >
                <PlusCircle className="w-5 h-5 mr-2" />
                New Workflow
              </Link>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Template Gallery View */}
          <div>
            {/* Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-6 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:scale-105 bg-white dark:bg-gray-800"
                  onClick={() => handleSelectTemplate(template)}
                >
                  {/* Template Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${getTemplateColor(template.color)} flex items-center justify-center text-white text-xl`}>
                      {template.icon}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getComplexityColor(template.complexity)}`}>
                      {template.complexity}
                    </span>
                  </div>

                  {/* Template Info */}
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{template.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{template.description}</p>

                  {/* Features */}
                  {template.features && (
                    <div className="mb-4">
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

            {/* Empty State */}
            {filteredTemplates.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 dark:text-gray-600 text-6xl mb-4">🎯</div>
                <h3 className="text-h3 text-gray-900 dark:text-white mb-2">No templates found</h3>
                <p className="text-body text-gray-600 dark:text-gray-400 mb-6">
                  Try selecting a different category or adjusting your search criteria
                </p>
              </div>
            )}
          </div>
        </div>
        
      </div>

    </div>
  );
};

export default WorkflowsPage;
