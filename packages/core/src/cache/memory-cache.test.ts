import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryCache } from './memory-cache';

describe('MemoryCache', () => {
  let cache: MemoryCache<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new MemoryCache<string>({
      defaultTtl: 1000, // 1 second
      maxEntries: 3,
      gcInterval: 500,
    });
  });

  afterEach(() => {
    cache.destroy();
    vi.useRealTimers();
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should delete keys', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.delete('key1')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.keys()).toEqual(['key1', 'key2']);
    });

    it('should return correct size', () => {
      expect(cache.size).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      vi.advanceTimersByTime(1001);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should use custom TTL when provided', () => {
      cache.set('key1', 'value1', 500);
      expect(cache.get('key1')).toBe('value1');

      vi.advanceTimersByTime(501);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false for has() on expired entries', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(1001);
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('max entries eviction', () => {
    it('should evict oldest entry when at max capacity', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(10);
      cache.set('key3', 'value3');
      vi.advanceTimersByTime(10);

      // Adding a 4th entry should evict key1 (oldest)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
      expect(cache.size).toBe(3);
    });

    it('should not evict when updating existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Updating existing key should not trigger eviction
      cache.set('key1', 'updated1');

      expect(cache.get('key1')).toBe('updated1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.size).toBe(3);
    });
  });

  describe('garbage collection', () => {
    it('should remove expired entries on gc()', () => {
      cache.set('key1', 'value1', 500);
      cache.set('key2', 'value2', 1500);

      vi.advanceTimersByTime(600);
      const removed = cache.gc();

      expect(removed).toBe(1);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should run gc automatically at interval', () => {
      cache.set('key1', 'value1', 200);

      vi.advanceTimersByTime(600);

      // GC should have run and removed expired entry
      expect(cache.size).toBe(0);
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('key2'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should track evictions', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(10);
      cache.set('key3', 'value3');
      vi.advanceTimersByTime(10);
      cache.set('key4', 'value4');

      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
    });

    it('should track expirations', () => {
      cache.set('key1', 'value1', 100);
      vi.advanceTimersByTime(200);
      cache.get('key1'); // Triggers expiration check

      const stats = cache.getStats();
      expect(stats.expirations).toBe(1);
    });

    it('should reset statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key2');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.entries).toBe(1);
    });
  });

  describe('serialization', () => {
    it('should export entries for serialization', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const entries = cache.entries();

      expect(entries).toHaveLength(2);
      expect(entries[0]?.[0]).toBe('key1');
      expect(entries[0]?.[1]?.value).toBe('value1');
      expect(entries[1]?.[0]).toBe('key2');
      expect(entries[1]?.[1]?.value).toBe('value2');
    });

    it('should not export expired entries', () => {
      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 1000);

      vi.advanceTimersByTime(200);
      const entries = cache.entries();

      expect(entries).toHaveLength(1);
      expect(entries[0]?.[0]).toBe('key2');
    });

    it('should restore entries from serialization', () => {
      const entries: Array<[string, { value: string; createdAt: number; expiresAt: number; hits: number }]> = [
        ['key1', { value: 'value1', createdAt: Date.now(), expiresAt: Date.now() + 10000, hits: 5 }],
        ['key2', { value: 'value2', createdAt: Date.now(), expiresAt: Date.now() + 10000, hits: 3 }],
      ];

      cache.restore(entries);

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });

    it('should not restore expired entries', () => {
      const entries: Array<[string, { value: string; createdAt: number; expiresAt: number; hits: number }]> = [
        ['key1', { value: 'value1', createdAt: Date.now() - 2000, expiresAt: Date.now() - 1000, hits: 0 }],
        ['key2', { value: 'value2', createdAt: Date.now(), expiresAt: Date.now() + 10000, hits: 0 }],
      ];

      cache.restore(entries);

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('updateOnAccess option', () => {
    it('should extend TTL on access when enabled', () => {
      const slidingCache = new MemoryCache<string>({
        defaultTtl: 1000,
        updateOnAccess: true,
      });

      slidingCache.set('key1', 'value1');
      vi.advanceTimersByTime(800);
      slidingCache.get('key1'); // Should extend TTL
      vi.advanceTimersByTime(800);

      expect(slidingCache.get('key1')).toBe('value1');

      slidingCache.destroy();
    });
  });
});
