import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { ensureDir, getConfigDir } from '@lazyreview/platform';
import { schema } from './schema';

export type StorageOptions = {
  dbPath?: string;
};

export type CacheEntry<T> = {
  key: string;
  value: T;
  updatedAt: number;
  ttlSeconds?: number | null;
};

export type QueuedAction = {
  id: string;
  type: string;
  providerType: string;
  host: string;
  owner: string;
  repo: string;
  prNumber: number;
  payload: string | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type EnqueueActionInput = Omit<QueuedAction, 'id' | 'attempts' | 'lastError' | 'nextAttemptAt' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  payload?: string | null;
};

export class LazyReviewStorage {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  static open(options: StorageOptions = {}): LazyReviewStorage {
    const dbPath = options.dbPath ?? join(getConfigDir(), 'lazyreview.db');
    ensureDir(dirname(dbPath));

    const db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    db.exec(schema);

    return new LazyReviewStorage(db);
  }

  close(): void {
    this.db.close();
  }

  getCache<T>(key: string): CacheEntry<T> | null {
    const row = this.db
      .prepare('SELECT key, value, updated_at, ttl_seconds FROM cache WHERE key = ?')
      .get(key) as { key: string; value: string; updated_at: number; ttl_seconds: number | null } | undefined;

    if (!row) {
      return null;
    }

    if (row.ttl_seconds && Date.now() - row.updated_at > row.ttl_seconds * 1000) {
      this.deleteCache(key);
      return null;
    }

    return {
      key: row.key,
      value: JSON.parse(row.value) as T,
      updatedAt: row.updated_at,
      ttlSeconds: row.ttl_seconds,
    };
  }

  setCache<T>(key: string, value: T, ttlSeconds?: number): void {
    const now = Date.now();
    const stmt = this.db.prepare(
      'INSERT INTO cache (key, value, updated_at, ttl_seconds) VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, ttl_seconds = excluded.ttl_seconds'
    );
    stmt.run(key, JSON.stringify(value), now, ttlSeconds ?? null);
  }

  deleteCache(key: string): void {
    this.db.prepare('DELETE FROM cache WHERE key = ?').run(key);
  }

  clearCache(): void {
    this.db.prepare('DELETE FROM cache').run();
  }

  enqueueAction(input: EnqueueActionInput): QueuedAction {
    const now = Date.now();
    const id = input.id ?? randomUUID();
    const action: QueuedAction = {
      id,
      type: input.type,
      providerType: input.providerType,
      host: input.host,
      owner: input.owner,
      repo: input.repo,
      prNumber: input.prNumber,
      payload: input.payload ?? null,
      attempts: 0,
      lastError: null,
      nextAttemptAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        'INSERT INTO queued_actions (id, type, provider_type, host, owner, repo, pr_number, payload, attempts, last_error, next_attempt_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        action.id,
        action.type,
        action.providerType,
        action.host,
        action.owner,
        action.repo,
        action.prNumber,
        action.payload,
        action.attempts,
        action.lastError,
        action.nextAttemptAt,
        action.createdAt,
        action.updatedAt
      );

    return action;
  }

  listQueuedActions(limit = 50): QueuedAction[] {
    const rows = this.db
      .prepare(
        'SELECT id, type, provider_type, host, owner, repo, pr_number, payload, attempts, last_error, next_attempt_at, created_at, updated_at FROM queued_actions ORDER BY created_at ASC LIMIT ?'
      )
      .all(limit) as Array<{
      id: string;
      type: string;
      provider_type: string;
      host: string;
      owner: string;
      repo: string;
      pr_number: number;
      payload: string | null;
      attempts: number;
      last_error: string | null;
      next_attempt_at: number | null;
      created_at: number;
      updated_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      providerType: row.provider_type,
      host: row.host,
      owner: row.owner,
      repo: row.repo,
      prNumber: row.pr_number,
      payload: row.payload,
      attempts: row.attempts,
      lastError: row.last_error,
      nextAttemptAt: row.next_attempt_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  recordActionFailure(id: string, error: string, retryAt?: number): void {
    const now = Date.now();
    this.db
      .prepare(
        'UPDATE queued_actions SET attempts = attempts + 1, last_error = ?, next_attempt_at = ?, updated_at = ? WHERE id = ?'
      )
      .run(error, retryAt ?? null, now, id);
  }

  deleteAction(id: string): void {
    this.db.prepare('DELETE FROM queued_actions WHERE id = ?').run(id);
  }
}
