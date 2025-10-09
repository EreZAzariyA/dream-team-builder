/**
 * Interactive Messaging System with Redis
 * Handles real-time user responses during workflow execution across distributed serverless instances
 *
 * REQUIRES Redis to function properly in production (Vercel)
 *
 * Redis Key Structure:
 * - interactive:pending:{messageId} - Pending response data (hash with TTL)
 * - interactive:response:{messageId} - Response data (temporary storage for polling)
 * - interactive:workflow:{workflowId}:messages - List of message IDs for a workflow
 */

import { EVENTS } from '../pusher/config.js';
import logger from '../utils/logger.js';
import { redisService } from '../utils/redis.js';

export class InteractiveMessaging {
  constructor(pusherService, messageService) {
    this.pusherService = pusherService;
    this.messageService = messageService;

    // Verify Redis is available
    if (!redisService.isAvailable()) {
      logger.warn('⚠️  Interactive Messaging: Redis not configured - workflow responses will NOT work properly in production!');
    }
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

    // Check Redis availability
    if (!redisService.isAvailable()) {
      throw new Error('Interactive messaging requires Redis to be configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
    }

    // Wait for user response using Redis
    return this.waitForResponse(messageId, workflowId, data, timeoutMs);
  }

  /**
   * Wait for response using Redis
   */
  async waitForResponse(messageId, workflowId, data, timeoutMs) {
    // Store pending response in Redis with TTL
    const pendingKey = `interactive:pending:${messageId}`;
    const pendingData = {
      workflowId,
      agent: data.agent,
      timestamp: Date.now(),
      status: 'waiting'
    };

    const ttlSeconds = Math.ceil(timeoutMs / 1000);
    await redisService.set(pendingKey, pendingData, ttlSeconds);

    // Add message to workflow's message list
    const workflowMessagesKey = `interactive:workflow:${workflowId}:messages`;
    await redisService.lpush(workflowMessagesKey, messageId);
    await redisService.expire(workflowMessagesKey, ttlSeconds);

    logger.info(`📨 [${data.agent}] Waiting for user response to message ${messageId} (Redis)`);

    // Poll for response (serverless-friendly approach)
    const pollInterval = 1000; // 1 second
    const maxPolls = Math.floor(timeoutMs / pollInterval);

    for (let i = 0; i < maxPolls; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      // Check if response has been received
      const responseKey = `interactive:response:${messageId}`;
      const response = await redisService.get(responseKey);

      if (response) {
        // Clean up
        await redisService.del(pendingKey);
        await redisService.del(responseKey);

        logger.info(`📨 [${data.agent}] Received user response (Redis): ${JSON.stringify(response)}`);
        return response;
      }

      // Check if pending request still exists (not cancelled)
      const pending = await redisService.get(pendingKey);
      if (!pending) {
        throw new Error('Response request was cancelled');
      }
    }

    // Timeout
    await redisService.del(pendingKey);
    throw new Error(`User response timeout after ${timeoutMs}ms`);
  }

  /**
   * Handle incoming user response
   */
  async handleUserResponse(messageId, response) {
    if (!redisService.isAvailable()) {
      throw new Error('Interactive messaging requires Redis to be configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
    }

    const pendingKey = `interactive:pending:${messageId}`;
    const pendingResponse = await redisService.get(pendingKey);

    if (pendingResponse) {
      logger.info(`📨 [${pendingResponse.agent}] Received user response: ${JSON.stringify(response)}`);

      // Store response for polling to pick up
      const responseKey = `interactive:response:${messageId}`;
      await redisService.set(responseKey, response, 60); // 60 second TTL

      return true;
    } else {
      logger.warn(`📨 No pending response found for message ${messageId}`);
      return false;
    }
  }

  /**
   * Cancel pending response
   */
  async cancelPendingResponse(messageId, reason = 'Workflow cancelled') {
    if (!redisService.isAvailable()) {
      logger.warn('Redis not available - cannot cancel pending response');
      return false;
    }

    const pendingKey = `interactive:pending:${messageId}`;
    const pending = await redisService.get(pendingKey);

    if (pending) {
      await redisService.del(pendingKey);
      logger.info(`📨 Cancelled pending response for message ${messageId}: ${reason}`);
      return true;
    }

    return false;
  }

  /**
   * Cancel all pending responses for a workflow
   */
  async cancelWorkflowResponses(workflowId, reason = 'Workflow cancelled') {
    if (!redisService.isAvailable()) {
      logger.warn('Redis not available - cannot cancel workflow responses');
      return 0;
    }

    const messageIds = await redisService.keys(`interactive:pending:*`);
    let cancelledCount = 0;

    for (const key of messageIds) {
      const pending = await redisService.get(key);

      if (pending && pending.workflowId === workflowId) {
        await redisService.del(key);
        cancelledCount++;
      }
    }

    // Clean up workflow messages list
    const workflowMessagesKey = `interactive:workflow:${workflowId}:messages`;
    await redisService.del(workflowMessagesKey);

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
  async getPendingResponseCount() {
    if (!redisService.isAvailable()) {
      logger.warn('Redis not available - cannot get pending response count');
      return 0;
    }

    const keys = await redisService.keys('interactive:pending:*');
    return keys.length;
  }

  /**
   * Cleanup expired responses
   * Note: Redis handles TTL automatically, this is for manual cleanup if needed
   */
  async cleanup() {
    if (!redisService.isAvailable()) {
      logger.warn('Redis not available - cannot cleanup expired responses');
      return 0;
    }

    const keys = await redisService.keys('interactive:pending:*');
    let cleanedCount = 0;
    const now = Date.now();

    for (const key of keys) {
      const pending = await redisService.get(key);

      if (pending) {
        // Check if response is older than 10 minutes
        if (now - pending.timestamp > 600000) {
          await redisService.del(key);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info(`📨 Cleaned up ${cleanedCount} expired pending responses`);
    }

    return cleanedCount;
  }
}

export default InteractiveMessaging;