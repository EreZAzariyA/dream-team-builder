'use client';

import React from 'react';
import WorkflowChat from '../../workflow/WorkflowChat';

const WorkflowControls = ({ 
  realTimeData,
  elicitationPrompt,
  elicitationResponse,
  elicitationLoading,
  waitingForAgent,
  respondingAgent,
  workflowInstance,
  onSendMessage,
  onElicitationResponseChange,
  onElicitationSubmit 
}) => {
  return (
    <div className="space-y-6">
      {/* Live Communication Feed */}
      <WorkflowChat 
        messages={realTimeData.messages}
        isConnected={realTimeData.isConnected}
        onSendMessage={onSendMessage}
        loading={elicitationLoading}
        waitingForAgent={waitingForAgent}
        respondingAgent={respondingAgent}
        title="Live Communication"
        elicitationPrompt={elicitationPrompt}
        elicitationResponse={elicitationResponse}
        onElicitationResponseChange={onElicitationResponseChange}
        onElicitationSubmit={onElicitationSubmit}
        elicitationLoading={elicitationLoading}
        workflowInstance={workflowInstance}
        activeAgents={realTimeData.agents}
        currentAgent={realTimeData.currentAgent}
      />
    </div>
  );
};

export default WorkflowControls;