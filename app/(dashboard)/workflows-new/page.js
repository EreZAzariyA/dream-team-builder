
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const WorkflowsNewPage = () => {
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

  const getUniqueAgents = (sequence) => {
    if (!sequence) return [];
    const agents = sequence.reduce((acc, step) => {
      if (step.agent) {
        acc.push(...step.agent.split('/'));
      }
      return acc;
    }, []);
    return [...new Set(agents)];
  };

  return (
    <div className="p-8">
      <h1 className="text-h1 font-semibold text-gray-800 dark:text-white mb-8">Select a Workflow</h1>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-white dark:bg-gray-800 shadow-md animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {workflows.map((workflow) => (
            <Link href={`/workflows-new/${workflow.id}`} key={workflow.id}>
              <Card className="bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer group">
                <CardHeader>
                  <CardTitle className="text-h4 text-gray-800 dark:text-white">{workflow.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-body text-gray-600 dark:text-gray-400 mb-4">{workflow.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {getUniqueAgents(workflow.sequence).map((agent) => (
                      <Badge key={agent} variant="secondary">{agent}</Badge>
                    ))}
                  </div>
                  <div className="flex justify-end items-center mt-4">
                    <span className="text-sm font-medium text-primary-600 dark:text-primary-400 group-hover:underline">
                      Select Workflow
                    </span>
                    <ArrowRight className="w-4 h-4 ml-2 text-primary-600 dark:text-primary-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowsNewPage;
