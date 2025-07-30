'use client';

import React from 'react';
import { useSelector } from 'react-redux';
import { selectGeneratedArtifacts } from '../../lib/store/slices/agentSlice';

const AgentOutputPanel = ({ workflowId, agentId = 'default-agent' }) => { // Added agentId prop
  const outputs = useSelector(selectGeneratedArtifacts(workflowId, agentId)); // Use workflowId and agentId

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Agent Outputs: {workflowId}</h2>
      {outputs.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No outputs generated yet.</p>
      ) : (
        <div className="space-y-4">
          {outputs.map((output) => (
            <div key={output.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-900 dark:text-white">{output.agent} - {output.title}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{output.timestamp}</span>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {output.type === 'code' ? (
                  <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded-md overflow-auto text-xs">
                    <code>{output.content}</code>
                  </pre>
                ) : (
                  <p>{output.content}</p>
                )}
              </div>
              {/* Add download/view options here later */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentOutputPanel;
