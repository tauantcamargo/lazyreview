import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SidebarCounts } from './useSidebarCounts'
import { extractCount, extractThisRepoCount } from './useSidebarCounts'

// Minimal mock PR objects matching what extractCount expects (array with .length)
function makePRs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    html_url: `https://github.com/owner/repo/pull/${i + 1}`,
    updated_at: '2025-01-01T00:00:00Z',
  }))
}

function createMockQueryClient(
  queriesMap: ReadonlyMap<string, readonly unknown[] | undefined>,
) {
  return {
    getQueriesData: vi.fn(({ queryKey }: { queryKey: readonly string[] }) => {
      const prefix = queryKey[0]
      const data = queriesMap.get(prefix)
      // Simulate the shape returned by getQueriesData: [[queryKey, data]]
      if (data !== undefined) {
        return [[[prefix], data]]
      }
      return []
    }),
    getQueryCache: vi.fn(() => ({
      subscribe: vi.fn(() => vi.fn()),
    })),
  } as unknown as ReturnType<typeof import('@tanstack/react-query').useQueryClient>
}

describe('SidebarCounts type', () => {
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

describe('extractCount', () => {
  it('returns null when no query data exists for the prefix', () => {
    const client = createMockQueryClient(new Map())
    expect(extractCount(client, 'involved-prs')).toBeNull()
  })

  it('returns null when query data is empty array in map but getQueriesData returns no entries', () => {
    // If the prefix is not in the map, getQueriesData returns []
    const client = createMockQueryClient(new Map([['other-key', makePRs(3)]]))
    expect(extractCount(client, 'involved-prs')).toBeNull()
  })

  it('returns count when query data has PR items', () => {
    const prs = makePRs(5)
    const client = createMockQueryClient(new Map([['involved-prs', prs]]))
    expect(extractCount(client, 'involved-prs')).toBe(5)
  })

  it('returns 0 when query data is an empty array', () => {
    const client = createMockQueryClient(new Map([['my-prs', []]]))
    expect(extractCount(client, 'my-prs')).toBe(0)
  })

  it('calls getQueriesData with correct query key and exact:false', () => {
    const client = createMockQueryClient(new Map())
    extractCount(client, 'review-requests')
    expect(client.getQueriesData).toHaveBeenCalledWith({
      queryKey: ['review-requests'],
      exact: false,
    })
  })

  it('returns count for browse-prs prefix', () => {
    const prs = makePRs(12)
    const client = createMockQueryClient(new Map([['browse-prs', prs]]))
    expect(extractCount(client, 'browse-prs')).toBe(12)
  })

  it('returns count for the first query that has data', () => {
    // The mock returns data for the first matching prefix
    const prs = makePRs(7)
    const client = createMockQueryClient(new Map([['review-requests', prs]]))
    expect(extractCount(client, 'review-requests')).toBe(7)
  })
})

describe('extractThisRepoCount', () => {
  it('returns null when no prs query data exists', () => {
    const client = createMockQueryClient(new Map())
    expect(extractThisRepoCount(client)).toBeNull()
  })

  it('returns count when prs query has data', () => {
    const prs = makePRs(8)
    const client = createMockQueryClient(new Map([['prs', prs]]))
    expect(extractThisRepoCount(client)).toBe(8)
  })

  it('returns 0 when prs query has empty array', () => {
    const client = createMockQueryClient(new Map([['prs', []]]))
    expect(extractThisRepoCount(client)).toBe(0)
  })

  it('calls getQueriesData with prs key and exact:false', () => {
    const client = createMockQueryClient(new Map())
    extractThisRepoCount(client)
    expect(client.getQueriesData).toHaveBeenCalledWith({
      queryKey: ['prs'],
      exact: false,
    })
  })

  it('ignores non-prs query data', () => {
    const client = createMockQueryClient(
      new Map([['other-key', makePRs(3)]]),
    )
    expect(extractThisRepoCount(client)).toBeNull()
  })
})

describe('extractCount with undefined data entries', () => {
  it('skips undefined data entries and returns null', () => {
    // When getQueriesData returns entries with undefined data
    const client = {
      getQueriesData: vi.fn(() => [
        [['involved-prs', 'open'], undefined],
      ]),
      getQueryCache: vi.fn(() => ({
        subscribe: vi.fn(() => vi.fn()),
      })),
    } as unknown as ReturnType<typeof import('@tanstack/react-query').useQueryClient>

    expect(extractCount(client, 'involved-prs')).toBeNull()
  })

  it('returns count from second entry when first is undefined', () => {
    const prs = makePRs(4)
    const client = {
      getQueriesData: vi.fn(() => [
        [['involved-prs', 'open'], undefined],
        [['involved-prs', 'closed'], prs],
      ]),
      getQueryCache: vi.fn(() => ({
        subscribe: vi.fn(() => vi.fn()),
      })),
    } as unknown as ReturnType<typeof import('@tanstack/react-query').useQueryClient>

    expect(extractCount(client, 'involved-prs')).toBe(4)
  })
})

describe('subscriber behavior', () => {
  it('getQueryCache().subscribe is callable on mock', () => {
    const subscribeFn = vi.fn(() => vi.fn())
    const client = {
      getQueriesData: vi.fn(() => []),
      getQueryCache: vi.fn(() => ({
        subscribe: subscribeFn,
      })),
    } as unknown as ReturnType<typeof import('@tanstack/react-query').useQueryClient>

    const cache = client.getQueryCache()
    const unsub = cache.subscribe(() => {})
    expect(subscribeFn).toHaveBeenCalled()
    expect(typeof unsub).toBe('function')
  })
})
