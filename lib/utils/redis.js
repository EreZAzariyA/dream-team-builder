/**
 * Redis Service using ioredis
 * Connects to any standard Redis instance using a REDIS_URL
 */

import IORedis from 'ioredis';
import logger from './logger.js';

let redisClient = null;

/**
 * Initializes and returns a singleton ioredis client.
 * Uses a single REDIS_URL environment variable for configuration.
 */
function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const client = new IORedis(redisUrl, {
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
      });

      client.on('connect', () => logger.info('✅ Connected to Redis successfully via ioredis.'));
      client.on('error', (err) => logger.error('ioredis Client Error:', err));

      redisClient = client;
      return redisClient;
    } catch (error) {
      logger.error('Failed to initialize ioredis client:', error);
      return null;
    }
  } else {
    logger.warn('REDIS_URL not configured. Using in-memory fallback for Redis service.');
    return null;
  }
}

/**
 * Redis helper class with fallback to in-memory storage.
 * This class provides a consistent interface whether using ioredis or the in-memory store.
 */
export class RedisService {
  constructor() {
    this.redis = getRedisClient();
    this.memoryStore = new Map();
  }

  isAvailable() {
    return this.redis !== null;
  }

  async set(key, value, ttl = null) {
    try {
      if (this.redis) {
        const stringValue = JSON.stringify(value);
        if (ttl) {
          return await this.redis.set(key, stringValue, 'EX', ttl);
        }
        return await this.redis.set(key, stringValue);
      } else {
        const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
        this.memoryStore.set(key, { value, expiresAt });
        return 'OK';
      }
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      throw error;
    }
  }

  async get(key) {
    try {
      if (this.redis) {
        const result = await this.redis.get(key);
        return result ? JSON.parse(result) : null;
      } else {
        const entry = this.memoryStore.get(key);
        if (!entry) return null;
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

  async del(key) {
    try {
      if (this.redis) {
        return await this.redis.del(key);
      } else {
        this.memoryStore.delete(key);
        return 1;
      }
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      return 0;
    }
  }

  async incr(key) {
    try {
      if (this.redis) {
        return await this.redis.incr(key);
      } else {
        const entry = this.memoryStore.get(key) || { value: 0 };
        const numValue = typeof entry.value === 'number' ? entry.value : parseInt(entry.value) || 0;
        entry.value = numValue + 1;
        this.memoryStore.set(key, entry);
        return entry.value;
      }
    } catch (error) {
      logger.error(`Redis INCR error for key ${key}:`, error);
      throw error;
    }
  }

  async incrby(key, amount) {
    try {
      if (this.redis) {
        return await this.redis.incrby(key, amount);
      } else {
        const entry = this.memoryStore.get(key) || { value: 0 };
        const numValue = typeof entry.value === 'number' ? entry.value : parseInt(entry.value) || 0;
        entry.value = numValue + amount;
        this.memoryStore.set(key, entry);
        return entry.value;
      }
    } catch (error) {
      logger.error(`Redis INCRBY error for key ${key}:`, error);
      throw error;
    }
  }

  async expire(key, seconds) {
    try {
      if (this.redis) {
        return await this.redis.expire(key, seconds);
      } else {
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

  async ttl(key) {
    try {
      if (this.redis) {
        return await this.redis.ttl(key);
      } else {
        const entry = this.memoryStore.get(key);
        if (!entry || !entry.expiresAt) return -1;
        const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2;
      }
    } catch (error) {
      logger.error(`Redis TTL error for key ${key}:`, error);
      return -1;
    }
  }

  async exists(key) {
    try {
      if (this.redis) {
        return await this.redis.exists(key);
      } else {
        const entry = this.memoryStore.get(key);
        if (!entry) return 0;
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

  async lpush(key, value) {
    try {
      if (this.redis) {
        const stringValue = JSON.stringify(value);
        return await this.redis.lpush(key, stringValue);
      } else {
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

  async rpop(key) {
    try {
      if (this.redis) {
        const result = await this.redis.rpop(key);
        return result ? JSON.parse(result) : null;
      } else {
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

  async llen(key) {
    try {
      if (this.redis) {
        return await this.redis.llen(key);
      } else {
        const entry = this.memoryStore.get(key);
        if (!entry || !Array.isArray(entry.value)) return 0;
        return entry.value.length;
      }
    } catch (error) {
      logger.error(`Redis LLEN error for key ${key}:`, error);
      return 0;
    }
  }

  async keys(pattern) {
    try {
      if (this.redis) {
        return await this.redis.keys(pattern);
      } else {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(this.memoryStore.keys()).filter(key => regex.test(key));
      }
    } catch (error) {
      logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const redisService = new RedisService();

export default redisService;