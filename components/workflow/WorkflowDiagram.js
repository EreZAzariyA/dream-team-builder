
'use client';

import React from 'react';
import { useSelector } from 'react-redux';
import { selectAgentSequence } from '../../lib/store/slices/workflowSlice';
import { selectAvailableAgents } from '../../lib/store/slices/agentSlice';

const WorkflowDiagram = ({ workflowId, currentAgentId }) => {
  const { sequence, currentIndex } = useSelector(selectAgentSequence);
  const availableAgents = useSelector(selectAvailableAgents);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Workflow Diagram: {workflowId}</h2>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {sequence.map((agentId, index) => {
          const agent = availableAgents[agentId];
          if (!agent) return null; // Handle case where agent definition is not found

          const isActive = currentAgentId === agentId; // Use currentAgentId prop for active state

          return (
            <React.Fragment key={agent.id}>
              <div
                className={`flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer ${isActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700'
                }`}
                onClick={() => console.log('Agent clicked:', agent.id)}
              >
                <span className="text-3xl mb-2">{agent.icon}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{agent.name}</span>
              </div>
              {index < sequence.length - 1 && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-gray-400 dark:text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowDiagram;
