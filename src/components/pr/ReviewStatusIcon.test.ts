import { describe, it, expect } from 'vitest'
import { getReviewDecision, type ReviewDecision } from './ReviewStatusIcon'
import type { Review } from '../../models/review'

function makeReview(login: string, state: Review['state']): Review {
  return {
    id: Math.floor(Math.random() * 100000),
    user: { login, avatar_url: '', id: 1 },
    body: null,
    state,
    submitted_at: new Date().toISOString(),
    html_url: `https://github.com/owner/repo/pull/1#pullrequestreview-${Math.random()}`,
  } as unknown as Review
}

describe('getReviewDecision', () => {
  it('returns none for empty reviews', () => {
    expect(getReviewDecision([])).toBe<ReviewDecision>('none')
  })

  it('returns pending when only COMMENTED reviews exist', () => {
    const reviews = [
      makeReview('alice', 'COMMENTED'),
      makeReview('bob', 'COMMENTED'),
    ]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('pending')
  })

  it('returns approved when all reviewers approved', () => {
    const reviews = [
      makeReview('alice', 'APPROVED'),
      makeReview('bob', 'APPROVED'),
    ]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('approved')
  })

  it('returns changes_requested when any reviewer requests changes', () => {
    const reviews = [
      makeReview('alice', 'APPROVED'),
      makeReview('bob', 'CHANGES_REQUESTED'),
    ]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('changes_requested')
  })

  it('uses latest review per user (approved after changes requested)', () => {
    const reviews = [
      makeReview('alice', 'CHANGES_REQUESTED'),
      makeReview('alice', 'APPROVED'),
    ]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('approved')
  })

  it('uses latest review per user (changes requested after approval)', () => {
    const reviews = [
      makeReview('alice', 'APPROVED'),
      makeReview('alice', 'CHANGES_REQUESTED'),
    ]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('changes_requested')
  })

  it('ignores DISMISSED and PENDING reviews', () => {
    const reviews = [
      makeReview('alice', 'DISMISSED'),
      makeReview('bob', 'PENDING'),
      makeReview('charlie', 'APPROVED'),
    ]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('approved')
  })

  it('returns pending when only DISMISSED reviews exist', () => {
    const reviews = [makeReview('alice', 'DISMISSED')]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('pending')
  })

  it('handles mixed reviewers with one requesting changes', () => {
    const reviews = [
      makeReview('alice', 'APPROVED'),
      makeReview('bob', 'APPROVED'),
      makeReview('charlie', 'CHANGES_REQUESTED'),
    ]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('changes_requested')
  })

  it('handles single reviewer approving', () => {
    const reviews = [makeReview('alice', 'APPROVED')]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('approved')
  })

  it('handles single reviewer requesting changes', () => {
    const reviews = [makeReview('alice', 'CHANGES_REQUESTED')]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('changes_requested')
  })

  it('handles only PENDING reviews (non-decisive)', () => {
    const reviews = [
      makeReview('alice', 'PENDING'),
      makeReview('bob', 'PENDING'),
    ]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('pending')
  })

  it('handles complex history with multiple users and state changes', () => {
    const reviews = [
      makeReview('alice', 'APPROVED'),
      makeReview('bob', 'CHANGES_REQUESTED'),
      makeReview('alice', 'COMMENTED'), // Non-decisive, alice stays APPROVED
      makeReview('bob', 'APPROVED'), // Bob now approves
    ]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('approved')
  })

  it('ignores COMMENTED between decisive reviews for same user', () => {
    const reviews = [
      makeReview('alice', 'CHANGES_REQUESTED'),
      makeReview('alice', 'COMMENTED'),
      // alice's latest decisive review is still CHANGES_REQUESTED
    ]
    expect(getReviewDecision(reviews)).toBe<ReviewDecision>('changes_requested')
  })
})
