import { createListenerMiddleware } from '@reduxjs/toolkit';
import { 
  selectWorkflow,
  addActiveWorkflow,
  removeActiveWorkflow,
  setRealTimeStatus,
  addLiveWorkflow,
  removeLiveWorkflow
} from '../slices/workflowSlice.js';
import {
  updateAgentStatus,
  addInterAgentMessage,
  setAgentOutput,
  addGeneratedArtifact,
  updateAgentHeartbeat
} from '../slices/agentSlice.js';
import {
  initiateConnection,
  connectionEstablished,
  connectionLost,
  connectionError,
  liveUpdateReceived,
  sendMessage,
  messageAcknowledged,
  processMessageQueue,
  sendHeartbeat,
  receiveHeartbeat,
  missedHeartbeat,
  addDebugLog
} from '../slices/realtimeSlice.js';

// WebSocket connection manager
class WebSocketManager {
  constructor() {
    this.connections = new Map(); // workflowId -> WebSocket instance
    this.reconnectTimeouts = new Map(); // workflowId -> timeout ID
    this.heartbeatIntervals = new Map(); // workflowId -> interval ID
    this.queryClient = null;
    this.store = null;
  }
  
  setStore(store) {
    this.store = store;
  }
  
  setQueryClient(client) {
    this.queryClient = client;
  }
  
  connect(workflowId, options = {}) {
    // Don't create multiple connections for the same workflow
    if (this.connections.has(workflowId)) {
      return this.connections.get(workflowId);
    }
    
    const {
      url = `/api/realtime/workflow/${workflowId}`,
      protocols = [],
      reconnectDelay = 3000,
      maxReconnectAttempts = 5
    } = options;
    
    // Dispatch connection initiation
    this.store.dispatch(initiateConnection({ workflowId, url, options }));
    this.debugLog('info', `Initiating WebSocket connection for workflow ${workflowId}`, { url });
    
    try {
      // Create WebSocket URL (handle both HTTP and HTTPS)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = url.startsWith('/') ? `${protocol}//${host}${url}` : url;
      
      const ws = new WebSocket(wsUrl, protocols);
      this.connections.set(workflowId, ws);
      
      // Set up event handlers
      this.setupWebSocketHandlers(ws, workflowId, options);
      
      return ws;
    } catch (error) {
      this.debugLog('error', `Failed to create WebSocket connection`, { workflowId, error: error.message });
      this.store.dispatch(connectionError({ 
        workflowId, 
        error: error.message, 
        retryable: true 
      }));
      
      // Schedule reconnection
      this.scheduleReconnection(workflowId, options, reconnectDelay);
      return null;
    }
  }
  
  setupWebSocketHandlers(ws, workflowId, options) {
    ws.onopen = (event) => {
      this.debugLog('info', `WebSocket connected for workflow ${workflowId}`);
      
      const connectionId = `ws_${workflowId}_${Date.now()}`;
      this.store.dispatch(connectionEstablished({ 
        workflowId, 
        connectionId,
        serverInfo: { readyState: ws.readyState }
      }));
      
      // Clear any existing reconnect timeout
      if (this.reconnectTimeouts.has(workflowId)) {
        clearTimeout(this.reconnectTimeouts.get(workflowId));
        this.reconnectTimeouts.delete(workflowId);
      }
      
      // Start heartbeat
      this.startHeartbeat(workflowId);
      
      // Process any queued messages
      this.store.dispatch(processMessageQueue({ workflowId }));
      
      // Update workflow state
      this.store.dispatch(addActiveWorkflow(workflowId));
      this.store.dispatch(addLiveWorkflow(workflowId));
      this.store.dispatch(setRealTimeStatus({ 
        connected: true, 
        connectionId,
        lastHeartbeat: new Date().toISOString()
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleIncomingMessage(workflowId, data);
      } catch (error) {
        this.debugLog('error', `Failed to parse WebSocket message`, { 
          workflowId, 
          error: error.message,
          rawData: event.data 
        });
      }
    };
    
    ws.onclose = (event) => {
      this.debugLog('info', `WebSocket closed for workflow ${workflowId}`, { 
        code: event.code, 
        reason: event.reason,
        wasClean: event.wasClean 
      });
      
      this.store.dispatch(connectionLost({ 
        workflowId, 
        reason: event.reason || 'Connection closed',
        code: event.code 
      }));
      
      // Clean up
      this.cleanup(workflowId, false);
      
      // Update workflow state
      this.store.dispatch(removeActiveWorkflow(workflowId));
      this.store.dispatch(removeLiveWorkflow(workflowId));
      this.store.dispatch(setRealTimeStatus({ 
        connected: false, 
        connectionId: null 
      }));
      
      // Schedule reconnection if not a clean close
      if (!event.wasClean && options.autoReconnect !== false) {
        this.scheduleReconnection(workflowId, options, options.reconnectDelay || 3000);
      }
    };
    
    ws.onerror = (event) => {
      this.debugLog('error', `WebSocket error for workflow ${workflowId}`, { event });
      
      this.store.dispatch(connectionError({ 
        workflowId, 
        error: 'WebSocket error occurred',
        retryable: true 
      }));
    };
  }
  
  handleIncomingMessage(workflowId, data) {
    const { type, payload, messageId, timestamp } = data;
    
    this.debugLog('debug', `Received message`, { workflowId, type, messageId });
    
    // Dispatch the live update
    this.store.dispatch(liveUpdateReceived({ 
      workflowId, 
      update: { type, ...payload },
      messageId 
    }));
    
    // Handle specific message types
    switch (type) {
      case 'agent_activated':
      case 'agent_completed':
      case 'agent_paused':
      case 'agent_error':
        this.handleAgentStatusUpdate(workflowId, payload);
        break;
        
      case 'agent_message':
      case 'inter_agent_communication':
        this.handleInterAgentMessage(workflowId, payload);
        break;
        
      case 'agent_output':
        this.handleAgentOutput(workflowId, payload);
        break;
        
      case 'artifact_generated':
        this.handleArtifactGenerated(workflowId, payload);
        break;
        
      case 'workflow_status_changed':
        this.handleWorkflowStatusChanged(workflowId, payload);
        break;
        
      case 'heartbeat':
        this.handleHeartbeat(workflowId, payload);
        break;
        
      case 'message_ack':
        this.store.dispatch(messageAcknowledged({ messageId: payload.messageId }));
        break;
        
      default:
        this.debugLog('warn', `Unknown message type received`, { workflowId, type });
    }
    
    // Invalidate React Query cache based on message type
    this.invalidateQueryCache(workflowId, type, payload);
  }
  
  handleAgentStatusUpdate(workflowId, payload) {
    const { agentId, status, metadata } = payload;
    
    this.store.dispatch(updateAgentStatus({ workflowId, agentId, status }));
    this.store.dispatch(updateAgentHeartbeat({ agentId }));
    
    this.debugLog('info', `Agent status updated`, { workflowId, agentId, status });
  }
  
  handleInterAgentMessage(workflowId, payload) {
    this.store.dispatch(addInterAgentMessage({ workflowId, message: payload }));
  }
  
  handleAgentOutput(workflowId, payload) {
    const { agentId, output } = payload;
    this.store.dispatch(setAgentOutput({ workflowId, agentId, output }));
  }
  
  handleArtifactGenerated(workflowId, payload) {
    const { agentId, artifact } = payload;
    this.store.dispatch(addGeneratedArtifact({ workflowId, agentId, artifact }));
  }
  
  handleWorkflowStatusChanged(workflowId, payload) {
    // This will be handled by React Query cache invalidation
    this.debugLog('info', `Workflow status changed`, { workflowId, status: payload.status });
  }
  
  handleHeartbeat(workflowId, payload) {
    this.store.dispatch(receiveHeartbeat({ workflowId }));
    this.debugLog('debug', `Heartbeat received`, { workflowId });
  }
  
  startHeartbeat(workflowId) {
    // Clear existing heartbeat if any
    if (this.heartbeatIntervals.has(workflowId)) {
      clearInterval(this.heartbeatIntervals.get(workflowId));
    }
    
    const interval = setInterval(() => {
      const ws = this.connections.get(workflowId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        const heartbeatMessage = {
          type: 'heartbeat',
          timestamp: new Date().toISOString(),
          workflowId
        };
        
        ws.send(JSON.stringify(heartbeatMessage));
        this.store.dispatch(sendHeartbeat({ workflowId }));
        this.debugLog('debug', `Heartbeat sent`, { workflowId });
      } else {
        // Connection is not open, missed heartbeat
        this.store.dispatch(missedHeartbeat({ workflowId }));
        clearInterval(interval);
        this.heartbeatIntervals.delete(workflowId);
      }
    }, 30000); // 30 seconds
    
    this.heartbeatIntervals.set(workflowId, interval);
  }
  
  scheduleReconnection(workflowId, options, delay) {
    if (this.reconnectTimeouts.has(workflowId)) {
      clearTimeout(this.reconnectTimeouts.get(workflowId));
    }
    
    const timeout = setTimeout(() => {
      this.debugLog('info', `Attempting to reconnect`, { workflowId });
      this.connect(workflowId, options);
    }, delay);
    
    this.reconnectTimeouts.set(workflowId, timeout);
  }
  
  send(workflowId, message) {
    const ws = this.connections.get(workflowId);
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        const messageWithId = {
          ...message,
          messageId,
          timestamp: new Date().toISOString()
        };
        
        ws.send(JSON.stringify(messageWithId));
        this.store.dispatch(sendMessage({ workflowId, message: messageWithId, messageId }));
        this.debugLog('debug', `Message sent`, { workflowId, messageId, type: message.type });
        
        return messageId;
      } catch (error) {
        this.debugLog('error', `Failed to send message`, { workflowId, error: error.message });
        return null;
      }
    } else {
      // Queue message if not connected
      this.store.dispatch(sendMessage({ workflowId, message, messageId }));
      this.debugLog('warn', `Message queued (connection not open)`, { workflowId, messageId });
      return messageId;
    }
  }
  
  disconnect(workflowId) {
    const ws = this.connections.get(workflowId);
    if (ws) {
      ws.close(1000, 'User initiated disconnect');
      this.cleanup(workflowId, true);
    }
  }
  
  cleanup(workflowId, removeConnection = true) {
    // Clear heartbeat interval
    if (this.heartbeatIntervals.has(workflowId)) {
      clearInterval(this.heartbeatIntervals.get(workflowId));
      this.heartbeatIntervals.delete(workflowId);
    }
    
    // Clear reconnect timeout
    if (this.reconnectTimeouts.has(workflowId)) {
      clearTimeout(this.reconnectTimeouts.get(workflowId));
      this.reconnectTimeouts.delete(workflowId);
    }
    
    // Remove connection
    if (removeConnection) {
      this.connections.delete(workflowId);
    }
  }
  
  invalidateQueryCache(workflowId, messageType, payload) {
    if (!this.queryClient) return;
    
    const invalidations = {
      'agent_activated': [
        ['agentExecutions', workflowId],
        ['workflow', workflowId]
      ],
      'agent_completed': [
        ['agentExecutions', workflowId],
        ['workflow', workflowId]
      ],
      'agent_message': [
        ['agentMessages', workflowId]
      ],
      'artifact_generated': [
        ['agentArtifacts', workflowId, payload.agentId]
      ],
      'workflow_status_changed': [
        ['workflow', workflowId],
        ['workflows']
      ]
    };
    
    const queries = invalidations[messageType];
    if (queries) {
      queries.forEach(queryKey => {
        this.queryClient.invalidateQueries({ queryKey });
      });
    }
  }
  
  debugLog(level, message, data = {}) {
    if (this.store) {
      this.store.dispatch(addDebugLog({ level, message, data }));
    }
  }
  
  // Get connection status
  getConnectionStatus(workflowId) {
    const ws = this.connections.get(workflowId);
    if (!ws) return 'disconnected';
    
    switch (ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }
  
  // Get all active connections
  getActiveConnections() {
    const active = [];
    this.connections.forEach((ws, workflowId) => {
      if (ws.readyState === WebSocket.OPEN) {
        active.push(workflowId);
      }
    });
    return active;
  }
}

// Create singleton instance
export const wsManager = new WebSocketManager();

// Create listener middleware
export const websocketMiddleware = createListenerMiddleware();

// Listen for workflow selection changes
websocketMiddleware.startListening({
  actionCreator: selectWorkflow,
  effect: (action, listenerApi) => {
    const { payload: workflowId } = action;
    const { dispatch, getState } = listenerApi;
    
    if (workflowId) {
      // Set store reference if not already set
      if (!wsManager.store) {
        wsManager.setStore({ dispatch, getState });
      }
      
      // Connect to workflow updates
      wsManager.connect(workflowId, {
        autoReconnect: true,
        reconnectDelay: 3000,
        maxReconnectAttempts: 5
      });
    }
  }
});

// Listen for connection cleanup when workflow is deselected
websocketMiddleware.startListening({
  predicate: (action, currentState, previousState) => {
    return (
      previousState?.workflow?.selectedWorkflowId &&
      !currentState?.workflow?.selectedWorkflowId
    );
  },
  effect: (action, listenerApi) => {
    const previousWorkflowId = listenerApi.getOriginalState().workflow.selectedWorkflowId;
    if (previousWorkflowId) {
      // Optionally disconnect (or keep connection alive for quick re-access)
      // wsManager.disconnect(previousWorkflowId);
    }
  }
});

// Export helper functions for use in components
export const connectToWorkflow = (workflowId, options = {}) => {
  return wsManager.connect(workflowId, options);
};

export const sendMessageToWorkflow = (workflowId, message) => {
  return wsManager.send(workflowId, message);
};

export const disconnectFromWorkflow = (workflowId) => {
  return wsManager.disconnect(workflowId);
};

export const getWorkflowConnectionStatus = (workflowId) => {
  return wsManager.getConnectionStatus(workflowId);
};

export const getAllActiveConnections = () => {
  return wsManager.getActiveConnections();
};

export default websocketMiddleware;