/**
 * Memory Cache with TTL Support
 *
 * A generic in-memory cache with time-to-live (TTL) expiration,
 * designed to integrate with TanStack Query for offline-first caching.
 */

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

export interface CacheOptions {
  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTtl?: number;
  /** Maximum number of entries (default: 1000) */
  maxEntries?: number;
  /** Garbage collection interval in milliseconds (default: 60 seconds) */
  gcInterval?: number;
  /** Whether to update TTL on access (default: false) */
  updateOnAccess?: boolean;
}

export interface CacheStats {
  entries: number;
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_GC_INTERVAL = 60 * 1000; // 60 seconds

export class MemoryCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly defaultTtl: number;
  private readonly maxEntries: number;
  private readonly gcInterval: number;
  private readonly updateOnAccess: boolean;
  private gcTimer: ReturnType<typeof setInterval> | null = null;
  private stats: CacheStats;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.defaultTtl = options.defaultTtl ?? DEFAULT_TTL;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.gcInterval = options.gcInterval ?? DEFAULT_GC_INTERVAL;
    this.updateOnAccess = options.updateOnAccess ?? false;
    this.stats = {
      entries: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };

    // Start garbage collection
    this.startGC();
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.entries--;
      this.stats.expirations++;
      this.stats.misses++;
      return undefined;
    }

    // Update hit count and optionally extend TTL
    entry.hits++;
    if (this.updateOnAccess) {
      entry.expiresAt = Date.now() + this.defaultTtl;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl ?? this.defaultTtl);

    // Evict if at max capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    const isNew = !this.cache.has(key);
    this.cache.set(key, {
      value,
      createdAt: now,
      expiresAt,
      hits: 0,
    });

    if (isNew) {
      this.stats.entries++;
    }
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.entries--;
      this.stats.expirations++;
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.stats.entries--;
    }
    return existed;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.entries = 0;
  }

  /**
   * Get all keys in the cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get the number of entries in the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      entries: this.cache.size,
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };
  }

  /**
   * Get all entries (for serialization)
   */
  entries(): Array<[string, CacheEntry<T>]> {
    const now = Date.now();
    const result: Array<[string, CacheEntry<T>]> = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now <= entry.expiresAt) {
        result.push([key, entry]);
      }
    }

    return result;
  }

  /**
   * Restore entries (for deserialization)
   */
  restore(entries: Array<[string, CacheEntry<T>]>): void {
    const now = Date.now();

    for (const [key, entry] of entries) {
      // Only restore if not expired
      if (now <= entry.expiresAt) {
        this.cache.set(key, entry);
        this.stats.entries++;
      }
    }
  }

  /**
   * Manually run garbage collection
   */
  gc(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
        this.stats.expirations++;
      }
    }

    this.stats.entries = this.cache.size;
    return removed;
  }

  /**
   * Stop the cache (cleanup)
   */
  destroy(): void {
    this.stopGC();
    this.cache.clear();
    this.stats.entries = 0;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.entries--;
      this.stats.evictions++;
    }
  }

  private startGC(): void {
    this.gcTimer = setInterval(() => {
      this.gc();
    }, this.gcInterval);

    // Don't block Node.js exit
    if (this.gcTimer.unref) {
      this.gcTimer.unref();
    }
  }

  private stopGC(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }
}
