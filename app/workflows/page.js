'use client';

import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

const workflows = [
  { id: 1, name: 'Project Phoenix - PRD to Code', status: 'In Progress', agents: ['PM', 'Architect', 'Developer'] },
  { id: 2, name: 'Security Audit - Web App', status: 'Completed', agents: ['Security Analyst', 'QA'] },
  { id: 3, name: 'Onboard New User - Flow Design', status: 'Paused', agents: ['UX Expert'] },
];

const WorkflowsPage = () => {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-h1">Workflows</h1>
        <button className="btn-primary">
          <PlusCircle className="w-5 h-5 mr-2" />
          New Workflow
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {workflows.map(wf => (
            <li key={wf.id} className="p-4 flex justify-between items-center">
              <Link href={`/workflow-visualization?id=${wf.id}`} className="w-full">
                <div>
                  <p className="text-body font-semibold text-professional">{wf.name}</p>
                  <p className="text-body-small text-professional-muted">Agents: {wf.agents.join(', ')}</p>
                </div>
                <div>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${{
                    'In Progress': 'bg-blue-100 text-blue-800',
                    'Completed': 'bg-green-100 text-green-800',
                    'Paused': 'bg-yellow-100 text-yellow-800',
                  }[wf.status]}`}>
                    {wf.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default WorkflowsPage;