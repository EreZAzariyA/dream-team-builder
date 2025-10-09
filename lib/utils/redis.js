/**
 * Redis Service using Upstash Redis
 * Serverless-friendly Redis client for Vercel deployment
 */

import { Redis } from '@upstash/redis';
import logger from './logger.js';

let redisClient = null;

/**
 * Initialize Redis client with Upstash
 */
export function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  // Check if Redis is configured
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    logger.warn('Upstash Redis not configured - using fallback in-memory mode');
    return null;
  }

  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    logger.info('✅ Upstash Redis client initialized');
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Upstash Redis:', error);
    return null;
  }
}

/**
 * Redis helper class with fallback to in-memory storage
 */
export class RedisService {
  constructor() {
    this.redis = getRedisClient();
    // Fallback in-memory storage if Redis is not available
    this.memoryStore = new Map();
  }

  /**
   * Check if Redis is available
   */
  isAvailable() {
    return this.redis !== null;
  }

  /**
   * Set a key-value pair with optional TTL (in seconds)
   */
  async set(key, value, ttl = null) {
    try {
      if (this.redis) {
        // Upstash REST API handles JSON automatically, no need to stringify
        if (ttl) {
          return await this.redis.setex(key, ttl, value);
        }
        return await this.redis.set(key, value);
      } else {
        // Fallback to in-memory
        const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
        this.memoryStore.set(key, { value, expiresAt });
        return 'OK';
      }
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a value by key
   */
  async get(key) {
    try {
      if (this.redis) {
        // Upstash REST API automatically parses JSON, no need to JSON.parse
        const result = await this.redis.get(key);
        return result !== null ? result : null;
      } else {
        // Fallback to in-memory
        const entry = this.memoryStore.get(key);
        if (!entry) return null;

        // Check expiration
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          this.memoryStore.delete(key);
          return null;
        }

        return entry.value;
      }
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a key
   */
  async del(key) {
    try {
      if (this.redis) {
        return await this.redis.del(key);
      } else {
        // Fallback to in-memory
        this.memoryStore.delete(key);
        return 1;
      }
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Increment a counter
   */
  async incr(key) {
    try {
      if (this.redis) {
        return await this.redis.incr(key);
      } else {
        // Fallback to in-memory
        const entry = this.memoryStore.get(key) || { value: 0 };
        entry.value = (parseInt(entry.value) || 0) + 1;
        this.memoryStore.set(key, entry);
        return entry.value;
      }
    } catch (error) {
      logger.error(`Redis INCR error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Increment by a specific amount
   */
  async incrby(key, amount) {
    try {
      if (this.redis) {
        return await this.redis.incrby(key, amount);
      } else {
        // Fallback to in-memory
        const entry = this.memoryStore.get(key) || { value: 0 };
        entry.value = (parseInt(entry.value) || 0) + amount;
        this.memoryStore.set(key, entry);
        return entry.value;
      }
    } catch (error) {
      logger.error(`Redis INCRBY error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set expiration time on a key (in seconds)
   */
  async expire(key, seconds) {
    try {
      if (this.redis) {
        return await this.redis.expire(key, seconds);
      } else {
        // Fallback to in-memory
        const entry = this.memoryStore.get(key);
        if (entry) {
          entry.expiresAt = Date.now() + seconds * 1000;
          this.memoryStore.set(key, entry);
          return 1;
        }
        return 0;
      }
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get remaining TTL for a key (in seconds)
   */
  async ttl(key) {
    try {
      if (this.redis) {
        return await this.redis.ttl(key);
      } else {
        // Fallback to in-memory
        const entry = this.memoryStore.get(key);
        if (!entry || !entry.expiresAt) return -1;

        const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2; // -2 means expired
      }
    } catch (error) {
      logger.error(`Redis TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key) {
    try {
      if (this.redis) {
        return await this.redis.exists(key);
      } else {
        // Fallback to in-memory
        const entry = this.memoryStore.get(key);
        if (!entry) return 0;

        // Check expiration
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          this.memoryStore.delete(key);
          return 0;
        }

        return 1;
      }
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Push value to a list (left push)
   */
  async lpush(key, value) {
    try {
      if (this.redis) {
        // Upstash REST API handles JSON automatically
        return await this.redis.lpush(key, value);
      } else {
        // Fallback to in-memory
        const entry = this.memoryStore.get(key) || { value: [] };
        if (!Array.isArray(entry.value)) entry.value = [];
        entry.value.unshift(value);
        this.memoryStore.set(key, entry);
        return entry.value.length;
      }
    } catch (error) {
      logger.error(`Redis LPUSH error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Pop value from a list (right pop)
   */
  async rpop(key) {
    try {
      if (this.redis) {
        // Upstash REST API automatically parses JSON
        const result = await this.redis.rpop(key);
        return result !== null ? result : null;
      } else {
        // Fallback to in-memory
        const entry = this.memoryStore.get(key);
        if (!entry || !Array.isArray(entry.value) || entry.value.length === 0) {
          return null;
        }
        const value = entry.value.pop();
        this.memoryStore.set(key, entry);
        return value;
      }
    } catch (error) {
      logger.error(`Redis RPOP error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get list length
   */
  async llen(key) {
    try {
      if (this.redis) {
        return await this.redis.llen(key);
      } else {
        // Fallback to in-memory
        const entry = this.memoryStore.get(key);
        if (!entry || !Array.isArray(entry.value)) return 0;
        return entry.value.length;
      }
    } catch (error) {
      logger.error(`Redis LLEN error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern) {
    try {
      if (this.redis) {
        return await this.redis.keys(pattern);
      } else {
        // Fallback to in-memory
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(this.memoryStore.keys()).filter(key => regex.test(key));
      }
    } catch (error) {
      logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Clean up expired entries in memory store
   */
  cleanupExpired() {
    if (!this.redis) {
      const now = Date.now();
      for (const [key, entry] of this.memoryStore.entries()) {
        if (entry.expiresAt && now > entry.expiresAt) {
          this.memoryStore.delete(key);
        }
      }
    }
  }
}

// Export singleton instance
export const redisService = new RedisService();

export default redisService;
