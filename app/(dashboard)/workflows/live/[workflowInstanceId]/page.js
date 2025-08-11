
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '../../../../../components/common/Card';
import { Badge } from '../../../../../components/common/Badge';
import WorkflowChat from '../../../../../components/workflow/WorkflowChat';
import GeneratedFiles from '../../../../../components/workflow/GeneratedFiles';
import ProgressOverview from '../../../../../components/workflow/ProgressOverview';
import BmadDocumentManager from '../../../../../components/workflow/BmadDocumentManager';
import { AgentPipeline } from '../../../../../components/workflow/AgentPipeline';
import { WorkflowErrorWrapper } from '../../../../../components/common/WorkflowErrorBoundary';
import { WorkflowId } from '../../../../../lib/utils/workflowId';
import { 
  Loader2, 
  AlertCircle, 
  Activity,
  Zap,
  Wifi,
  WifiOff} from 'lucide-react';
import { CHANNELS, EVENTS } from '../../../../../lib/pusher/config';
import { usePusherSimple } from '../../../../../lib/pusher/SimplePusherClient';
import { getAgentStyle } from '../../../../../lib/utils/agentHelpers';

const LiveWorkflowPage = () => {
  const [workflowInstance, setWorkflowInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [realTimeData, setRealTimeData] = useState({
    agents: [],
    currentAgent: null,
    messages: [],
    progress: 0,
    isConnected: false,
    lastUpdate: null
  });
  const [artifacts, setArtifacts] = useState([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [elicitationPrompt, setElicitationPrompt] = useState(null);
  const [elicitationResponse, setElicitationResponse] = useState('');
  const [elicitationLoading, setElicitationLoading] = useState(false);
  const [waitingForAgent, setWaitingForAgent] = useState(false);
  const [respondingAgent, setRespondingAgent] = useState(null);
  const { workflowInstanceId } = useParams();
  
  

  // Use SimplePusherClient hook
  const { connected: pusherConnected, pusher: pusherClient, error: pusherError } = usePusherSimple();


  // Initialize Pusher connection for real-time updates with error handling
  useEffect(() => {
    if (!workflowInstanceId || !pusherClient || !pusherConnected) return;

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

    // Workflow event handlers
    
    channel.bind(EVENTS.AGENT_ACTIVATED, (data) => {
      
      // Set the responding agent for loading UI
      setRespondingAgent(data.agentId);
      setWaitingForAgent(true);
      
      setRealTimeData(prev => ({
        ...prev,
        currentAgent: data.agentId,
        lastUpdate: data.timestamp,
        agents: prev.agents.map(agent => {
          if (agent.id === data.agentId) {
            // Only activate if not already active to prevent race conditions
            return agent.status !== 'active' 
              ? { ...agent, status: 'active', startTime: data.timestamp, progress: 0 }
              : agent;
          } else if (agent.status === 'active' && agent.id !== data.agentId) {
            // Only mark as completed if we're activating a different agent
            return { ...agent, status: 'completed', endTime: data.timestamp, progress: 100 };
          }
          return agent;
        })
      }));
    });

    channel.bind(EVENTS.AGENT_COMPLETED, (data) => {
      
      // Clear waiting states when agent completes
      if (respondingAgent === data.agentId) {
        setWaitingForAgent(false);
        setRespondingAgent(null);
      }
      
      setRealTimeData(prev => ({
        ...prev,
        lastUpdate: data.timestamp,
        agents: prev.agents.map(agent => 
          agent.id === data.agentId 
            ? { ...agent, status: 'completed', endTime: data.timestamp, progress: 100 } // Set progress to 100 on completion
            : agent
        ),
        progress: Math.min(prev.progress + (100 / Math.max(prev.agents.length, 1)), 100)
      }));
    });

    channel.bind(EVENTS.WORKFLOW_MESSAGE, (data) => {
      
      // Clear waiting state when we receive a message from the responding agent
      if (data.message?.from === respondingAgent || data.message?.agentId === respondingAgent) {
        setWaitingForAgent(false);
        setRespondingAgent(null);
      }
      
      setRealTimeData(prev => {
        // Check for duplicate messages based on ID or content + timestamp
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
          setElicitationPrompt(null); // Clear elicitation prompt if workflow is no longer paused
        }
      }
    });

    channel.bind(EVENTS.AGENT_COMMUNICATION, (data) => {
      setRealTimeData(prev => {
        const newMessages = [...prev.messages, {
          id: data.id || `comm-${data.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
          from: data.from,
          to: data.to,
          summary: data.message || 'Agent communication',
          timestamp: data.timestamp
        }].slice(-50);
        return {
          ...prev,
          lastUpdate: data.timestamp,
          messages: newMessages
        };
      });
    });

    // Handle agent messages
    channel.bind(EVENTS.AGENT_MESSAGE, (data) => {
      console.log({ data });
      
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

    // Handle user messages
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
  }, [workflowInstanceId, pusherClient, pusherConnected, respondingAgent]);

  // Update connection state when pusher connection changes
  useEffect(() => {
    setRealTimeData(prev => ({ 
      ...prev, 
      isConnected: pusherConnected
    }));
    
    if (pusherError) {
      console.error('❌ Pusher connection error:', pusherError);
    }
    
    // Handle reconnection - re-subscribe to channel if connection was restored
    if (pusherConnected && pusherClient && workflowInstanceId) {
      const channelName = WorkflowId.toChannelName(workflowInstanceId) || CHANNELS.WORKFLOW(workflowInstanceId);
      const existingChannel = pusherClient.channel(channelName);
      if (!existingChannel) {
        // The main useEffect will handle re-subscription
      }
    }
  }, [pusherConnected, pusherError, pusherClient, workflowInstanceId]);

  // Fetch initial workflow data
  useEffect(() => {
    if (workflowInstanceId) {
      const fetchWorkflowInstance = async () => {
        try {
          const response = await fetch(`/api/workflows/live/${workflowInstanceId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch workflow instance');
          }
          const text = await response.text();
          if (text) {
            const data = JSON.parse(text);
            setWorkflowInstance(data);
            
            // If the workflow is already paused, show the elicitation prompt
            if (data.status === 'PAUSED_FOR_ELICITATION' && data.elicitationDetails) {
              setElicitationPrompt(data.elicitationDetails);
            }

            // Initialize real-time data with workflow agents
            const defaultAgents = ['pm', 'architect', 'ux-expert', 'developer', 'qa'];
            const workflowAgents = (data.workflow?.agents && data.workflow.agents.length > 0) ? 
              data.workflow.agents : defaultAgents;
            
            const mappedAgents = workflowAgents.map((agent, index) => {
              // Handle both object and string agent formats
              const agentId = typeof agent === 'string' ? agent : (agent.agentId || agent._id || `agent-${index}`);
              const agentName = agentId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
              
              // Determine agent status based on current agent and workflow state
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
          } else {
            console.warn('⚠️ Empty workflow response');
            return;
          }
        } catch (error) {
          console.error('Failed to fetch workflow instance:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchWorkflowInstance();
    }
  }, [workflowInstanceId]);

  // Demo function to trigger test events
  // Fetch artifacts for the workflow
  const fetchArtifacts = useCallback(async () => {
    if (!workflowInstanceId) return;
    
    setLoadingArtifacts(true);
    try {
      const response = await fetch(`/api/workflows/${workflowInstanceId}/artifacts`);
      if (response.ok) {
        const text = await response.text();
        if (text) {
          const data = JSON.parse(text);
          setArtifacts(data.artifacts || []);
        } else {
          console.warn('⚠️ Empty artifacts response');
        }
      } else if (response.status === 401) {
        console.warn('❌ Authentication failed for artifacts - stopping polling');
        return 'auth_failed';
      }
    } catch (error) {
      console.error('❌ Error fetching artifacts:', error);
    } finally {
      setLoadingArtifacts(false);
    }
  }, [workflowInstanceId]);

  // Periodically refresh artifacts (every 10 seconds)
  useEffect(() => {
    fetchArtifacts(); // Initial load
    
    const interval = setInterval(async () => {
      const result = await fetchArtifacts();
      if (result === 'auth_failed') {
        console.warn('Stopping artifacts polling due to authentication failure');
        clearInterval(interval);
      }
    }, 20000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchArtifacts]);

  const triggerDemoEvents = async () => {
    try {
      const response = await fetch(`/api/test-pusher?workflowId=${workflowInstanceId}`);
      if (response.ok) {
        const result = await response.json();
      }
    } catch (error) {
      console.error('Failed to trigger demo events:', error);
    }
  };

  const handleElicitationSubmit = async () => {
    if (!elicitationResponse.trim()) return;

    try {
      setElicitationLoading(true);
      const response = await fetch(`/api/workflows/${workflowInstanceId}/resume-elicitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          elicitationResponse: elicitationResponse.trim(),
          agentId: elicitationPrompt?.agentId // Pass the agentId back to the backend
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit elicitation response');
      }
      setElicitationResponse(''); // Clear input
      setElicitationPrompt(null); // Clear prompt
      setElicitationLoading(false);
      // Workflow status will be updated via Pusher
    } catch (error) {
      console.error('Error submitting elicitation response:', error);
      setElicitationLoading(false);
    }
  };

  // Unified message handler for both free chat and elicitation responses
  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    try {
      // Add user message immediately to show it in chat
      const userMessage = {
        id: `user-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from: 'User',
        content: message.trim(),
        timestamp: new Date().toISOString(),
        type: 'user_message'
      };
      
      setRealTimeData(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage].slice(-50)
      }));

      // If there's an active elicitation prompt, treat this as an elicitation response
      if (elicitationPrompt) {
        setElicitationLoading(true);
        setWaitingForAgent(true);
        setRespondingAgent(elicitationPrompt.agentId);
        setElicitationResponse(message); // Set the message as the response
        
        // const selectedNumber = parseInt(message.trim());
        // if (isNaN(selectedNumber) || selectedNumber < 1 || (elicitationPrompt.options && selectedNumber > elicitationPrompt.options.length)) {
        //     console.error("Invalid elicitation response: Please enter a number corresponding to an option.");
        //     // Optionally, display an error message to the user in the UI
        //     setElicitationLoading(false);
        //     setWaitingForAgent(false);
        //     setRespondingAgent(null);
        //     return; // Stop processing if input is invalid
        // }

        const response = await fetch(`/api/workflows/${workflowInstanceId}/resume-elicitation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            elicitationResponse: message, // Send the number
            agentId: elicitationPrompt?.agentId
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to submit elicitation response');
        }

        setElicitationResponse('');
        setElicitationPrompt(null);
        setElicitationLoading(false);
        // Note: waitingForAgent and respondingAgent will be cleared by AGENT_ACTIVATED/AGENT_COMPLETED events
      } else {
        // Regular free chat message - Use new chat API
        try {
          const response = await fetch(`/api/workflows/${workflowInstanceId}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: message.trim(),
              targetAgent: realTimeData.currentAgent // Send to current workflow agent
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send chat message');
          }

          const result = await response.json();
          
          // Messages will be delivered via real-time Pusher events
          // The API handles both user message and agent response
          logger.info('✅ [FREE CHAT] Chat message sent successfully:', result);
          
        } catch (chatError) {
          console.error('Error sending free chat message:', chatError);
          
          // Add error message to chat
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
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Helper function for file size formatting (used by GeneratedFiles component)
  const formatFileSize = (size) => {
    if (!size) return '0 B';
    const units = ['B', 'KB', 'MB'];
    let unitIndex = 0;
    let fileSize = size;
    
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024;
      unitIndex++;
    }
    
    return `${Math.round(fileSize * 10) / 10} ${units[unitIndex]}`;
  };

  const downloadFile = async (filename) => {
    try {
      const response = await fetch(`/api/workflows/${workflowInstanceId}/artifacts/${filename}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to download file:', filename);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const downloadAllFiles = async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowInstanceId}/artifacts/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflowInstanceId}-artifacts.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to download zip file');
      }
    } catch (error) {
      console.error('Error downloading zip:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (!workflowInstance) {
    return (
      <div className="p-8">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Workflow Not Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              The workflow instance could not be found or has been deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <WorkflowErrorWrapper
      title="Live workflow page encountered an error"
      onError={(error, errorInfo) => {
        console.error('LiveWorkflowPage error:', error, errorInfo);
      }}
      onReset={() => {
        // Reset state on error recovery
        setRealTimeData(prev => ({
          ...prev,
          messages: [],
          isConnected: false
        }));
        setElicitationPrompt(null);
      }}
    >
      <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            {workflowInstance.workflow?.name || 'Live Workflow'}
          </h1>
          <div className="flex items-center mt-3 space-x-6">
            <div className="flex items-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mr-2">Status:</p>
              <Badge className={getStatusColor(workflowInstance.status)}>
                <Activity className="w-3 h-3 mr-1" />
                {workflowInstance.status}
              </Badge>
            </div>
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
            {realTimeData.lastUpdate && (
              <div className="text-sm text-gray-500">
                Last update: {formatTimestamp(realTimeData.lastUpdate)}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={triggerDemoEvents}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex items-center"
        >
          <Zap className="w-4 h-4 mr-2" />
          Test Real-time
        </button>
      </div>

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

      {/* Live Communication Feed */}
      <WorkflowChat 
        messages={realTimeData.messages}
        isConnected={realTimeData.isConnected}
        onSendMessage={handleSendMessage}
        loading={elicitationLoading}
        waitingForAgent={waitingForAgent}
        respondingAgent={respondingAgent}
        title="Live Communication"
        elicitationPrompt={elicitationPrompt}
        elicitationResponse={elicitationResponse}
        onElicitationResponseChange={setElicitationResponse}
        onElicitationSubmit={handleElicitationSubmit}
        elicitationLoading={elicitationLoading}
        workflowInstance={workflowInstance}
        activeAgents={realTimeData.agents}
        currentAgent={realTimeData.currentAgent}
      />

      {/* BMAD Document Manager */}
      <BmadDocumentManager 
        workflowId={workflowInstanceId}
        artifacts={artifacts}
        loading={loadingArtifacts}
        onRefresh={fetchArtifacts}
        onDownload={downloadFile}
        onView={(filename) => {
          // TODO: Implement document viewer
          console.log('View document:', filename);
        }}
      />

      {/* Generated Files Section */}
      <GeneratedFiles 
        artifacts={artifacts}
        loading={loadingArtifacts}
        workflowInstanceId={workflowInstanceId}
        onDownloadFile={downloadFile}
        onDownloadAll={downloadAllFiles}
        formatTimestamp={formatTimestamp}
        formatFileSize={formatFileSize}
      />
      </div>
    </WorkflowErrorWrapper>
  );
};

export default LiveWorkflowPage;
