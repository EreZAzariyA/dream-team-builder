'use client';

import { useState, useEffect } from 'react';
import { WorkflowId } from '../../../lib/utils/workflowId';
import { CHANNELS, EVENTS } from '../../../lib/pusher/config';
import { usePusherSimple } from '../../../lib/pusher/SimplePusherClient';

export const useLiveWorkflow = (workflowInstanceId) => {
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
  const [elicitationPrompt, setElicitationPrompt] = useState(null);
  const [waitingForAgent, setWaitingForAgent] = useState(false);
  const [respondingAgent, setRespondingAgent] = useState(null);

  // Use SimplePusherClient hook
  const { connected: pusherConnected, pusher: pusherClient, error: pusherError } = usePusherSimple();

  // Fetch initial workflow data with enhanced error handling
  useEffect(() => {
    if (workflowInstanceId) {
      const fetchWorkflowInstance = async () => {
        try {
          console.log(`🔍 [LiveWorkflow] Fetching workflow: ${workflowInstanceId}`);
          const response = await fetch(`/api/workflows/live/${workflowInstanceId}`);
          
          if (!response.ok) {
            if (response.status === 401) {
              console.error('❌ [LiveWorkflow] Authentication required');
              return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const text = await response.text();
          console.log(`📄 [LiveWorkflow] Response received: ${text.length} characters`);
          
          if (!text) {
            console.warn('⚠️ [LiveWorkflow] Empty response from API');
            setLoading(false);
            return;
          }

          const data = JSON.parse(text);
          console.log(`✅ [LiveWorkflow] Workflow data parsed:`, data);
          setWorkflowInstance(data);
          
          // Handle elicitation state
          if (data.status === 'PAUSED_FOR_ELICITATION' && data.elicitationDetails) {
            console.log('⏸️ [LiveWorkflow] Workflow paused for elicitation');
            setElicitationPrompt(data.elicitationDetails);
          }

          // Enhanced agent mapping with better data handling
          const defaultAgents = ['analyst', 'pm', 'architect', 'ux-expert', 'dev', 'qa'];
          let workflowAgents = [];
          
          // Try multiple data sources for agents
          if (data.workflow?.agents && data.workflow.agents.length > 0) {
            workflowAgents = data.workflow.agents;
          } else if (data.agents && Object.keys(data.agents).length > 0) {
            workflowAgents = Object.keys(data.agents);
          } else {
            workflowAgents = defaultAgents;
            console.warn('⚠️ [LiveWorkflow] Using default agents, no workflow agents found');
          }
          
          const mappedAgents = workflowAgents.map((agent, index) => {
            // Enhanced agent parsing
            const agentId = typeof agent === 'string' ? agent : 
                           (agent.agentId || agent.id || agent._id || `agent-${index}`);
            const agentName = typeof agent === 'object' && agent.name ? agent.name :
                             agentId.charAt(0).toUpperCase() + agentId.slice(1).replace(/-/g, ' ');
            
            // Enhanced status determination
            let status = 'pending';
            if (data.currentAgent === agentId) {
              if (data.status === 'PAUSED_FOR_ELICITATION') {
                status = 'waiting_for_input';
              } else if (data.status === 'RUNNING') {
                status = 'active';
              } else {
                status = 'active'; // Default for current agent
              }
            }
            
            return {
              id: agentId,
              name: agentName,
              status,
              startTime: data.currentAgent === agentId ? (data.metadata?.startTime || new Date()) : null,
              endTime: null,
              order: index + 1
            };
          });
          
          console.log(`👥 [LiveWorkflow] Mapped agents:`, mappedAgents);
          
          // Load existing messages from communication timeline
          const existingMessages = data.communication?.timeline || [];
          console.log(`💬 [LiveWorkflow] Loaded ${existingMessages.length} existing messages`);
          
          setRealTimeData(prev => ({
            ...prev,
            agents: mappedAgents,
            currentAgent: data.currentAgent,
            messages: existingMessages,
            progress: data.progress?.percentage || 0
          }));
          
        } catch (error) {
          console.error('❌ [LiveWorkflow] Failed to fetch workflow:', error);
          setWorkflowInstance(null);
        } finally {
          setLoading(false);
        }
      };

      fetchWorkflowInstance();
    }
  }, [workflowInstanceId]);

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
          
          if (isDuplicate) return prev;
          
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

      // Additional event handlers...
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
  }, [pusherConnected, pusherError]);

  // CRITICAL FIX: Add periodic workflow data refresh when real-time isn't working
  useEffect(() => {
    if (!workflowInstanceId || !workflowInstance) return;
    
    const refreshWorkflowData = async () => {
      try {
        const response = await fetch(`/api/workflows/live/${workflowInstanceId}`);
        if (response.ok) {
          const data = await response.json();
          
          // Update workflow status and current agent
          if (data.status !== workflowInstance.status || data.currentAgent !== realTimeData.currentAgent) {
            console.log(`🔄 [LiveWorkflow] Status changed: ${workflowInstance.status} → ${data.status}, Agent: ${realTimeData.currentAgent} → ${data.currentAgent}`);
            
            setWorkflowInstance(prev => ({ ...prev, status: data.status }));
            setRealTimeData(prev => ({
              ...prev,
              currentAgent: data.currentAgent,
              progress: data.progress?.percentage || prev.progress
            }));
            
            // Handle elicitation state changes
            if (data.status === 'PAUSED_FOR_ELICITATION' && data.elicitationDetails) {
              setElicitationPrompt(data.elicitationDetails);
            } else if (data.status !== 'PAUSED_FOR_ELICITATION') {
              setElicitationPrompt(null);
            }
          }
          
          // Update messages if new ones exist
          const newMessages = data.communication?.timeline || [];
          if (newMessages.length > realTimeData.messages.length) {
            console.log(`💬 [LiveWorkflow] New messages detected: ${realTimeData.messages.length} → ${newMessages.length}`);
            setRealTimeData(prev => ({
              ...prev,
              messages: newMessages,
              lastUpdate: new Date().toISOString()
            }));
          }
        }
      } catch (error) {
        console.warn('🔄 [LiveWorkflow] Periodic refresh failed:', error.message);
      }
    };
    
    // Refresh every 5 seconds when not connected, every 15 seconds when connected
    const refreshInterval = realTimeData.isConnected ? 15000 : 5000;
    const interval = setInterval(refreshWorkflowData, refreshInterval);
    
    return () => clearInterval(interval);
  }, [workflowInstanceId, workflowInstance, realTimeData.isConnected, realTimeData.messages.length, realTimeData.currentAgent]);

  return {
    workflowInstance,
    loading,
    realTimeData,
    elicitationPrompt,
    waitingForAgent,
    respondingAgent,
    setElicitationPrompt,
    setWaitingForAgent,
    setRespondingAgent,
    setRealTimeData,
    setWorkflowInstance
  };
};