import { describe, it, expect } from 'vitest'
import { buildReviewerList } from './ReReviewModal'
import type { Review } from '../../models/review'

function makeReview(login: string, state: string, submitted_at: string): Review {
  return {
    id: Math.floor(Math.random() * 10000),
    user: { login, avatar_url: '' },
    body: null,
    state,
    submitted_at,
    html_url: '',
  } as unknown as Review
}

describe('buildReviewerList', () => {
  it('returns empty list when no reviews or requested reviewers', () => {
    const result = buildReviewerList([], [])
    expect(result).toEqual([])
  })

  it('uses latest review state per user', () => {
    const reviews = [
      makeReview('alice', 'COMMENTED', '2025-01-01T00:00:00Z'),
      makeReview('alice', 'APPROVED', '2025-01-02T00:00:00Z'),
    ]
    const result = buildReviewerList(reviews, [])
    expect(result).toHaveLength(1)
    expect(result[0]!.login).toBe('alice')
    expect(result[0]!.status).toBe('APPROVED')
  })

  it('filters out PENDING reviews', () => {
    const reviews = [
      makeReview('bob', 'PENDING', '2025-01-01T00:00:00Z'),
    ]
    const result = buildReviewerList(reviews, [])
    expect(result).toEqual([])
  })

  it('adds requested reviewers who have not reviewed', () => {
    const reviews = [
      makeReview('alice', 'APPROVED', '2025-01-01T00:00:00Z'),
    ]
    const requested = [{ login: 'bob' }]
    const result = buildReviewerList(reviews, requested)
    expect(result).toHaveLength(2)
    expect(result[0]!.login).toBe('alice')
    expect(result[0]!.status).toBe('APPROVED')
    expect(result[1]!.login).toBe('bob')
    expect(result[1]!.status).toBe('PENDING')
  })

  it('does not duplicate reviewers already in the review list', () => {
    const reviews = [
      makeReview('alice', 'CHANGES_REQUESTED', '2025-01-01T00:00:00Z'),
    ]
    const requested = [{ login: 'alice' }]
    const result = buildReviewerList(reviews, requested)
    expect(result).toHaveLength(1)
    expect(result[0]!.login).toBe('alice')
    expect(result[0]!.status).toBe('CHANGES_REQUESTED')
  })

  it('handles multiple reviewers with different states', () => {
    const reviews = [
      makeReview('alice', 'APPROVED', '2025-01-02T00:00:00Z'),
      makeReview('bob', 'CHANGES_REQUESTED', '2025-01-01T00:00:00Z'),
      makeReview('charlie', 'COMMENTED', '2025-01-01T00:00:00Z'),
    ]
    const requested = [{ login: 'dave' }]
    const result = buildReviewerList(reviews, requested)
    expect(result).toHaveLength(4)
    const logins = result.map((r) => r.login)
    expect(logins).toContain('alice')
    expect(logins).toContain('bob')
    expect(logins).toContain('charlie')
    expect(logins).toContain('dave')
  })
})
