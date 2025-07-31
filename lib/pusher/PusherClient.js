/**
 * Pusher Client for Real-time Communication
 * Replaces WebSocket client with Pusher for Vercel deployment compatibility
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { pusherClient, CHANNELS, EVENTS } from './config';

export class BmadPusherClient {
  constructor(options = {}) {
    this.userId = options.userId || 'anonymous';
    this.token = options.token;
    this.subscriptions = new Map(); // channelName -> channel
    this.eventListeners = new Map(); // event -> Set of callbacks
    this.connected = false;
    this.connecting = false;
    
    this.statistics = {
      messagesSent: 0,
      messagesReceived: 0,
      connectionTime: null,
    };
  }

  /**
   * Connect to Pusher
   */
  async connect() {
    if (this.connecting || this.connected) {
      return Promise.resolve();
    }

    console.log('🔄 Attempting to connect to Pusher...', {
      currentState: pusherClient.connection.state,
      connecting: this.connecting,
      connected: this.connected
    });

    return new Promise((resolve, reject) => {
      this.connecting = true;

      // Connection state handlers
      pusherClient.connection.bind('connected', () => {
        console.log('🌐 Connected to Pusher successfully!');
        this.connected = true;
        this.connecting = false;
        this.statistics.connectionTime = new Date();
        this.emit('connected');
        resolve();
      });

      pusherClient.connection.bind('disconnected', () => {
        console.log('🌐 Disconnected from Pusher');
        this.connected = false;
        this.connecting = false;
        this.emit('disconnected');
      });

      pusherClient.connection.bind('error', (error) => {
        console.error('❌ Pusher connection error:', error);
        console.error('❌ Error details:', {
          type: error.type,
          error: error.error,
          data: error.data
        });
        this.connecting = false;
        this.emit('error', error);
        reject(error);
      });

      // State change listener for debugging
      pusherClient.connection.bind('state_change', (states) => {
        console.log('🔄 Pusher state change:', states.previous, '→', states.current);
      });

      // If already connected, resolve immediately
      if (pusherClient.connection.state === 'connected') {
        console.log('✅ Pusher already connected!');
        this.connected = true;
        this.connecting = false;
        this.statistics.connectionTime = new Date();
        this.emit('connected');
        resolve();
        return;
      }

      // Force connection if needed
      if (pusherClient.connection.state === 'initialized') {
        console.log('🔄 Starting Pusher connection...');
        pusherClient.connect();
      }
    });
  }

  /**
   * Disconnect from Pusher
   */
  disconnect() {
    // Unsubscribe from all channels
    this.subscriptions.forEach((channel, channelName) => {
      pusherClient.unsubscribe(channelName);
    });
    this.subscriptions.clear();
    
    pusherClient.disconnect();
    this.connected = false;
    this.connecting = false;
    
    console.log('🌐 Disconnected from Pusher');
    this.emit('disconnected');
  }

  /**
   * Subscribe to workflow updates
   */
  subscribeToWorkflow(workflowId) {
    const channelName = CHANNELS.WORKFLOW(workflowId);
    const channel = pusherClient.subscribe(channelName);
    this.subscriptions.set(channelName, channel);

    // Bind to workflow events
    channel.bind(EVENTS.WORKFLOW_UPDATE, (data) => {
      this.statistics.messagesReceived++;
      this.emit('workflow_update', data);
    });

    channel.bind(EVENTS.WORKFLOW_MESSAGE, (data) => {
      this.statistics.messagesReceived++;
      this.emit('workflow_message', data);
    });

    channel.bind(EVENTS.AGENT_ACTIVATED, (data) => {
      this.statistics.messagesReceived++;
      this.emit('agent_activated', data);
    });

    channel.bind(EVENTS.AGENT_COMPLETED, (data) => {
      this.statistics.messagesReceived++;
      this.emit('agent_completed', data);
    });

    channel.bind(EVENTS.AGENT_COMMUNICATION, (data) => {
      this.statistics.messagesReceived++;
      this.emit('agent_communication', data);
    });

    console.log(`📡 Subscribed to workflow: ${workflowId}`);
    return true;
  }

  /**
   * Unsubscribe from workflow updates
   */
  unsubscribeFromWorkflow(workflowId) {
    const channelName = CHANNELS.WORKFLOW(workflowId);
    const channel = this.subscriptions.get(channelName);
    
    if (channel) {
      pusherClient.unsubscribe(channelName);
      this.subscriptions.delete(channelName);
      console.log(`📡 Unsubscribed from workflow: ${workflowId}`);
    }
    
    return true;
  }

  /**
   * Subscribe to agent updates
   */
  subscribeToAgent(agentId) {
    const channelName = CHANNELS.AGENT(agentId);
    const channel = pusherClient.subscribe(channelName);
    this.subscriptions.set(channelName, channel);

    channel.bind(EVENTS.AGENT_MESSAGE, (data) => {
      this.statistics.messagesReceived++;
      this.emit('agent_message', data);
    });

    console.log(`📡 Subscribed to agent: ${agentId}`);
    return true;
  }

  /**
   * Unsubscribe from agent updates
   */
  unsubscribeFromAgent(agentId) {
    const channelName = CHANNELS.AGENT(agentId);
    const channel = this.subscriptions.get(channelName);
    
    if (channel) {
      pusherClient.unsubscribe(channelName);
      this.subscriptions.delete(channelName);
      console.log(`📡 Unsubscribed from agent: ${agentId}`);
    }
    
    return true;
  }

  /**
   * Join communication channel
   */
  joinChannel(channelId) {
    const channelName = `channel-${channelId}`;
    const channel = pusherClient.subscribe(channelName);
    this.subscriptions.set(channelName, channel);

    channel.bind('user-message', (data) => {
      this.statistics.messagesReceived++;
      this.emit('channel_message', data);
    });

    console.log(`📡 Joined channel: ${channelId}`);
    return true;
  }

  /**
   * Leave communication channel
   */
  leaveChannel(channelId) {
    const channelName = `channel-${channelId}`;
    const channel = this.subscriptions.get(channelName);
    
    if (channel) {
      pusherClient.unsubscribe(channelName);
      this.subscriptions.delete(channelName);
      console.log(`📡 Left channel: ${channelId}`);
    }
    
    return true;
  }

  /**
   * Send broadcast message (via API route)
   */
  async broadcastMessage(content, target) {
    try {
      const response = await fetch('/api/pusher/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          target,
          userId: this.userId,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        this.statistics.messagesSent++;
        console.log('📤 Message sent via Pusher');
        return true;
      } else {
        console.error('Failed to send message via Pusher');
        return false;
      }
    } catch (error) {
      console.error('Error sending message via Pusher:', error);
      return false;
    }
  }

  /**
   * Send typing indicator
   */
  async sendTyping(workflowId, isTyping = true) {
    try {
      await fetch('/api/pusher/typing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId,
          userId: this.userId,
          isTyping,
        }),
      });
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
    
    return () => this.off(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    const eventListeners = this.eventListeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    const eventListeners = this.eventListeners.get(event);
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
      subscriptions: Array.from(this.subscriptions.keys()),
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
 * React Hook for Pusher connection
 */
export function usePusher(options = {}) {
  const [client, setClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const pusherClient = new BmadPusherClient(options);
    
    pusherClient.on('connected', () => {
      setConnected(true);
      setConnecting(false);
      setError(null);
    });
    
    pusherClient.on('disconnected', () => {
      setConnected(false);
      setConnecting(false);
    });
    
    pusherClient.on('error', (err) => {
      setError(err);
      setConnecting(false);
    });
    
    setClient(pusherClient);
    
    // Auto-connect
    setConnecting(true);
    pusherClient.connect().catch(err => {
      setError(err);
      setConnecting(false);
    });
    
    return () => {
      pusherClient.disconnect();
    };
  }, []);

  const connect = useCallback(async () => {
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

  const disconnect = useCallback(() => {
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

export default BmadPusherClient;