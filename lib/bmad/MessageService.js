/**
 * Unified Message Service
 * Stores all messages in bmadWorkflowData.messages[] for single source of truth
 */

import logger from '../utils/logger.js';

class MessageService {
  constructor(options = {}) {
    this.options = {
      // All messages stored in bmadWorkflowData.messages[] only
      persistToDatabase: options.persistToDatabase !== false,
      
      ...options
    };
    
    // Track message sources for each workflow
    this.messageConfig = new Map(); // workflowId -> config
  }

  /**
   * Initialize message service for a workflow
   */
  async initializeWorkflow(workflowId, config = {}) {
    const workflowConfig = {
      // All messages stored in bmadWorkflowData.messages[] only
      ...config
    };
    
    this.messageConfig.set(workflowId, workflowConfig);
    
    // Load existing messages from database
    await this.loadExistingMessages(workflowId);
    
    logger.info(`📨 [MessageService] Initialized for workflow ${workflowId}`);
  }

  /**
   * Add a message (unified interface)
   */
  async addMessage(workflowId, messageData) {
    const normalizedMessage = this.normalizeMessage(messageData);
    
    // Store in bmadWorkflowData.messages[] only (single source of truth)
    await this.persistToWorkflowDocument(workflowId, normalizedMessage);
    
    return normalizedMessage;
  }

  /**
   * Get messages for a workflow from database
   */
  async getMessages(workflowId, options = {}) {
    // Always load fresh from database (bmadWorkflowData.messages[])
    let messages = await this.loadFromWorkflowDocument(workflowId);
    
    return this.applyFilters(messages, options);
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
   * Persist to embedded workflow document using atomic operations to prevent race conditions
   */
  async persistToWorkflowDocument(workflowId, message) {
    const { connectMongoose } = require('../database/mongodb.js');
    await connectMongoose();
    const WorkflowModel = require('../database/models/Workflow.js').default;

    // Prepare message with safe content serialization
    const messageToStore = {
      id: message.id,
      from: message.from,
      to: message.to,
      type: message.type,
      // CRITICAL FIX: Ensure content is always stored as a string to prevent character breakdown
      content: typeof message.content === 'string' ? message.content : 
               (message.content && typeof message.content === 'object') ? JSON.stringify(message.content) : 
               String(message.content || ''),
      timestamp: message.timestamp,
      status: message.status
    };

    try {
      // CRITICAL FIX: First ensure the messages array exists, then push
      // Step 1: Initialize messages array if it doesn't exist
      await WorkflowModel.findOneAndUpdate(
        { 
          workflowId: workflowId,
          'bmadWorkflowData.messages': { $exists: false }
        },
        { 
          $set: { 'bmadWorkflowData.messages': [] }
        },
        { upsert: false }
      );
      
      // Step 2: Push the message to the messages array
      const result = await WorkflowModel.findOneAndUpdate(
        { workflowId: workflowId },
        { 
          $push: { 'bmadWorkflowData.messages': messageToStore }
        },
        { 
          new: true, 
          upsert: false,
          runValidators: true
        }
      );

      if (!result) {
        logger.warn(`⚠️ [MessageService] Workflow ${workflowId} not found, skipping message persistence for ${message.id}`);
        return;
      }

      
      
    } catch (error) {
      // Enhanced error logging for debugging
      const errorDetails = {
        workflowId,
        messageId: message.id,
        messageSize: JSON.stringify(message).length,
        error: error.message,
        errorCode: error.code,
        errorName: error.name,
        stack: error.stack,
        fullError: error.toString(),
        mongooseValidationErrors: error.errors ? Object.keys(error.errors) : null,
        isVersionError: error.message?.includes('version') || error.code === 11000,
        isConcurrencyError: error.message?.includes('E11000') || error.message?.includes('duplicate'),
        errorType: 'atomic_update_failed'
      };
      
      // Log with both console and logger to ensure visibility
      console.error(`❌ [MessageService] ATOMIC UPDATE FAILED for message ${message.id}:`, errorDetails);
      logger.error(`❌ [MessageService] Failed to atomically save message ${message.id}:`, errorDetails);
      
      // Don't re-throw the error to prevent workflow interruption
      // The workflow should continue even if message persistence fails
      logger.warn(`⚠️ [MessageService] Continuing workflow execution despite message persistence failure for ${message.id}`);
    }
  }


  /**
   * Load existing messages from database
   */
  async loadExistingMessages(workflowId) {
    // Load from bmadWorkflowData.messages[] only
    const messages = await this.loadFromWorkflowDocument(workflowId);
    
    return messages;
  }

  /**
   * Load messages from workflow document
   */
  async loadFromWorkflowDocument(workflowId) {
    try {
      const { connectMongoose } = require('../database/mongodb.js');
      await connectMongoose();
      
      // CRITICAL FIX: Force fresh query with read concern and fresh connection
      delete require.cache[require.resolve('../database/models/Workflow.js')]; // Clear module cache
      const WorkflowModel = require('../database/models/Workflow.js').default;
      const workflow = await WorkflowModel.findOne({ workflowId: workflowId })
        .lean()
        .read('primary') // Force read from primary
        .maxTimeMS(5000); // 5 second timeout
      
      // ENHANCED DEBUG: Log the full workflow structure with explicit values
      const debugInfo = {
        found: !!workflow,
        hasBmadData: !!(workflow?.bmadWorkflowData),
        messagesCount: workflow?.bmadWorkflowData?.messages?.length || 0,
        workflowKeys: workflow ? Object.keys(workflow) : [],
        bmadDataKeys: workflow?.bmadWorkflowData ? Object.keys(workflow.bmadWorkflowData) : [],
        fullWorkflowId: workflow?.workflowId,
        workflowStatus: workflow?.status,
        hasMessagesArray: Array.isArray(workflow?.bmadWorkflowData?.messages)
      };
      
      
      // Initialize empty bmadWorkflowData if it doesn't exist
      if (!workflow) {
        logger.warn(`⚠️ [MessageService] Workflow ${workflowId} not found in database`);
        return [];
      }
      
      if (!workflow.bmadWorkflowData) {
        logger.warn(`⚠️ [MessageService] No bmadWorkflowData found for ${workflowId}`);
        return [];
      }
      
      if (!workflow.bmadWorkflowData.messages) {
        logger.warn(`⚠️ [MessageService] No messages array found for ${workflowId}`);
        return [];
      }

      const messages = workflow.bmadWorkflowData.messages.map(msg => this.normalizeMessage(msg));
      
      // DEBUG: Log message loading details
      if (messages.length > 0) {
        // Messages loaded successfully
      } else {
        logger.warn(`⚠️ [MessageService] No messages found in workflow document for ${workflowId}. bmadWorkflowData exists: ${!!workflow.bmadWorkflowData}, messages array length: ${workflow.bmadWorkflowData.messages?.length || 0}`);
        
      }
      
      return messages;
    } catch (error) {
      console.error(`❌ [MessageService] Failed to load from workflow document:`, error);
      return [];
    }
  }

  /**
   * Helper method to find workflow by either ObjectId or custom workflowId
   */
  async findWorkflow(workflowId) {
    const { connectMongoose } = require('../database/mongodb.js');
    await connectMongoose();
    const WorkflowModel = require('../database/models/Workflow.js').default;
    
    // Always search by workflowId field
    return await WorkflowModel.findOne({ workflowId: workflowId });
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
   * Cleanup workflow configuration
   */
  cleanup(workflowId) {
    this.messageConfig.delete(workflowId);
    logger.info(`🧹 [MessageService] Cleaned up workflow ${workflowId}`);
  }


  /**
   * Global cleanup for all workflows
   */
  cleanupAll() {
    const count = this.messageConfig.size;
    this.messageConfig.clear();
    logger.info(`🧹 [MessageService] Cleaned up ${count} workflow configurations`);
  }
}

export default { MessageService };