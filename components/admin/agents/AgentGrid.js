'use client';

import { useState } from 'react';
import { 
  Edit, 
  Trash2, 
  Eye, 
  MoreVertical,
  Command,
  FileText,
  GitBranch,
  Shield,
  ShieldCheck,
  Power,
  PowerOff
} from 'lucide-react';
import { Badge } from '../../common/Badge';

export default function AgentGrid({ agents, onEditAgent, onRefresh }) {
  const [deletingAgent, setDeletingAgent] = useState(null);

  const handleDeleteAgent = async (agent, deleteType = 'default') => {
    const isSystemAgent = agent.isSystemAgent;
    const isActive = agent.isActive;
    
    let confirmMessage;
    let deleteUrl;
    
    if (isSystemAgent) {
      if (deleteType === 'force') {
        confirmMessage = `Are you sure you want to DEACTIVATE the system agent "${agent.name}"?\n\nSystem agents cannot be permanently deleted to preserve BMAD functionality.\nThis will deactivate the agent but it can be reactivated later.`;
        deleteUrl = `/api/bmad/agents?id=${agent.id}&force=true&soft=true`;
      } else {
        alert(`Cannot delete system agent "${agent.name}".\n\nSystem agents are protected to preserve BMAD functionality.\nUse "Deactivate" instead to temporarily disable this agent.`);
        return;
      }
    } else {
      if (deleteType === 'hard') {
        confirmMessage = `Are you sure you want to PERMANENTLY DELETE the custom agent "${agent.name}"?\n\nThis action cannot be undone and will remove all agent data.`;
        deleteUrl = `/api/bmad/agents?id=${agent.id}&hard=true`;
      } else {
        confirmMessage = `Are you sure you want to deactivate the custom agent "${agent.name}"?\n\nThis will disable the agent but preserve its data. It can be reactivated later.`;
        deleteUrl = `/api/bmad/agents?id=${agent.id}`;
      }
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    setDeletingAgent(agent.id);
    try {
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete agent');
      }

      const result = await response.json();
      alert(result.message);
      onRefresh(); // Refresh the agent list
    } catch (error) {
      console.error('Failed to delete agent:', error);
      alert(`Failed to delete agent: ${error.message}`);
    } finally {
      setDeletingAgent(null);
    }
  };

  const handleReactivateAgent = async (agent) => {
    if (!confirm(`Are you sure you want to reactivate the "${agent.name}" agent?`)) {
      return;
    }

    setDeletingAgent(agent.id);
    try {
      const response = await fetch(`/api/bmad/agents?id=${agent.id}&action=reactivate`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reactivate agent');
      }

      const result = await response.json();
      alert(result.message);
      onRefresh(); // Refresh the agent list
    } catch (error) {
      console.error('Failed to reactivate agent:', error);
      alert(`Failed to reactivate agent: ${error.message}`);
    } finally {
      setDeletingAgent(null);
    }
  };
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Filter agents based on search and category
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = !searchTerm || 
      agent.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || 
      (selectedCategory === 'core' && ['analyst', 'pm', 'architect', 'dev', 'qa'].includes(agent.id)) ||
      (selectedCategory === 'workflow' && ['bmad-master', 'bmad-orchestrator', 'sm', 'po'].includes(agent.id)) ||
      (selectedCategory === 'design' && ['ux-expert'].includes(agent.id));

    const matchesType = selectedType === 'all' ||
      (selectedType === 'system' && agent.isSystemAgent) ||
      (selectedType === 'custom' && !agent.isSystemAgent);

    const matchesStatus = selectedStatus === 'all' ||
      (selectedStatus === 'active' && agent.isActive) ||
      (selectedStatus === 'inactive' && !agent.isActive);

    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  const getAgentTypeColor = (agentId) => {
    switch (agentId) {
      case 'analyst': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'pm': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'architect': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'dev': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'qa': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'ux-expert': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      case 'sm': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      case 'po': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Categories</option>
              <option value="core">Core Agents</option>
              <option value="workflow">Workflow Management</option>
              <option value="design">Design & UX</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
              </div>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <div className="w-4 h-4 flex flex-col space-y-1">
                <div className="h-0.5 bg-current rounded"></div>
                <div className="h-0.5 bg-current rounded"></div>
                <div className="h-0.5 bg-current rounded"></div>
              </div>
            </button>
          </div>
        </div>

        {/* Additional Filters */}
        <div className="flex items-center space-x-4">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="system">🔒 System Agents</option>
            <option value="custom">✏️ Custom Agents</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="active">✅ Active</option>
            <option value="inactive">❌ Inactive</option>
          </select>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            {filteredAgents.length} of {agents.length} agents
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map((agent) => (
            <AgentCard 
              key={agent.id} 
              agent={agent} 
              onEdit={onEditAgent}
              onDelete={handleDeleteAgent}
              onReactivate={handleReactivateAgent}
              getTypeColor={getAgentTypeColor}
              isDeleting={deletingAgent === agent.id}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {filteredAgents.map((agent) => (
            <AgentListItem 
              key={agent.id} 
              agent={agent} 
              onEdit={onEditAgent}
              onDelete={handleDeleteAgent}
              onReactivate={handleReactivateAgent}
              getTypeColor={getAgentTypeColor}
              isDeleting={deletingAgent === agent.id}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredAgents.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-400 dark:text-gray-500 mb-2">
            <Command className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No agents found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || selectedCategory !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'No agents are currently configured'
            }
          </p>
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, onEdit, onDelete, onReactivate, getTypeColor, isDeleting }) {
  const dependencyCount = agent.dependencies ? 
    Object.values(agent.dependencies).flat().length : 0;
  
  const isSystemAgent = agent.isSystemAgent;
  const isActive = agent.isActive;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border p-4 hover:shadow-md transition-shadow ${
      isActive 
        ? 'border-gray-200 dark:border-gray-700' 
        : 'border-red-200 dark:border-red-700 bg-gray-50 dark:bg-gray-850'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">
            {agent.icon || '🤖'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className={`font-semibold ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                {agent.name || agent.id}
              </h3>
              {isSystemAgent && (
                <Shield className="w-3 h-3 text-blue-500" title="System Agent" />
              )}
              {!isActive && (
                <PowerOff className="w-3 h-3 text-red-500" title="Inactive" />
              )}
            </div>
            <p className={`text-sm ${isActive ? 'text-gray-600 dark:text-gray-400' : 'text-gray-500 dark:text-gray-500'}`}>
              {agent.title}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onEdit(agent)}
            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            title="Edit agent"
          >
            <Edit className="w-4 h-4" />
          </button>
          
          {!isActive ? (
            <button
              onClick={() => onReactivate(agent)}
              disabled={isDeleting}
              className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 disabled:opacity-50"
              title="Reactivate agent"
            >
              {isDeleting ? (
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
            </button>
          ) : (
            <>
              {isSystemAgent ? (
                <button
                  onClick={() => onDelete(agent, 'force')}
                  disabled={isDeleting}
                  className="p-1 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 disabled:opacity-50"
                  title="Deactivate system agent"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <PowerOff className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <div className="flex space-x-1">
                  <button
                    onClick={() => onDelete(agent, 'default')}
                    disabled={isDeleting}
                    className="p-1 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 disabled:opacity-50"
                    title="Deactivate custom agent"
                  >
                    {isDeleting ? (
                      <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <PowerOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => onDelete(agent, 'hard')}
                    disabled={isDeleting}
                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                    title="Permanently delete custom agent"
                  >
                    {isDeleting ? (
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Agent Badges */}
      <div className="mb-3 flex items-center space-x-2">
        <Badge className={getTypeColor(agent.id)}>
          {agent.id}
        </Badge>
        <Badge className={isSystemAgent 
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        }>
          {isSystemAgent ? '🔒 System' : '✏️ Custom'}
        </Badge>
        {!isActive && (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            Inactive
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
        {agent.description || agent.persona?.identity || 'No description available'}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center space-x-1">
          <Command className="w-3 h-3 text-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">
            {agent.commands?.length || 0} commands
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <GitBranch className="w-3 h-3 text-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">
            {dependencyCount} deps
          </span>
        </div>
      </div>
    </div>
  );
}

function AgentListItem({ agent, onEdit, onDelete, onReactivate, getTypeColor, isDeleting }) {
  const dependencyCount = agent.dependencies ? 
    Object.values(agent.dependencies).flat().length : 0;
  
  const isSystemAgent = agent.isSystemAgent;
  const isActive = agent.isActive;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border p-4 flex items-center justify-between hover:shadow-sm transition-shadow ${
      isActive 
        ? 'border-gray-200 dark:border-gray-700' 
        : 'border-red-200 dark:border-red-700 bg-gray-50 dark:bg-gray-850'
    }`}>
      <div className="flex items-center space-x-4">
        <div className="text-xl">
          {agent.icon || '🤖'}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h3 className={`font-semibold ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              {agent.name || agent.id}
            </h3>
            {isSystemAgent && (
              <Shield className="w-3 h-3 text-blue-500" title="System Agent" />
            )}
            {!isActive && (
              <PowerOff className="w-3 h-3 text-red-500" title="Inactive" />
            )}
          </div>
          <p className={`text-sm ${isActive ? 'text-gray-600 dark:text-gray-400' : 'text-gray-500 dark:text-gray-500'}`}>
            {agent.title}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={getTypeColor(agent.id)}>
            {agent.id}
          </Badge>
          <Badge className={isSystemAgent 
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          }>
            {isSystemAgent ? '🔒 System' : '✏️ Custom'}
          </Badge>
          {!isActive && (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
              Inactive
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <div className={`text-sm ${isActive ? 'text-gray-600 dark:text-gray-400' : 'text-gray-500 dark:text-gray-500'}`}>
          {agent.commands?.length || 0} commands
        </div>
        <div className={`text-sm ${isActive ? 'text-gray-600 dark:text-gray-400' : 'text-gray-500 dark:text-gray-500'}`}>
          {dependencyCount} dependencies
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onEdit(agent)}
            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            title="Edit agent"
          >
            <Edit className="w-4 h-4" />
          </button>
          
          {!isActive ? (
            <button
              onClick={() => onReactivate(agent)}
              disabled={isDeleting}
              className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50"
              title="Reactivate agent"
            >
              {isDeleting ? (
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
            </button>
          ) : (
            <>
              {isSystemAgent ? (
                <button
                  onClick={() => onDelete(agent, 'force')}
                  disabled={isDeleting}
                  className="p-2 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50"
                  title="Deactivate system agent"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <PowerOff className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onDelete(agent, 'default')}
                    disabled={isDeleting}
                    className="p-2 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50"
                    title="Deactivate custom agent"
                  >
                    {isDeleting ? (
                      <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <PowerOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => onDelete(agent, 'hard')}
                    disabled={isDeleting}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50"
                    title="Permanently delete custom agent"
                  >
                    {isDeleting ? (
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}