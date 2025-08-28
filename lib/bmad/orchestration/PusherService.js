import logger from '@/lib/utils/logger.js';


class PusherService {
  constructor() {
    this.pusher = null;
    try {
      if (typeof window === 'undefined') {
        const { pusherServer } = require('../../pusher/config.js');
        this.pusher = pusherServer;
      }
    } catch (error) {
      logger.warn('Pusher server not available:', error.message);
    }
    this.isConnected = !!this.pusher;
  }

  /**
   * Trigger a Pusher event for a workflow
   * @param {string} workflowId - Raw workflow ID or pre-formatted channel name
   * @param {string} eventType - Event type to trigger
   * @param {Object} data - Event data
   * @returns {boolean} Success status
   */
  async trigger(workflowId, eventType, data) {
    if (!this.pusher || !workflowId) {
      logger.warn(`🚫 Pusher trigger skipped - pusher: ${!!this.pusher}, workflowId: ${workflowId}`);
      return false;
    }

    try {
      // Import WorkflowId utility for consistent channel naming
      const { WorkflowId } = await import('../../utils/workflowId.js');
      
      // Check if this is already a complete channel name (like repo-analysis-xxx)
      let channelName;
      
      if (workflowId.includes('-') && !workflowId.startsWith('workflow_')) {
        // This is likely a complete channel name like "repo-analysis-123" - use as is
        channelName = workflowId;
        logger.info(`🔍 [PUSHER] Using channel name as-is: "${channelName}"`);
      } else {
        // This is a workflow ID - apply the workflow prefix fix
        let cleanWorkflowId = workflowId;
        
        // Remove all "workflow-" prefixes to get to the raw ID
        while (cleanWorkflowId.startsWith('workflow-')) {
          cleanWorkflowId = cleanWorkflowId.substring(9); // Remove "workflow-"
        }
        
        // Manually create workflow channel name
        channelName = `workflow-${cleanWorkflowId}`;
        logger.info(`🔍 [PUSHER] Created workflow channel: "${channelName}"`);
      }
        
      const eventData = {
        workflowId: workflowId, // Use original ID for event data
        timestamp: new Date().toISOString(),
        ...data
      };

      logger.info(`📡 [Pusher] Triggering ${eventType} on ${channelName} - ${JSON.stringify(eventData)}` );

      await this.pusher.trigger(channelName, eventType, eventData);
      logger.info(`✅ [Pusher] Event sent successfully: ${eventType}`);
      return true;
    } catch (error) {
      logger.error(`❌ [Pusher] Failed to send ${eventType}:`, error);
      return false;
    }
  }

  // Enhanced event methods for workflow communication
  async triggerAgentActivated(workflowId, agentId, metadata = {}) {
    return this.trigger(workflowId, 'agent-activated', {
      agentId,
      status: 'active',
      ...metadata
    });
  }

  async triggerAgentCompleted(workflowId, agentId, result = {}) {
    return this.trigger(workflowId, 'agent-completed', {
      agentId,
      status: 'completed',
      result,
      ...result
    });
  }

  async triggerWorkflowMessage(workflowId, message) {
    return this.trigger(workflowId, 'workflow-message', {
      message: {
        id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        from: message.from || 'system',
        to: message.to || 'user',
        content: message.content || message.summary || 'No content',
        timestamp: message.timestamp || new Date().toISOString(),
        type: message.type || 'info',
        ...message
      }
    });
  }

  async triggerWorkflowUpdate(workflowId, status, details = {}) {
    return this.trigger(workflowId, 'workflow-update', {
      status,
      ...details
    });
  }

  async triggerElicitationRequest(workflowId, elicitationDetails) {
    return this.trigger(workflowId, 'workflow-update', {
      status: 'PAUSED_FOR_ELICITATION',
      elicitationDetails
    });
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      pusherAvailable: !!this.pusher,
      envVarsSet: {
        PUSHER_APP_ID: !!process.env.PUSHER_APP_ID,
        PUSHER_KEY: !!process.env.PUSHER_KEY,
        PUSHER_SECRET: !!process.env.PUSHER_SECRET
      }
    };
  }
}

module.exports = { PusherService };
