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

  async trigger(workflowId, eventType, data) {
    if (!this.pusher || !workflowId) {
      logger.warn(`🚫 Pusher trigger skipped - pusher: ${!!this.pusher}, workflowId: ${workflowId}`);
      return false;
    }

    try {
      const channelName = `workflow-${workflowId}`;
      const eventData = {
        workflowId,
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
