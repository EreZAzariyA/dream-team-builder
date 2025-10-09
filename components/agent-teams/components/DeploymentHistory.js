'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { 
  Clock, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

/**
 * Deployment History Component
 * Shows user's previous agent team deployments with status and actions
 */
const DeploymentHistory = () => {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchDeploymentHistory = async () => {
      try {
        const response = await fetch('/api/agent-teams/history');
        const result = await response.json();
        
        if (result.success) {
          setDeployments(result.deployments || []);
        } else {
          setError(result.error || 'Failed to load deployment history');
        }
      } catch (err) {
        setError('Error fetching deployment history: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDeploymentHistory();
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'active':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'active':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatRelativeTime = (timestamp) => {
    const now = new Date();
    const deployTime = new Date(timestamp);
    const diffMs = now - deployTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleRedeploy = async (deployment) => {
    if (!confirm(`Redeploy "${deployment.name}" with the same configuration?`)) {
      return;
    }

    try {
      const response = await fetch('/api/agent-teams/redeploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deploymentId: deployment._id })
      });

      const result = await response.json();
      if (result.success) {
        window.location.href = `/agent-teams/${result.teamInstanceId}/${result.workflowInstanceId}/live`;
      } else {
        alert(`Failed to redeploy: ${result.error}`);
      }
    } catch (error) {
      alert(`Redeploy failed: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">Error loading deployment history</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (deployments.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400">No deployment history yet</p>
            <p className="text-sm text-gray-500 mt-1">Your team deployments will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentDeployments = isExpanded ? deployments : deployments.slice(0, 3);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                Deployment History
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {deployments.length} total deployment{deployments.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          {deployments.length > 3 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show All ({deployments.length})
                </>
              )}
            </button>
          )}
        </div>

        <div className="space-y-3">
          {recentDeployments.map((deployment) => (
            <div
              key={deployment._id}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(deployment.deployment?.status)}
                  <Badge className={getStatusColor(deployment.deployment?.status)}>
                    {deployment.deployment?.status || 'unknown'}
                  </Badge>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-800 dark:text-white">
                      {deployment.name}
                    </h3>
                    <span className="text-sm text-gray-500">
                      ({deployment.teamId})
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {deployment.deployment?.selectedWorkflow?.workflowName && (
                      <span className="mr-4">
                        Workflow: {deployment.deployment.selectedWorkflow.workflowName}
                      </span>
                    )}
                    {deployment.deployment?.projectContext?.type && (
                      <span className="mr-4">
                        Type: {deployment.deployment.projectContext.type}
                      </span>
                    )}
                    <span>
                      {formatRelativeTime(deployment.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Redeploy Button */}
                <button
                  onClick={() => handleRedeploy(deployment)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Redeploy with same configuration"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* View Live Button - Only for active deployments */}
                {deployment.deployment?.status === 'active' && deployment.teamInstanceId && (
                  <a
                    href={`/agent-teams/${deployment.teamInstanceId}/${deployment.workflowInstanceId || 'default'}/live`}
                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="View live deployment"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {deployments.length > 3 && !isExpanded && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsExpanded(true)}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              View {deployments.length - 3} more deployments
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeploymentHistory;