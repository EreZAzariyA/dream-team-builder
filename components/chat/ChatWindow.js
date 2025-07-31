
'use client';

import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useMemo } from 'react';
import { addAgentChatMessage, selectAgentChatHistory } from '../../lib/store/slices/agentSlice';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import WorkflowInitiator from '../bmad/WorkflowInitiator';
import WorkflowStatus from './WorkflowStatus';

const ChatWindow = ({ workflowId = 'default-workflow', agentId = 'default-agent', initialTemplate, pusherClient, pusherConnected }) => {
  useEffect(() => {
    if (initialTemplate) {
      const initialMessage = `Starting workflow with template: ${initialTemplate}`;
      handleSendMessage(initialMessage, true); // Send as system message
    }
  }, [initialTemplate]);
  
  const dispatch = useDispatch();
  useEffect(() => {
    if (pusherClient && pusherConnected) {
      const channelName = `workflow-${workflowId}`;
      const channel = pusherClient.subscribe(channelName);
      
      if (channel) {
        const handlePusherMessage = (message) => {
          if (message.type === 'chat_message' || message.type === 'agent-message') {
            const botMessage = {
              sender: message.sender || message.agentId || 'agent',
              content: message.content,
              timestamp: message.timestamp || new Date().toISOString(),
            };
            dispatch(addAgentChatMessage({ agentId, message: botMessage }));
          }
        };
        
        // Bind to multiple event types
        channel.bind('chat_message', handlePusherMessage);
        channel.bind('agent-message', handlePusherMessage);
        channel.bind('user-message', handlePusherMessage);
      }
      
      return () => {
        if (pusherClient) {
          pusherClient.unsubscribe(channelName);
        }
      };
    }
  }, [pusherClient, pusherConnected, workflowId, agentId, dispatch]);
  
  // Memoized selector to prevent unnecessary rerenders
  const messages = useSelector(useMemo(() => selectAgentChatHistory(agentId), [agentId]));
  const [showWorkflowInitiator, setShowWorkflowInitiator] = useState(false);
  const [activeWorkflowId, setActiveWorkflowId] = useState(null);
  const [bmadMode, setBmadMode] = useState(false);

  // Detect BMAD workflow triggers in messages
  const detectWorkflowTrigger = (content) => {
    const triggers = [
      'start workflow', 'bmad workflow', 'create project', 'build app',
      'develop application', 'design system', 'implement feature'
    ];
    return triggers.some(trigger => 
      content.toLowerCase().includes(trigger.toLowerCase())
    );
  };

  const handleSendMessage = async (content, isSystem = false) => {
    const newMessage = {
      sender: isSystem ? 'System' : 'User',
      content,
      timestamp: new Date().toLocaleTimeString(),
    };
    
    dispatch(addAgentChatMessage({ agentId, message: newMessage }));

    if (!isSystem && pusherClient && pusherConnected) {
      if (bmadMode && activeWorkflowId) {
        // If in BMAD mode and a workflow is active, send as a command to the workflow
        pusherClient.broadcastMessage(JSON.stringify({
          command: 'agent_message',
          agent: 'orchestrator', // Assuming orchestrator handles initial routing
          workflowId: activeWorkflowId,
          content: newMessage.content,
          sender: newMessage.sender,
        }), { type: 'workflow', id: activeWorkflowId });
      } else {
        // Otherwise, send as a regular chat message
        pusherClient.broadcastMessage(newMessage.content, {
          type: 'workflow',
          id: workflowId
        });
      }
    }

    // Check if message triggers BMAD workflow (only for user messages)
    if (!isSystem && detectWorkflowTrigger(content) && !showWorkflowInitiator) {
      const suggestion = {
        sender: 'System',
        content: `🤖 I detected you want to start a project! Would you like me to initiate a BMAD workflow? This will coordinate our AI agents (PM, Architect, Developer, QA) to help you build it step by step.`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'workflow-suggestion',
        actions: [
          { label: 'Start BMAD Workflow', action: 'show-workflow-initiator' },
          { label: 'Continue Chat', action: 'dismiss' }
        ]
      };
      
      setTimeout(() => {
        dispatch(addAgentChatMessage({ agentId, message: suggestion }));
      }, 1000);
    }
  };

  // Handle workflow started
  const onWorkflowStarted = (workflow) => {
    setActiveWorkflowId(workflow.workflowId);
    setShowWorkflowInitiator(false);
    setBmadMode(true);

    // Add workflow started message to chat
    const workflowMessage = {
      sender: 'BMAD System',
      content: `🚀 Workflow "${workflow.workflowId}" started successfully! Your AI agents are now working on your project. You can monitor progress in real-time.`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'workflow-started',
      workflowId: workflow.workflowId
    };
    
    dispatch(addAgentChatMessage({ agentId, message: workflowMessage }));
  };

  // Handle system message actions
  const handleMessageAction = (action) => {
    switch (action) {
      case 'show-workflow-initiator':
        setShowWorkflowInitiator(true);
        break;
      case 'dismiss':
        // Just dismiss, no action needed
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Header with BMAD status */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {bmadMode ? '🤖 BMAD Agent Chat' : 'Agent Chat'}
          </h2>
          <div className="flex items-center space-x-2">
            {activeWorkflowId && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                Workflow Active
              </span>
            )}
            <button
              onClick={() => setShowWorkflowInitiator(!showWorkflowInitiator)}
              className="text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 rounded-full hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center space-x-1"
            >
              <span>🚀</span>
              <span>{showWorkflowInitiator ? 'Hide' : 'Start'} BMAD</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* BMAD Workflow Initiator */}
        {showWorkflowInitiator && (
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-medium text-gray-900 dark:text-white">
                  🤖 Start BMAD Workflow
                </h3>
                <button
                  onClick={() => setShowWorkflowInitiator(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <WorkflowInitiator 
                onWorkflowStarted={onWorkflowStarted}
                className="max-w-none"
              />
            </div>
          </div>
        )}

        {/* Workflow Status Panel */}
        {activeWorkflowId && (
          <WorkflowStatus 
            workflowId={activeWorkflowId}
            onWorkflowComplete={() => {
              setActiveWorkflowId(null);
              setBmadMode(false);
            }}
          />
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <MessageList 
            messages={messages} 
            onMessageAction={handleMessageAction}
          />
        </div>

        {/* Message Input */}
        <MessageInput 
          onSendMessage={handleSendMessage}
          placeholder={bmadMode ? "Ask about your workflow progress or send new instructions..." : "Type your message..."}
          bmadMode={bmadMode}
        />
      </div>
    </div>
  );
};

export default ChatWindow;
