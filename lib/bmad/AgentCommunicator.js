/**
 * BMAD Agent Communication System
 * Handles messaging between agents and workflow coordination
 */

const { EventEmitter } = require('events');
const { MessageType } = require('./types.js');
import logger from '../utils/logger.js';

class AgentCommunicator extends EventEmitter {
  constructor(webSocketServer = null, messageService = null, pusherService = null) {
    super();
    this.messageHandlers = new Map(); // messageType -> handler function
    // For serverless: activeChannels should be stored in database, not memory
    // Fallback to empty Map for backward compatibility
    this.activeChannels = new Map();
    this.webSocketServer = webSocketServer; // For real-time broadcasting
    this.messageService = messageService; // For database persistence
    this.pusherService = pusherService; // For real-time Pusher events
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
    // CRITICAL DEBUG: Log all sendMessage calls to trace message flow
    console.log(`🔍 [COMMUNICATOR DEBUG] sendMessage called for workflow ${workflowId}:`, {
      from: message.from,
      to: message.to,
      type: message.type,
      content: (() => {
        try {
          if (typeof message.content === 'string') {
            return message.content.substring(0, 100) + '...';
          }
          const stringified = JSON.stringify(message.content || '');
          return typeof stringified === 'string' ? stringified.substring(0, 100) + '...' : '[non-stringifiable]';
        } catch (e) {
          return '[debug-error]';
        }
      })(),
      hasMessageService: !!this.messageService
    });
    
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


      // CRITICAL: Persist message to database via MessageService
      if (this.messageService) {
        try {
          await this.messageService.addMessage(workflowId, enrichedMessage);
          logger.info(`💾 [DATABASE] Persisted message ${enrichedMessage.id} from ${enrichedMessage.from} to database`);
        } catch (error) {
          logger.error(`❌ [DATABASE] Failed to persist message ${enrichedMessage.id}:`, error.message);
          // Don't fail the entire operation if DB save fails - workflow should continue
          // The atomic update in MessageService now handles concurrency gracefully
        }
      }

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
      
      // Send Pusher events for real-time UI updates  
      if (this.pusherService) {
        // CRITICAL FIX: Extract actual message content for UI display
        let displayContent = enrichedMessage.content;
        
        // If content is a JSON string, try to extract the actual message
        if (typeof displayContent === 'string') {
          try {
            const parsed = JSON.parse(displayContent);
            if (parsed.message) {
              displayContent = parsed.message; // Extract the actual message content
            }
          } catch (e) {
            // If parsing fails, use the original content
            // This handles cases where content is already a plain string
          }
        }
        
        this.pusherService.trigger(workflowId, 'workflow-message', {
          message: {
            id: enrichedMessage.id,
            from: enrichedMessage.from,
            to: enrichedMessage.to,
            summary: this.generateMessageSummary(enrichedMessage),
            content: displayContent, // Use extracted/processed content
            timestamp: enrichedMessage.timestamp
          }
        });
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
    
    // Agent activation tracked in database via workflow state

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
    
    // Agent completion tracked in database via workflow state

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
    // Agent error tracked in database via workflow state

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
    
    // Handle elicitation workflow state update
    if (this.pusherService) {
      try {
        const { connectMongoose } = require('../database/mongodb.js');
        await connectMongoose();
        
        const WorkflowModel = require('../database/models/Workflow.js').default;
        
        // Update workflow status and elicitation details
        await WorkflowModel.findOneAndUpdate(
          { workflowId: message.workflowId }, 
          { 
            status: 'PAUSED_FOR_ELICITATION',
            elicitationDetails: message.content,
            updatedAt: new Date()
          }, 
          { new: true }
        );
        
        // Send Pusher update
        this.pusherService.trigger(message.workflowId, 'workflow-update', {
          status: 'PAUSED_FOR_ELICITATION',
          message: 'Workflow paused, waiting for user input.',
          elicitationDetails: message.content,
          timestamp: new Date().toISOString()
        });
        
        logger.info('📝 [DATABASE] Elicitation details saved and Pusher event sent');
        
      } catch (error) {
        logger.error('❌ [DATABASE] Failed to update workflow with elicitation details:', error);
      }
    }
    
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
   * Get message history for a workflow from database
   */
  async getMessageHistory(workflowId, options = {}) {
    if (!this.messageService) {
      return [];
    }
    
    // Get messages directly from MessageService (database)
    const messages = await this.messageService.getMessages(workflowId, options);
    return messages;
  }

  /**
   * Get active channels for a workflow
   */
  getActiveChannels(workflowId) {
    const channels = [];
    
    // Defensive check: ensure activeChannels exists and is iterable
    if (!this.activeChannels || typeof this.activeChannels[Symbol.iterator] !== 'function') {
      logger.warn(`⚠️ [SERVERLESS ISSUE] activeChannels not properly initialized, returning empty array`);
      return channels;
    }
    
    try {
      for (const [, channel] of this.activeChannels) {
        if (channel && channel.workflowId === workflowId) {
          channels.push(channel);
        }
      }
    } catch (error) {
      logger.error(`❌ [ACTIVE CHANNELS] Error iterating channels: ${error.message}`);
      return [];
    }
    
    return channels;
  }

  /**
   * Get communication timeline for workflow visualization
   */
  async getCommunicationTimeline(workflowId) {
    const messages = await this.getMessageHistory(workflowId);
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
   * Generate message summary for Pusher events
   */
  generateMessageSummary(message) {
    switch (message.type) {
      case 'activation':
        return `Activating ${message.to} agent`;
      case 'completion':
        return message.content?.summary || `${message.from} completed task`;
      case 'error':
        return `Error in ${message.from}: ${message.content?.error || 'Unknown error'}`;
      case 'inter_agent':
        return `${message.from} → ${message.to}: ${message.content?.summary || 'Communication'}`;
      case 'workflow_complete':
        return 'Workflow completed successfully';
      case 'elicitation_request':
        return `${message.from} requesting user input`;
      case 'workflow_progress':
        return `workflow_progress message from ${message.from} to ${message.to}`;
      default:
        return `${message.type} message from ${message.from} to ${message.to}`;
    }
  }

  /**
   * Cleanup is now handled at database level
   */
  cleanup(workflowId, olderThanHours = 24) {
    // No cleanup needed - agent state tracked in database
    logger.info(`Cleanup called for workflow ${workflowId || 'all workflows'}`);
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
  async getStatistics(workflowId) {
    const messages = await this.getMessageHistory(workflowId);
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