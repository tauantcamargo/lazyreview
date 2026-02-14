import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  createOptimisticComment,
  createOptimisticIssueComment,
  createOptimisticReview,
  applyOptimisticComment,
  applyOptimisticIssueComment,
  applyOptimisticReview,
  applyThreadResolution,
  OPTIMISTIC_USER,
} from './optimistic-updates'
import type { ReviewThread } from '../services/CodeReviewApiTypes'

// ---------------------------------------------------------------------------
// Test: full optimistic update + rollback flow using QueryClient directly
// ---------------------------------------------------------------------------

describe('optimistic update flow with QueryClient', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  // -----------------------------------------------------------------------
  // Comment optimistic update
  // -----------------------------------------------------------------------

  describe('comment optimistic update', () => {
    const commentKey = ['pr-comments', 'octocat', 'hello', 42]

    const existingComments = [
      {
        id: 1,
        body: 'existing comment',
        user: { login: 'alice', id: 1, avatar_url: '', html_url: '' },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        html_url: 'https://github.com/comment/1',
      },
    ]

    it('inserts optimistic comment into cache', () => {
      queryClient.setQueryData(commentKey, existingComments)

      const optimistic = createOptimisticComment({
        body: 'new comment',
        path: 'src/foo.ts',
        line: 10,
        side: 'RIGHT',
      })
      const updated = applyOptimisticComment(
        queryClient.getQueryData(commentKey) as readonly unknown[],
        optimistic,
      )
      queryClient.setQueryData(commentKey, updated)

      const cached = queryClient.getQueryData(commentKey) as readonly unknown[]
      expect(cached).toHaveLength(2)
      expect((cached[1] as { body: string }).body).toBe('new comment')
    })

    it('rolls back on error by restoring snapshot', () => {
      queryClient.setQueryData(commentKey, existingComments)

      // Snapshot before optimistic update
      const snapshot = queryClient.getQueryData(commentKey)

      // Apply optimistic update
      const optimistic = createOptimisticComment({ body: 'will fail' })
      queryClient.setQueryData(
        commentKey,
        applyOptimisticComment(
          queryClient.getQueryData(commentKey) as readonly unknown[],
          optimistic,
        ),
      )

      // Verify optimistic data is present
      const afterOptimistic = queryClient.getQueryData(commentKey) as readonly unknown[]
      expect(afterOptimistic).toHaveLength(2)

      // Simulate rollback
      queryClient.setQueryData(commentKey, snapshot)

      // Verify rollback
      const afterRollback = queryClient.getQueryData(commentKey) as readonly unknown[]
      expect(afterRollback).toHaveLength(1)
      expect(afterRollback).toEqual(existingComments)
    })

    it('handles optimistic insert when cache is empty', () => {
      // No initial data set
      const optimistic = createOptimisticComment({ body: 'first' })
      const updated = applyOptimisticComment(
        queryClient.getQueryData(commentKey) as readonly unknown[] | undefined,
        optimistic,
      )
      queryClient.setQueryData(commentKey, updated)

      const cached = queryClient.getQueryData(commentKey) as readonly unknown[]
      expect(cached).toHaveLength(1)
      expect((cached[0] as { body: string }).body).toBe('first')
    })
  })

  // -----------------------------------------------------------------------
  // Issue comment optimistic update
  // -----------------------------------------------------------------------

  describe('issue comment optimistic update', () => {
    const issueCommentKey = ['issue-comments', 'octocat', 'hello', 42]

    const existingComments = [
      {
        id: 10,
        body: 'existing issue comment',
        user: { login: 'bob', id: 2, avatar_url: '', html_url: '' },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        html_url: 'https://github.com/comment/10',
      },
    ]

    it('inserts optimistic issue comment', () => {
      queryClient.setQueryData(issueCommentKey, existingComments)

      const optimistic = createOptimisticIssueComment({ body: 'new issue comment' })
      queryClient.setQueryData(
        issueCommentKey,
        applyOptimisticIssueComment(existingComments, optimistic),
      )

      const cached = queryClient.getQueryData(issueCommentKey) as readonly unknown[]
      expect(cached).toHaveLength(2)
      expect((cached[1] as { body: string }).body).toBe('new issue comment')
      expect((cached[1] as { user: typeof OPTIMISTIC_USER }).user).toEqual(OPTIMISTIC_USER)
    })

    it('rolls back issue comment on error', () => {
      queryClient.setQueryData(issueCommentKey, existingComments)
      const snapshot = queryClient.getQueryData(issueCommentKey)

      const optimistic = createOptimisticIssueComment({ body: 'will fail' })
      queryClient.setQueryData(
        issueCommentKey,
        applyOptimisticIssueComment(existingComments, optimistic),
      )

      expect((queryClient.getQueryData(issueCommentKey) as readonly unknown[]).length).toBe(2)

      // Rollback
      queryClient.setQueryData(issueCommentKey, snapshot)
      expect((queryClient.getQueryData(issueCommentKey) as readonly unknown[]).length).toBe(1)
    })
  })

  // -----------------------------------------------------------------------
  // Review optimistic update
  // -----------------------------------------------------------------------

  describe('review optimistic update', () => {
    const reviewKey = ['pr-reviews', 'octocat', 'hello', 42]

    const existingReviews = [
      {
        id: 100,
        body: 'old review',
        state: 'COMMENTED' as const,
        user: { login: 'carol', id: 3, avatar_url: '', html_url: '' },
        html_url: 'https://github.com/review/100',
        submitted_at: '2024-01-01T00:00:00Z',
      },
    ]

    it('inserts optimistic APPROVE review', () => {
      queryClient.setQueryData(reviewKey, existingReviews)

      const optimistic = createOptimisticReview({ body: 'LGTM', event: 'APPROVE' })
      queryClient.setQueryData(
        reviewKey,
        applyOptimisticReview(existingReviews, optimistic),
      )

      const cached = queryClient.getQueryData(reviewKey) as readonly unknown[]
      expect(cached).toHaveLength(2)
      const newReview = cached[1] as { body: string; state: string }
      expect(newReview.body).toBe('LGTM')
      expect(newReview.state).toBe('APPROVED')
    })

    it('inserts optimistic REQUEST_CHANGES review', () => {
      queryClient.setQueryData(reviewKey, existingReviews)

      const optimistic = createOptimisticReview({ body: 'needs fixes', event: 'REQUEST_CHANGES' })
      queryClient.setQueryData(
        reviewKey,
        applyOptimisticReview(existingReviews, optimistic),
      )

      const cached = queryClient.getQueryData(reviewKey) as readonly unknown[]
      expect(cached).toHaveLength(2)
      expect((cached[1] as { state: string }).state).toBe('CHANGES_REQUESTED')
    })

    it('rolls back review on error', () => {
      queryClient.setQueryData(reviewKey, existingReviews)
      const snapshot = queryClient.getQueryData(reviewKey)

      const optimistic = createOptimisticReview({ body: 'will fail', event: 'APPROVE' })
      queryClient.setQueryData(
        reviewKey,
        applyOptimisticReview(existingReviews, optimistic),
      )

      expect((queryClient.getQueryData(reviewKey) as readonly unknown[]).length).toBe(2)

      queryClient.setQueryData(reviewKey, snapshot)
      expect((queryClient.getQueryData(reviewKey) as readonly unknown[]).length).toBe(1)
      expect(queryClient.getQueryData(reviewKey)).toEqual(existingReviews)
    })

    it('handles empty review cache', () => {
      const optimistic = createOptimisticReview({ body: 'first', event: 'COMMENT' })
      const result = applyOptimisticReview(undefined, optimistic)
      queryClient.setQueryData(reviewKey, result)

      const cached = queryClient.getQueryData(reviewKey) as readonly unknown[]
      expect(cached).toHaveLength(1)
      expect((cached[0] as { state: string }).state).toBe('COMMENTED')
    })
  })

  // -----------------------------------------------------------------------
  // Thread resolution optimistic update
  // -----------------------------------------------------------------------

  describe('thread resolution optimistic update', () => {
    const threadKey = ['pr-review-threads', 'octocat', 'hello', 42]

    const existingThreads: readonly ReviewThread[] = [
      { id: 'thread-1', isResolved: false, comments: [{ databaseId: 1 }] },
      { id: 'thread-2', isResolved: false, comments: [{ databaseId: 2 }] },
      { id: 'thread-3', isResolved: true, comments: [{ databaseId: 3 }] },
    ]

    it('optimistically resolves a thread', () => {
      queryClient.setQueryData(threadKey, existingThreads)

      const updated = applyThreadResolution(existingThreads, 'thread-1', true)
      queryClient.setQueryData(threadKey, updated)

      const cached = queryClient.getQueryData(threadKey) as readonly ReviewThread[]
      expect(cached[0]!.isResolved).toBe(true)
      expect(cached[1]!.isResolved).toBe(false) // unchanged
      expect(cached[2]!.isResolved).toBe(true) // unchanged
    })

    it('optimistically unresolves a thread', () => {
      queryClient.setQueryData(threadKey, existingThreads)

      const updated = applyThreadResolution(existingThreads, 'thread-3', false)
      queryClient.setQueryData(threadKey, updated)

      const cached = queryClient.getQueryData(threadKey) as readonly ReviewThread[]
      expect(cached[2]!.isResolved).toBe(false)
    })

    it('rolls back thread resolution on error', () => {
      queryClient.setQueryData(threadKey, existingThreads)
      const snapshot = queryClient.getQueryData(threadKey)

      const updated = applyThreadResolution(existingThreads, 'thread-1', true)
      queryClient.setQueryData(threadKey, updated)

      expect((queryClient.getQueryData(threadKey) as readonly ReviewThread[])[0]!.isResolved).toBe(true)

      queryClient.setQueryData(threadKey, snapshot)
      expect((queryClient.getQueryData(threadKey) as readonly ReviewThread[])[0]!.isResolved).toBe(false)
    })

    it('handles thread not found gracefully', () => {
      queryClient.setQueryData(threadKey, existingThreads)

      const updated = applyThreadResolution(existingThreads, 'nonexistent', true)
      queryClient.setQueryData(threadKey, updated)

      const cached = queryClient.getQueryData(threadKey) as readonly ReviewThread[]
      // All threads unchanged
      expect(cached[0]!.isResolved).toBe(false)
      expect(cached[1]!.isResolved).toBe(false)
      expect(cached[2]!.isResolved).toBe(true)
    })

    it('handles empty cache gracefully', () => {
      const updated = applyThreadResolution(undefined, 'thread-1', true)
      queryClient.setQueryData(threadKey, updated)

      const cached = queryClient.getQueryData(threadKey) as readonly ReviewThread[]
      expect(cached).toEqual([])
    })
  })

  // -----------------------------------------------------------------------
  // Snapshot / rollback pattern
  // -----------------------------------------------------------------------

  describe('snapshot and rollback pattern', () => {
    it('snapshots multiple query keys and rolls back all on error', () => {
      const commentsKey = ['pr-comments', 'o', 'r', 1]
      const threadsKey = ['pr-review-threads', 'o', 'r', 1]

      const existingComments = [
        { id: 1, body: 'comment', user: OPTIMISTIC_USER, created_at: '', updated_at: '', html_url: '' },
      ]
      const existingThreads: readonly ReviewThread[] = [
        { id: 't1', isResolved: false, comments: [{ databaseId: 1 }] },
      ]

      queryClient.setQueryData(commentsKey, existingComments)
      queryClient.setQueryData(threadsKey, existingThreads)

      // Take snapshots
      const commentSnapshot = queryClient.getQueryData(commentsKey)
      const threadSnapshot = queryClient.getQueryData(threadsKey)

      // Apply optimistic updates
      queryClient.setQueryData(
        commentsKey,
        applyOptimisticComment(existingComments, createOptimisticComment({ body: 'reply', inReplyToId: 1 })),
      )
      queryClient.setQueryData(
        threadsKey,
        applyThreadResolution(existingThreads, 't1', true),
      )

      // Verify optimistic state
      expect((queryClient.getQueryData(commentsKey) as readonly unknown[]).length).toBe(2)
      expect((queryClient.getQueryData(threadsKey) as readonly ReviewThread[])[0]!.isResolved).toBe(true)

      // Roll back all
      queryClient.setQueryData(commentsKey, commentSnapshot)
      queryClient.setQueryData(threadsKey, threadSnapshot)

      // Verify rollback
      expect((queryClient.getQueryData(commentsKey) as readonly unknown[]).length).toBe(1)
      expect((queryClient.getQueryData(threadsKey) as readonly ReviewThread[])[0]!.isResolved).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// Test: factory exports and hook creation
// ---------------------------------------------------------------------------

describe('createOptimisticMutation factory', () => {
  it('is exported from useGitHubMutations', async () => {
    const mod = await import('./useGitHubMutations')
    expect(typeof mod.createOptimisticMutation).toBe('function')
  })

  it('creates a hook function', async () => {
    const mod = await import('./useGitHubMutations')
    const hook = mod.createOptimisticMutation({
      effect: (api) => api.getMyPRs(),
      invalidateKeys: () => [['my-prs']],
      cacheUpdates: [],
    })
    expect(typeof hook).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Test: mutation hooks use optimistic pattern
// ---------------------------------------------------------------------------

describe('mutation hooks with optimistic updates', () => {
  it('useSubmitReview is exported and is a function', async () => {
    const mod = await import('./useGitHubMutations')
    expect(typeof mod.useSubmitReview).toBe('function')
  })

  it('useCreateComment is exported and is a function', async () => {
    const mod = await import('./useGitHubMutations')
    expect(typeof mod.useCreateComment).toBe('function')
  })

  it('useResolveReviewThread is exported and is a function', async () => {
    const mod = await import('./useGitHubMutations')
    expect(typeof mod.useResolveReviewThread).toBe('function')
  })

  it('useUnresolveReviewThread is exported and is a function', async () => {
    const mod = await import('./useGitHubMutations')
    expect(typeof mod.useUnresolveReviewThread).toBe('function')
  })

  it('useReplyToReviewComment is exported and is a function', async () => {
    const mod = await import('./useGitHubMutations')
    expect(typeof mod.useReplyToReviewComment).toBe('function')
  })

  it('useCreateReviewComment is exported and is a function', async () => {
    const mod = await import('./useGitHubMutations')
    expect(typeof mod.useCreateReviewComment).toBe('function')
  })
})
