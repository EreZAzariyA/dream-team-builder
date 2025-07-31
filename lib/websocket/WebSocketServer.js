/**
 * BMAD WebSocket Server
 * Real-time communication system for agent coordination and workflow updates
 */

import { WebSocketServer } from 'ws';
import { parse } from 'url';
import jwt from 'jsonwebtoken';
import { getToken } from 'next-auth/jwt';

export class BmadWebSocketServer {
  constructor(options = {}) {
    this.port = options.port;
    this.httpServer = options.server; // HTTP server to attach to
    this.clients = new Map(); // clientId -> { ws, userId, subscriptions }
    this.channels = new Map(); // channelId -> Set of clientIds
    this.workflowSubscriptions = new Map(); // workflowId -> Set of clientIds
    this.agentSubscriptions = new Map(); // agentId -> Set of clientIds
    this.server = null;
    this.messageQueue = new Map(); // clientId -> Array of queued messages
    this.statistics = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      startTime: new Date()
    };
  }

  /**
   * Start the WebSocket server
   */
  async start() {
    try {
      const wsOptions = {
        verifyClient: this.verifyClient.bind(this)
      };

      // Attach to existing HTTP server or create new one
      if (this.httpServer) {
        wsOptions.server = this.httpServer;
        wsOptions.path = '/ws'; // Use specific path to avoid conflicts with Next.js HMR
        console.log('🚀 BMAD WebSocket Server attached to HTTP server on path /ws');
      } else {
        wsOptions.port = this.port || 8080;
        console.log(`🚀 BMAD WebSocket Server started on port ${wsOptions.port}`);
      }

      this.server = new WebSocketServer(wsOptions);

      this.server.on('connection', this.handleConnection.bind(this));
      this.server.on('error', this.handleServerError.bind(this));

      // Setup cleanup interval
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 30000); // Cleanup every 30 seconds

      return true;
    } catch (error) {
      console.error('Failed to start WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  async stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.server) {
      // Close all client connections
      this.clients.forEach((client, clientId) => {
        this.disconnectClient(clientId, 'Server shutdown');
      });

      // Close server
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
      
      console.log('BMAD WebSocket Server stopped');
    }
  }

  /**
   * Verify client authentication using JWT
   */
  verifyClient(info) {
    try {
      const url = parse(info.req.url, true);
      const token = url.query.token;
      
      console.log('🔍 WebSocket connection attempt:', {
        url: info.req.url,
        token: token ? 'provided' : 'missing',
        origin: info.origin
      });

      if (!token) {
        console.log('❌ WebSocket connection rejected: No token provided');
        return false;
      }

      // For development, accept test token
      if (token === 'test-token') {
        console.log('✅ WebSocket connection accepted (test token)');
        return true;
      }

      // Verify JWT token synchronously
      try {
        const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || 'fallback-secret-for-development');
        if (decoded) {
          console.log(`✅ WebSocket connection verified: ${decoded.email || decoded.sub}`);
          return true;
        }
      } catch (jwtError) {
        console.log('❌ WebSocket connection rejected: Invalid JWT token:', jwtError.message);
      }

      console.log('❌ WebSocket connection rejected: Token verification failed');
      return false;
    } catch (error) {
      console.error('❌ Error verifying WebSocket client:', error);
      return false;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, request) {
    const clientId = this.generateClientId();
    const url = parse(request.url, true);
    const userId = url.query.userId || 'anonymous';

    // Setup client record
    const client = {
      ws,
      userId,
      clientId,
      subscriptions: new Set(),
      connectedAt: new Date(),
      lastPing: new Date()
    };

    this.clients.set(clientId, client);
    this.statistics.totalConnections++;
    this.statistics.activeConnections++;

    console.log(`📡 Client connected: ${clientId} (User: ${userId})`);

    // Setup WebSocket event handlers
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', () => this.handleDisconnection(clientId));
    ws.on('error', (error) => this.handleClientError(clientId, error));
    ws.on('pong', () => this.handlePong(clientId));

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'welcome',
      clientId,
      serverTime: new Date().toISOString(),
      message: 'Connected to BMAD WebSocket Server'
    });

    // Process any queued messages for this client
    this.processQueuedMessages(clientId);

    // Start heartbeat for this client
    this.startHeartbeat(clientId);
  }

  /**
   * Handle incoming message from client
   */
  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      this.statistics.messagesReceived++;

      console.log(`📨 Message from ${clientId}:`, message.type);

      switch (message.type) {
        case 'subscribe_workflow':
          this.subscribeToWorkflow(clientId, message.workflowId);
          break;

        case 'unsubscribe_workflow':
          this.unsubscribeFromWorkflow(clientId, message.workflowId);
          break;

        case 'subscribe_agent':
          this.subscribeToAgent(clientId, message.agentId);
          break;

        case 'unsubscribe_agent':
          this.unsubscribeFromAgent(clientId, message.agentId);
          break;

        case 'join_channel':
          this.joinChannel(clientId, message.channelId);
          break;

        case 'leave_channel':
          this.leaveChannel(clientId, message.channelId);
          break;

        case 'send_message':
          this.broadcastMessage(clientId, message);
          break;

        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
          break;

        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Invalid message format',
        error: error.message
      });
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`📡 Client disconnected: ${clientId}`);

    // Remove from all subscriptions
    client.subscriptions.forEach(subscription => {
      if (subscription.startsWith('workflow:')) {
        const workflowId = subscription.replace('workflow:', '');
        this.unsubscribeFromWorkflow(clientId, workflowId);
      } else if (subscription.startsWith('agent:')) {
        const agentId = subscription.replace('agent:', '');
        this.unsubscribeFromAgent(clientId, agentId);
      } else if (subscription.startsWith('channel:')) {
        const channelId = subscription.replace('channel:', '');
        this.leaveChannel(clientId, channelId);
      }
    });

    // Remove client
    this.clients.delete(clientId);
    this.messageQueue.delete(clientId);
    this.statistics.activeConnections--;
  }

  /**
   * Subscribe client to workflow updates
   */
  subscribeToWorkflow(clientId, workflowId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (!this.workflowSubscriptions.has(workflowId)) {
      this.workflowSubscriptions.set(workflowId, new Set());
    }

    this.workflowSubscriptions.get(workflowId).add(clientId);
    client.subscriptions.add(`workflow:${workflowId}`);

    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      subscription: 'workflow',
      workflowId,
      message: `Subscribed to workflow ${workflowId}`
    });

    console.log(`📡 Client ${clientId} subscribed to workflow ${workflowId}`);
  }

  /**
   * Unsubscribe client from workflow updates
   */
  unsubscribeFromWorkflow(clientId, workflowId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const subscribers = this.workflowSubscriptions.get(workflowId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.workflowSubscriptions.delete(workflowId);
      }
    }

    client.subscriptions.delete(`workflow:${workflowId}`);

    this.sendToClient(clientId, {
      type: 'subscription_cancelled',
      subscription: 'workflow',
      workflowId,
      message: `Unsubscribed from workflow ${workflowId}`
    });
  }

  /**
   * Subscribe client to agent updates
   */
  subscribeToAgent(clientId, agentId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (!this.agentSubscriptions.has(agentId)) {
      this.agentSubscriptions.set(agentId, new Set());
    }

    this.agentSubscriptions.get(agentId).add(clientId);
    client.subscriptions.add(`agent:${agentId}`);

    this.sendToClient(clientId, {
      type: 'subscription_confirmed',  
      subscription: 'agent',
      agentId,
      message: `Subscribed to agent ${agentId}`
    });

    console.log(`📡 Client ${clientId} subscribed to agent ${agentId}`);
  }

  /**
   * Unsubscribe client from agent updates
   */
  unsubscribeFromAgent(clientId, agentId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const subscribers = this.agentSubscriptions.get(agentId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.agentSubscriptions.delete(agentId);
      }
    }

    client.subscriptions.delete(`agent:${agentId}`);

    this.sendToClient(clientId, {
      type: 'subscription_cancelled',
      subscription: 'agent',
      agentId,
      message: `Unsubscribed from agent ${agentId}`
    });
  }

  /**
   * Join a communication channel
   */
  joinChannel(clientId, channelId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, new Set());
    }

    this.channels.get(channelId).add(clientId);
    client.subscriptions.add(`channel:${channelId}`);

    this.sendToClient(clientId, {
      type: 'channel_joined',
      channelId,
      message: `Joined channel ${channelId}`
    });

    // Broadcast to other channel members
    this.broadcastToChannel(channelId, {
      type: 'user_joined_channel',
      channelId,
      userId: client.userId,
      clientId
    }, clientId);
  }

  /**
   * Leave a communication channel
   */
  leaveChannel(clientId, channelId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const channelMembers = this.channels.get(channelId);
    if (channelMembers) {
      channelMembers.delete(clientId);
      if (channelMembers.size === 0) {
        this.channels.delete(channelId);
      }
    }

    client.subscriptions.delete(`channel:${channelId}`);

    this.sendToClient(clientId, {
      type: 'channel_left',
      channelId,
      message: `Left channel ${channelId}`
    });

    // Broadcast to remaining channel members
    this.broadcastToChannel(channelId, {
      type: 'user_left_channel',
      channelId,
      userId: client.userId,
      clientId
    });
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== client.ws.OPEN) {
      // Queue message if client is temporarily unavailable
      this.queueMessage(clientId, message);
      return false;
    }

    try {
      const payload = JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
        clientId
      });
      
      client.ws.send(payload);
      this.statistics.messagesSent++;
      return true;
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast message to workflow subscribers
   */
  broadcastToWorkflow(workflowId, message) {
    const subscribers = this.workflowSubscriptions.get(workflowId);
    if (!subscribers || subscribers.size === 0) return 0;

    let sentCount = 0;
    subscribers.forEach(clientId => {
      if (this.sendToClient(clientId, {
        ...message,
        workflowId,
        type: message.type || 'workflow_update'
      })) {
        sentCount++;
      }
    });

    return sentCount;
  }

  /**
   * Broadcast message to agent subscribers
   */
  broadcastToAgent(agentId, message) {
    const subscribers = this.agentSubscriptions.get(agentId);
    if (!subscribers || subscribers.size === 0) return 0;

    let sentCount = 0;
    subscribers.forEach(clientId => {
      if (this.sendToClient(clientId, {
        ...message,
        agentId,
        type: message.type || 'agent_update'
      })) {
        sentCount++;
      }
    });

    return sentCount;
  }

  /**
   * Broadcast message to channel members
   */
  broadcastToChannel(channelId, message, excludeClientId = null) {
    const members = this.channels.get(channelId);
    if (!members || members.size === 0) return 0;

    let sentCount = 0;
    members.forEach(clientId => {
      if (clientId !== excludeClientId) {
        if (this.sendToClient(clientId, {
          ...message,
          channelId,
          type: message.type || 'channel_message'
        })) {
          sentCount++;
        }
      }
    });

    return sentCount;
  }

  /**
   * Broadcast message from client
   */
  broadcastMessage(fromClientId, message) {
    const client = this.clients.get(fromClientId);
    if (!client) return;

    const broadcastData = {
      type: 'broadcast_message',
      from: {
        clientId: fromClientId,
        userId: client.userId
      },
      content: message.content,
      timestamp: new Date().toISOString()
    };

    if (message.target) {
      switch (message.target.type) {
        case 'workflow':
          this.broadcastToWorkflow(message.target.id, broadcastData);
          break;
        case 'agent':
          this.broadcastToAgent(message.target.id, broadcastData);
          break;
        case 'channel':
          this.broadcastToChannel(message.target.id, broadcastData, fromClientId);
          break;
      }
    }
  }

  /**
   * Queue message for offline/unavailable client
   */
  queueMessage(clientId, message) {
    if (!this.messageQueue.has(clientId)) {
      this.messageQueue.set(clientId, []);
    }
    
    const queue = this.messageQueue.get(clientId);
    queue.push({
      ...message,
      queuedAt: new Date().toISOString()
    });

    // Limit queue size
    if (queue.length > 100) {
      queue.shift(); // Remove oldest message
    }
  }

  /**
   * Process queued messages for reconnected client
   */
  processQueuedMessages(clientId) {
    const queue = this.messageQueue.get(clientId);
    if (!queue || queue.length === 0) return;

    console.log(`📨 Processing ${queue.length} queued messages for client ${clientId}`);

    queue.forEach(message => {
      this.sendToClient(clientId, {
        ...message,
        queued: true
      });
    });

    this.messageQueue.delete(clientId);
  }

  /**
   * Start heartbeat for client
   */
  startHeartbeat(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const heartbeatInterval = setInterval(() => {
      if (!this.clients.has(clientId)) {
        clearInterval(heartbeatInterval);
        return;
      }

      const currentClient = this.clients.get(clientId);
      if (currentClient.ws.readyState === currentClient.ws.OPEN) {
        currentClient.ws.ping();
        currentClient.lastPing = new Date();
      } else {
        clearInterval(heartbeatInterval);
        this.handleDisconnection(clientId);
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Handle pong response from client
   */
  handlePong(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = new Date();
    }
  }

  /**
   * Handle client error
   */
  handleClientError(clientId, error) {
    console.error(`WebSocket client error for ${clientId}:`, error);
    this.disconnectClient(clientId, 'Client error');
  }

  /**
   * Handle server error
   */
  handleServerError(error) {
    console.error('WebSocket server error:', error);
  }

  /**
   * Disconnect client with reason
   */
  disconnectClient(clientId, reason) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      this.sendToClient(clientId, {
        type: 'disconnect',
        reason,
        message: 'Connection terminated by server'
      });
      
      client.ws.close();
    } catch (error) {
      console.error(`Error disconnecting client ${clientId}:`, error);
    }

    this.handleDisconnection(clientId);
  }

  /**
   * Cleanup inactive connections and old data
   */
  cleanup() {
    const now = new Date();
    const timeout = 5 * 60 * 1000; // 5 minutes

    // Remove inactive clients
    this.clients.forEach((client, clientId) => {
      if (now - client.lastPing > timeout) {
        console.log(`🧹 Cleaning up inactive client: ${clientId}`);
        this.disconnectClient(clientId, 'Timeout');
      }
    });

    // Clean up empty subscriptions
    this.workflowSubscriptions.forEach((subscribers, workflowId) => {
      if (subscribers.size === 0) {
        this.workflowSubscriptions.delete(workflowId);
      }
    });

    this.agentSubscriptions.forEach((subscribers, agentId) => {
      if (subscribers.size === 0) {
        this.agentSubscriptions.delete(agentId);
      }
    });

    this.channels.forEach((members, channelId) => {
      if (members.size === 0) {
        this.channels.delete(channelId);
      }
    });
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get server statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      activeConnections: this.clients.size,
      workflowSubscriptions: this.workflowSubscriptions.size,
      agentSubscriptions: this.agentSubscriptions.size,
      channels: this.channels.size,
      queuedMessages: Array.from(this.messageQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
      uptime: Date.now() - this.statistics.startTime.getTime()
    };
  }

  /**
   * Get active clients info
   */
  getActiveClients() {
    return Array.from(this.clients.entries()).map(([clientId, client]) => ({
      clientId,
      userId: client.userId,
      connectedAt: client.connectedAt,
      subscriptions: Array.from(client.subscriptions),
      lastPing: client.lastPing
    }));
  }
}

export default BmadWebSocketServer;