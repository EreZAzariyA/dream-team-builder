'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Activity, 
  Clock, 
  Users, 
  Loader2, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '../../common/Card';
import { Badge } from '../../common/Badge';

/**
 * Workflow Selector Component
 * 
 * Allows users to browse and select active workflows for chat
 * Features:
 * - Search and filter workflows
 * - Real-time status indicators  
 * - Workflow information display
 * - Quick access to recent workflows
 */
const WorkflowSelector = ({ 
  onSelectWorkflow,
  selectedWorkflowId,
  className = "" 
}) => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'completed'

  // Fetch active workflows
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch from both Workflow and AgentTeam collections
        const [workflowsResponse, teamsResponse] = await Promise.all([
          fetch('/api/workflows/active'),
          fetch('/api/agent-teams/active')
        ]);

        let allWorkflows = [];

        // Get regular workflows
        if (workflowsResponse.ok) {
          const workflowsData = await workflowsResponse.json();
          const regularWorkflows = (workflowsData.workflows || []).map(workflow => ({
            ...workflow,
            type: 'workflow',
            displayName: workflow.title || workflow.name || `Workflow ${workflow.workflowId}`,
            workflowInstanceId: workflow.workflowId
          }));
          allWorkflows = [...allWorkflows, ...regularWorkflows];
        }

        // Get team deployments
        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json();
          const teamWorkflows = (teamsData.teams || []).map(team => ({
            ...team,
            type: 'team-deployment',
            displayName: team.teamId ? `Team: ${team.teamId}` : 'Team Deployment',
            workflowInstanceId: team.deployment?.workflowInstanceId || team.teamInstanceId,
            status: team.deployment?.status || 'unknown',
            agents: team.teamConfig?.agentIds || []
          }));
          allWorkflows = [...allWorkflows, ...teamWorkflows];
        }

        setWorkflows(allWorkflows);
      } catch (err) {
        console.error('Error fetching workflows:', err);
        setError('Failed to load workflows. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  // Filter workflows based on search and status
  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.workflowInstanceId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || workflow.status?.toLowerCase() === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paused':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'error':
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString([], { 
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const handleRefresh = () => {
    // Trigger a re-fetch by updating the key
    setWorkflows([]);
    setLoading(true);
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center min-h-32">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600 dark:text-gray-400">Loading workflows...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                Error Loading Workflows
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <Card>
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                Select Workflow
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Choose a workflow to start chatting with its agents
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh workflows"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          {/* Workflows List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredWorkflows.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-800 dark:text-white mb-2">
                  {searchTerm || filterStatus !== 'all' ? 'No Matching Workflows' : 'No Active Workflows'}
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'Try adjusting your search or filters.'
                    : 'No workflows are currently active. Deploy a team or start a workflow to begin chatting.'
                  }
                </p>
              </div>
            ) : (
              filteredWorkflows.map((workflow) => (
                <motion.div
                  key={workflow.workflowInstanceId}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onSelectWorkflow(workflow)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedWorkflowId === workflow.workflowInstanceId
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-800 dark:text-white">
                      {workflow.displayName}
                    </h4>
                    <Badge className={getStatusColor(workflow.status)}>
                      <Activity className="w-3 h-3 mr-1" />
                      {workflow.status || 'Unknown'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatTimestamp(workflow.createdAt || workflow.deployment?.createdAt)}
                    </div>
                    {workflow.agents && workflow.agents.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {workflow.agents.length} agents
                      </div>
                    )}
                    <div className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {workflow.type === 'team-deployment' ? 'Team' : 'Workflow'}
                    </div>
                  </div>

                  {workflow.workflowInstanceId && (
                    <p className="text-xs text-gray-500 mt-2 font-mono">
                      ID: {workflow.workflowInstanceId}
                    </p>
                  )}
                </motion.div>
              ))
            )}
          </div>

          {/* Quick Info */}
          {filteredWorkflows.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="bg-blue-500 text-white p-2 rounded-lg">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Workflow Chat Tips
                  </h4>
                  <ul className="text-blue-700 dark:text-blue-200 text-sm space-y-1">
                    <li>• Messages are sent to the currently active agent in the workflow</li>
                    <li>• You&apos;ll see real-time updates as agents respond and collaborate</li>
                    <li>• Chat history is preserved for the entire workflow session</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkflowSelector;