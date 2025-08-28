'use client';

import React from 'react';
import ProgressOverview from '../../workflow/ProgressOverview';

const WorkflowProgress = ({ 
  realTimeData, 
  workflowInstance,
  formatTimestamp 
}) => {
  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <ProgressOverview 
        progress={realTimeData.progress}
        agents={realTimeData.agents}
      />
    </div>
  );
};

export default WorkflowProgress;