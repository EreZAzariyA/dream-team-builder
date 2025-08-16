/**
 * Usage tracking for cost control with TTL cleanup
 * Tracks user usage statistics and provides cost control
 */

import logger from '../../utils/logger.js';

export class UsageTracker {
  constructor() {
    this.userUsage = new Map();
    this.globalUsage = {
      requests: 0,
      tokens: 0,
      cost: 0
    };
    
    // TTL tracking for cleanup
    this.userActivityTimestamps = new Map();
    this.cleanupInterval = null;
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    // Start cleanup interval
    this.startCleanup();
  }

  startCleanup() {
    if (this.cleanupInterval) return;
    
    // Clean up every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  cleanup() {
    const now = Date.now();
    const cutoff = now - this.maxAge;
    
    let cleanedUsers = 0;
    
    for (const [userId, timestamp] of this.userActivityTimestamps.entries()) {
      if (timestamp < cutoff) {
        this.userUsage.delete(userId);
        this.userActivityTimestamps.delete(userId);
        cleanedUsers++;
      }
    }
    
    if (cleanedUsers > 0) {
      logger.info(`🧹 Cleaned up usage data for ${cleanedUsers} inactive users`);
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  trackUsage(userId, provider, tokens, estimatedCost, inputTokens = null, outputTokens = null) {
    // Update activity timestamp
    this.userActivityTimestamps.set(userId, Date.now());
    
    if (!this.userUsage.has(userId)) {
      this.userUsage.set(userId, {
        requests: 0,
        tokens: 0,
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
        providers: {},
        firstSeen: new Date(),
        lastActive: new Date()
      });
    }

    const userStats = this.userUsage.get(userId);
    userStats.requests++;
    userStats.tokens += tokens;
    userStats.cost += estimatedCost;
    userStats.lastActive = new Date();
    
    // Track input/output tokens if available
    if (inputTokens !== null && outputTokens !== null) {
      userStats.inputTokens += inputTokens;
      userStats.outputTokens += outputTokens;
    }
    
    if (!userStats.providers[provider]) {
      userStats.providers[provider] = { 
        requests: 0, 
        tokens: 0, 
        cost: 0,
        inputTokens: 0,
        outputTokens: 0
      };
    }
    userStats.providers[provider].requests++;
    userStats.providers[provider].tokens += tokens;
    userStats.providers[provider].cost += estimatedCost;
    
    // Track input/output tokens per provider if available
    if (inputTokens !== null && outputTokens !== null) {
      userStats.providers[provider].inputTokens += inputTokens;
      userStats.providers[provider].outputTokens += outputTokens;
    }

    // Update global usage
    this.globalUsage.requests++;
    this.globalUsage.tokens += tokens;
    this.globalUsage.cost += estimatedCost;
  }

  checkUserLimits(userId, limits = {}) {
    const userStats = this.userUsage.get(userId);
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
  }

  getUserStats(userId) {
    return this.userUsage.get(userId) || null;
  }

  getGlobalStats() {
    return this.globalUsage;
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export default UsageTracker;