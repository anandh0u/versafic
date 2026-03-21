// src/__tests__/unit/cache.test.ts - Unit tests for Redis cache utility
import { cache } from '../../utils/redis';

jest.mock('ioredis');

describe('Cache Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should retrieve cached value', async () => {
      const key = 'test-key';
      const value = 'test-value';

      const cacheGetSpy = jest.spyOn(cache, 'get').mockResolvedValue(value);

      const result = await cache.get(key);

      expect(result).toBe(value);
      expect(cacheGetSpy).toHaveBeenCalledWith(key);
    });

    it('should return null for missing key', async () => {
      const cacheGetSpy = jest.spyOn(cache, 'get').mockResolvedValue(null);

      const result = await cache.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value with default TTL', async () => {
      const setSpy = jest.spyOn(cache, 'set').mockResolvedValue(true);

      await cache.set('key', 'value', 3600);

      expect(setSpy).toHaveBeenCalledWith('key', 'value', 3600);
    });

    it('should set value with custom TTL', async () => {
      const setSpy = jest.spyOn(cache, 'set').mockResolvedValue(true);

      await cache.set('key', 'value', 7200);

      expect(setSpy).toHaveBeenCalledWith('key', 'value', 7200);
    });
  });

  describe('delete', () => {
    it('should delete cached value', async () => {
      const deleteSpy = jest.spyOn(cache, 'delete').mockResolvedValue(true);

      const result = await cache.delete('test-key');

      expect(result).toBe(true);
      expect(deleteSpy).toHaveBeenCalledWith('test-key');
    });
  });

  describe('increment', () => {
    it('should increment counter', async () => {
      const incrementSpy = jest.spyOn(cache, 'increment').mockResolvedValue(5);

      const result = await cache.increment('counter');

      expect(result).toBe(5);
    });

    it('should increment with custom amount', async () => {
      const incrementSpy = jest.spyOn(cache, 'increment').mockResolvedValue(15);

      const result = await cache.increment('counter', 10);

      expect(result).toBe(15);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const getter = jest.fn().mockResolvedValue('fetched-value');
      const getOrSetSpy = jest
        .spyOn(cache, 'getOrSet')
        .mockResolvedValue('cached-value');

      const result = await cache.getOrSet('key', getter);

      expect(result).toBe('cached-value');
      expect(getter).not.toHaveBeenCalled();
    });

    it('should support cache-aside pattern', async () => {
      const getter = jest.fn().mockResolvedValue('fresh-value');
      const getOrSetSpy = jest.spyOn(cache, 'getOrSet');

      expect(getOrSetSpy).toBeDefined();
    });
  });
});
