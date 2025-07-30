
'use client';

import { useQuery } from '@tanstack/react-query';

async function fetchWorkflowAnalytics() {
  const response = await fetch('/api/analytics/workflows');
  if (!response.ok) {
    throw new Error('Failed to fetch workflow analytics');
  }
  return response.json();
}

export default function WorkflowAnalytics() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['workflow-analytics'],
    queryFn: fetchWorkflowAnalytics,
  });

  if (isLoading) return <div>Loading analytics...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const stats = data?.data;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        📊 Workflow Analytics
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center">
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats?.totalWorkflows || 0}</p>
          <p className="text-gray-600 dark:text-gray-400">Total Workflows</p>
        </div>
        {
          stats?.byStatus.map(status => (
            <div key={status._id} className="text-center">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{status.count}</p>
              <p className="text-gray-600 dark:text-gray-400">{status._id}</p>
            </div>
          ))
        }
      </div>
    </div>
  );
}
