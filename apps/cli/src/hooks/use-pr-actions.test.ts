import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePRActions } from './use-pr-actions';
import type { PullRequest } from '@lazyreview/core';

// Mock the core module
vi.mock('@lazyreview/core', () => ({
  createProvider: vi.fn(),
}));

import { createProvider } from '@lazyreview/core';

const mockProvider = {
  approveReview: vi.fn(),
  requestChanges: vi.fn(),
  createComment: vi.fn(),
};

const defaultOptions = {
  providerType: 'github' as const,
  token: 'test-token',
  baseUrl: 'https://api.github.com',
  owner: 'test-owner',
  repo: 'test-repo',
};

const mockPR: PullRequest = {
  id: '1',
  number: 42,
  title: 'Test PR',
  repo: 'test-owner/test-repo',
  author: 'testuser',
  sourceBranch: 'feature',
  targetBranch: 'main',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  state: 'open',
};

describe('usePRActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider.approveReview.mockResolvedValue(undefined);
    mockProvider.requestChanges.mockResolvedValue(undefined);
    mockProvider.createComment.mockResolvedValue(undefined);
    (createProvider as ReturnType<typeof vi.fn>).mockReturnValue(mockProvider);
  });

  it('initializes with idle status', () => {
    const { result } = renderHook(() => usePRActions(defaultOptions));

    expect(result.current.actionStatus).toBe('idle');
    expect(result.current.actionError).toBeNull();
  });

  describe('approve', () => {
    it('approves a PR successfully', async () => {
      const { result } = renderHook(() => usePRActions(defaultOptions));

      await act(async () => {
        await result.current.approve(mockPR);
      });

      expect(mockProvider.approveReview).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        42,
        undefined
      );
      expect(result.current.actionStatus).toBe('success');
      expect(result.current.actionError).toBeNull();
    });

    it('approves with optional body', async () => {
      const { result } = renderHook(() => usePRActions(defaultOptions));

      await act(async () => {
        await result.current.approve(mockPR, 'LGTM!');
      });

      expect(mockProvider.approveReview).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        42,
        'LGTM!'
      );
    });

    it('handles approval failure', async () => {
      mockProvider.approveReview.mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() => usePRActions(defaultOptions));

      await act(async () => {
        try {
          await result.current.approve(mockPR);
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.actionStatus).toBe('error');
      expect(result.current.actionError).toBe('API error');
    });
  });

  describe('requestChanges', () => {
    it('requests changes successfully', async () => {
      const { result } = renderHook(() => usePRActions(defaultOptions));

      await act(async () => {
        await result.current.requestChanges(mockPR, 'Please fix this');
      });

      expect(mockProvider.requestChanges).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        42,
        'Please fix this'
      );
      expect(result.current.actionStatus).toBe('success');
    });

    it('requires body for request changes', async () => {
      const { result } = renderHook(() => usePRActions(defaultOptions));

      await act(async () => {
        await result.current.requestChanges(mockPR, '   ');
      });

      expect(mockProvider.requestChanges).not.toHaveBeenCalled();
      expect(result.current.actionStatus).toBe('error');
      expect(result.current.actionError).toBe(
        'Comment body is required when requesting changes'
      );
    });

    it('handles request changes failure', async () => {
      mockProvider.requestChanges.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePRActions(defaultOptions));

      await act(async () => {
        try {
          await result.current.requestChanges(mockPR, 'Fix this');
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.actionStatus).toBe('error');
      expect(result.current.actionError).toBe('Network error');
    });
  });

  describe('comment', () => {
    it('posts a comment successfully', async () => {
      const { result } = renderHook(() => usePRActions(defaultOptions));

      await act(async () => {
        await result.current.comment(mockPR, 'Great work!');
      });

      expect(mockProvider.createComment).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        42,
        { body: 'Great work!' }
      );
      expect(result.current.actionStatus).toBe('success');
    });

    it('requires body for comment', async () => {
      const { result } = renderHook(() => usePRActions(defaultOptions));

      await act(async () => {
        await result.current.comment(mockPR, '');
      });

      expect(mockProvider.createComment).not.toHaveBeenCalled();
      expect(result.current.actionStatus).toBe('error');
      expect(result.current.actionError).toBe('Comment body is required');
    });

    it('handles comment failure', async () => {
      mockProvider.createComment.mockRejectedValue(new Error('Rate limited'));

      const { result } = renderHook(() => usePRActions(defaultOptions));

      await act(async () => {
        try {
          await result.current.comment(mockPR, 'Comment');
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.actionStatus).toBe('error');
      expect(result.current.actionError).toBe('Rate limited');
    });
  });

  describe('reset', () => {
    it('resets status and error', async () => {
      mockProvider.approveReview.mockRejectedValue(new Error('Error'));

      const { result } = renderHook(() => usePRActions(defaultOptions));

      await act(async () => {
        try {
          await result.current.approve(mockPR);
        } catch {
          // Expected
        }
      });
      expect(result.current.actionStatus).toBe('error');

      act(() => {
        result.current.reset();
      });

      expect(result.current.actionStatus).toBe('idle');
      expect(result.current.actionError).toBeNull();
    });
  });

  it('creates provider with correct options', async () => {
    const { result } = renderHook(() => usePRActions(defaultOptions));

    await act(async () => {
      await result.current.approve(mockPR);
    });

    expect(createProvider).toHaveBeenCalledWith({
      type: 'github',
      token: 'test-token',
      baseUrl: 'https://api.github.com',
    });
  });
});
