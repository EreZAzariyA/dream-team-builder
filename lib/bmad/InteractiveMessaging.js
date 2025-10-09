/**
 * Interactive Messaging System
 * Handles real-time user responses during workflow execution
 */

import { EVENTS } from '../pusher/config.js';
import logger from '../utils/logger.js';

export class InteractiveMessaging {
  constructor(pusherService, messageService) {
    this.pusherService = pusherService;
    this.messageService = messageService; // Add this
    this.pendingResponses = new Map(); // workflowId -> { agent, resolve, timeout }
  }

  /**
   * Send interactive message to user and wait for response
   */
  async sendMessageAndWait(workflowId, eventType, data, timeoutMs = 300000) { // 5 minute timeout
    const messageId = this.generateMessageId();
    data.messageId = messageId;
    data.timestamp = new Date().toISOString();

    // Persist message via MessageService if available
    if (this.messageService) {
        const messageToPersist = {
            id: messageId,
            from: data.agent || 'system',
            to: 'user',
            type: eventType,
            content: data.message || data,
            timestamp: data.timestamp,
            workflowId: workflowId
        };
        await this.messageService.addMessage(workflowId, messageToPersist);
    }

    // Send message via Pusher
    if (this.pusherService) {
      try {
        // Import WorkflowId utility for channel naming
        const { WorkflowId } = await import('../utils/workflowId.js');
        const channelName = WorkflowId.toChannelName(workflowId);
        
        await this.pusherService.trigger(channelName, eventType, data);
      } catch (error) {
        logger.warn(`Failed to send message via Pusher: ${error.message}`);
      }
    }
    
    // If no response required, return immediately
    if (!data.requiresResponse) {
      return null;
    }

    // Wait for user response
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingResponses.delete(messageId);
        reject(new Error(`User response timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingResponses.set(messageId, {
        workflowId,
        agent: data.agent,
        resolve: (response) => {
          clearTimeout(timeoutId);
          this.pendingResponses.delete(messageId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          this.pendingResponses.delete(messageId);
          reject(error);
        }
      });

      // Log waiting state
      logger.info(`📨 [${data.agent}] Waiting for user response to message ${messageId}`);
    });
  }

  /**
   * Handle incoming user response
   */
  handleUserResponse(messageId, response) {
    const pendingResponse = this.pendingResponses.get(messageId);
    
    if (pendingResponse) {
      logger.info(`📨 [${pendingResponse.agent}] Received user response: ${JSON.stringify(response)}`);
      pendingResponse.resolve(response);
      return true;
    } else {
      logger.warn(`📨 No pending response found for message ${messageId}`);
      return false;
    }
  }

  /**
   * Cancel pending response (e.g., when workflow is cancelled)
   */
  cancelPendingResponse(messageId, reason = 'Workflow cancelled') {
    const pendingResponse = this.pendingResponses.get(messageId);
    
    if (pendingResponse) {
      pendingResponse.reject(new Error(reason));
      return true;
    }
    
    return false;
  }

  /**
   * Cancel all pending responses for a workflow
   */
  cancelWorkflowResponses(workflowId, reason = 'Workflow cancelled') {
    let cancelledCount = 0;
    
    for (const [messageId, pending] of this.pendingResponses.entries()) {
      if (pending.workflowId === workflowId) {
        pending.reject(new Error(reason));
        this.pendingResponses.delete(messageId);
        cancelledCount++;
      }
    }
    
    if (cancelledCount > 0) {
      logger.info(`📨 Cancelled ${cancelledCount} pending responses for workflow ${workflowId}`);
    }
    
    return cancelledCount;
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get pending response count for monitoring
   */
  getPendingResponseCount() {
    return this.pendingResponses.size;
  }

  /**
   * Cleanup expired responses
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [messageId, pending] of this.pendingResponses.entries()) {
      // Clean up responses older than 10 minutes
      if (now - pending.timestamp > 600000) {
        pending.reject(new Error('Response expired'));
        this.pendingResponses.delete(messageId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`📨 Cleaned up ${cleanedCount} expired pending responses`);
    }
    
    return cleanedCount;
  }
}

export default InteractiveMessaging;