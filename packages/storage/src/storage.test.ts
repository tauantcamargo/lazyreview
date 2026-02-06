import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { LazyReviewStorage } from './storage';
import { schema } from './schema';

describe('LazyReviewStorage', () => {
  let storage: LazyReviewStorage;
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory database for testing
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(schema);
    storage = new LazyReviewStorage(db);
  });

  afterEach(() => {
    storage.close();
  });

  describe('cache operations', () => {
    it('should set and get cache entries', () => {
      const testData = { foo: 'bar', count: 42 };
      storage.setCache('test-key', testData);

      const result = storage.getCache<typeof testData>('test-key');
      expect(result).not.toBeNull();
      expect(result?.value).toEqual(testData);
      expect(result?.key).toBe('test-key');
    });

    it('should return null for non-existent keys', () => {
      const result = storage.getCache('non-existent');
      expect(result).toBeNull();
    });

    it('should update existing cache entries', () => {
      storage.setCache('key', { version: 1 });
      storage.setCache('key', { version: 2 });

      const result = storage.getCache<{ version: number }>('key');
      expect(result?.value.version).toBe(2);
    });

    it('should handle TTL expiration', async () => {
      storage.setCache('expiring', 'value', 0.1); // 100ms TTL

      const immediate = storage.getCache('expiring');
      expect(immediate?.value).toBe('value');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const expired = storage.getCache('expiring');
      expect(expired).toBeNull();
    });

    it('should delete cache entries', () => {
      storage.setCache('to-delete', 'value');
      expect(storage.getCache('to-delete')).not.toBeNull();

      storage.deleteCache('to-delete');
      expect(storage.getCache('to-delete')).toBeNull();
    });

    it('should clear all cache entries', () => {
      storage.setCache('key1', 'value1');
      storage.setCache('key2', 'value2');
      storage.setCache('key3', 'value3');

      storage.clearCache();

      expect(storage.getCache('key1')).toBeNull();
      expect(storage.getCache('key2')).toBeNull();
      expect(storage.getCache('key3')).toBeNull();
    });

    it('should handle complex data types', () => {
      const complexData = {
        array: [1, 2, 3],
        nested: { deep: { value: true } },
        date: new Date().toISOString(),
        nullValue: null,
      };

      storage.setCache('complex', complexData);
      const result = storage.getCache<typeof complexData>('complex');
      expect(result?.value).toEqual(complexData);
    });
  });

  describe('queue operations', () => {
    const sampleAction = {
      type: 'approve',
      providerType: 'github',
      host: 'github.com',
      owner: 'owner',
      repo: 'repo',
      prNumber: 123,
    };

    it('should enqueue an action', () => {
      const action = storage.enqueueAction(sampleAction);

      expect(action.id).toBeDefined();
      expect(action.type).toBe('approve');
      expect(action.providerType).toBe('github');
      expect(action.host).toBe('github.com');
      expect(action.owner).toBe('owner');
      expect(action.repo).toBe('repo');
      expect(action.prNumber).toBe(123);
      expect(action.attempts).toBe(0);
      expect(action.lastError).toBeNull();
      expect(action.createdAt).toBeGreaterThan(0);
    });

    it('should list queued actions', () => {
      storage.enqueueAction({ ...sampleAction, prNumber: 1 });
      storage.enqueueAction({ ...sampleAction, prNumber: 2 });
      storage.enqueueAction({ ...sampleAction, prNumber: 3 });

      const actions = storage.listQueuedActions();
      expect(actions).toHaveLength(3);
      expect(actions[0]?.prNumber).toBe(1);
      expect(actions[1]?.prNumber).toBe(2);
      expect(actions[2]?.prNumber).toBe(3);
    });

    it('should respect list limit', () => {
      for (let i = 0; i < 10; i++) {
        storage.enqueueAction({ ...sampleAction, prNumber: i });
      }

      const limited = storage.listQueuedActions(5);
      expect(limited).toHaveLength(5);
    });

    it('should record action failure', () => {
      const action = storage.enqueueAction(sampleAction);
      const retryAt = Date.now() + 60000;

      storage.recordActionFailure(action.id, 'Network error', retryAt);

      const actions = storage.listQueuedActions();
      const updated = actions.find((a) => a.id === action.id);
      expect(updated?.attempts).toBe(1);
      expect(updated?.lastError).toBe('Network error');
      expect(updated?.nextAttemptAt).toBe(retryAt);
    });

    it('should increment attempts on multiple failures', () => {
      const action = storage.enqueueAction(sampleAction);

      storage.recordActionFailure(action.id, 'Error 1');
      storage.recordActionFailure(action.id, 'Error 2');
      storage.recordActionFailure(action.id, 'Error 3');

      const actions = storage.listQueuedActions();
      const updated = actions.find((a) => a.id === action.id);
      expect(updated?.attempts).toBe(3);
      expect(updated?.lastError).toBe('Error 3');
    });

    it('should delete an action', () => {
      const action = storage.enqueueAction(sampleAction);
      expect(storage.listQueuedActions()).toHaveLength(1);

      storage.deleteAction(action.id);
      expect(storage.listQueuedActions()).toHaveLength(0);
    });

    it('should handle action with payload', () => {
      const payload = JSON.stringify({ comment: 'LGTM!' });
      const action = storage.enqueueAction({
        ...sampleAction,
        payload,
      });

      const actions = storage.listQueuedActions();
      expect(actions[0]?.payload).toBe(payload);
    });

    it('should use provided ID if given', () => {
      const customId = 'custom-action-id';
      const action = storage.enqueueAction({
        ...sampleAction,
        id: customId,
      });

      expect(action.id).toBe(customId);
    });
  });
});
