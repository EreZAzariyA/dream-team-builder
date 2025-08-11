'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BmadTemplateCard } from '@/components/workflow/BmadTemplateCard';
import BmadAgentInterface from '@/components/workflow/BmadAgentInterface';
import AgentChatLauncher from '@/components/workflow/AgentChatLauncher';
import BmadDocumentSharding from '@/components/workflow/BmadDocumentSharding';
import BmadCoreConfigManager from '@/components/workflow/BmadCoreConfigManager';
import BmadStoryManager from '@/components/workflow/BmadStoryManager';
import { Rocket, Filter, Search, Users, Clock, AlertCircle, Bot, Workflow, Scissors, Settings, FileText, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/common/Card';

const BmadWorkflowsPage = () => {
  const [templates, setTemplates] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'greenfield', 'brownfield'
  const [searchTerm, setSearchTerm] = useState('');
  const [launching, setLaunching] = useState(false);
  const [autoLaunching, setAutoLaunching] = useState(false);
  const [activeTab, setActiveTab] = useState('agents'); // 'workflows', 'agents', 'documents', 'stories', 'config'
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/bmad/workflow-templates');
        if (!response.ok) {
          throw new Error('Failed to fetch BMAD templates');
        }
        const data = await response.json();
        if (data.success) {
          setTemplates(data.templates);
        } else {
          throw new Error(data.error || 'Failed to load templates');
        }
      } catch (error) {
        console.error('Error fetching BMAD templates:', error);
        // Fallback to empty state with error message
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch('/api/bmad/agents');
        if (!response.ok) {
          throw new Error('Failed to fetch BMAD agents');
        }
        const data = await response.json();
        if (data.success) {
          setAgents(data.agents);
        } else {
          throw new Error(data.error || 'Failed to load agents');
        }
      } catch (error) {
        console.error('Error fetching BMAD agents:', error);
        setAgents([]);
      }
    };

    fetchAgents();
  }, []);

  // Filter and search templates
  const filteredTemplates = templates.filter(template => {
    const matchesFilter = filter === 'all' || template.type === filter;
    const matchesSearch = searchTerm === '' || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.project_types.some(type => type.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  const handleTemplateSelect = async (template) => {
    console.log('Template selected for instant launch:', template.id);
    setLaunching(true);
    
    // Instantly launch workflow without modal
    try {
      const response = await fetch('/api/bmad/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userPrompt: 'User wants to start a development project. Project details will be gathered during the workflow.',
          name: `My ${template.name} Project`,
          sequence: template.id,
          description: `${template.name} workflow started instantly`
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Workflow launched instantly:', data.workflowId);
        // Navigate directly to live workflow page
        router.push(`/workflows/live/${data.workflowId}`);
      } else {
        throw new Error(data.error || 'Failed to start workflow');
      }
    } catch (error) {
      console.error('❌ Failed to launch workflow:', error);
      alert(`Failed to start workflow: ${error.message}`);
    } finally {
      setLaunching(false);
    }
  };

  const handleWorkflowLaunch = async (config) => {
    setLaunching(true);
    try {
      const response = await fetch('/api/bmad/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userPrompt: config.userPrompt,
          name: config.name,
          sequence: config.sequence,
          priority: 'normal',
          tags: ['bmad', config.template.type]
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Redirect to live workflow page
        router.push(`/workflows/live/${result.workflowId}`);
      } else {
        throw new Error(result.error || 'Failed to launch workflow');
      }
    } catch (error) {
      console.error('Error launching workflow:', error);
      alert(`Failed to launch workflow: ${error.message}`);
    } finally {
      setLaunching(false);
    }
  };

  // Handle autolaunch from onboarding (after handleWorkflowLaunch is defined)
  useEffect(() => {
    const autolaunch = searchParams?.get('autolaunch');
    const templateId = searchParams?.get('template'); 
    const projectName = searchParams?.get('name');
    const projectDescription = searchParams?.get('description');
    
    if (autolaunch === 'true' && templateId && projectName && projectDescription && templates.length > 0) {
      // Find the template
      const template = templates.find(t => t.id === templateId);
      if (template) {
        console.log('🚀 Auto-launching workflow from onboarding:', { templateId, projectName });
        
        setAutoLaunching(true);
        
        // Auto-launch the workflow
        const config = {
          name: decodeURIComponent(projectName),
          userPrompt: decodeURIComponent(projectDescription),
          template: template,
          sequence: template.sequence || []
        };
        
        // Clear URL params to avoid re-triggering
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        
        handleWorkflowLaunch(config);
      } else {
        console.warn('Template not found for autolaunch:', templateId);
      }
    }
  }, [templates, searchParams]);

  const handleWorkflowStart = (workflowInfo) => {
    console.log('Workflow started:', workflowInfo);
    if (workflowInfo.workflowId) {
      router.push(`/workflows/live/${workflowInfo.workflowId}`);
    }
  };

  const handleDocumentCreated = (documentInfo) => {
    console.log('Document created:', documentInfo);
    // Could show success message or refresh document list
  };

  const getFilterColor = (filterType) => {
    if (filter !== filterType) return 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600';
    
    switch (filterType) {
      case 'greenfield':
        return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-600';
      case 'brownfield':
        return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600';
      default:
        return 'bg-primary-100 text-primary-700 border-primary-300 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-600';
    }
  };

  const greenfieldCount = templates.filter(t => t.type === 'greenfield').length;
  const brownfieldCount = templates.filter(t => t.type === 'brownfield').length;

  // Show autolaunch loading screen
  if (autoLaunching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-6 mx-auto animate-pulse">
            <Rocket className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            🚀 Launching Your BMAD Workflow
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
            Setting up your project with the Analyst, PM, and Architect agents...
          </p>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-1">
              BMAD Method Platform
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Work with AI agents or launch complete workflow templates
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('agents')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'agents'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
            }`}
          >
            <Bot className="w-4 h-4" />
            AI Agents
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'workflows'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
            }`}
          >
            <Workflow className="w-4 h-4" />
            Workflow Templates
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'documents'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
            }`}
          >
            <Scissors className="w-4 h-4" />
            Document Sharding
          </button>
          <button
            onClick={() => setActiveTab('stories')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'stories'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
            }`}
          >
            <FileText className="w-4 h-4" />
            Story Management
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'config'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
            }`}
          >
            <Settings className="w-4 h-4" />
            Core Configuration
          </button>
        </div>

        {/* Stats */}
        {!loading && templates.length > 0 && activeTab === 'workflows' && (
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{agents.length} AI agents available</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{templates.length} workflow templates</span>
            </div>
          </div>
        )}
      </div>

      {/* Content based on active tab */}
      {activeTab === 'agents' ? (
        /* AI Agents Interface */
        <BmadAgentInterface 
          onWorkflowStart={handleWorkflowStart}
          onDocumentCreated={handleDocumentCreated}
        />
      ) : activeTab === 'documents' ? (
        /* Document Sharding Interface */
        <BmadDocumentSharding 
          onShardingComplete={(result) => {
            console.log('Sharding completed:', result);
          }}
        />
      ) : activeTab === 'stories' ? (
        /* Story Management */
        <BmadStoryManager 
          onStorySelect={(story) => {
            console.log('Story selected:', story);
          }}
          onStoryCreate={(story) => {
            console.log('Story created:', story);
          }}
        />
      ) : activeTab === 'config' ? (
        /* Core Configuration Manager */
        <BmadCoreConfigManager />
      ) : (
        /* Workflow Templates Interface */
        <>
          {/* Search and Filter Bar */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search workflows by name, description, or project type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    getFilterColor('all')
                  }`}
                >
                  All ({templates.length})
                </button>
                <button
                  onClick={() => setFilter('greenfield')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    getFilterColor('greenfield')
                  }`}
                >
                  🚀 Greenfield ({greenfieldCount})
                </button>
                <button
                  onClick={() => setFilter('brownfield')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    getFilterColor('brownfield')
                  }`}
                >
                  🔧 Brownfield ({brownfieldCount})
                </button>
              </div>
            </div>
          </div>

          {/* Template Grid */}
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <BmadTemplateCard
                  isLoading={true}
                  key={i}
                />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                  No BMAD Templates Found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Unable to load workflow templates from .bmad-core directory.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Retry
                </button>
              </CardContent>
            </Card>
          ) : filteredTemplates.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                  No Templates Match Your Search
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Try adjusting your search terms or filter settings.
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilter('all');
                  }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Clear Filters
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <BmadTemplateCard
                  key={template.id}
                  template={template}
                  onSelect={handleTemplateSelect}
                  launching={launching}
                />
              ))}
            </div>
          )}

          {/* Results Summary */}
          {!loading && filteredTemplates.length > 0 && (
            <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredTemplates.length} of {templates.length} workflow templates
              {filter !== 'all' && ` (${filter} only)`}
              {searchTerm && ` matching "${searchTerm}"`}
            </div>
          )}
        </>
      )}

      {/* Loading overlay when launching workflow */}
      {launching && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Starting Your Workflow
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Setting up agents and initializing the workflow...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BmadWorkflowsPage;
