'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  Activity, 
  Wifi, 
  WifiOff, 
  Bot, 
  Clock, 
  AlertCircle,
  Loader2,
  Send
} from 'lucide-react';
import { Card, CardContent } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { WorkflowId } from '../../../lib/utils/workflowId';
import { CHANNELS, EVENTS } from '../../../lib/pusher/config';
import { usePusher } from '../../../lib/pusher/PusherClient';
import { getAgentStyle } from '../../../lib/utils/agentHelpers';

/**
 * Workflow Chat Interface Component
 * 
 * Provides chat functionality specifically for live workflows
 * Features:
 * - Real-time workflow messaging
 * - Agent status awareness
 * - Workflow context integration
 * - Message history with workflow events
 */
const WorkflowChatInterface = ({ 
  workflowInstanceId,
  className = "" 
}) => {
  const { data: session } = useSession();
  const [workflowInstance, setWorkflowInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [waitingForAgent, setWaitingForAgent] = useState(false);
  const [respondingAgent, setRespondingAgent] = useState(null);
  
  // Use PusherClient hook
  const { connected: pusherConnected, pusher: pusherClient, error: pusherError } = usePusher();

  // Initialize Pusher connection for real-time updates
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
      setIsConnected(pusherConnected);

      // Handle workflow messages
      channel.bind(EVENTS.WORKFLOW_MESSAGE, (data) => {
        // Clear waiting state when we receive a message from the responding agent
        if (data.message?.from === respondingAgent || data.message?.agentId === respondingAgent) {
          setWaitingForAgent(false);
          setRespondingAgent(null);
        }
        
        setMessages(prev => {
          // Check for duplicate messages based on ID or content + timestamp
          const messageId = data.message?.id || `workflow-msg-${data.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
          const isDuplicate = prev.some(msg => 
            msg.id === messageId || 
            (msg.content === data.message?.content && msg.timestamp === data.timestamp)
          );
          
          if (isDuplicate) {
            return prev;
          }
          
          const messageWithId = { ...data.message, id: messageId };
          return [...prev, messageWithId].slice(-50);
        });
      });

      // Handle user messages
      channel.bind(EVENTS.USER_MESSAGE, (data) => {
        setMessages(prev => {
          const messageId = data.id || `user-msg-${data.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
          const isDuplicate = prev.some(msg => msg.id === messageId);
          
          if (isDuplicate) return prev;
          
          const messageWithId = {
            ...data,
            id: messageId,
            from: 'User',
            to: data.target?.targetAgent || 'System'
          };
          return [...prev, messageWithId].slice(-50);
        });
      });

      // Handle agent messages
      channel.bind(EVENTS.AGENT_MESSAGE, (data) => {
        // Clear waiting states when agent responds
        if (respondingAgent === data.agentId || respondingAgent === data.agentName) {
          setWaitingForAgent(false);
          setRespondingAgent(null);
        }
        
        setMessages(prev => {
          const messageId = data.id || `agent-msg-${data.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
          const isDuplicate = prev.some(msg => msg.id === messageId);
          
          if (isDuplicate) return prev;
          
          const messageWithId = {
            ...data,
            id: messageId,
            from: data.agentName || data.agentId || 'Agent',
            to: 'User'
          };
          return [...prev, messageWithId].slice(-50);
        });
      });

      // Handle agent communication
      channel.bind(EVENTS.AGENT_COMMUNICATION, (data) => {
        setMessages(prev => {
          const messageId = data.id || `comm-${data.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
          const messageWithId = {
            id: messageId,
            from: data.from,
            to: data.to,
            content: data.message || 'Agent communication',
            timestamp: data.timestamp,
            type: 'agent_communication'
          };
          return [...prev, messageWithId].slice(-50);
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
    setIsConnected(pusherConnected);
    
    if (pusherError) {
      console.error('❌ Pusher connection error:', pusherError);
    }
  }, [pusherConnected, pusherError]);

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

  // Send message function
  const handleSendMessage = useCallback(async (message) => {
    if (!message.trim() || !workflowInstanceId || sending) return;

    setSending(true);
    try {
      // Set waiting state
      setWaitingForAgent(true);
      if (workflowInstance?.currentAgent) {
        setRespondingAgent(workflowInstance.currentAgent);
      }

      const response = await fetch(`/api/workflows/${workflowInstanceId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          targetAgent: workflowInstance?.currentAgent
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send chat message');
      }

      setNewMessage(''); // Clear input on success
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message to chat
      const errorMessage = {
        id: `error-msg-${Date.now()}`,
        from: 'System',
        content: `❌ Failed to send message: ${error.message}`,
        timestamp: new Date().toISOString(),
        type: 'error'
      };
      
      setMessages(prev => [...prev, errorMessage].slice(-50));
      setWaitingForAgent(false);
      setRespondingAgent(null);
    } finally {
      setSending(false);
    }
  }, [workflowInstanceId, workflowInstance?.currentAgent, sending]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getMessageStyle = (message) => {
    if (message.from === 'User' || message.from === 'user') {
      return 'bg-blue-500 text-white ml-12';
    } else if (message.type === 'error') {
      return 'bg-red-100 text-red-800 border border-red-200';
    } else if (message.type === 'agent_communication') {
      return 'bg-purple-50 text-purple-800 border border-purple-200';
    } else {
      return 'bg-white border border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex justify-center items-center min-h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600 dark:text-gray-400">Loading workflow chat...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!workflowInstance) {
    return (
      <div className={`p-6 ${className}`}>
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
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            {workflowInstance.workflow?.name || 'Workflow Chat'}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mr-2">Status:</p>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <Activity className="w-3 h-3 mr-1" />
                {workflowInstance.status || 'Active'}
              </Badge>
            </div>
            <div className="flex items-center">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500 mr-2" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500 mr-2" />
              )}
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {isConnected ? 'Live Updates Active' : 'Connection Lost'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <Card className="h-96 flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Chat with the workflow agents. Your messages will be sent to the currently active agent.
              </p>
              {workflowInstance.currentAgent && (
                <p className="text-sm text-blue-600 mt-2">
                  Current Agent: <strong>{workflowInstance.currentAgent}</strong>
                </p>
              )}
            </div>
          )}
          
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-lg max-w-xs ${getMessageStyle(message)} ${
                message.from === 'User' || message.from === 'user' ? 'ml-auto' : 'mr-auto'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">
                  {message.from === 'User' || message.from === 'user' ? 'You' : message.from}
                </span>
                {message.timestamp && (
                  <span className="text-xs opacity-60">
                    {formatTimestamp(message.timestamp)}
                  </span>
                )}
              </div>
              <p className="text-sm">{message.content || message.summary}</p>
            </motion.div>
          ))}
          
          {waitingForAgent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center space-x-2 text-gray-500 text-sm"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {respondingAgent ? `${respondingAgent} is typing...` : 'Agent is typing...'}
              </span>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(newMessage);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim() || !isConnected}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default WorkflowChatInterface;