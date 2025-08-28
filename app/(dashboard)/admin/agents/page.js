'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../../lib/react-query';
import AgentGrid from '../../../../components/admin/agents/AgentGrid';
import AgentEditor from '../../../../components/admin/agents/AgentEditor';
import { 
  Plus, 
  Download, 
  Upload, 
  RefreshCw,
  Settings 
} from 'lucide-react';

export default function AdminAgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Fetch agents from API (include inactive agents for admin)
  const { data: agentsData, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: () => fetchWithAuth('/api/bmad/agents?includeInactive=true'),
  });

  const agents = agentsData?.agents || [];

  const handleCreateAgent = () => {
    setSelectedAgent(null);
    setIsCreating(true);
    setShowEditor(true);
  };

  const handleEditAgent = (agent) => {
    setSelectedAgent(agent);
    setIsCreating(false);
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setSelectedAgent(null);
    setIsCreating(false);
    refetch(); // Refresh the agent list
  };

  const handleExportAgents = () => {
    const dataStr = JSON.stringify(agents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bmad-agents-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportAgents = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.json';
    input.multiple = true; // Allow multiple file selection for .md files
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      try {
        let agentsToImport = [];
        
        for (const file of files) {
          const text = await file.text();
          const fileName = file.name;
          
          if (fileName.endsWith('.md')) {
            // Parse BMAD .md file with YAML block
            const yamlMatch = text.match(/```yaml\s*\n([\s\S]*?)\n```/);
            if (!yamlMatch) {
              alert(`Invalid .md file format in ${fileName}. No YAML block found.`);
              return;
            }
            
            try {
              // Use backend API to parse the .md file properly
              const response = await fetch('/api/bmad/agents/parse-md', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                  content: text,
                  fileName: fileName.replace('.md', '')
                }),
              });
              
              if (!response.ok) {
                const errorData = await response.json();
                alert(`Failed to parse ${fileName}: ${errorData.error}`);
                return;
              }
              
              const { agentData } = await response.json();
              agentsToImport.push(agentData);
            } catch (error) {
              alert(`Failed to parse YAML in ${fileName}: ${error.message}`);
              return;
            }
          } else if (fileName.endsWith('.json')) {
            // Parse JSON file (legacy format)
            const jsonData = JSON.parse(text);
            
            if (Array.isArray(jsonData)) {
              agentsToImport.push(...jsonData);
            } else {
              agentsToImport.push(jsonData);
            }
          } else {
            alert(`Unsupported file format: ${fileName}. Please use .md or .json files.`);
            return;
          }
        }

        if (agentsToImport.length === 0) {
          alert('No agents found to import.');
          return;
        }

        const importedAgents = agentsToImport;

        // Validate that each item has required fields
        for (const agent of importedAgents) {
          if (!agent.id || !agent.name || !agent.title) {
            alert(`Invalid agent data: missing required fields (id, name, title) for agent: ${agent.id || 'unknown'}`);
            return;
          }
        }

        // Import each agent
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const agentData of importedAgents) {
          try {
            const response = await fetch('/api/bmad/agents', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ agentData }),
            });

            if (response.ok) {
              successCount++;
            } else {
              const errorData = await response.json();
              errorCount++;
              errors.push(`${agentData.id}: ${errorData.error}`);
            }
          } catch (error) {
            errorCount++;
            errors.push(`${agentData.id}: ${error.message}`);
          }
        }

        let message = `Import completed: ${successCount} agents imported successfully`;
        if (errorCount > 0) {
          message += `, ${errorCount} failed.\n\nErrors:\n${errors.join('\n')}`;
        }
        
        alert(message);
        refetch(); // Refresh the agent list
      } catch (error) {
        alert(`Failed to import agents: ${error.message}`);
      }
    };
    input.click();
  };

  const handleMigrateAgents = async () => {
    if (!confirm('This will migrate agents from .bmad-core/agents/ files to the database. Existing database agents will not be affected. Continue?')) {
      return;
    }

    setIsMigrating(true);
    try {
      const response = await fetch('/api/admin/migrate-agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to migrate agents');
      }

      const result = await response.json();
      
      let message = `Migration completed:\n\n`;
      message += `✅ Successfully migrated: ${result.summary.successCount}\n`;
      message += `⏭️ Skipped (already exists): ${result.summary.skipCount}\n`;
      message += `❌ Errors: ${result.summary.errorCount}\n`;
      message += `📁 Total files processed: ${result.summary.totalFiles}`;

      if (result.errors && result.errors.length > 0) {
        message += `\n\nErrors:\n${result.errors.join('\n')}`;
      }

      alert(message);
      refetch(); // Refresh the agent list
    } catch (error) {
      console.error('Failed to migrate agents:', error);
      alert(`Failed to migrate agents: ${error.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Failed to Load Agents
          </h2>
          <p className="text-red-600 dark:text-red-300 mb-4">
            {error.message || 'An error occurred while loading agents'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Agent Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage BMAD agents, their configurations, and capabilities
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleMigrateAgents}
            disabled={isMigrating}
            className="px-4 py-2 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900 dark:hover:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded-lg flex items-center space-x-2 disabled:opacity-50"
          >
            {isMigrating ? (
              <div className="w-4 h-4 border-2 border-yellow-700 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Settings className="w-4 h-4" />
            )}
            <span>{isMigrating ? 'Migrating...' : 'Migrate from Files'}</span>
          </button>

          <button
            onClick={handleImportAgents}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Import</span>
          </button>

          <button
            onClick={handleExportAgents}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>

          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-lg flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleCreateAgent}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Agent</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Settings className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Agents
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {agents.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <span className="text-green-600 dark:text-green-400 text-sm font-semibold">✓</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Agents
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {agents.filter(agent => agent.commands?.length > 0).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
              <span className="text-purple-600 dark:text-purple-400 text-sm font-semibold">⚡</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Commands
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {agents.reduce((sum, agent) => sum + (agent.commands?.length || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
              <span className="text-orange-600 dark:text-orange-400 text-sm font-semibold">🔗</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Avg Dependencies
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {agents.length > 0 ? Math.round(
                  agents.reduce((sum, agent) => {
                    const deps = agent.dependencies;
                    return sum + (deps ? Object.values(deps).flat().length : 0);
                  }, 0) / agents.length
                ) : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Grid */}
      <AgentGrid 
        agents={agents}
        onEditAgent={handleEditAgent}
        onRefresh={refetch}
      />

      {/* Agent Editor Modal */}
      {showEditor && (
        <AgentEditor
          agent={selectedAgent}
          isCreating={isCreating}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  );
}