import { describe, it, expect } from 'vitest'
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

// ---------------------------------------------------------------------------
// createOptimisticComment
// ---------------------------------------------------------------------------

describe('createOptimisticComment', () => {
  it('creates a Comment-shaped object with a negative temporary id', () => {
    const comment = createOptimisticComment({ body: 'hello', path: 'src/foo.ts', line: 10, side: 'RIGHT' as const })
    expect(comment.id).toBeLessThan(0)
    expect(comment.body).toBe('hello')
    expect(comment.path).toBe('src/foo.ts')
    expect(comment.line).toBe(10)
    expect(comment.side).toBe('RIGHT')
    expect(comment.user).toEqual(OPTIMISTIC_USER)
    expect(comment.html_url).toBe('')
    expect(comment.created_at).toBeTruthy()
    expect(comment.updated_at).toBeTruthy()
  })

  it('creates unique negative ids for each call', () => {
    const c1 = createOptimisticComment({ body: 'a' })
    const c2 = createOptimisticComment({ body: 'b' })
    expect(c1.id).not.toBe(c2.id)
    expect(c1.id).toBeLessThan(0)
    expect(c2.id).toBeLessThan(0)
  })

  it('uses current timestamp for created_at and updated_at', () => {
    const before = new Date().toISOString()
    const comment = createOptimisticComment({ body: 'test' })
    const after = new Date().toISOString()
    expect(comment.created_at >= before).toBe(true)
    expect(comment.updated_at <= after).toBe(true)
  })

  it('sets optional fields to undefined when not provided', () => {
    const comment = createOptimisticComment({ body: 'test' })
    expect(comment.path).toBeUndefined()
    expect(comment.line).toBeUndefined()
    expect(comment.side).toBeUndefined()
    expect(comment.in_reply_to_id).toBeUndefined()
  })

  it('sets in_reply_to_id when provided', () => {
    const comment = createOptimisticComment({ body: 'reply', inReplyToId: 42 })
    expect(comment.in_reply_to_id).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// createOptimisticIssueComment
// ---------------------------------------------------------------------------

describe('createOptimisticIssueComment', () => {
  it('creates an IssueComment-shaped object with negative id', () => {
    const comment = createOptimisticIssueComment({ body: 'general comment' })
    expect(comment.id).toBeLessThan(0)
    expect(comment.body).toBe('general comment')
    expect(comment.user).toEqual(OPTIMISTIC_USER)
    expect(comment.html_url).toBe('')
  })

  it('creates unique ids across calls', () => {
    const c1 = createOptimisticIssueComment({ body: 'a' })
    const c2 = createOptimisticIssueComment({ body: 'b' })
    expect(c1.id).not.toBe(c2.id)
  })
})

// ---------------------------------------------------------------------------
// createOptimisticReview
// ---------------------------------------------------------------------------

describe('createOptimisticReview', () => {
  it('creates a Review-shaped object', () => {
    const review = createOptimisticReview({ body: 'LGTM', event: 'APPROVE' })
    expect(review.id).toBeLessThan(0)
    expect(review.body).toBe('LGTM')
    expect(review.state).toBe('APPROVED')
    expect(review.user).toEqual(OPTIMISTIC_USER)
    expect(review.html_url).toBe('')
    expect(review.submitted_at).toBeTruthy()
  })

  it('maps REQUEST_CHANGES event to CHANGES_REQUESTED state', () => {
    const review = createOptimisticReview({ body: 'fix it', event: 'REQUEST_CHANGES' })
    expect(review.state).toBe('CHANGES_REQUESTED')
  })

  it('maps COMMENT event to COMMENTED state', () => {
    const review = createOptimisticReview({ body: 'note', event: 'COMMENT' })
    expect(review.state).toBe('COMMENTED')
  })

  it('creates unique ids', () => {
    const r1 = createOptimisticReview({ body: 'a', event: 'APPROVE' })
    const r2 = createOptimisticReview({ body: 'b', event: 'APPROVE' })
    expect(r1.id).not.toBe(r2.id)
  })
})

// ---------------------------------------------------------------------------
// applyOptimisticComment
// ---------------------------------------------------------------------------

describe('applyOptimisticComment', () => {
  const existing = [
    { id: 1, body: 'first', user: OPTIMISTIC_USER, created_at: '2024-01-01', updated_at: '2024-01-01', html_url: '' },
  ]

  it('appends the new comment to an existing array', () => {
    const newComment = createOptimisticComment({ body: 'added' })
    const result = applyOptimisticComment(existing, newComment)
    expect(result).toHaveLength(2)
    expect(result[1]!.body).toBe('added')
  })

  it('returns a new array (does not mutate)', () => {
    const newComment = createOptimisticComment({ body: 'added' })
    const result = applyOptimisticComment(existing, newComment)
    expect(result).not.toBe(existing)
    expect(existing).toHaveLength(1)
  })

  it('handles undefined old data by returning array with single item', () => {
    const newComment = createOptimisticComment({ body: 'first ever' })
    const result = applyOptimisticComment(undefined, newComment)
    expect(result).toHaveLength(1)
    expect(result[0]!.body).toBe('first ever')
  })
})

// ---------------------------------------------------------------------------
// applyOptimisticIssueComment
// ---------------------------------------------------------------------------

describe('applyOptimisticIssueComment', () => {
  const existing = [
    { id: 1, body: 'first', user: OPTIMISTIC_USER, created_at: '2024-01-01', updated_at: '2024-01-01', html_url: '' },
  ]

  it('appends the new issue comment', () => {
    const newComment = createOptimisticIssueComment({ body: 'new' })
    const result = applyOptimisticIssueComment(existing, newComment)
    expect(result).toHaveLength(2)
    expect(result[1]!.body).toBe('new')
  })

  it('handles undefined old data', () => {
    const newComment = createOptimisticIssueComment({ body: 'only' })
    const result = applyOptimisticIssueComment(undefined, newComment)
    expect(result).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// applyOptimisticReview
// ---------------------------------------------------------------------------

describe('applyOptimisticReview', () => {
  const existing = [
    { id: 1, body: 'old review', state: 'COMMENTED' as const, user: OPTIMISTIC_USER, html_url: '', submitted_at: '2024-01-01' },
  ]

  it('appends the new review', () => {
    const newReview = createOptimisticReview({ body: 'LGTM', event: 'APPROVE' })
    const result = applyOptimisticReview(existing, newReview)
    expect(result).toHaveLength(2)
    expect(result[1]!.state).toBe('APPROVED')
  })

  it('handles undefined old data', () => {
    const newReview = createOptimisticReview({ body: 'first', event: 'COMMENT' })
    const result = applyOptimisticReview(undefined, newReview)
    expect(result).toHaveLength(1)
  })

  it('does not mutate old data', () => {
    const newReview = createOptimisticReview({ body: 'LGTM', event: 'APPROVE' })
    const result = applyOptimisticReview(existing, newReview)
    expect(result).not.toBe(existing)
    expect(existing).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// applyThreadResolution
// ---------------------------------------------------------------------------

describe('applyThreadResolution', () => {
  const threads = [
    { id: 'thread-1', isResolved: false, comments: [{ databaseId: 1 }] },
    { id: 'thread-2', isResolved: false, comments: [{ databaseId: 2 }] },
    { id: 'thread-3', isResolved: true, comments: [{ databaseId: 3 }] },
  ]

  it('marks a specific thread as resolved', () => {
    const result = applyThreadResolution(threads, 'thread-1', true)
    expect(result[0]!.isResolved).toBe(true)
    expect(result[1]!.isResolved).toBe(false)
    expect(result[2]!.isResolved).toBe(true)
  })

  it('marks a specific thread as unresolved', () => {
    const result = applyThreadResolution(threads, 'thread-3', false)
    expect(result[0]!.isResolved).toBe(false)
    expect(result[1]!.isResolved).toBe(false)
    expect(result[2]!.isResolved).toBe(false)
  })

  it('does not mutate the original array', () => {
    const result = applyThreadResolution(threads, 'thread-1', true)
    expect(result).not.toBe(threads)
    expect(threads[0]!.isResolved).toBe(false)
  })

  it('leaves other threads unchanged', () => {
    const result = applyThreadResolution(threads, 'thread-2', true)
    expect(result[0]).toEqual(threads[0])
    expect(result[2]).toEqual(threads[2])
  })

  it('handles undefined old data by returning empty array', () => {
    const result = applyThreadResolution(undefined, 'thread-1', true)
    expect(result).toEqual([])
  })

  it('handles thread id not found by returning same data', () => {
    const result = applyThreadResolution(threads, 'nonexistent', true)
    expect(result).toEqual(threads)
  })
})
