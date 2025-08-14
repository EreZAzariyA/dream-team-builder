/**
 * BMAD Agent Communication System
 * Handles messaging between agents and workflow coordination
 */

const { EventEmitter } = require('events');
const { MessageType } = require('./types.js');
import logger from '../utils/logger.js';

class AgentCommunicator extends EventEmitter {
  constructor(webSocketServer = null) {
    super();
    this.messageHistory = new Map(); // workflowId -> messages[]
    this.activeChannels = new Map();  // workflowId -> channel info
    this.messageHandlers = new Map(); // messageType -> handler function
    this.webSocketServer = webSocketServer; // For real-time broadcasting
    this.setupDefaultHandlers();
  }

  /**
   * Setup default message handlers
   */
  setupDefaultHandlers() {
    this.messageHandlers.set(MessageType.ACTIVATION, this.handleActivationMessage.bind(this));
    this.messageHandlers.set(MessageType.COMPLETION, this.handleCompletionMessage.bind(this));
    this.messageHandlers.set(MessageType.ERROR, this.handleErrorMessage.bind(this));
    this.messageHandlers.set(MessageType.INTER_AGENT, this.handleInterAgentMessage.bind(this));
    this.messageHandlers.set(MessageType.ELICITATION_REQUEST, this.handleElicitationRequestMessage.bind(this));
    this.messageHandlers.set(MessageType.WORKFLOW_STEP_UPDATE, this.handleWorkflowStepUpdateMessage.bind(this));
    this.messageHandlers.set(MessageType.WORKFLOW_PROGRESS, this.handleWorkflowProgressMessage.bind(this));
  }

  /**
   * Send message within a workflow
   */
  async sendMessage(workflowId, message) {
    try {
      // Validate message structure
      this.validateMessage(message);

      // Add metadata
      const enrichedMessage = {
        ...message,
        id: this.generateMessageId(),
        workflowId,
        timestamp: message.timestamp || new Date(),
        status: 'sent'
      };

      // Store message in history
      if (!this.messageHistory.has(workflowId)) {
        this.messageHistory.set(workflowId, []);
      }
      this.messageHistory.get(workflowId).push(enrichedMessage);

      // Route message to appropriate handler
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        await handler(enrichedMessage);
      }

      // Emit message event for real-time updates
      this.emit('message', enrichedMessage);
      this.emit(`message:${workflowId}`, enrichedMessage);
      this.emit(`message:${message.type}`, enrichedMessage);

      // Broadcast to WebSocket clients if server is available
      if (this.webSocketServer) {
        this.broadcastToWebSocket(workflowId, enrichedMessage);
      }

      return enrichedMessage;

    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Handle agent activation messages
   */
  async handleActivationMessage(message) {
    logger.info(`Activating agent ${message.to} for workflow ${message.workflowId}`);
    
    // Create activation channel
    this.activeChannels.set(`${message.workflowId}:${message.to}`, {
      workflowId: message.workflowId,
      agentId: message.to,
      status: 'active',
      startTime: new Date(),
      context: message.content.context
    });

    // Emit activation event
    this.emit('agent:activated', {
      workflowId: message.workflowId,
      agentId: message.to,
      context: message.content.context
    });
  }

  /**
   * Handle agent completion messages
   */
  async handleCompletionMessage(message) {
    logger.info(`Agent ${message.from} completed in workflow ${message.workflowId}`);
    
    // Update channel status
    const channelKey = `${message.workflowId}:${message.from}`;
    const channel = this.activeChannels.get(channelKey);
    if (channel) {
      channel.status = 'completed';
      channel.endTime = new Date();
      channel.result = message.content;
    }

    // Emit completion event
    this.emit('agent:completed', {
      workflowId: message.workflowId,
      agentId: message.from,
      result: message.content
    });
  }

  /**
   * Handle error messages
   */
  async handleErrorMessage(message) {
    console.error(`Error in workflow ${message.workflowId}:`, message.content);
    
    // Update channel status
    const channelKey = `${message.workflowId}:${message.from}`;
    const channel = this.activeChannels.get(channelKey);
    if (channel) {
      channel.status = 'error';
      channel.error = message.content;
      channel.endTime = new Date();
    }

    // Emit error event
    this.emit('workflow:error', {
      workflowId: message.workflowId,
      agentId: message.from,
      error: message.content
    });
  }

  /**
   * Handle inter-agent communication
   */
  async handleInterAgentMessage(message) {
    logger.info(`Inter-agent message from ${message.from} to ${message.to}`);
    
    // Emit inter-agent communication event
    this.emit('agent:communication', {
      workflowId: message.workflowId,
      from: message.from,
      to: message.to,
      content: message.content
    });
  }

  /**
   * Handle elicitation request messages
   */
  async handleElicitationRequestMessage(message) {
    logger.info(`Elicitation request from ${message.from} in workflow ${message.workflowId}`);
    
    // Emit elicitation request event
    this.emit('elicitation:request', {
      workflowId: message.workflowId,
      agentId: message.from,
      sectionTitle: message.content.sectionTitle,
      instruction: message.content.instruction,
      sectionId: message.content.sectionId
    });
  }

  /**
   * Handle workflow step update messages
   */
  async handleWorkflowStepUpdateMessage(message) {
    logger.info(`Workflow step update for workflow ${message.workflowId}: step ${message.content.currentStepIndex}`);
    
    // Emit workflow step update event
    this.emit('workflow:step-update', {
      workflowId: message.workflowId,
      currentStepIndex: message.content.currentStepIndex,
      stepDetails: message.content.stepDetails,
      status: message.content.status
    });
  }

  /**
   * Handle workflow progress messages  
   */
  async handleWorkflowProgressMessage(message) {
    logger.info(`Workflow progress for workflow ${message.workflowId}: ${message.content.currentStep}/${message.content.totalSteps}`);
    
    // Emit workflow progress event
    this.emit('workflow:progress', {
      workflowId: message.workflowId,
      currentStep: message.content.currentStep,
      totalSteps: message.content.totalSteps,
      progress: message.content.progress
    });
  }

  /**
   * Get message history for a workflow
   */
  getMessageHistory(workflowId, options = {}) {
    const messages = this.messageHistory.get(workflowId) || [];
    
    let filteredMessages = messages;
    
    // Filter by message type
    if (options.type) {
      filteredMessages = filteredMessages.filter(msg => msg.type === options.type);
    }
    
    // Filter by agent
    if (options.agentId) {
      filteredMessages = filteredMessages.filter(
        msg => msg.from === options.agentId || msg.to === options.agentId
      );
    }
    
    // Limit results
    if (options.limit) {
      filteredMessages = filteredMessages.slice(-options.limit);
    }
    
    return filteredMessages;
  }

  /**
   * Get active channels for a workflow
   */
  getActiveChannels(workflowId) {
    const channels = [];
    for (const [, channel] of this.activeChannels) {
      if (channel.workflowId === workflowId) {
        channels.push(channel);
      }
    }
    return channels;
  }

  /**
   * Get communication timeline for workflow visualization
   */
  getCommunicationTimeline(workflowId) {
    const messages = this.getMessageHistory(workflowId);
    return messages.map(msg => ({
      id: msg.id,
      timestamp: msg.timestamp,
      from: msg.from,
      to: msg.to,
      type: msg.type,
      summary: this.generateMessageSummary(msg),
      status: msg.status
    }));
  }

  /**
   * Generate human-readable message summary
   */
  generateMessageSummary(message) {
    switch (message.type) {
      case MessageType.ACTIVATION:
        return `Activating ${message.to} agent`;
      case MessageType.COMPLETION:
        return `${message.from} completed task`;
      case MessageType.ERROR:
        return `Error in ${message.from}: ${message.content.error || 'Unknown error'}`;
      case MessageType.INTER_AGENT:
        return `${message.from} → ${message.to}: ${message.content.summary || 'Communication'}`;
      case MessageType.WORKFLOW_COMPLETE:
        return 'Workflow completed successfully';
      case MessageType.ELICITATION_REQUEST:
        return `${message.from} requests user input: ${message.content.sectionTitle || 'Input required'}`;
      case MessageType.WORKFLOW_STEP_UPDATE:
        return `Workflow step ${message.content.currentStepIndex}: ${message.content.stepDetails?.stepName || 'Step update'}`;
      case MessageType.WORKFLOW_PROGRESS:
        return `Workflow progress: ${message.content.currentStep}/${message.content.totalSteps}`;
      default:
        return `${message.type} message`;
    }
  }

  /**
   * Send inter-agent message
   */
  async sendInterAgentMessage(workflowId, fromAgent, toAgent, content) {
    return this.sendMessage(workflowId, {
      from: fromAgent,
      to: toAgent,
      type: MessageType.INTER_AGENT,
      content: {
        message: content.message,
        data: content.data,
        artifacts: content.artifacts,
        summary: content.summary || content.message
      }
    });
  }

  /**
   * Broadcast message to all agents in workflow
   */
  async broadcastMessage(workflowId, fromAgent, content) {
    const channels = this.getActiveChannels(workflowId);
    const broadcasts = [];

    for (const channel of channels) {
      if (channel.agentId !== fromAgent) {
        broadcasts.push(
          this.sendMessage(workflowId, {
            from: fromAgent,
            to: channel.agentId,
            type: MessageType.INTER_AGENT,
            content: {
              ...content,
              broadcast: true
            }
          })
        );
      }
    }

    return Promise.all(broadcasts);
  }

  /**
   * Subscribe to workflow events
   */
  subscribeToWorkflow(workflowId, eventHandlers) {
    const events = [
      'message',
      'agent:activated',
      'agent:completed',
      'agent:communication',
      'workflow:error'
    ];

    const unsubscribe = {};

    events.forEach(event => {
      if (eventHandlers[event]) {
        const handler = (data) => {
          if (data.workflowId === workflowId) {
            eventHandlers[event](data);
          }
        };
        this.on(event, handler);
        unsubscribe[event] = () => this.off(event, handler);
      }
    });

    // Return unsubscribe function
    return () => {
      Object.values(unsubscribe).forEach(fn => fn());
    };
  }

  /**
   * Validate message structure
   */
  validateMessage(message) {
    const required = ['from', 'to', 'type', 'content'];
    for (const field of required) {
      if (!message[field]) {
        throw new Error(`Message missing required field: ${field}`);
      }
    }

    if (!Object.values(MessageType).includes(message.type)) {
      throw new Error(`Invalid message type: ${message.type}`);
    }
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Clean up old message history
   */
  cleanup(workflowId, olderThanHours = 24) {
    if (workflowId) {
      // Clean specific workflow
      this.messageHistory.delete(workflowId);
      
      // Clean channels for this workflow
      for (const [, channel] of this.activeChannels) {
        if (channel.workflowId === workflowId) {
          this.activeChannels.delete(key);
        }
      }
    } else {
      // Clean old messages across all workflows
      const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
      
      for (const [workflowId, messages] of this.messageHistory) {
        const recentMessages = messages.filter(msg => msg.timestamp > cutoffTime);
        if (recentMessages.length === 0) {
          this.messageHistory.delete(workflowId);
        } else {
          this.messageHistory.set(workflowId, recentMessages);
        }
      }
    }
  }

  /**
   * Broadcast message to WebSocket clients
   */
  broadcastToWebSocket(workflowId, message) {
    if (!this.webSocketServer) return;

    try {
      // Broadcast to workflow subscribers
      this.webSocketServer.broadcastToWorkflow(workflowId, {
        type: 'workflow_message',
        message: {
          id: message.id,
          from: message.from,
          to: message.to,
          type: message.type,
          timestamp: message.timestamp,
          summary: this.generateMessageSummary(message)
        }
      });

      // Also broadcast to specific agent subscribers
      if (message.from && message.from !== 'system') {
        this.webSocketServer.broadcastToAgent(message.from, {
          type: 'agent_message',
          agentId: message.from,
          workflowId,
          message: {
            id: message.id,
            to: message.to,
            type: message.type,
            timestamp: message.timestamp,
            summary: this.generateMessageSummary(message)
          }
        });
      }

      if (message.to && message.to !== 'system' && message.to !== message.from) {
        this.webSocketServer.broadcastToAgent(message.to, {
          type: 'agent_message',
          agentId: message.to,
          workflowId,
          message: {
            id: message.id,
            from: message.from,
            type: message.type,
            timestamp: message.timestamp,
            summary: this.generateMessageSummary(message)
          }
        });
      }

    } catch (error) {
      console.error('Error broadcasting to WebSocket:', error);
    }
  }

  /**
   * Set WebSocket server for real-time broadcasting
   */
  setWebSocketServer(webSocketServer) {
    this.webSocketServer = webSocketServer;
  }

  /**
   * Broadcast workflow status update
   */
  broadcastWorkflowUpdate(workflowId, update) {
    if (!this.webSocketServer) return;

    this.webSocketServer.broadcastToWorkflow(workflowId, {
      type: 'workflow_update',
      ...update
    });

    // Emit locally as well
    this.emit('workflow:update', { workflowId, ...update });
  }

  /**
   * Broadcast agent status update
   */
  broadcastAgentUpdate(agentId, workflowId, update) {
    if (!this.webSocketServer) return;

    this.webSocketServer.broadcastToAgent(agentId, {
      type: 'agent_update',
      agentId,
      workflowId,
      ...update
    });

    // Also broadcast to workflow subscribers
    this.webSocketServer.broadcastToWorkflow(workflowId, {
      type: 'workflow_agent_update',
      agentId,
      workflowId,
      ...update  
    });

    // Emit locally as well
    this.emit('agent:update', { agentId, workflowId, ...update });
  }

  /**
   * Get communication statistics
   */
  getStatistics(workflowId) {
    const messages = this.getMessageHistory(workflowId);
    const channels = this.getActiveChannels(workflowId);
    
    const stats = {
      totalMessages: messages.length,
      messagesByType: {},
      activeChannels: channels.length,
      communicationFlow: {},
      timeline: []
    };

    // Count messages by type
    messages.forEach(msg => {
      stats.messagesByType[msg.type] = (stats.messagesByType[msg.type] || 0) + 1;
    });

    // Analyze communication flow
    messages.forEach(msg => {
      if (msg.from && msg.to) {
        const flow = `${msg.from} → ${msg.to}`;
        stats.communicationFlow[flow] = (stats.communicationFlow[flow] || 0) + 1;
      }
    });

    // Create timeline
    stats.timeline = messages.map(msg => ({
      timestamp: msg.timestamp,
      type: msg.type,
      participants: [msg.from, msg.to].filter(Boolean)
    }));

    return stats;
  }
}

module.exports = { AgentCommunicator };