import { describe, it, expect } from 'vitest'
import type { SidebarCounts } from './useSidebarCounts'

describe('SidebarCounts', () => {
  it('type has correct shape', () => {
    const counts: SidebarCounts = {
      involved: 5,
      myPrs: 3,
      forReview: 2,
      forReviewUnread: 1,
      thisRepo: 10,
      browse: 7,
    }
    expect(counts.involved).toBe(5)
    expect(counts.myPrs).toBe(3)
    expect(counts.forReview).toBe(2)
    expect(counts.forReviewUnread).toBe(1)
    expect(counts.thisRepo).toBe(10)
    expect(counts.browse).toBe(7)
  })

  it('accepts null values for loading/unavailable counts', () => {
    const counts: SidebarCounts = {
      involved: null,
      myPrs: null,
      forReview: null,
      forReviewUnread: null,
      thisRepo: null,
      browse: null,
    }
    expect(counts.involved).toBeNull()
    expect(counts.forReviewUnread).toBeNull()
    expect(counts.browse).toBeNull()
  })

  it('forReviewUnread is null when no unread items', () => {
    const counts: SidebarCounts = {
      involved: 5,
      myPrs: 3,
      forReview: 2,
      forReviewUnread: null,
      thisRepo: 0,
      browse: null,
    }
    expect(counts.forReviewUnread).toBeNull()
    expect(counts.thisRepo).toBe(0)
  })
})
