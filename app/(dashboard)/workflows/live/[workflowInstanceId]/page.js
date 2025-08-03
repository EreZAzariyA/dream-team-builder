
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/common/Card';
import { Badge } from '../../../../../components/common/Badge';
import { 
  Loader2, 
  Play, 
  Pause, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  User, 
  MessageSquare, 
  Activity,
  Zap,
  ArrowRight,
  Wifi,
  WifiOff
} from 'lucide-react';
import { CHANNELS, EVENTS } from '../../../../../lib/pusher/config';
import { usePusherSimple } from '../../../../../lib/pusher/SimplePusherClient';

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
  const [elicitationPrompt, setElicitationPrompt] = useState(null);
  const [elicitationResponse, setElicitationResponse] = useState('');
  const { workflowInstanceId } = useParams();
  
  // Use SimplePusherClient hook
  const { connected: pusherConnected, pusher: pusherClient, error: pusherError } = usePusherSimple();

  // Agent role colors based on design system
  const getAgentColor = (agentId) => {
    const colors = {
      'pm': { primary: '#8b5cf6', bg: '#f3f4f6', text: '#7c3aed' },
      'architect': { primary: '#06b6d4', bg: '#ecfeff', text: '#0891b2' },
      'developer': { primary: '#10b981', bg: '#ecfdf5', text: '#059669' },
      'qa': { primary: '#f59e0b', bg: '#fffbeb', text: '#d97706' },
      'ux-expert': { primary: '#ec4899', bg: '#fdf2f8', text: '#db2777' },
      'data-architect': { primary: '#7c3aed', bg: '#f5f3ff', text: '#6d28d9' }
    };
    return colors[agentId] || { primary: '#6b7280', bg: '#f9fafb', text: '#4b5563' };
  };

  // Initialize Pusher connection for real-time updates
  useEffect(() => {
    if (!workflowInstanceId || !pusherClient || !pusherConnected) return;

    console.log('🔌 Initializing Pusher connection for workflow:', workflowInstanceId);
    
    const channelName = CHANNELS.WORKFLOW(workflowInstanceId);
    console.log('📺 Subscribing to channel:', channelName);
    const channel = pusherClient.subscribe(channelName);
    
    // Update connection state
    setRealTimeData(prev => ({ 
      ...prev, 
      isConnected: pusherConnected,
      lastUpdate: new Date().toISOString()
    }));
    console.log('✅ Connected to Pusher for workflow:', workflowInstanceId);

    // Workflow event handlers with enhanced debugging
    console.log('🔗 Binding to events:', Object.values(EVENTS));
    
    // Add a catch-all event listener for debugging
    channel.bind_global((eventName, data) => {
      console.log('📨 RECEIVED ANY EVENT:', eventName, data);
    });
    
    channel.bind(EVENTS.AGENT_ACTIVATED, (data) => {
      console.log('📨 RECEIVED AGENT_ACTIVATED:', data);
      setRealTimeData(prev => ({
        ...prev,
        currentAgent: data.agentId,
        lastUpdate: data.timestamp,
        agents: prev.agents.map(agent => 
          agent.id === data.agentId 
            ? { ...agent, status: 'active', startTime: data.timestamp }
            : { ...agent, status: agent.status === 'active' ? 'completed' : agent.status }
        )
      }));
    });

    channel.bind(EVENTS.AGENT_COMPLETED, (data) => {
      console.log('📨 RECEIVED AGENT_COMPLETED:', data);
      setRealTimeData(prev => ({
        ...prev,
        lastUpdate: data.timestamp,
        agents: prev.agents.map(agent => 
          agent.id === data.agentId 
            ? { ...agent, status: 'completed', endTime: data.timestamp }
            : agent
        ),
        progress: Math.min(prev.progress + (100 / Math.max(prev.agents.length, 1)), 100)
      }));
    });

    channel.bind(EVENTS.WORKFLOW_MESSAGE, (data) => {
      console.log('💬 Workflow message:', data);
      setRealTimeData(prev => ({
        ...prev,
        lastUpdate: data.timestamp,
        messages: [data.message, ...prev.messages].slice(0, 50) // Keep last 50 messages
      }));
    });

    channel.bind(EVENTS.WORKFLOW_UPDATE, (data) => {
      console.log('🔄 Workflow update:', data);
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
      console.log('📡 Agent communication:', data);
      setRealTimeData(prev => ({
        ...prev,
        lastUpdate: data.timestamp,
        messages: [{
          id: `comm-${Date.now()}`,
          from: data.from,
          to: data.to,
          summary: data.message || 'Agent communication',
          timestamp: data.timestamp
        }, ...prev.messages].slice(0, 50)
      }));
    });

    // Handle agent messages
    channel.bind(EVENTS.AGENT_MESSAGE, (data) => {
      console.log('🤖 Agent message:', data);
      setRealTimeData(prev => ({
        ...prev,
        lastUpdate: data.timestamp,
        messages: [{
          id: data.id || `agent-msg-${Date.now()}`,
          from: data.agentName || data.agentId || 'Agent',
          to: 'User',
          content: data.content,
          timestamp: data.timestamp
        }, ...prev.messages].slice(0, 50)
      }));
    });

    // Handle user messages
    channel.bind(EVENTS.USER_MESSAGE, (data) => {
      console.log('👤 User message:', data);
      setRealTimeData(prev => ({
        ...prev,
        lastUpdate: data.timestamp,
        messages: [{
          id: data.id || `user-msg-${Date.now()}`,
          from: 'User',
          to: data.target?.targetAgent || 'System',
          content: data.content,
          timestamp: data.timestamp
        }, ...prev.messages].slice(0, 50)
      }));
    });

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up Pusher connection');
      if (channel) {
        channel.unbind_all();
        pusherClient.unsubscribe(channelName);
      }
    };
  }, [workflowInstanceId, pusherClient, pusherConnected]);

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

  // Fetch initial workflow data
  useEffect(() => {
    if (workflowInstanceId) {
      const fetchWorkflowInstance = async () => {
        try {
          const response = await fetch(`/api/workflows/live/${workflowInstanceId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch workflow instance');
          }
          const data = await response.json();
          setWorkflowInstance(data);
          
          // Initialize real-time data with workflow agents
          const defaultAgents = ['pm', 'architect', 'ux-expert', 'developer', 'qa'];
          const workflowAgents = data.workflow?.agents || defaultAgents;
          
          setRealTimeData(prev => ({
            ...prev,
            agents: workflowAgents.map((agentId, index) => ({
              id: agentId,
              name: agentId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
              status: 'pending',
              startTime: null,
              endTime: null,
              order: index + 1
            }))
          }));
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
  const triggerDemoEvents = async () => {
    try {
      const response = await fetch(`/api/test-pusher?workflowId=${workflowInstanceId}`);
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Demo events triggered successfully:', result);
      }
    } catch (error) {
      console.error('Failed to trigger demo events:', error);
    }
  };

  const handleElicitationSubmit = async () => {
    if (!elicitationResponse.trim()) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/workflows/${workflowInstanceId}/resume-elicitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ elicitationResponse: elicitationResponse.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit elicitation response');
      }

      setElicitationResponse(''); // Clear input
      setElicitationPrompt(null); // Clear prompt
      setLoading(false);
      // Workflow status will be updated via Pusher
    } catch (error) {
      console.error('Error submitting elicitation response:', error);
      setLoading(false);
    }
  };

  const getAgentIcon = (status) => {
    switch (status) {
      case 'active': return <Play className="w-4 h-4 text-green-500 animate-pulse" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
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

      {/* Progress Overview */}
      <Card className="border-l-4 border-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Workflow Completion
              </span>
              <span className="text-sm font-bold text-blue-600">
                {Math.round(realTimeData.progress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${realTimeData.progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {realTimeData.agents.filter(a => a.status === 'completed').length} of {realTimeData.agents.length} agents completed
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Elicitation Form */}
      {workflowInstance.status === 'PAUSED_FOR_ELICITATION' && elicitationPrompt && (
        <Card className="border-l-4 border-yellow-500 animate-pulse-slow">
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-600 dark:text-yellow-400">
              <MessageSquare className="w-5 h-5 mr-2" />
              User Input Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              The workflow is paused, awaiting your input for the <strong>{elicitationPrompt.sectionTitle}</strong> section.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Instruction:</strong> {elicitationPrompt.instruction}
            </p>
            <textarea
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-y"
              rows="5"
              placeholder="Enter your response here..."
              value={elicitationResponse}
              onChange={(e) => setElicitationResponse(e.target.value)}
              disabled={loading}
            />
            <button
              onClick={handleElicitationSubmit}
              disabled={!elicitationResponse.trim() || loading}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Submit Response
            </button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              Agent Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {realTimeData.agents.length > 0 ? (
                realTimeData.agents.map((agent, index) => {
                  const colors = getAgentColor(agent.id);
                  const isActive = agent.status === 'active';
                  const isCompleted = agent.status === 'completed';
                  const isNext = realTimeData.agents[index - 1]?.status === 'active' && agent.status === 'pending';
                  
                  return (
                    <div key={agent.id} className="relative">
                      {/* Timeline connector */}
                      {index < realTimeData.agents.length - 1 && (
                        <div className="absolute left-5 top-12 w-0.5 h-8 bg-gray-200 dark:bg-gray-700" />
                      )}
                      
                      <div 
                        className={`flex items-center p-4 rounded-lg border-2 transition-all duration-300 ${
                          isActive 
                            ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700 shadow-lg' 
                            : isCompleted
                            ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
                            : isNext
                            ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center flex-1">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center mr-4"
                            style={{ backgroundColor: colors.bg }}
                          >
                            {isActive && <div className="absolute w-10 h-10 rounded-full border-2 border-green-400 animate-ping" />}
                            {getAgentIcon(agent.status)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                {agent.name}
                              </span>
                              <Badge 
                                className={`text-xs ${getStatusColor(agent.status)}`}
                                style={{ color: colors.text }}
                              >
                                {agent.status}
                              </Badge>
                            </div>
                            {(agent.startTime || agent.endTime) && (
                              <div className="text-xs text-gray-500 mt-1">
                                {agent.startTime && `Started: ${formatTimestamp(agent.startTime)}`}
                                {agent.endTime && ` • Completed: ${formatTimestamp(agent.endTime)}`}
                              </div>
                            )}
                          </div>
                        </div>
                        {isNext && (
                          <ArrowRight className="w-4 h-4 text-yellow-500 animate-pulse" />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No agents configured for this workflow
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Communication Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Live Communication
              </div>
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {realTimeData.messages.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {realTimeData.messages.length > 0 ? (
                realTimeData.messages.map((message, index) => (
                  <div 
                    key={message.id || index}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 border-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className="font-medium text-sm text-blue-600 dark:text-blue-400">
                          {message.from}
                        </span>
                        <ArrowRight className="w-3 h-3 mx-2 text-gray-400" />
                        <span className="font-medium text-sm text-green-600 dark:text-green-400">
                          {message.to}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {typeof message.content === 'object' ? message.content.summary : message.content}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No messages yet
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Agent communication will appear here in real-time
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LiveWorkflowPage;
