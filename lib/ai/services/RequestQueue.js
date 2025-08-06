/**
 * Queue-based request throttling system
 * Handles request queuing and rate limiting per user
 */

import logger from '../../utils/logger.js';

export class RequestQueue {
  constructor(minInterval = 2000) {
    this.queues = new Map(); // userId -> queue
    this.minInterval = minInterval;
    this.processing = new Set(); // Track which users are being processed
  }

  async enqueue(userId, requestFn) {
    if (!this.queues.has(userId)) {
      this.queues.set(userId, []);
    }

    return new Promise((resolve, reject) => {
      this.queues.get(userId).push({ requestFn, resolve, reject });
      this.processQueue(userId);
    });
  }

  async processQueue(userId) {
    if (this.processing.has(userId)) {
      return; // Already processing this user's queue
    }

    const queue = this.queues.get(userId);
    if (!queue || queue.length === 0) {
      return;
    }

    this.processing.add(userId);

    try {
      while (queue.length > 0) {
        const { requestFn, resolve, reject } = queue.shift();
        
        try {
          logger.debug(`Processing queued request for user ${userId}`);
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }

        // Wait before processing next request
        if (queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.minInterval));
        }
      }
    } finally {
      this.processing.delete(userId);
    }
  }

  getQueueLength(userId) {
    return this.queues.get(userId)?.length || 0;
  }

  clearQueue(userId) {
    this.queues.delete(userId);
    this.processing.delete(userId);
  }

  cleanup() {
    // Clean up empty queues
    for (const [userId, queue] of this.queues.entries()) {
      if (queue.length === 0 && !this.processing.has(userId)) {
        this.queues.delete(userId);
      }
    }
  }
}

export default RequestQueue;