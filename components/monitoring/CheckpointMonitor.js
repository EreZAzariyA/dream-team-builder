/**
 * Checkpoint Monitor Component
 * Displays workflow checkpoints from database in real-time
 */

'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

const CheckpointMonitor = () => {
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch all checkpoints from database
  const { data: checkpoints, isLoading, error, refetch } = useQuery({
    queryKey: ['checkpoints'],
    queryFn: async () => {
      const response = await fetch('/api/monitoring/checkpoints');
      if (!response.ok) throw new Error('Failed to fetch checkpoints');
      return response.json();
    },
    refetchInterval: autoRefresh ? 5000 : false, // Refresh every 5 seconds
    refetchOnWindowFocus: false
  });

  // Create test checkpoint
  const createTestCheckpoint = async () => {
    try {
      const response = await fetch('/api/monitoring/checkpoints/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: `test_workflow_${Date.now()}`,
          type: 'manual_checkpoint',
          description: 'Test checkpoint from UI'
        })
      });
      
      if (response.ok) {
        refetch(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to create test checkpoint:', error);
    }
  };

  // Clean up test checkpoints
  const cleanupTestCheckpoints = async () => {
    if (!confirm('Are you sure you want to delete all test checkpoints?')) return;
    
    try {
      const response = await fetch('/api/monitoring/checkpoints/test', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Cleaned up ${result.deletedCount} test checkpoints`);
        refetch(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to cleanup test checkpoints:', error);
    }
  };

  // Group checkpoints by workflow
  const groupedCheckpoints = checkpoints?.checkpoints?.reduce((acc, checkpoint) => {
    const workflowId = checkpoint.workflowId;
    if (!acc[workflowId]) acc[workflowId] = [];
    acc[workflowId].push(checkpoint);
    return acc;
  }, {}) || {};

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 h-10 w-10"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error Loading Checkpoints</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
        <button 
          onClick={() => refetch()}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <span className="mr-2">🗄️</span>
              Checkpoint Database Monitor
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Live view of workflow checkpoints stored in MongoDB
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-600">Auto-refresh</span>
            </label>
            
            <button
              onClick={createTestCheckpoint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              + Create Test
            </button>
            
            <button
              onClick={cleanupTestCheckpoints}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              🗑️ Clean Up Tests
            </button>
            
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-6 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {checkpoints?.checkpoints?.length || 0}
            </div>
            <div className="text-sm text-gray-600">Total Checkpoints</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {Object.keys(groupedCheckpoints).length}
            </div>
            <div className="text-sm text-gray-600">Workflows</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round((checkpoints?.totalSize || 0) / 1024)}KB
            </div>
            <div className="text-sm text-gray-600">Total Size</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {checkpoints?.oldestAge || 0}h
            </div>
            <div className="text-sm text-gray-600">Oldest Age</div>
          </div>
        </div>
      </div>

      {/* Checkpoint List */}
      <div className="p-6">
        {Object.keys(groupedCheckpoints).length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-lg mb-2">📝</div>
            <p className="text-gray-600">No checkpoints found in database</p>
            <p className="text-gray-500 text-sm mt-1">
              Create a test checkpoint or run a workflow to see data here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedCheckpoints).map(([workflowId, workflowCheckpoints]) => (
              <div key={workflowId} className="border border-gray-200 rounded-lg">
                <div 
                  className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => setSelectedWorkflow(
                    selectedWorkflow === workflowId ? null : workflowId
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {workflowId}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {workflowCheckpoints.length} checkpoints
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {workflowCheckpoints[0]?.status || 'unknown'}
                      </span>
                      <span className="text-gray-400">
                        {selectedWorkflow === workflowId ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {selectedWorkflow === workflowId && (
                  <div className="p-4 border-t border-gray-200">
                    <div className="space-y-3">
                      {workflowCheckpoints
                        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                        .map((checkpoint) => (
                          <div key={checkpoint.checkpointId} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                                  {checkpoint.type}
                                </span>
                                <span className="text-sm text-gray-600">
                                  Step {checkpoint.step}
                                </span>
                                {checkpoint.currentAgent && (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                    {checkpoint.currentAgent}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-800 mt-1">
                                {checkpoint.description}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(checkpoint.timestamp).toLocaleString()}
                                {checkpoint.stateSize && (
                                  <span className="ml-2">
                                    • {Math.round(checkpoint.stateSize / 1024)}KB
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="text-xs text-gray-400 font-mono">
                              {checkpoint.checkpointId.slice(-8)}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckpointMonitor;