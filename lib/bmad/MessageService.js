/**
 * Unified Message Service
 * Abstracts message storage and provides consistent API across all BMAD components
 */

import logger from '../utils/logger.js';

class MessageService {
  constructor(options = {}) {
    this.options = {
      // Storage strategy for different message types
      workflowMessages: options.workflowMessages || 'embedded', // 'embedded' | 'collection'
      chatMessages: options.chatMessages || 'collection',        // 'embedded' | 'collection'
      systemMessages: options.systemMessages || 'memory',       // 'memory' | 'collection' | 'embedded'
      
      // Persistence settings
      persistInMemory: options.persistInMemory !== false,
      persistToDatabase: options.persistToDatabase !== false,
      
      // Message retention
      maxInMemoryMessages: options.maxInMemoryMessages || 1000,
      ...options
    };
    
    // In-memory storage for fast access
    this.memoryStore = new Map(); // workflowId -> messages[]
    
    // Track message sources for each workflow
    this.messageConfig = new Map(); // workflowId -> config
  }

  /**
   * Initialize message service for a workflow
   */
  async initializeWorkflow(workflowId, config = {}) {
    const workflowConfig = {
      workflowMessages: config.workflowMessages || this.options.workflowMessages,
      chatMessages: config.chatMessages || this.options.chatMessages,
      systemMessages: config.systemMessages || this.options.systemMessages,
      ...config
    };
    
    this.messageConfig.set(workflowId, workflowConfig);
    
    if (!this.memoryStore.has(workflowId)) {
      this.memoryStore.set(workflowId, []);
    }

    // Load existing messages from appropriate storage
    await this.loadExistingMessages(workflowId);
    
    logger.info(`📨 [MessageService] Initialized for workflow ${workflowId} with config:`, workflowConfig);
  }

  /**
   * Add a message (unified interface)
   */
  async addMessage(workflowId, messageData) {
    const normalizedMessage = this.normalizeMessage(messageData);
    const config = this.messageConfig.get(workflowId) || this.options;
    
    // Always store in memory for fast access
    if (this.options.persistInMemory) {
      this.addToMemory(workflowId, normalizedMessage);
    }
    
    // Persist based on message type and configuration
    if (this.options.persistToDatabase) {
      await this.persistMessage(workflowId, normalizedMessage, config);
    }
    
    return normalizedMessage;
  }

  /**
   * Get messages for a workflow (unified interface)
   */
  async getMessages(workflowId, options = {}) {
    const {
      source = 'auto' // 'auto' | 'memory' | 'database'
    } = options;

    let messages = [];

    if (source === 'memory' || (source === 'auto' && this.memoryStore.has(workflowId))) {
      // Get from memory (fastest)
      messages = this.getFromMemory(workflowId, options);
    } else {
      // Get from database (comprehensive)
      messages = await this.getFromDatabase(workflowId, options);
    }

    return this.applyFilters(messages, options);
  }

  /**
   * Get message history for communication timeline
   */
  getMessageHistory(workflowId) {
    return this.memoryStore.get(workflowId) || [];
  }

  /**
   * Get statistics about messages
   */
  getStatistics(workflowId) {
    const messages = this.memoryStore.get(workflowId) || [];
    
    const stats = {
      totalMessages: messages.length,
      messagesByType: {},
      activeChannels: 0,
      communicationFlow: {},
      timeline: []
    };

    // Calculate statistics
    const agents = new Set();
    messages.forEach(msg => {
      // Count by type
      stats.messagesByType[msg.type] = (stats.messagesByType[msg.type] || 0) + 1;
      
      // Track agents
      agents.add(msg.from);
      agents.add(msg.to);
      
      // Communication flow
      const flow = `${msg.from} → ${msg.to}`;
      stats.communicationFlow[flow] = (stats.communicationFlow[flow] || 0) + 1;
      
      // Timeline
      stats.timeline.push({
        timestamp: msg.timestamp,
        type: msg.type,
        participants: [msg.from, msg.to]
      });
    });

    stats.activeChannels = agents.size;
    return stats;
  }

  /**
   * Normalize message from different formats to unified format
   */
  normalizeMessage(messageData) {
    const normalized = {
      id: messageData.id || messageData.messageId || this.generateMessageId(),
      from: messageData.from || messageData.fromAgent,
      to: messageData.to || messageData.toAgent,
      type: this.normalizeMessageType(messageData.type || messageData.messageType),
      content: messageData.content,
      timestamp: messageData.timestamp || new Date(),
      status: messageData.status || 'sent',
      workflowId: messageData.workflowId,
      
      // Preserve original format for compatibility
      _original: messageData,
      _normalized: true
    };

    return normalized;
  }

  /**
   * Normalize different message type formats
   */
  normalizeMessageType(type) {
    const typeMapping = {
      // AgentCommunicator types -> Standard types
      'activation': 'system',
      'completion': 'response', 
      'inter_agent': 'communication',
      'elicitation_request': 'request',
      'elicitation_response': 'response',
      
      // AgentMessage enum types (keep as-is)
      'handoff': 'handoff',
      'request': 'request',
      'response': 'response',
      'notification': 'notification',
      'error': 'error',
      'status_update': 'status',
      'heartbeat': 'heartbeat',
      'system': 'system',
      'debug': 'debug'
    };

    return typeMapping[type] || type;
  }

  /**
   * Add message to in-memory store
   */
  addToMemory(workflowId, message) {
    if (!this.memoryStore.has(workflowId)) {
      this.memoryStore.set(workflowId, []);
    }

    const messages = this.memoryStore.get(workflowId);
    messages.push(message);

    // Maintain size limit
    if (messages.length > this.options.maxInMemoryMessages) {
      messages.splice(0, messages.length - this.options.maxInMemoryMessages);
    }
  }

  /**
   * Persist message based on configuration
   */
  async persistMessage(workflowId, message, config) {
    const storageType = this.determineStorageType(message.type, config);
    
    try {
      switch (storageType) {
        case 'embedded':
          await this.persistToWorkflowDocument(workflowId, message);
          break;
        case 'collection':
          await this.persistToAgentMessageCollection(workflowId, message);
          break;
        case 'memory':
          // Already handled by addToMemory
          break;
        default:
          console.warn(`[MessageService] Unknown storage type: ${storageType}`);
      }
    } catch (error) {
      console.error(`[MessageService] Failed to persist message:`, error);
      // Don't throw - message is still in memory
    }
  }

  /**
   * Determine storage type based on message type and configuration
   */
  determineStorageType(messageType, config) {
    switch (messageType) {
      case 'request':
      case 'response':
      case 'system':
        return config.workflowMessages;
      case 'communication':
      case 'handoff':
        return config.chatMessages;
      case 'debug':
      case 'heartbeat':
        return config.systemMessages;
      default:
        return config.workflowMessages;
    }
  }

  /**
   * Persist to embedded workflow document
   */
  async persistToWorkflowDocument(workflowId, message) {
    const { connectMongoose } = require('../database/mongodb.js');
    await connectMongoose();
    const WorkflowModel = require('../database/models/Workflow.js').default;
    
    const workflow = await WorkflowModel.findById(workflowId);
    if (!workflow) return;

    // Initialize bmadWorkflowData structure
    if (!workflow.bmadWorkflowData) {
      workflow.bmadWorkflowData = { messages: [] };
    }
    if (!workflow.bmadWorkflowData.messages) {
      workflow.bmadWorkflowData.messages = [];
    }

    // Add message
    workflow.bmadWorkflowData.messages.push({
      id: message.id,
      from: message.from,
      to: message.to,
      type: message.type,
      content: message.content,
      timestamp: message.timestamp,
      status: message.status
    });

    await workflow.save();
    logger.info(`📝 [MessageService] Persisted message ${message.id} to workflow document`);
  }

  /**
   * Persist to AgentMessage collection
   */
  async persistToAgentMessageCollection(workflowId, message) {
    const { connectMongoose } = require('../database/mongodb.js');
    await connectMongoose();
    const AgentMessage = require('../database/models/AgentMessage.js').default;

    const agentMessage = new AgentMessage({
      workflowId: workflowId,
      messageId: message.id,
      fromAgent: message.from,
      toAgent: message.to,
      messageType: this.mapToAgentMessageType(message.type),
      content: {
        text: typeof message.content === 'string' ? message.content : null,
        data: typeof message.content === 'object' ? message.content : null
      },
      timestamp: message.timestamp,
      status: this.mapToAgentMessageStatus(message.status)
    });

    await agentMessage.save();
    logger.info(`📝 [MessageService] Persisted message ${message.id} to AgentMessage collection`);
  }

  /**
   * Load existing messages from storage
   */
  async loadExistingMessages(workflowId) {
    const config = this.messageConfig.get(workflowId);
    const messages = [];

    // Load from embedded workflow documents
    if (config.workflowMessages === 'embedded') {
      const workflowMessages = await this.loadFromWorkflowDocument(workflowId);
      messages.push(...workflowMessages);
    }

    // Load from AgentMessage collection
    if (config.chatMessages === 'collection') {
      const collectionMessages = await this.loadFromAgentMessageCollection(workflowId);
      messages.push(...collectionMessages);
    }

    // Sort by timestamp and store in memory
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    this.memoryStore.set(workflowId, messages);

    logger.info(`📥 [MessageService] Loaded ${messages.length} existing messages for workflow ${workflowId}`);
  }

  /**
   * Load messages from workflow document
   */
  async loadFromWorkflowDocument(workflowId) {
    try {
      const { connectMongoose } = require('../database/mongodb.js');
      await connectMongoose();
      const WorkflowModel = require('../database/models/Workflow.js').default;
      
      const workflow = await WorkflowModel.findById(workflowId);
      if (!workflow || !workflow.bmadWorkflowData || !workflow.bmadWorkflowData.messages) {
        return [];
      }

      return workflow.bmadWorkflowData.messages.map(msg => this.normalizeMessage(msg));
    } catch (error) {
      console.error(`[MessageService] Failed to load from workflow document:`, error);
      return [];
    }
  }

  /**
   * Load messages from AgentMessage collection
   */
  async loadFromAgentMessageCollection(workflowId) {
    try {
      const { connectMongoose } = require('../database/mongodb.js');
      await connectMongoose();
      const AgentMessage = require('../database/models/AgentMessage.js').default;
      
      const messages = await AgentMessage.find({ workflowId }).sort({ timestamp: 1 });
      
      return messages.map(msg => this.normalizeMessage({
        id: msg.messageId,
        from: msg.fromAgent,
        to: msg.toAgent,
        type: msg.messageType,
        content: msg.content.text || msg.content.data,
        timestamp: msg.timestamp,
        status: msg.status
      }));
    } catch (error) {
      console.error(`[MessageService] Failed to load from AgentMessage collection:`, error);
      return [];
    }
  }

  /**
   * Helper methods for type mapping
   */
  mapToAgentMessageType(type) {
    const mapping = {
      'system': 'system',
      'request': 'request', 
      'response': 'response',
      'communication': 'handoff',
      'error': 'error',
      'status': 'status_update',
      'heartbeat': 'heartbeat',
      'debug': 'debug'
    };
    return mapping[type] || 'notification';
  }

  mapToAgentMessageStatus(status) {
    const mapping = {
      'sent': 'sent',
      'delivered': 'delivered',
      'processed': 'processed',
      'failed': 'failed'
    };
    return mapping[status] || 'pending';
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Apply filters to message list
   */
  applyFilters(messages, options) {
    let filtered = [...messages];

    if (options.messageType) {
      filtered = filtered.filter(msg => msg.type === options.messageType);
    }

    if (options.fromAgent) {
      filtered = filtered.filter(msg => msg.from === options.fromAgent);
    }

    if (options.toAgent) {
      filtered = filtered.filter(msg => msg.to === options.toAgent);
    }

    if (options.since) {
      filtered = filtered.filter(msg => new Date(msg.timestamp) >= new Date(options.since));
    }

    // Apply limit and offset
    const start = options.offset || 0;
    const end = start + (options.limit || 50);
    
    return filtered.slice(start, end);
  }

  /**
   * Get messages from memory
   */
  getFromMemory(workflowId, options = {}) {
    return this.memoryStore.get(workflowId) || [];
  }

  /**
   * Get messages from database (comprehensive query)
   */
  async getFromDatabase(workflowId, options = {}) {
    // This would implement database queries across both storage types
    // For now, return from memory as fallback
    return this.getFromMemory(workflowId, options);
  }

  /**
   * Cleanup memory for completed workflows
   */
  cleanup(workflowId) {
    this.memoryStore.delete(workflowId);
    this.messageConfig.delete(workflowId);
    logger.info(`🧹 [MessageService] Cleaned up workflow ${workflowId}`);
  }
}

export default { MessageService };