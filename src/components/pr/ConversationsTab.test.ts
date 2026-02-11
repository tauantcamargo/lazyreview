import { describe, it, expect } from 'vitest'
import { buildTimeline } from './ConversationsTab'
import type { PullRequest } from '../../models/pull-request'
import type { Comment } from '../../models/comment'
import type { Review } from '../../models/review'
import type { ReviewThread } from '../../services/GitHubApiTypes'

function makePR(overrides?: Partial<Record<string, unknown>>): PullRequest {
  return {
    id: 1,
    number: 42,
    title: 'Test PR',
    body: 'PR description',
    state: 'open',
    draft: false,
    merged: false,
    user: { login: 'author', avatar_url: '' },
    labels: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    html_url: 'https://github.com/owner/repo/pull/42',
    head: { ref: 'feature', sha: 'abc' },
    base: { ref: 'main', sha: 'def' },
    additions: 10,
    deletions: 5,
    changed_files: 3,
    comments: 0,
    review_comments: 0,
    requested_reviewers: [],
    ...overrides,
  } as unknown as PullRequest
}

function makeComment(id: number, date: string, body = 'comment body'): Comment {
  return {
    id,
    body,
    user: { login: 'commenter', avatar_url: '' },
    created_at: date,
    updated_at: date,
    html_url: '',
  } as unknown as Comment
}

function makeReview(id: number, state: string, date: string): Review {
  return {
    id,
    user: { login: 'reviewer', avatar_url: '' },
    body: 'review body',
    state,
    submitted_at: date,
    html_url: '',
  } as unknown as Review
}

describe('buildTimeline', () => {
  it('returns empty array when no comments or reviews', () => {
    const pr = makePR()
    const items = buildTimeline(pr, [], [])
    expect(items).toHaveLength(0)
  })

  it('adds reviews (non-PENDING) to timeline', () => {
    const pr = makePR()
    const reviews = [
      makeReview(1, 'APPROVED', '2025-01-02T00:00:00Z'),
      makeReview(2, 'PENDING', '2025-01-03T00:00:00Z'),
    ]
    const items = buildTimeline(pr, [], reviews)
    expect(items).toHaveLength(1)
    expect(items[0]!.type).toBe('review')
    expect(items[0]!.state).toBe('APPROVED')
  })

  it('adds comments to timeline', () => {
    const pr = makePR()
    const comments = [makeComment(1, '2025-01-02T00:00:00Z')]
    const items = buildTimeline(pr, comments, [])
    expect(items).toHaveLength(1)
    expect(items[0]!.type).toBe('comment')
    expect(items[0]!.body).toBe('comment body')
  })

  it('sorts items by date', () => {
    const pr = makePR({ created_at: '2025-01-01T00:00:00Z' })
    const comments = [
      makeComment(1, '2025-01-05T00:00:00Z'),
      makeComment(2, '2025-01-02T00:00:00Z'),
    ]
    const reviews = [makeReview(1, 'COMMENTED', '2025-01-03T00:00:00Z')]
    const items = buildTimeline(pr, comments, reviews)
    expect(items).toHaveLength(3)
    // comment-2 (Jan 2), review (Jan 3), comment-1 (Jan 5)
    expect(items[0]!.id).toBe('comment-2')
    expect(items[1]!.type).toBe('review')
    expect(items[2]!.id).toBe('comment-1')
  })

  it('attaches thread info to comments', () => {
    const pr = makePR()
    const comments = [makeComment(100, '2025-01-02T00:00:00Z')]
    const threads: ReviewThread[] = [
      { id: 'thread-1', isResolved: true, comments: [{ databaseId: 100 }] },
    ]
    const items = buildTimeline(pr, comments, [], threads)
    const commentItem = items.find((i) => i.type === 'comment')
    expect(commentItem?.threadId).toBe('thread-1')
    expect(commentItem?.isResolved).toBe(true)
  })

  it('does not attach thread info when no matching thread', () => {
    const pr = makePR()
    const comments = [makeComment(200, '2025-01-02T00:00:00Z')]
    const threads: ReviewThread[] = [
      { id: 'thread-1', isResolved: false, comments: [{ databaseId: 999 }] },
    ]
    const items = buildTimeline(pr, comments, [], threads)
    const commentItem = items.find((i) => i.type === 'comment')
    expect(commentItem?.threadId).toBeUndefined()
    expect(commentItem?.isResolved).toBeUndefined()
  })

  it('does not include description item in timeline', () => {
    const pr = makePR()
    const comments = [makeComment(1, '2025-01-02T00:00:00Z')]
    const reviews = [makeReview(1, 'APPROVED', '2025-01-03T00:00:00Z')]
    const items = buildTimeline(pr, comments, reviews)
    const descriptionItems = items.filter((i) => i.type === 'description')
    expect(descriptionItems).toHaveLength(0)
  })
})
