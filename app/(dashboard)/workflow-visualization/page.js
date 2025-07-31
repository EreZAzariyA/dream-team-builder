
'use client';

import React from 'react';
import ChatWindow from '../../../components/chat/ChatWindow';
import WorkflowStatus from '../../../components/workflow/WorkflowStatus';
import WorkflowDiagram from '../../../components/workflow/WorkflowDiagram';
import AgentOutputPanel from '../../../components/workflow/AgentOutputPanel';
import WorkflowTimeline from '../../../components/workflow/WorkflowTimeline';

const WorkflowVisualizationPage = () => {
  // Placeholder data for now - will be connected to Redux later
  const workflowId = 'workflow-123';
  const currentAgentId = 'architect'; // Example active agent

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Workflow Visualization</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Workflow Status & Diagram */}
        <div className="lg:col-span-2 space-y-8">
          <WorkflowStatus workflowId={workflowId} />
          <WorkflowDiagram workflowId={workflowId} currentAgentId={currentAgentId} />
        </div>

        {/* Right Column: Chat & Outputs */}
        <div className="lg:col-span-1 space-y-8">
          <div className="h-96">
            <ChatWindow workflowId={workflowId} agentId={currentAgentId} />
          </div>
          <AgentOutputPanel workflowId={workflowId} />
        </div>
      </div>

      {/* Bottom Section: Timeline */}
      <div className="mt-8">
        <WorkflowTimeline workflowId={workflowId} />
      </div>
    </div>
  );
};

export default WorkflowVisualizationPage;
