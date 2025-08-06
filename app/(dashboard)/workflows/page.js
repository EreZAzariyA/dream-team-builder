'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { WorkflowCard } from '@/components/workflow/WorkflowCard';

const WorkflowsPage = () => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const response = await fetch('/api/workflows');
        if (!response.ok) {
          throw new Error('Failed to fetch workflows');
        }
        const data = await response.json();
        setWorkflows(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-h1 font-semibold text-gray-800 dark:text-white mb-2">BMAD Method Workflows</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Select a workflow to start your AI-powered development project with specialized agents
        </p>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <WorkflowCard
              isLoading={true}
              key={i}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {workflows.map((workflow) => (
            <Link href={`/workflows/${workflow.id}`} key={workflow.id}>
              <WorkflowCard workflow={workflow} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowsPage;
