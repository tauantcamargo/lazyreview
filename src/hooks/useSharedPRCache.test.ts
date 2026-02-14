import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  filterMyPRs,
  filterReviewRequests,
  deriveCacheData,
  CACHE_STALENESS_MS,
} from './useSharedPRCache'
import type { PullRequest } from '../models/pull-request'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePR(overrides: Partial<{
  readonly number: number
  readonly login: string
  readonly requested_reviewers: readonly { readonly login: string }[]
  readonly state: 'open' | 'closed'
  readonly updated_at: string
}>): PullRequest {
  const {
    number = 1,
    login = 'alice',
    requested_reviewers = [],
    state = 'open',
    updated_at = '2026-01-01T00:00:00Z',
  } = overrides

  return {
    id: number,
    node_id: '',
    number,
    title: `PR #${number}`,
    body: null,
    state,
    draft: false,
    merged: false,
    user: { login, id: 1, avatar_url: '', html_url: '', type: 'User' },
    labels: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at,
    merged_at: null,
    closed_at: null,
    html_url: `https://github.com/owner/repo/pull/${number}`,
    head: { ref: 'feature', sha: 'abc123' },
    base: { ref: 'main', sha: 'def456' },
    additions: 0,
    deletions: 0,
    changed_files: 0,
    comments: 0,
    review_comments: 0,
    requested_reviewers: requested_reviewers.map((r) => ({
      login: r.login,
      id: 1,
      avatar_url: '',
      html_url: '',
      type: 'User',
    })),
    assignees: [],
    mergeable: null,
    mergeable_state: null,
    merge_commit_sha: null,
  } as unknown as PullRequest
}

// ---------------------------------------------------------------------------
// filterMyPRs
// ---------------------------------------------------------------------------

describe('filterMyPRs', () => {
  it('returns PRs authored by the current user', () => {
    const prs = [
      makePR({ number: 1, login: 'alice' }),
      makePR({ number: 2, login: 'bob' }),
      makePR({ number: 3, login: 'alice' }),
    ]
    const result = filterMyPRs(prs, 'alice')
    expect(result).toHaveLength(2)
    expect(result.map((pr) => pr.number)).toEqual([1, 3])
  })

  it('returns empty array when no PRs match', () => {
    const prs = [
      makePR({ number: 1, login: 'bob' }),
      makePR({ number: 2, login: 'charlie' }),
    ]
    const result = filterMyPRs(prs, 'alice')
    expect(result).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    const result = filterMyPRs([], 'alice')
    expect(result).toHaveLength(0)
  })

  it('is case-sensitive (usernames are case-sensitive on GitHub)', () => {
    const prs = [makePR({ number: 1, login: 'Alice' })]
    const result = filterMyPRs(prs, 'alice')
    expect(result).toHaveLength(0)
  })

  it('does not mutate the input array', () => {
    const prs = [
      makePR({ number: 1, login: 'alice' }),
      makePR({ number: 2, login: 'bob' }),
    ]
    const original = [...prs]
    filterMyPRs(prs, 'alice')
    expect(prs).toEqual(original)
  })
})

// ---------------------------------------------------------------------------
// filterReviewRequests
// ---------------------------------------------------------------------------

describe('filterReviewRequests', () => {
  it('returns PRs where the current user is a requested reviewer', () => {
    const prs = [
      makePR({ number: 1, login: 'bob', requested_reviewers: [{ login: 'alice' }] }),
      makePR({ number: 2, login: 'charlie', requested_reviewers: [{ login: 'dave' }] }),
      makePR({
        number: 3,
        login: 'eve',
        requested_reviewers: [{ login: 'alice' }, { login: 'frank' }],
      }),
    ]
    const result = filterReviewRequests(prs, 'alice')
    expect(result).toHaveLength(2)
    expect(result.map((pr) => pr.number)).toEqual([1, 3])
  })

  it('returns empty array when no PRs have the user as reviewer', () => {
    const prs = [
      makePR({ number: 1, login: 'bob', requested_reviewers: [{ login: 'charlie' }] }),
    ]
    const result = filterReviewRequests(prs, 'alice')
    expect(result).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    const result = filterReviewRequests([], 'alice')
    expect(result).toHaveLength(0)
  })

  it('handles PRs with no requested reviewers', () => {
    const prs = [makePR({ number: 1, login: 'bob' })]
    const result = filterReviewRequests(prs, 'alice')
    expect(result).toHaveLength(0)
  })

  it('does not include PRs authored by the user', () => {
    // Even if user is somehow in requested_reviewers, that's fine - just test the filter logic
    const prs = [
      makePR({ number: 1, login: 'alice', requested_reviewers: [{ login: 'alice' }] }),
    ]
    const result = filterReviewRequests(prs, 'alice')
    // Should include it since the filter is purely about requested_reviewers
    expect(result).toHaveLength(1)
  })

  it('does not mutate the input array', () => {
    const prs = [
      makePR({ number: 1, login: 'bob', requested_reviewers: [{ login: 'alice' }] }),
    ]
    const original = [...prs]
    filterReviewRequests(prs, 'alice')
    expect(prs).toEqual(original)
  })
})

// ---------------------------------------------------------------------------
// deriveCacheData
// ---------------------------------------------------------------------------

describe('deriveCacheData', () => {
  const now = Date.now()

  function makeQueryClient(
    cache: Record<string, { readonly data: readonly PullRequest[]; readonly dataUpdatedAt: number }>,
  ) {
    return {
      getQueryData: vi.fn((key: readonly unknown[]) => {
        const prefix = key[0] as string
        const stateFilter = key[1] as string
        const cacheKey = `${prefix}:${stateFilter}`
        return cache[cacheKey]?.data
      }),
      getQueryState: vi.fn((key: readonly unknown[]) => {
        const prefix = key[0] as string
        const stateFilter = key[1] as string
        const cacheKey = `${prefix}:${stateFilter}`
        const entry = cache[cacheKey]
        if (!entry) return undefined
        return { dataUpdatedAt: entry.dataUpdatedAt }
      }),
    }
  }

  describe('when involved-prs is cached', () => {
    it('derives myPRs from involved cache', () => {
      const involved = [
        makePR({ number: 1, login: 'alice' }),
        makePR({ number: 2, login: 'bob', requested_reviewers: [{ login: 'alice' }] }),
        makePR({ number: 3, login: 'alice', requested_reviewers: [{ login: 'bob' }] }),
      ]
      const client = makeQueryClient({
        'involved-prs:open': { data: involved, dataUpdatedAt: now },
      })

      const result = deriveCacheData(client as any, 'open', 'alice')
      expect(result.myPRsPlaceholder).toHaveLength(2)
      expect(result.myPRsPlaceholder?.map((pr) => pr.number)).toEqual([1, 3])
    })

    it('derives reviewRequests from involved cache', () => {
      const involved = [
        makePR({ number: 1, login: 'alice' }),
        makePR({ number: 2, login: 'bob', requested_reviewers: [{ login: 'alice' }] }),
        makePR({ number: 3, login: 'charlie', requested_reviewers: [{ login: 'alice' }, { login: 'dave' }] }),
      ]
      const client = makeQueryClient({
        'involved-prs:open': { data: involved, dataUpdatedAt: now },
      })

      const result = deriveCacheData(client as any, 'open', 'alice')
      expect(result.reviewRequestsPlaceholder).toHaveLength(2)
      expect(result.reviewRequestsPlaceholder?.map((pr) => pr.number)).toEqual([2, 3])
    })

    it('returns undefined placeholders when involved cache is stale', () => {
      const staleTime = now - CACHE_STALENESS_MS - 1000
      const involved = [makePR({ number: 1, login: 'alice' })]
      const client = makeQueryClient({
        'involved-prs:open': { data: involved, dataUpdatedAt: staleTime },
      })

      const result = deriveCacheData(client as any, 'open', 'alice')
      expect(result.myPRsPlaceholder).toBeUndefined()
      expect(result.reviewRequestsPlaceholder).toBeUndefined()
    })

    it('returns undefined involvedPlaceholder (involved data is already cached)', () => {
      const involved = [makePR({ number: 1, login: 'alice' })]
      const client = makeQueryClient({
        'involved-prs:open': { data: involved, dataUpdatedAt: now },
      })

      const result = deriveCacheData(client as any, 'open', 'alice')
      expect(result.involvedPlaceholder).toBeUndefined()
    })
  })

  describe('when only my-prs is cached', () => {
    it('does not derive reviewRequests from my-prs alone', () => {
      const myPrs = [makePR({ number: 1, login: 'alice' })]
      const client = makeQueryClient({
        'my-prs:open': { data: myPrs, dataUpdatedAt: now },
      })

      const result = deriveCacheData(client as any, 'open', 'alice')
      expect(result.reviewRequestsPlaceholder).toBeUndefined()
    })

    it('does not set involvedPlaceholder from my-prs alone', () => {
      const myPrs = [makePR({ number: 1, login: 'alice' })]
      const client = makeQueryClient({
        'my-prs:open': { data: myPrs, dataUpdatedAt: now },
      })

      const result = deriveCacheData(client as any, 'open', 'alice')
      expect(result.involvedPlaceholder).toBeUndefined()
    })
  })

  describe('when only review-requests is cached', () => {
    it('does not derive myPRs from review-requests alone', () => {
      const reviews = [
        makePR({ number: 1, login: 'bob', requested_reviewers: [{ login: 'alice' }] }),
      ]
      const client = makeQueryClient({
        'review-requests:open': { data: reviews, dataUpdatedAt: now },
      })

      const result = deriveCacheData(client as any, 'open', 'alice')
      expect(result.myPRsPlaceholder).toBeUndefined()
    })
  })

  describe('when both my-prs and review-requests are cached', () => {
    it('merges both into involvedPlaceholder (deduped by PR number)', () => {
      const myPrs = [
        makePR({ number: 1, login: 'alice' }),
        makePR({ number: 3, login: 'alice' }),
      ]
      const reviews = [
        makePR({ number: 2, login: 'bob', requested_reviewers: [{ login: 'alice' }] }),
        makePR({ number: 3, login: 'alice', requested_reviewers: [{ login: 'bob' }] }),
      ]
      const client = makeQueryClient({
        'my-prs:open': { data: myPrs, dataUpdatedAt: now },
        'review-requests:open': { data: reviews, dataUpdatedAt: now },
      })

      const result = deriveCacheData(client as any, 'open', 'alice')
      expect(result.involvedPlaceholder).toBeDefined()
      // PR #3 appears in both, should be deduped
      const numbers = result.involvedPlaceholder?.map((pr) => pr.number).sort()
      expect(numbers).toEqual([1, 2, 3])
    })

    it('returns undefined involvedPlaceholder when my-prs is stale', () => {
      const staleTime = now - CACHE_STALENESS_MS - 1000
      const myPrs = [makePR({ number: 1, login: 'alice' })]
      const reviews = [
        makePR({ number: 2, login: 'bob', requested_reviewers: [{ login: 'alice' }] }),
      ]
      const client = makeQueryClient({
        'my-prs:open': { data: myPrs, dataUpdatedAt: staleTime },
        'review-requests:open': { data: reviews, dataUpdatedAt: now },
      })

      const result = deriveCacheData(client as any, 'open', 'alice')
      expect(result.involvedPlaceholder).toBeUndefined()
    })

    it('returns undefined involvedPlaceholder when review-requests is stale', () => {
      const staleTime = now - CACHE_STALENESS_MS - 1000
      const myPrs = [makePR({ number: 1, login: 'alice' })]
      const reviews = [
        makePR({ number: 2, login: 'bob', requested_reviewers: [{ login: 'alice' }] }),
      ]
      const client = makeQueryClient({
        'my-prs:open': { data: myPrs, dataUpdatedAt: now },
        'review-requests:open': { data: reviews, dataUpdatedAt: staleTime },
      })

      const result = deriveCacheData(client as any, 'open', 'alice')
      expect(result.involvedPlaceholder).toBeUndefined()
    })
  })

  describe('when no data is cached', () => {
    it('returns all placeholders as undefined', () => {
      const client = makeQueryClient({})
      const result = deriveCacheData(client as any, 'open', 'alice')
      expect(result.myPRsPlaceholder).toBeUndefined()
      expect(result.reviewRequestsPlaceholder).toBeUndefined()
      expect(result.involvedPlaceholder).toBeUndefined()
    })
  })

  describe('when currentUserLogin is undefined', () => {
    it('returns all placeholders as undefined', () => {
      const involved = [makePR({ number: 1, login: 'alice' })]
      const client = makeQueryClient({
        'involved-prs:open': { data: involved, dataUpdatedAt: now },
      })

      const result = deriveCacheData(client as any, 'open', undefined)
      expect(result.myPRsPlaceholder).toBeUndefined()
      expect(result.reviewRequestsPlaceholder).toBeUndefined()
      expect(result.involvedPlaceholder).toBeUndefined()
    })
  })

  describe('state filter handling', () => {
    it('uses the correct state filter for cache lookups', () => {
      const involved = [makePR({ number: 1, login: 'alice' })]
      const client = makeQueryClient({
        'involved-prs:closed': { data: involved, dataUpdatedAt: now },
      })

      // Looking for 'open' should not find 'closed' data
      const openResult = deriveCacheData(client as any, 'open', 'alice')
      expect(openResult.myPRsPlaceholder).toBeUndefined()

      // Looking for 'closed' should find it
      const closedResult = deriveCacheData(client as any, 'closed', 'alice')
      expect(closedResult.myPRsPlaceholder).toHaveLength(1)
    })
  })

  describe('cross-population data', () => {
    it('provides cross-population data when involved query returns data', () => {
      const involved = [
        makePR({ number: 1, login: 'alice' }),
        makePR({ number: 2, login: 'bob', requested_reviewers: [{ login: 'alice' }] }),
      ]
      const client = makeQueryClient({
        'involved-prs:open': { data: involved, dataUpdatedAt: now },
      })

      const result = deriveCacheData(client as any, 'open', 'alice')
      expect(result.myPRsPlaceholder).toHaveLength(1)
      expect(result.reviewRequestsPlaceholder).toHaveLength(1)
    })
  })

  describe('provider-agnostic behavior', () => {
    it('works regardless of PR source (only uses user.login and requested_reviewers)', () => {
      // Simulate GitLab-style PRs (same normalized shape)
      const involvedPRs = [
        makePR({ number: 100, login: 'gitlab-user' }),
        makePR({
          number: 200,
          login: 'other-user',
          requested_reviewers: [{ login: 'gitlab-user' }],
        }),
      ]
      const client = makeQueryClient({
        'involved-prs:open': { data: involvedPRs, dataUpdatedAt: now },
      })

      const result = deriveCacheData(client as any, 'open', 'gitlab-user')
      expect(result.myPRsPlaceholder).toHaveLength(1)
      expect(result.myPRsPlaceholder?.[0]?.number).toBe(100)
      expect(result.reviewRequestsPlaceholder).toHaveLength(1)
      expect(result.reviewRequestsPlaceholder?.[0]?.number).toBe(200)
    })
  })
})
