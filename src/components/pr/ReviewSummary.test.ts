import { describe, it, expect } from 'vitest'
import { getLatestReviewByUser } from './ReviewSummary'
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

describe('getLatestReviewByUser', () => {
  it('returns empty map for no reviews', () => {
    const result = getLatestReviewByUser([])
    expect(result.size).toBe(0)
  })

  it('returns latest review per user', () => {
    const reviews = [
      makeReview('alice', 'COMMENTED', '2025-01-01T00:00:00Z'),
      makeReview('alice', 'APPROVED', '2025-01-02T00:00:00Z'),
    ]
    const result = getLatestReviewByUser(reviews)
    expect(result.size).toBe(1)
    expect(result.get('alice')?.state).toBe('APPROVED')
  })

  it('skips PENDING reviews', () => {
    const reviews = [makeReview('bob', 'PENDING', '2025-01-01T00:00:00Z')]
    const result = getLatestReviewByUser(reviews)
    expect(result.size).toBe(0)
  })

  it('handles multiple users', () => {
    const reviews = [
      makeReview('alice', 'APPROVED', '2025-01-01T00:00:00Z'),
      makeReview('bob', 'CHANGES_REQUESTED', '2025-01-02T00:00:00Z'),
    ]
    const result = getLatestReviewByUser(reviews)
    expect(result.size).toBe(2)
    expect(result.get('alice')?.state).toBe('APPROVED')
    expect(result.get('bob')?.state).toBe('CHANGES_REQUESTED')
  })

  it('keeps the latest when older comes after newer', () => {
    const reviews = [
      makeReview('alice', 'APPROVED', '2025-01-02T00:00:00Z'),
      makeReview('alice', 'COMMENTED', '2025-01-01T00:00:00Z'),
    ]
    const result = getLatestReviewByUser(reviews)
    expect(result.get('alice')?.state).toBe('APPROVED')
  })
})
