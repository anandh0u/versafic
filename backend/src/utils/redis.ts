// src/utils/redis.ts - Redis caching utility
import Redis from 'ioredis';
import { logger } from './logger';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  enableReadyCheck: true,
  maxRetriesPerRequest: null,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', err));

export const cache = {
  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}`, error as Error);
      return null;
    }
  },

  /**
   * Set cached value with TTL
   */
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<boolean> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}`, error as Error);
      return false;
    }
  },

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}`, error as Error);
      return false;
    }
  },

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      await redis.flushdb();
      return true;
    } catch (error) {
      logger.error('Cache clear error', error as Error);
      return false;
    }
  },

  /**
   * Increment counter
   */
  async increment(key: string, ttl: number = 3600): Promise<number> {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, ttl);
      }
      return count;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}`, error as Error);
      return 0;
    }
  },

  /**
   * Get or set (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    try {
      const cached = await cache.get<T>(key);
      if (cached) {
        logger.debug(`Cache hit: ${key}`);
        return cached;
      }

      logger.debug(`Cache miss: ${key}`);
      const data = await fetcher();
      await cache.set(key, data, ttl);
      return data;
    } catch (error) {
      logger.error(`Cache getOrSet error for key ${key}`, error as Error);
      // Fallback to direct fetch
      return fetcher();
    }
  }
};

export default redis;
