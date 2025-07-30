/**
 * BMAD WebSocket Client
 * Frontend WebSocket client for real-time communication with BMAD system
 */

'use client';

import React from 'react';

export class BmadWebSocketClient {
  constructor(options = {}) {
    this.url = options.url || `ws://localhost:8080`;
    this.token = options.token;
    this.userId = options.userId;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    
    this.ws = null;
    this.connected = false;
    this.connecting = false;
    this.listeners = new Map();
    this.subscriptions = new Set();
    
    this.messageQueue = [];
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    
    this.statistics = {
      messagesSent: 0,
      messagesReceived: 0,
      reconnects: 0,
      connectionTime: null
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    if (this.connecting || this.connected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.connecting = true;
      
      try {
        const url = new URL(this.url);
        if (this.token) url.searchParams.set('token', this.token);
        if (this.userId) url.searchParams.set('userId', this.userId);

        this.ws = new WebSocket(url.toString());
        
        this.ws.onopen = () => {
          console.log('🌐 Connected to BMAD WebSocket server');
          this.connected = true;
          this.connecting = false;
          this.reconnectAttempts = 0;
          this.statistics.connectionTime = new Date();
          
          // Process queued messages
          this.processMessageQueue();
          
          // Start heartbeat
          this.startHeartbeat();
          
          // Re-establish subscriptions
          this.reestablishSubscriptions();
          
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          this.handleDisconnection(event);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          if (this.connecting) {
            this.connecting = false;
            reject(error);
          }
        };

      } catch (error) {
        this.connecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.connecting = false;
    this.subscriptions.clear();
    
    console.log('🌐 Disconnected from BMAD WebSocket server');
    this.emit('disconnected');
  }

  /**
   * Handle incoming message
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      this.statistics.messagesReceived++;
      
      console.log('📨 WebSocket message received:', message.type);
      
      // Handle system messages
      switch (message.type) {
        case 'welcome':
          this.clientId = message.clientId;
          break;
        
        case 'pong':
          // Heartbeat response
          break;
          
        case 'error':
          console.error('WebSocket server error:', message.message);
          this.emit('error', new Error(message.message));
          break;
          
        default:
          // Emit custom message
          this.emit(message.type, message);
          this.emit('message', message);
      }
      
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(event) {
    console.log('🌐 WebSocket disconnected:', event.code, event.reason);
    
    this.connected = false;
    this.connecting = false;
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    this.emit('disconnected', { code: event.code, reason: event.reason });
    
    // Attempt reconnection if not a clean close
    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectTimer) return;
    
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts); // Exponential backoff
    
    console.log(`🔄 Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.statistics.reconnects++;
      
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.error('Max reconnection attempts reached');
          this.emit('reconnect_failed');
        }
      }
    }, delay);
  }

  /**
   * Send message to server
   */
  send(message) {
    if (!this.connected || !this.ws) {
      // Queue message for later
      this.messageQueue.push(message);
      console.log('📤 Message queued (not connected):', message.type);
      return false;
    }

    try {
      const payload = JSON.stringify(message);
      this.ws.send(payload);
      this.statistics.messagesSent++;
      console.log('📤 Message sent:', message.type);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      this.messageQueue.push(message);
      return false;
    }
  }

  /**
   * Process queued messages
   */
  processMessageQueue() {
    if (this.messageQueue.length === 0) return;
    
    console.log(`📤 Processing ${this.messageQueue.length} queued messages`);
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(message => {
      this.send(message);
    });
  }

  /**
   * Subscribe to workflow updates
   */
  subscribeToWorkflow(workflowId) {
    this.subscriptions.add(`workflow:${workflowId}`);
    return this.send({
      type: 'subscribe_workflow',
      workflowId
    });
  }

  /**
   * Unsubscribe from workflow updates
   */
  unsubscribeFromWorkflow(workflowId) {
    this.subscriptions.delete(`workflow:${workflowId}`);
    return this.send({
      type: 'unsubscribe_workflow',
      workflowId
    });
  }

  /**
   * Subscribe to agent updates
   */
  subscribeToAgent(agentId) {
    this.subscriptions.add(`agent:${agentId}`);
    return this.send({
      type: 'subscribe_agent',
      agentId
    });
  }

  /**
   * Unsubscribe from agent updates
   */
  unsubscribeFromAgent(agentId) {
    this.subscriptions.delete(`agent:${agentId}`);
    return this.send({
      type: 'unsubscribe_agent',
      agentId
    });
  }

  /**
   * Join communication channel
   */
  joinChannel(channelId) {
    this.subscriptions.add(`channel:${channelId}`);
    return this.send({
      type: 'join_channel',
      channelId
    });
  }

  /**
   * Leave communication channel
   */
  leaveChannel(channelId) {
    this.subscriptions.delete(`channel:${channelId}`);
    return this.send({
      type: 'leave_channel',
      channelId
    });
  }

  /**
   * Send broadcast message
   */
  broadcastMessage(content, target) {
    return this.send({
      type: 'send_message',
      content,
      target
    });
  }

  /**
   * Start heartbeat ping
   */
  startHeartbeat() {
    if (this.heartbeatTimer) return;
    
    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        this.send({ type: 'ping' });
      }
    }, this.heartbeatInterval);
  }

  /**
   * Re-establish subscriptions after reconnection
   */
  reestablishSubscriptions() {
    this.subscriptions.forEach(subscription => {
      const [type, id] = subscription.split(':');
      
      switch (type) {
        case 'workflow':
          this.send({ type: 'subscribe_workflow', workflowId: id });
          break;
        case 'agent':
          this.send({ type: 'subscribe_agent', agentId: id });
          break;
        case 'channel':
          this.send({ type: 'join_channel', channelId: id });
          break;
      }
    });
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    return () => this.off(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      clientId: this.clientId,
      subscriptions: Array.from(this.subscriptions),
      statistics: {
        ...this.statistics,
        uptime: this.statistics.connectionTime ? 
          Date.now() - this.statistics.connectionTime.getTime() : 0
      }
    };
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }
}

/**
 * React Hook for WebSocket connection
 */
export function useWebSocket(options = {}) {
  const [client, setClient] = React.useState(null);
  const [connected, setConnected] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const wsClient = new BmadWebSocketClient(options);
    
    wsClient.on('connected', () => {
      setConnected(true);
      setConnecting(false);
      setError(null);
    });
    
    wsClient.on('disconnected', () => {
      setConnected(false);
      setConnecting(false);
    });
    
    wsClient.on('error', (err) => {
      setError(err);
      setConnecting(false);
    });
    
    setClient(wsClient);
    
    // Auto-connect if token provided
    if (options.token) {
      setConnecting(true);
      wsClient.connect().catch(err => {
        setError(err);
        setConnecting(false);
      });
    }
    
    return () => {
      wsClient.disconnect();
    };
  }, []);

  const connect = React.useCallback(async () => {
    if (!client) return;
    
    setConnecting(true);
    setError(null);
    
    try {
      await client.connect();
    } catch (err) {
      setError(err);
      setConnecting(false);
    }
  }, [client]);

  const disconnect = React.useCallback(() => {
    if (client) {
      client.disconnect();
    }
  }, [client]);

  return {
    client,
    connected,
    connecting,
    error,
    connect,
    disconnect
  };
}

export default BmadWebSocketClient;