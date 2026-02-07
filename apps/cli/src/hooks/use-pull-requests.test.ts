import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pullRequestKeys } from './use-pull-requests';

// Note: Full hook testing requires React Query test utilities
// These tests validate the query key factory which is critical for cache management

describe('pullRequestKeys', () => {
  describe('all', () => {
    it('should return base key', () => {
      expect(pullRequestKeys.all).toEqual(['pull-requests']);
    });
  });

  describe('lists', () => {
    it('should return lists key', () => {
      expect(pullRequestKeys.lists()).toEqual(['pull-requests', 'list']);
    });
  });

  describe('list', () => {
    it('should return list key with owner and repo', () => {
      expect(pullRequestKeys.list('owner', 'repo', 'github')).toEqual([
        'pull-requests',
        'list',
        'owner',
        'repo',
        'github',
        undefined,
      ]);
    });

    it('should include filters when provided', () => {
      expect(pullRequestKeys.list('owner', 'repo', 'github', { state: 'open' })).toEqual([
        'pull-requests',
        'list',
        'owner',
        'repo',
        'github',
        { state: 'open' },
      ]);
    });
  });

  describe('details', () => {
    it('should return details key', () => {
      expect(pullRequestKeys.details()).toEqual(['pull-requests', 'detail']);
    });
  });

  describe('detail', () => {
    it('should return detail key with all params', () => {
      expect(pullRequestKeys.detail('owner', 'repo', 'github', 42)).toEqual([
        'pull-requests',
        'detail',
        'owner',
        'repo',
        'github',
        42,
      ]);
    });
  });

  describe('diffs', () => {
    it('should return diffs key', () => {
      expect(pullRequestKeys.diffs()).toEqual(['pull-requests', 'diff']);
    });
  });

  describe('diff', () => {
    it('should return diff key with all params', () => {
      expect(pullRequestKeys.diff('owner', 'repo', 'gitlab', 123)).toEqual([
        'pull-requests',
        'diff',
        'owner',
        'repo',
        'gitlab',
        123,
      ]);
    });
  });

  describe('key uniqueness', () => {
    it('should generate unique keys for different repos', () => {
      const key1 = pullRequestKeys.list('owner1', 'repo1', 'github');
      const key2 = pullRequestKeys.list('owner2', 'repo2', 'github');
      expect(key1).not.toEqual(key2);
    });

    it('should generate unique keys for different providers', () => {
      const key1 = pullRequestKeys.list('owner', 'repo', 'github');
      const key2 = pullRequestKeys.list('owner', 'repo', 'gitlab');
      expect(key1).not.toEqual(key2);
    });

    it('should generate unique keys for different filters', () => {
      const key1 = pullRequestKeys.list('owner', 'repo', 'github', { state: 'open' });
      const key2 = pullRequestKeys.list('owner', 'repo', 'github', { state: 'closed' });
      expect(key1).not.toEqual(key2);
    });
  });
});
