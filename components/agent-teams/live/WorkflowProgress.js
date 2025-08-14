'use client';

import React from 'react';
import { AgentPipeline } from '../../workflow/AgentPipeline';
import ProgressOverview from '../../workflow/ProgressOverview';

const WorkflowProgress = ({ 
  realTimeData, 
  workflowInstance,
  formatTimestamp 
}) => {
  return (
    <div className="space-y-6">
      {/* BMAD Agent Pipeline */}
      <AgentPipeline 
        agents={realTimeData.agents}
        title="BMAD Agent Pipeline"
        formatTimestamp={formatTimestamp}
        currentWorkflowStep={workflowInstance.progress?.currentStep}
        totalWorkflowSteps={workflowInstance.progress?.totalSteps}
      />

      {/* Progress Overview */}
      <ProgressOverview 
        progress={realTimeData.progress}
        agents={realTimeData.agents}
      />
    </div>
  );
};

export default WorkflowProgress;