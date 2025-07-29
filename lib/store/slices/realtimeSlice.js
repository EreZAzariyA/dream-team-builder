import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // WebSocket Connections
  connections: {}, // workflowId -> connectionState
  globalConnection: null, // Global WebSocket for system updates
  
  // Connection Management
  connectionStates: {
    // workflowId -> {
    //   status: 'connecting' | 'connected' | 'disconnected' | 'error',
    //   connectionId: string,
    //   connectedAt: timestamp,
    //   lastActivity: timestamp,
    //   reconnectAttempts: number,
    //   url: string
    // }
  },
  
  // Live Updates
  liveUpdates: {}, // workflowId -> latest update data
  updateHistory: {}, // workflowId -> array of recent updates
  
  // Message Queue (for offline scenarios)
  messageQueue: [], // Messages to send when connection is restored
  pendingAcknowledgments: {}, // messageId -> message data
  
  // Real-time Events
  eventSubscriptions: {}, // eventType -> array of workflowIds
  eventHandlers: {}, // eventType -> handler configuration
  
  // Performance & Monitoring
  connectionMetrics: {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    averageLatency: 0,
    connectionUptime: {},
    errorRate: 0
  },
  
  // Heartbeat System
  heartbeats: {}, // workflowId -> { lastSent, lastReceived, interval }
  heartbeatConfig: {
    interval: 30000, // 30 seconds
    timeout: 5000,   // 5 seconds
    maxMissed: 3     // Max missed heartbeats before disconnect
  },
  
  // Bandwidth Management
  bandwidthControl: {
    enabled: false,
    maxMessageSize: 1024 * 10, // 10KB
    rateLimitPerSecond: 100,
    compressionEnabled: true
  },
  
  // Connection Pools
  connectionPool: {
    maxConnections: 10,
    reuseConnections: true,
    poolTimeout: 60000 // 1 minute
  },
  
  // Security & Authentication
  authTokens: {}, // workflowId -> auth token for WebSocket
  secureConnections: true,
  certificateValidation: true,
  
  // Error Handling
  connectionErrors: [], // Array of connection error details
  retryPolicies: {
    maxRetries: 5,
    backoffMultiplier: 2,
    baseDelay: 1000, // 1 second
    maxDelay: 30000  // 30 seconds
  },
  
  // Feature Flags
  features: {
    autoReconnect: true,
    messageCompression: false,
    binaryMessages: false,
    multipleConnections: true,
    connectionSharing: false
  },
  
  // Debug & Development
  debugMode: false,
  logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
  messageLog: [], // Recent messages for debugging
  
  // Statistics
  statistics: {
    messagesReceived: 0,
    messagesSent: 0,
    bytesReceived: 0,
    bytesSent: 0,
    averageMessageSize: 0,
    peakConnections: 0,
    uptime: 0
  }
};

const realtimeSlice = createSlice({
  name: 'realtime',
  initialState,
  reducers: {
    // Connection Management
    initiateConnection: (state, action) => {
      const { workflowId, url, options = {} } = action.payload;
      
      state.connectionStates[workflowId] = {
        status: 'connecting',
        connectionId: null,
        connectedAt: null,
        lastActivity: new Date().toISOString(),
        reconnectAttempts: 0,
        url,
        options
      };
      
      state.connectionMetrics.totalConnections += 1;
    },
    
    connectionEstablished: (state, action) => {
      const { workflowId, connectionId, serverInfo = {} } = action.payload;
      const timestamp = new Date().toISOString();
      
      if (state.connectionStates[workflowId]) {
        state.connectionStates[workflowId].status = 'connected';
        state.connectionStates[workflowId].connectionId = connectionId;
        state.connectionStates[workflowId].connectedAt = timestamp;
        state.connectionStates[workflowId].lastActivity = timestamp;
        state.connectionStates[workflowId].reconnectAttempts = 0;
        state.connectionStates[workflowId].serverInfo = serverInfo;
      }
      
      // Initialize connection-specific data
      state.connections[workflowId] = {
        id: connectionId,
        established: timestamp,
        active: true
      };
      
      // Initialize heartbeat
      state.heartbeats[workflowId] = {
        lastSent: null,
        lastReceived: timestamp,
        interval: state.heartbeatConfig.interval,
        missedCount: 0
      };
      
      state.connectionMetrics.activeConnections += 1;
      state.connectionMetrics.peakConnections = Math.max(
        state.connectionMetrics.peakConnections,
        state.connectionMetrics.activeConnections
      );
    },
    
    connectionLost: (state, action) => {
      const { workflowId, reason = 'unknown', code } = action.payload;
      
      if (state.connectionStates[workflowId]) {
        state.connectionStates[workflowId].status = 'disconnected';
        state.connectionStates[workflowId].lastActivity = new Date().toISOString();
        state.connectionStates[workflowId].disconnectReason = reason;
        state.connectionStates[workflowId].disconnectCode = code;
      }
      
      if (state.connections[workflowId]) {
        state.connections[workflowId].active = false;
        state.connections[workflowId].disconnected = new Date().toISOString();
      }
      
      // Clean up heartbeat
      delete state.heartbeats[workflowId];
      
      state.connectionMetrics.activeConnections = Math.max(0, 
        state.connectionMetrics.activeConnections - 1
      );
      
      // Add error if unexpected disconnect
      if (reason !== 'user_initiated') {
        state.connectionErrors.push({
          workflowId,
          reason,
          code,
          timestamp: new Date().toISOString()
        });
      }
    },
    
    connectionError: (state, action) => {
      const { workflowId, error, retryable = true } = action.payload;
      
      if (state.connectionStates[workflowId]) {
        state.connectionStates[workflowId].status = 'error';
        state.connectionStates[workflowId].lastError = {
          error,
          timestamp: new Date().toISOString(),
          retryable
        };
        
        if (retryable) {
          state.connectionStates[workflowId].reconnectAttempts += 1;
        }
      }
      
      state.connectionErrors.push({
        workflowId,
        error,
        retryable,
        timestamp: new Date().toISOString()
      });
      
      state.connectionMetrics.errorRate = 
        state.connectionErrors.length / state.connectionMetrics.totalConnections;
    },
    
    // Live Updates
    liveUpdateReceived: (state, action) => {
      const { workflowId, update, messageId } = action.payload;
      const timestamp = new Date().toISOString();
      
      // Store latest update
      state.liveUpdates[workflowId] = {
        ...update,
        receivedAt: timestamp,
        messageId
      };
      
      // Add to update history
      if (!state.updateHistory[workflowId]) {
        state.updateHistory[workflowId] = [];
      }
      
      state.updateHistory[workflowId].push({
        ...update,
        receivedAt: timestamp,
        messageId
      });
      
      // Keep only last 50 updates per workflow
      if (state.updateHistory[workflowId].length > 50) {
        state.updateHistory[workflowId] = state.updateHistory[workflowId].slice(-50);
      }
      
      // Update connection activity
      if (state.connectionStates[workflowId]) {
        state.connectionStates[workflowId].lastActivity = timestamp;
      }
      
      // Update statistics
      state.statistics.messagesReceived += 1;
      if (update.size) {
        state.statistics.bytesReceived += update.size;
        state.statistics.averageMessageSize = 
          state.statistics.bytesReceived / state.statistics.messagesReceived;
      }
    },
    
    sendMessage: (state, action) => {
      const { workflowId, message, messageId } = action.payload;
      
      if (state.connectionStates[workflowId]?.status !== 'connected') {
        // Queue message if not connected
        state.messageQueue.push({
          workflowId,
          message,
          messageId,
          queuedAt: new Date().toISOString()
        });
      } else {
        // Track pending acknowledgment
        state.pendingAcknowledgments[messageId] = {
          workflowId,
          message,
          sentAt: new Date().toISOString()
        };
        
        // Update statistics
        state.statistics.messagesSent += 1;
        if (message.size) {
          state.statistics.bytesSent += message.size;
        }
      }
    },
    
    messageAcknowledged: (state, action) => {
      const { messageId } = action.payload;
      delete state.pendingAcknowledgments[messageId];
    },
    
    // Message Queue Management
    queueMessage: (state, action) => {
      state.messageQueue.push({
        ...action.payload,
        queuedAt: new Date().toISOString()
      });
    },
    
    processMessageQueue: (state, action) => {
      const { workflowId } = action.payload;
      
      // Move messages for this workflow to pending acknowledgments
      state.messageQueue = state.messageQueue.filter(queuedMessage => {
        if (queuedMessage.workflowId === workflowId) {
          state.pendingAcknowledgments[queuedMessage.messageId] = {
            ...queuedMessage,
            sentAt: new Date().toISOString()
          };
          return false; // Remove from queue
        }
        return true; // Keep in queue
      });
    },
    
    clearMessageQueue: (state, action) => {
      const workflowId = action.payload;
      if (workflowId) {
        state.messageQueue = state.messageQueue.filter(
          msg => msg.workflowId !== workflowId
        );
      } else {
        state.messageQueue = [];
      }
    },
    
    // Heartbeat Management
    sendHeartbeat: (state, action) => {
      const { workflowId } = action.payload;
      const timestamp = new Date().toISOString();
      
      if (state.heartbeats[workflowId]) {
        state.heartbeats[workflowId].lastSent = timestamp;
      }
    },
    
    receiveHeartbeat: (state, action) => {
      const { workflowId } = action.payload;
      const timestamp = new Date().toISOString();
      
      if (state.heartbeats[workflowId]) {
        state.heartbeats[workflowId].lastReceived = timestamp;
        state.heartbeats[workflowId].missedCount = 0;
      }
    },
    
    missedHeartbeat: (state, action) => {
      const { workflowId } = action.payload;
      
      if (state.heartbeats[workflowId]) {
        state.heartbeats[workflowId].missedCount += 1;
        
        // Trigger reconnection if too many missed heartbeats
        if (state.heartbeats[workflowId].missedCount >= state.heartbeatConfig.maxMissed) {
          state.connectionStates[workflowId].status = 'error';
          state.connectionStates[workflowId].lastError = {
            error: 'Heartbeat timeout',
            timestamp: new Date().toISOString(),
            retryable: true
          };
        }
      }
    },
    
    // Configuration Updates
    updateHeartbeatConfig: (state, action) => {
      state.heartbeatConfig = { ...state.heartbeatConfig, ...action.payload };
    },
    
    updateBandwidthControl: (state, action) => {
      state.bandwidthControl = { ...state.bandwidthControl, ...action.payload };
    },
    
    updateRetryPolicies: (state, action) => {
      state.retryPolicies = { ...state.retryPolicies, ...action.payload };
    },
    
    // Feature Management
    toggleFeature: (state, action) => {
      const feature = action.payload;
      state.features[feature] = !state.features[feature];
    },
    
    setFeature: (state, action) => {
      const { feature, enabled } = action.payload;
      state.features[feature] = enabled;
    },
    
    // Debug & Development
    setDebugMode: (state, action) => {
      state.debugMode = action.payload;
    },
    
    setLogLevel: (state, action) => {
      state.logLevel = action.payload;
    },
    
    addDebugLog: (state, action) => {
      if (state.debugMode) {
        state.messageLog.push({
          timestamp: new Date().toISOString(),
          ...action.payload
        });
        
        // Keep only last 100 debug messages
        if (state.messageLog.length > 100) {
          state.messageLog = state.messageLog.slice(-100);
        }
      }
    },
    
    clearDebugLog: (state) => {
      state.messageLog = [];
    },
    
    // Cleanup & Reset
    disconnectWorkflow: (state, action) => {
      const workflowId = action.payload;
      
      // Clean up all workflow-specific data
      delete state.connections[workflowId];
      delete state.connectionStates[workflowId];
      delete state.liveUpdates[workflowId];
      delete state.updateHistory[workflowId];
      delete state.heartbeats[workflowId];
      delete state.authTokens[workflowId];
      
      // Remove from message queue
      state.messageQueue = state.messageQueue.filter(
        msg => msg.workflowId !== workflowId
      );
      
      // Remove pending acknowledgments
      Object.keys(state.pendingAcknowledgments).forEach(messageId => {
        if (state.pendingAcknowledgments[messageId].workflowId === workflowId) {
          delete state.pendingAcknowledgments[messageId];
        }
      });
    },
    
    resetRealtimeState: (state) => {
      Object.assign(state, initialState);
    },
    
    // Statistics Updates
    updateStatistics: (state, action) => {
      state.statistics = { ...state.statistics, ...action.payload };
    },
    
    resetStatistics: (state) => {
      state.statistics = initialState.statistics;
    }
  }
});

export const {
  // Connection Management
  initiateConnection,
  connectionEstablished,
  connectionLost,
  connectionError,
  
  // Live Updates
  liveUpdateReceived,
  sendMessage,
  messageAcknowledged,
  
  // Message Queue
  queueMessage,
  processMessageQueue,
  clearMessageQueue,
  
  // Heartbeat
  sendHeartbeat,
  receiveHeartbeat,
  missedHeartbeat,
  updateHeartbeatConfig,
  
  // Configuration
  updateBandwidthControl,
  updateRetryPolicies,
  
  // Features
  toggleFeature,
  setFeature,
  
  // Debug
  setDebugMode,
  setLogLevel,
  addDebugLog,
  clearDebugLog,
  
  // Cleanup
  disconnectWorkflow,
  resetRealtimeState,
  
  // Statistics
  updateStatistics,
  resetStatistics
} = realtimeSlice.actions;

// Selectors
export const selectConnectionState = (workflowId) => (state) =>
  state.realtime.connectionStates[workflowId];

export const selectIsConnected = (workflowId) => (state) =>
  state.realtime.connectionStates[workflowId]?.status === 'connected';

export const selectLiveUpdate = (workflowId) => (state) =>
  state.realtime.liveUpdates[workflowId];

export const selectUpdateHistory = (workflowId) => (state) =>
  state.realtime.updateHistory[workflowId] || [];

export const selectMessageQueue = (state) => state.realtime.messageQueue;

export const selectPendingAcknowledgments = (state) => 
  state.realtime.pendingAcknowledgments;

export const selectConnectionMetrics = (state) => 
  state.realtime.connectionMetrics;

export const selectHeartbeatStatus = (workflowId) => (state) =>
  state.realtime.heartbeats[workflowId];

export const selectRealtimeFeatures = (state) => state.realtime.features;

export const selectConnectionErrors = (state) => state.realtime.connectionErrors;

export const selectDebugInfo = (state) => ({
  debugMode: state.realtime.debugMode,
  logLevel: state.realtime.logLevel,
  messageLog: state.realtime.messageLog
});

export const selectStatistics = (state) => state.realtime.statistics;

export const selectActiveConnections = (state) => 
  Object.keys(state.realtime.connectionStates).filter(workflowId =>
    state.realtime.connectionStates[workflowId].status === 'connected'
  );

export default realtimeSlice;