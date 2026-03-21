/**
 * Caching Utilities
 * In-memory and advanced caching strategies
 */

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of items
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Simple in-memory cache implementation
 */
export class Cache<K, V> {
  private map = new Map<K, CacheEntry<V>>();
  private ttl: number;
  private maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl || 60000; // 1 minute default
    this.maxSize = options.maxSize || 100;
  }

  /**
   * Set value in cache
   */
  set(key: K, value: V, ttl?: number): void {
    // Remove oldest entry if max size reached
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      const firstKey = this.map.keys().next().value as K;
      if (firstKey !== undefined) {
        this.map.delete(firstKey);
      }
    }

    const expiresAt = Date.now() + (ttl || this.ttl);
    this.map.set(key, { value, expiresAt });
  }

  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    const entry = this.map.get(key);

    if (!entry) return undefined;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete key from cache
   */
  delete(key: K): boolean {
    return this.map.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.map.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.map.size;
  }

  /**
   * Get all entries
   */
  entries(): Array<[K, V]> {
    const entries: Array<[K, V]> = [];

    for (const [key, entry] of this.map.entries()) {
      if (Date.now() <= entry.expiresAt) {
        entries.push([key, entry.value]);
      } else {
        this.map.delete(key);
      }
    }

    return entries;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    let removed = 0;

    for (const [key, entry] of this.map.entries()) {
      if (Date.now() > entry.expiresAt) {
        this.map.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * LRU (Least Recently Used) Cache
 */
export class LRUCache<K, V> {
  private map = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Set value and move to end (most recently used)
   */
  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // Remove first (least recently used)
      const firstKey = this.map.keys().next().value as K;
      if (firstKey !== undefined) {
        this.map.delete(firstKey);
      }
    }

    this.map.set(key, value);
  }

  /**
   * Get value and move to end
   */
  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;

    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);

    return value;
  }

  /**
   * Check if key exists
   */
  has(key: K): boolean {
    return this.map.has(key);
  }

  /**
   * Delete key
   */
  delete(key: K): boolean {
    return this.map.delete(key);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.map.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.map.size;
  }
}

/**
 * Memoization decorator for functions
 */
export const memoize = <Args extends unknown[], Return>(
  fn: (...args: Args) => Return,
  options: CacheOptions = {}
) => {
  const cache = new Cache<string, Return>(options);

  return (...args: Args): Return => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result);

    return result;
  };
};

/**
 * Async memoization for promises
 */
export const memoizeAsync = <Args extends unknown[], Return>(
  fn: (...args: Args) => Promise<Return>,
  options: CacheOptions = {}
) => {
  const cache = new Cache<string, Return>(options);

  return async (...args: Args): Promise<Return> => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = await fn(...args);
    cache.set(key, result);

    return result;
  };
};

/**
 * Debounce function execution
 */
export const debounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number
) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Args) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
};

/**
 * Throttle function execution
 */
export const throttle = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  intervalMs: number
) => {
  let lastCall = 0;

  return (...args: Args) => {
    const now = Date.now();

    if (now - lastCall >= intervalMs) {
      fn(...args);
      lastCall = now;
    }
  };
};

/**
 * Create cached getter
 */
export const createCachedGetter = <T>(
  fn: () => T,
  ttl: number = 60000
): (() => T) => {
  let cachedValue: T | undefined;
  let lastFetch = 0;

  return () => {
    if (cachedValue === undefined || Date.now() - lastFetch > ttl) {
      cachedValue = fn();
      lastFetch = Date.now();
    }

    return cachedValue;
  };
};

/**
 * Cache key builder for multiple parameters
 */
export const buildCacheKey = (...parts: (string | number | boolean)[]): string => {
  return parts.map(p => String(p).toLowerCase().replace(/\s+/g, '-')).join(':');
};

/**
 * Time-based cache invalidation
 */
export class TimedCache<K, V> {
  private cache = new Map<K, { value: V; createdAt: number }>();
  private ttl: number;

  constructor(ttlMs: number = 60000) {
    this.ttl = ttlMs;
  }

  set(key: K, value: V): void {
    this.cache.set(key, { value, createdAt: Date.now() });
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.createdAt > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  isExpired(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;

    const isExpired = Date.now() - entry.createdAt > this.ttl;

    if (isExpired) {
      this.cache.delete(key);
    }

    return isExpired;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Group-based cache for invalidating related items
 */
export class GroupedCache<K, V> {
  private cache = new Cache<K, V>();
  private groups = new Map<string, Set<K>>();

  set(key: K, value: V, group?: string): void {
    this.cache.set(key, value);

    if (group) {
      if (!this.groups.has(group)) {
        this.groups.set(group, new Set());
      }
      this.groups.get(group)!.add(key);
    }
  }

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  invalidateGroup(group: string): void {
    const keys = this.groups.get(group);

    if (keys) {
      for (const key of keys) {
        this.cache.delete(key);
      }
      this.groups.delete(group);
    }
  }

  clear(): void {
    this.cache.clear();
    this.groups.clear();
  }
}
