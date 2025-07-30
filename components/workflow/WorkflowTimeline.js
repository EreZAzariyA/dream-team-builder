
'use client';

import React from 'react';
import { useSelector } from 'react-redux';
import { selectUpdateHistory } from '../../lib/store/slices/realtimeSlice';

const WorkflowTimeline = ({ workflowId }) => {
  const events = useSelector(selectUpdateHistory(workflowId));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Workflow Timeline: {workflowId}</h2>
      {events.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No events in timeline yet.</p>
      ) : (
        <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-4">
          {events.map((event) => (
            <li key={event.messageId} className="mb-6 ml-6">
              <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-8 ring-white dark:ring-gray-900 dark:bg-blue-900">
                {/* You'll need to map event types to icons based on your liveUpdateReceived payload */}
                {event.type === 'workflow_start' && '🚀'}
                {event.type === 'agent_active' && '🟢'}
                {event.type === 'agent_message' && '💬'}
                {event.type === 'agent_output' && '📄'}
                {event.type === 'agent_idle' && '⚪'}
                {event.type === 'workflow_progress' && '📈'}
                {!event.type && '💡'} {/* Default icon if type is not specified */}
              </span>
              <h3 className="flex items-center mb-1 text-lg font-semibold text-gray-900 dark:text-white">
                {event.description || event.updateType || 'New Event'}
              </h3>
              <time className="block mb-2 text-sm font-normal leading-none text-gray-400 dark:text-gray-500">
                {new Date(event.receivedAt).toLocaleTimeString()}
              </time>
              {event.agent && (
                <p className="text-base font-normal text-gray-500 dark:text-gray-400">
                  Agent: {event.agent}
                </p>
              )}
              {event.from && event.to && (
                <p className="text-base font-normal text-gray-500 dark:text-gray-400">
                  From: {event.from}, To: {event.to}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default WorkflowTimeline;
