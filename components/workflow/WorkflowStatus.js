
'use client';

import React from 'react';
import { useSelector } from 'react-redux';
import { selectExecutionContext } from '../../lib/store/slices/workflowSlice';

const WorkflowStatus = ({ workflowId }) => {
  const executionContext = useSelector(selectExecutionContext);

  const overallStatus = executionContext.overallStatus || 'Unknown'; // Assuming overallStatus will be added to executionContext
  const currentStep = executionContext.currentStep || 'N/A';
  const progress = executionContext.progress || 0; // Assuming progress will be added to executionContext
  const errors = executionContext.errors || [];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Running': return 'bg-blue-500';
      case 'Completed': return 'bg-green-500';
      case 'Paused': return 'bg-yellow-500';
      case 'Error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Workflow Status: {workflowId}</h2>
      <div className="flex items-center justify-between mb-4">
        <span className="text-lg font-medium">Overall Status:</span>
        <span className={`px-3 py-1 rounded-full text-white ${getStatusColor(overallStatus)}`}>
          {overallStatus}
        </span>
      </div>
      <div className="mb-4">
        <span className="text-lg font-medium">Current Step:</span>
        <span className="ml-2 text-gray-700 dark:text-gray-300">{currentStep}</span>
      </div>
      <div className="mb-4">
        <span className="text-lg font-medium">Progress:</span>
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 block">{progress}% Complete</span>
      </div>
      {errors.length > 0 && (
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          <h3 className="font-semibold mb-2">Errors:</h3>
          <ul className="list-disc list-inside">
            {errors.map((error, index) => (
              <li key={index}>{error.message || error}</li> // Assuming error objects might have a message property
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default WorkflowStatus;
