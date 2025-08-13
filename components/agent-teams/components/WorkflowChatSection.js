'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../../common/Card';
import { Badge } from '../../common/Badge';
import WorkflowChat from '../../workflow/WorkflowChat';
import { 
  Activity, 
  Wifi, 
  WifiOff,
  MessageCircle,
  ChevronDown,
  Users
} from 'lucide-react';
import { WorkflowId } from '../../../lib/utils/workflowId';
import { CHANNELS, EVENTS } from '../../../lib/pusher/config';
import { usePusherSimple } from '../../../lib/pusher/SimplePusherClient';

/**
 * Workflow Chat Section Component
 * 
 * Provides chat interface for deployed team workflows in the agent-teams page
 * Reuses the same WorkflowChat component and logic from the live workflow page
 */
const WorkflowChatSection = ({ 
  deployedWorkflows, 
  selectedWorkflow,
  onSelectWorkflow
}) => {
  const [workflowInstance, setWorkflowInstance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [realTimeData, setRealTimeData] = useState({
    agents: [],
    currentAgent: null,
    messages: [],
    progress: 0,
    isConnected: false,
    lastUpdate: null
  });
  const [elicitationPrompt, setElicitationPrompt] = useState(null);
  const [elicitationResponse, setElicitationResponse] = useState('');
  const [elicitationLoading, setElicitationLoading] = useState(false);
  const [waitingForAgent, setWaitingForAgent] = useState(false);
  const [respondingAgent, setRespondingAgent] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Use SimplePusherClient hook
  const { connected: pusherConnected, pusher: pusherClient, error: pusherError } = usePusherSimple();

  // Initialize Pusher connection for real-time updates (same logic as live page)
  useEffect(() => {
    if (!selectedWorkflow?.workflowInstanceId || !pusherClient || !pusherConnected) return;

    const workflowInstanceId = selectedWorkflow.workflowInstanceId;

    // Validate workflow ID format
    if (!WorkflowId.validate(workflowInstanceId)) {
      console.error('Invalid workflow instance ID:', workflowInstanceId);
      return;
    }

    const channelName = WorkflowId.toChannelName(workflowInstanceId) || CHANNELS.WORKFLOW(workflowInstanceId);
    
    try {
      const channel = pusherClient.subscribe(channelName);
    
      // Update connection state
      setRealTimeData(prev => ({ 
        ...prev, 
        isConnected: pusherConnected,
        lastUpdate: new Date().toISOString()
      }));

      // Same event handlers as live workflow page
      channel.bind(EVENTS.AGENT_ACTIVATED, (data) => {
        setRespondingAgent(data.agentId);
        setWaitingForAgent(true);
        
        setRealTimeData(prev => ({
          ...prev,
          currentAgent: data.agentId,
          lastUpdate: data.timestamp,
          agents: prev.agents.map(agent => {
            if (agent.id === data.agentId) {
              return agent.status !== 'active' 
                ? { ...agent, status: 'active', startTime: data.timestamp, progress: 0 }
                : agent;
            } else if (agent.status === 'active' && agent.id !== data.agentId) {
              return { ...agent, status: 'completed', endTime: data.timestamp, progress: 100 };
            }
            return agent;
          })
        }));
      });

      channel.bind(EVENTS.AGENT_COMPLETED, (data) => {
        if (respondingAgent === data.agentId) {
          setWaitingForAgent(false);
          setRespondingAgent(null);
        }
        
        setRealTimeData(prev => ({
          ...prev,
          lastUpdate: data.timestamp,
          agents: prev.agents.map(agent => 
            agent.id === data.agentId 
              ? { ...agent, status: 'completed', endTime: data.timestamp, progress: 100 }
              : agent
          ),
          progress: Math.min(prev.progress + (100 / Math.max(prev.agents.length, 1)), 100)
        }));
      });

      channel.bind(EVENTS.WORKFLOW_MESSAGE, (data) => {
        if (data.message?.from === respondingAgent || data.message?.agentId === respondingAgent) {
          setWaitingForAgent(false);
          setRespondingAgent(null);
        }
        
        setRealTimeData(prev => {
          const messageId = data.message?.id || `workflow-msg-${data.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
          const isDuplicate = prev.messages.some(msg => 
            msg.id === messageId || 
            (msg.content === data.message?.content && msg.timestamp === data.timestamp)
          );
          
          if (isDuplicate) {
            return prev;
          }
          
          const messageWithId = { ...data.message, id: messageId };
          const newMessages = [...prev.messages, messageWithId].slice(-50);
          return {
            ...prev,
            lastUpdate: data.timestamp,
            messages: newMessages
          };
        });
      });

      channel.bind(EVENTS.WORKFLOW_UPDATE, (data) => {
        setRealTimeData(prev => ({ ...prev, lastUpdate: data.timestamp }));
        if (data.status) {
          setWorkflowInstance(prev => prev ? { ...prev, status: data.status } : null);
          if (data.status === 'PAUSED_FOR_ELICITATION' && data.elicitationDetails) {
            setElicitationPrompt(data.elicitationDetails);
          } else if (data.status !== 'PAUSED_FOR_ELICITATION') {
            setElicitationPrompt(null);
          }
        }
      });

      channel.bind(EVENTS.AGENT_MESSAGE, (data) => {
        setRealTimeData(prev => {
          const newMessages = [...prev.messages, {
            id: data.id || `agent-msg-${data.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
            from: data.agentName || data.agentId || 'Agent',
            to: 'User',
            content: data.content,
            timestamp: data.timestamp
          }].slice(-50);
          return {
            ...prev,
            lastUpdate: data.timestamp,
            messages: newMessages
          };
        });
      });

      channel.bind(EVENTS.USER_MESSAGE, (data) => {
        setRealTimeData(prev => {
          const newMessages = [...prev.messages, {
            id: data.id || `user-msg-${data.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
            from: 'User',
            to: data.target?.targetAgent || 'System',
            content: data.content,
            timestamp: data.timestamp
          }].slice(-50);
          return {
            ...prev,
            lastUpdate: data.timestamp,
            messages: newMessages
          };
        });
      });

      // Cleanup function
      return () => {
        try {
          if (channel) {
            channel.unbind_all();
            pusherClient.unsubscribe(channelName);
          }
        } catch (error) {
          console.warn('Error during Pusher cleanup:', error);
        }
      };
    } catch (error) {
      console.error('Error setting up Pusher connection:', error);
    }
  }, [selectedWorkflow?.workflowInstanceId, pusherClient, pusherConnected, respondingAgent]);

  // Update connection state when pusher connection changes
  useEffect(() => {
    setRealTimeData(prev => ({ 
      ...prev, 
      isConnected: pusherConnected
    }));
    
    if (pusherError) {
      console.error('❌ Pusher connection error:', pusherError);
    }
  }, [pusherConnected, pusherError]);

  // Fetch workflow data when selection changes
  useEffect(() => {
    if (selectedWorkflow?.workflowInstanceId) {
      const fetchWorkflowInstance = async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/workflows/live/${selectedWorkflow.workflowInstanceId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch workflow instance');
          }
          const text = await response.text();
          if (text) {
            const data = JSON.parse(text);
            setWorkflowInstance(data);
            
            if (data.status === 'PAUSED_FOR_ELICITATION' && data.elicitationDetails) {
              setElicitationPrompt(data.elicitationDetails);
            }

            // Initialize agents
            const defaultAgents = ['pm', 'architect', 'ux-expert', 'developer', 'qa'];
            const workflowAgents = (data.workflow?.agents && data.workflow.agents.length > 0) ? 
              data.workflow.agents : defaultAgents;
            
            const mappedAgents = workflowAgents.map((agent, index) => {
              const agentId = typeof agent === 'string' ? agent : (agent.agentId || agent._id || `agent-${index}`);
              const agentName = agentId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
              
              let status = 'pending';
              if (data.currentAgent === agentId) {
                if (data.status === 'PAUSED_FOR_ELICITATION') {
                  status = 'waiting_for_input';
                } else {
                  status = 'active';
                }
              }
              
              return {
                id: agentId,
                name: agentName,
                status,
                startTime: data.currentAgent === agentId ? data.metadata?.startTime : null,
                endTime: null,
                order: index + 1
              };
            });
            
            setRealTimeData(prev => ({
              ...prev,
              agents: mappedAgents,
              currentAgent: data.currentAgent
            }));
          }
        } catch (error) {
          console.error('Failed to fetch workflow instance:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchWorkflowInstance();
    }
  }, [selectedWorkflow?.workflowInstanceId]);

  // Same handleSendMessage logic as live workflow page
  const handleSendMessage = useCallback(async (message) => {
    if (!message.trim() || !selectedWorkflow?.workflowInstanceId) return;

    try {
      if (elicitationPrompt) {
        setElicitationLoading(true);
        setWaitingForAgent(true);
        setRespondingAgent(elicitationPrompt.agentId);
        setElicitationResponse(message);

        const response = await fetch(`/api/workflows/${selectedWorkflow.workflowInstanceId}/resume-elicitation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            elicitationResponse: message,
            agentId: elicitationPrompt?.agentId
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to submit elicitation response');
        }

        setElicitationResponse('');
        setElicitationPrompt(null);
        setElicitationLoading(false);
      } else {
        try {
          const response = await fetch(`/api/workflows/${selectedWorkflow.workflowInstanceId}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: message.trim(),
              targetAgent: realTimeData.currentAgent
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send chat message');
          }

          const result = await response.json();
          console.log('✅ [TEAM CHAT] Chat message sent successfully:', result);
          
        } catch (chatError) {
          console.error('Error sending team chat message:', chatError);
          
          const errorMessage = {
            id: `error-msg-${Date.now()}`,
            from: 'System',
            content: `❌ Failed to send message: ${chatError.message}`,
            timestamp: new Date().toISOString(),
            type: 'error'
          };
          
          setRealTimeData(prev => ({
            ...prev,
            messages: [...prev.messages, errorMessage].slice(-50)
          }));
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setElicitationLoading(false);
      setWaitingForAgent(false);
      setRespondingAgent(null);
    }
  }, [selectedWorkflow?.workflowInstanceId, elicitationPrompt, realTimeData.currentAgent]);

  const handleElicitationSubmit = async () => {
    if (!elicitationResponse.trim()) return;
    await handleSendMessage(elicitationResponse);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (deployedWorkflows.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                Team Workflow Chat
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Chat with deployed team agents in real-time
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center">
              {realTimeData.isConnected ? (
                <Wifi className="w-4 h-4 text-green-500 mr-2" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500 mr-2" />
              )}
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {realTimeData.isConnected ? 'Live Updates Active' : 'Connection Lost'}
              </span>
            </div>
            
            {/* Expand/Collapse */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {isExpanded && (
          <>
            {/* Workflow Selector */}
            {deployedWorkflows.length > 1 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Team Workflow:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {deployedWorkflows.map((workflow) => (
                    <button
                      key={workflow.workflowInstanceId}
                      onClick={() => onSelectWorkflow(workflow)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedWorkflow?.workflowInstanceId === workflow.workflowInstanceId
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-800 dark:text-white">
                          {workflow.teamName}
                        </h4>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <Activity className="w-3 h-3 mr-1" />
                          {workflow.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 font-mono">
                        {workflow.workflowInstanceId}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Deployed {formatTimestamp(workflow.deployedAt)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Current Workflow Status */}
            {selectedWorkflow && workflowInstance && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    {workflowInstance.workflow?.name || selectedWorkflow.teamName}
                  </h3>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    <Activity className="w-3 h-3 mr-1" />
                    {workflowInstance.status}
                  </Badge>
                </div>
                {realTimeData.currentAgent && (
                  <div className="flex items-center text-blue-700 dark:text-blue-200 text-sm">
                    <Users className="w-4 h-4 mr-2" />
                    Current Agent: <strong className="ml-1">{realTimeData.currentAgent}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Chat Interface - Same as live workflow page */}
            {selectedWorkflow && (
              <WorkflowChat 
                messages={realTimeData.messages}
                isConnected={realTimeData.isConnected}
                onSendMessage={handleSendMessage}
                loading={elicitationLoading}
                waitingForAgent={waitingForAgent}
                respondingAgent={respondingAgent}
                title="Team Communication"
                elicitationPrompt={elicitationPrompt}
                elicitationResponse={elicitationResponse}
                onElicitationResponseChange={setElicitationResponse}
                onElicitationSubmit={handleElicitationSubmit}
                elicitationLoading={elicitationLoading}
                workflowInstance={workflowInstance}
                activeAgents={realTimeData.agents}
                currentAgent={realTimeData.currentAgent}
              />
            )}

            {!selectedWorkflow && deployedWorkflows.length > 0 && (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">
                  Select a Team Workflow
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Choose a deployed team above to start chatting with the agents.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkflowChatSection;