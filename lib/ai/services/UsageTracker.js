/**
 * Usage tracking for cost control with Redis
 * Tracks user usage statistics across distributed serverless instances
 *
 * REQUIRES Redis to function properly in production (Vercel)
 *
 * Redis Key Structure:
 * - usage:user:{userId} - User usage stats (hash)
 * - usage:user:{userId}:provider:{provider} - Provider-specific stats (hash)
 * - usage:global - Global usage stats (hash)
 * - usage:activity:{userId} - Last activity timestamp (string with 24h TTL)
 */

import logger from '../../utils/logger.js';
import { redisService } from '../../utils/redis.js';

export class UsageTracker {
  constructor() {
    // Verify Redis is available
    if (!redisService.isAvailable()) {
      logger.warn('⚠️  UsageTracker: Redis not configured - usage tracking and limits will NOT work properly in production!');
    }

    this.cleanupInterval = null;
  }

  async cleanup() {
    if (!redisService.isAvailable()) {
      logger.warn('Redis not available - cannot cleanup expired usage data');
      return;
    }

    // Redis handles TTL automatically, but we can clean up old activity keys manually
    try {
      const pattern = 'usage:activity:*';
      const keys = await redisService.keys(pattern);

      let cleanedCount = 0;
      for (const key of keys) {
        const ttl = await redisService.ttl(key);
        // If TTL expired (shouldn't happen, but Redis might not have cleaned yet)
        if (ttl === -2) {
          await redisService.del(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`🧹 Cleaned up ${cleanedCount} expired activity keys from Redis`);
      }
    } catch (error) {
      logger.error('Redis cleanup error:', error);
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Track usage in Redis
   */
  async trackUsage(userId, provider, tokens, estimatedCost, inputTokens = null, outputTokens = null) {
    if (!redisService.isAvailable()) {
      logger.warn(`UsageTracker: Redis not available - cannot track usage for user ${userId}`);
      return;
    }
    try {
      const now = new Date().toISOString();

      // Update activity timestamp with 24h TTL
      await redisService.set(`usage:activity:${userId}`, Date.now(), 86400); // 24 hours

      // Get or create user stats
      const userStatsKey = `usage:user:${userId}`;
      let userStats = await redisService.get(userStatsKey);

      if (!userStats) {
        userStats = {
          requests: 0,
          tokens: 0,
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          firstSeen: now,
          lastActive: now
        };
      }

      // Update user stats
      userStats.requests++;
      userStats.tokens += tokens;
      userStats.cost += estimatedCost;
      userStats.lastActive = now;

      if (inputTokens !== null && outputTokens !== null) {
        userStats.inputTokens = (userStats.inputTokens || 0) + inputTokens;
        userStats.outputTokens = (userStats.outputTokens || 0) + outputTokens;
      }

      // Save user stats with 24h TTL
      await redisService.set(userStatsKey, userStats, 86400);

      // Update provider-specific stats
      const providerKey = `usage:user:${userId}:provider:${provider}`;
      let providerStats = await redisService.get(providerKey);

      if (!providerStats) {
        providerStats = {
          requests: 0,
          tokens: 0,
          cost: 0,
          inputTokens: 0,
          outputTokens: 0
        };
      }

      providerStats.requests++;
      providerStats.tokens += tokens;
      providerStats.cost += estimatedCost;

      if (inputTokens !== null && outputTokens !== null) {
        providerStats.inputTokens = (providerStats.inputTokens || 0) + inputTokens;
        providerStats.outputTokens = (providerStats.outputTokens || 0) + outputTokens;
      }

      // Save provider stats with 24h TTL
      await redisService.set(providerKey, providerStats, 86400);

      // Update global stats
      const globalKey = 'usage:global';
      let globalStats = await redisService.get(globalKey);

      if (!globalStats) {
        globalStats = {
          requests: 0,
          tokens: 0,
          cost: 0
        };
      }

      globalStats.requests++;
      globalStats.tokens += tokens;
      globalStats.cost += estimatedCost;

      // Save global stats (no TTL - persistent)
      await redisService.set(globalKey, globalStats);

      logger.debug(`✅ Usage tracked in Redis for user ${userId}: ${tokens} tokens, $${estimatedCost.toFixed(4)}`);
    } catch (error) {
      logger.error('Failed to track usage in Redis:', error);
      throw error;
    }
  }

  /**
   * Check user limits
   */
  async checkUserLimits(userId, limits = {}) {
    if (!redisService.isAvailable()) {
      logger.warn('Redis not available - cannot check user limits, allowing request');
      return { allowed: true };
    }

    try {
      const userStatsKey = `usage:user:${userId}`;
      const userStats = await redisService.get(userStatsKey);

      if (!userStats) return { allowed: true };

      const dailyRequestLimit = limits.dailyRequests || 1000;
      const dailyCostLimit = limits.dailyCost || 10; // $10

      if (userStats.requests >= dailyRequestLimit) {
        return {
          allowed: false,
          reason: 'Daily request limit exceeded',
          current: userStats.requests,
          limit: dailyRequestLimit
        };
      }

      if (userStats.cost >= dailyCostLimit) {
        return {
          allowed: false,
          reason: 'Daily cost limit exceeded',
          current: userStats.cost.toFixed(2),
          limit: dailyCostLimit
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error checking limits in Redis:', error);
      // On error, allow the request
      return { allowed: true };
    }
  }

  /**
   * Get user stats
   */
  async getUserStats(userId) {
    if (!redisService.isAvailable()) {
      logger.warn('Redis not available - cannot get user stats');
      return null;
    }

    try {
      const userStatsKey = `usage:user:${userId}`;
      const userStats = await redisService.get(userStatsKey);

      if (!userStats) return null;

      // Get provider stats
      const providerKeys = await redisService.keys(`usage:user:${userId}:provider:*`);
      const providers = {};

      for (const key of providerKeys) {
        const provider = key.split(':').pop();
        const providerStats = await redisService.get(key);
        if (providerStats) {
          providers[provider] = providerStats;
        }
      }

      return {
        ...userStats,
        providers
      };
    } catch (error) {
      logger.error('Error getting user stats from Redis:', error);
      return null;
    }
  }

  /**
   * Get global stats
   */
  async getGlobalStats() {
    if (!redisService.isAvailable()) {
      logger.warn('Redis not available - cannot get global stats');
      return { requests: 0, tokens: 0, cost: 0 };
    }

    try {
      const globalKey = 'usage:global';
      const globalStats = await redisService.get(globalKey);
      return globalStats || { requests: 0, tokens: 0, cost: 0 };
    } catch (error) {
      logger.error('Error getting global stats from Redis:', error);
      return { requests: 0, tokens: 0, cost: 0 };
    }
  }
}

export default UsageTracker;
