/**
 * Queue-based request throttling system
 * Handles request queuing and rate limiting per user
 * Uses Redis (Upstash) for distributed queue management
 */

import logger from '../../utils/logger.js';
import { redisService } from '../../utils/redis.js';

export class RequestQueue {
  constructor(minInterval = 2000) {
    this.minInterval = minInterval;
  }

  /**
   * Enqueue a request for a user
   * In serverless environments, we use Redis to track queue state
   * and process requests with distributed locking
   */
  async enqueue(userId, requestFn) {
    const queueKey = `ai:queue:${userId}`;
    const lockKey = `ai:queue:${userId}:lock`;
    const lastProcessedKey = `ai:queue:${userId}:lastProcessed`;

    try {
      // Check if we need to wait (rate limiting)
      const lastProcessed = await redisService.get(lastProcessedKey);
      if (lastProcessed) {
        const timeSinceLastRequest = Date.now() - lastProcessed;
        if (timeSinceLastRequest < this.minInterval) {
          const waitTime = this.minInterval - timeSinceLastRequest;
          logger.debug(`Rate limiting: waiting ${waitTime}ms for user ${userId}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // Try to acquire lock (with TTL to prevent deadlocks)
      const lockAcquired = await this.acquireLock(lockKey, 30); // 30 second TTL

      if (!lockAcquired) {
        // Another process is handling this user's queue
        // Add to queue and wait for processing
        await redisService.lpush(queueKey, {
          timestamp: Date.now(),
          status: 'pending'
        });

        // Poll for completion (simplified approach for serverless)
        // In production, consider using pub/sub or webhooks
        logger.debug(`Request queued for user ${userId}, waiting for processing...`);
        await new Promise(resolve => setTimeout(resolve, this.minInterval));
      }

      // Process the request
      try {
        logger.debug(`Processing request for user ${userId}`);
        const result = await requestFn();

        // Update last processed timestamp
        await redisService.set(lastProcessedKey, Date.now(), 60); // 60 second TTL

        return result;
      } finally {
        // Release lock
        await this.releaseLock(lockKey);
      }
    } catch (error) {
      logger.error(`Queue processing error for user ${userId}:`, error);
      await this.releaseLock(lockKey);
      throw error;
    }
  }

  /**
   * Acquire a distributed lock using Redis
   */
  async acquireLock(lockKey, ttlSeconds = 30) {
    try {
      const lockValue = Date.now().toString();
      const existing = await redisService.get(lockKey);

      if (existing) {
        return false; // Lock already held
      }

      await redisService.set(lockKey, lockValue, ttlSeconds);
      return true;
    } catch (error) {
      logger.error(`Failed to acquire lock ${lockKey}:`, error);
      return false;
    }
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(lockKey) {
    try {
      await redisService.del(lockKey);
    } catch (error) {
      logger.error(`Failed to release lock ${lockKey}:`, error);
    }
  }

  /**
   * Get queue length for a user
   */
  async getQueueLength(userId) {
    try {
      const queueKey = `ai:queue:${userId}`;
      return await redisService.llen(queueKey);
    } catch (error) {
      logger.error(`Failed to get queue length for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Clear queue for a user
   */
  async clearQueue(userId) {
    try {
      const queueKey = `ai:queue:${userId}`;
      const lockKey = `ai:queue:${userId}:lock`;
      const lastProcessedKey = `ai:queue:${userId}:lastProcessed`;

      await redisService.del(queueKey);
      await redisService.del(lockKey);
      await redisService.del(lastProcessedKey);

      logger.info(`Cleared queue for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to clear queue for user ${userId}:`, error);
    }
  }

  /**
   * Cleanup old queue entries
   * In Redis, TTL handles most cleanup automatically
   */
  async cleanup() {
    try {
      // Find all queue keys
      const queueKeys = await redisService.keys('ai:queue:*');

      for (const key of queueKeys) {
        // Check if key has no TTL and is empty
        const ttl = await redisService.ttl(key);
        if (ttl === -1) {
          // No TTL set, check if empty
          if (key.endsWith(':lock')) {
            // Locks should always have TTL, if not, remove them
            await redisService.del(key);
          } else if (!key.endsWith(':lastProcessed')) {
            const length = await redisService.llen(key);
            if (length === 0) {
              await redisService.del(key);
            }
          }
        }
      }

      logger.debug('Queue cleanup completed');
    } catch (error) {
      logger.error('Queue cleanup error:', error);
    }
  }
}

export default RequestQueue;