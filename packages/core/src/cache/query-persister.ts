/**
 * TanStack Query Persister Integration
 *
 * Creates a persister that uses MemoryCache for offline-first caching
 * with TanStack Query.
 */

import { MemoryCache, type CacheEntry } from './memory-cache';

export interface PersisterStorage {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}

export interface PersistedQuery {
  queryKey: unknown[];
  queryHash: string;
  state: unknown;
  meta?: Record<string, unknown>;
}

export interface QueryPersister {
  persistClient: (client: unknown) => Promise<void>;
  restoreClient: () => Promise<unknown | undefined>;
  removeClient: () => Promise<void>;
}

export interface TanStackQueryPersisterOptions {
  /** Cache instance to use */
  cache?: MemoryCache<PersistedQuery>;
  /** Storage key for the client state */
  key?: string;
  /** Optional external storage (for SQLite integration) */
  storage?: PersisterStorage;
  /** TTL for persisted queries in milliseconds (default: 24 hours) */
  ttl?: number;
  /** Whether to serialize to external storage (default: false) */
  serialize?: boolean;
}

const DEFAULT_KEY = 'lazyreview-query-cache';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Creates a TanStack Query persister that uses MemoryCache
 *
 * This can be used with @tanstack/query-persist-client-core for
 * persisting query cache across sessions.
 */
export function createTanStackQueryPersister(
  options: TanStackQueryPersisterOptions = {}
): QueryPersister {
  const {
    cache = new MemoryCache<PersistedQuery>({ defaultTtl: options.ttl ?? DEFAULT_TTL }),
    key = DEFAULT_KEY,
    storage,
    serialize = false,
  } = options;

  return {
    async persistClient(client: unknown): Promise<void> {
      const typedClient = client as { queries?: unknown[] };
      const queries = typedClient?.queries;

      if (!queries || !Array.isArray(queries)) {
        return;
      }

      // Store each query in the cache
      for (const query of queries as PersistedQuery[]) {
        const cacheKey = `${key}:${query.queryHash}`;
        cache.set(cacheKey, query);
      }

      // Optionally serialize to external storage
      if (serialize && storage) {
        const entries = cache.entries();
        await storage.setItem(key, JSON.stringify(entries));
      }
    },

    async restoreClient(): Promise<unknown | undefined> {
      // Optionally restore from external storage first
      if (serialize && storage) {
        const stored = await storage.getItem(key);
        if (stored) {
          try {
            const entries = JSON.parse(stored) as Array<[string, CacheEntry<PersistedQuery>]>;
            cache.restore(entries);
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Get all cached queries
      const queries: PersistedQuery[] = [];
      for (const cacheKey of cache.keys()) {
        if (cacheKey.startsWith(`${key}:`)) {
          const query = cache.get(cacheKey);
          if (query) {
            queries.push(query);
          }
        }
      }

      if (queries.length === 0) {
        return undefined;
      }

      return { queries };
    },

    async removeClient(): Promise<void> {
      // Remove all cached queries
      for (const cacheKey of cache.keys()) {
        if (cacheKey.startsWith(`${key}:`)) {
          cache.delete(cacheKey);
        }
      }

      // Optionally remove from external storage
      if (serialize && storage) {
        await storage.removeItem(key);
      }
    },
  };
}

/**
 * Creates a simple in-memory storage adapter for testing
 */
export function createMemoryStorage(): PersisterStorage {
  const store = new Map<string, string>();

  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
  };
}
