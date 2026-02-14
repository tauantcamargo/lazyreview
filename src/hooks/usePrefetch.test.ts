import { describe, it, expect } from 'vitest'
import {
  shouldPrefetch,
  buildPrefetchQueryKeys,
  DEFAULT_DELAY_MS,
  DEFAULT_MIN_RATE_LIMIT,
} from './usePrefetch'
import type { PullRequest } from '../models/pull-request'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePR(overrides: Partial<{
  readonly number: number
  readonly login: string
}>): PullRequest {
  const {
    number = 1,
    login = 'alice',
  } = overrides

  return {
    id: number,
    node_id: '',
    number,
    title: `PR #${number}`,
    body: null,
    state: 'open',
    draft: false,
    merged: false,
    user: { login, id: 1, avatar_url: '', html_url: '', type: 'User' },
    labels: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
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
    requested_reviewers: [],
    assignees: [],
    mergeable: null,
    mergeable_state: null,
    merge_commit_sha: null,
  } as unknown as PullRequest
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('has default delay of 500ms', () => {
    expect(DEFAULT_DELAY_MS).toBe(500)
  })

  it('has default min rate limit of 200', () => {
    expect(DEFAULT_MIN_RATE_LIMIT).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// shouldPrefetch
// ---------------------------------------------------------------------------

describe('shouldPrefetch', () => {
  const baseOptions = {
    items: [makePR({ number: 1 }), makePR({ number: 2 })],
    selectedIndex: 0,
    enabled: true,
    owner: 'owner',
    repo: 'repo',
    minRateLimit: 200,
    rateLimitRemaining: 5000,
    alreadyPrefetched: new Set<number>(),
  }

  it('returns PR number when all conditions are met', () => {
    const result = shouldPrefetch(baseOptions)
    expect(result).toBe(1)
  })

  it('returns null when disabled', () => {
    const result = shouldPrefetch({ ...baseOptions, enabled: false })
    expect(result).toBeNull()
  })

  it('returns null when owner is empty', () => {
    const result = shouldPrefetch({ ...baseOptions, owner: '' })
    expect(result).toBeNull()
  })

  it('returns null when repo is empty', () => {
    const result = shouldPrefetch({ ...baseOptions, repo: '' })
    expect(result).toBeNull()
  })

  it('returns null when items array is empty', () => {
    const result = shouldPrefetch({ ...baseOptions, items: [] })
    expect(result).toBeNull()
  })

  it('returns null when selectedIndex is negative', () => {
    const result = shouldPrefetch({ ...baseOptions, selectedIndex: -1 })
    expect(result).toBeNull()
  })

  it('returns null when selectedIndex is out of bounds', () => {
    const result = shouldPrefetch({ ...baseOptions, selectedIndex: 5 })
    expect(result).toBeNull()
  })

  it('returns null when PR was already prefetched', () => {
    const result = shouldPrefetch({
      ...baseOptions,
      alreadyPrefetched: new Set([1]),
    })
    expect(result).toBeNull()
  })

  it('returns PR number for un-prefetched PR in same list', () => {
    const result = shouldPrefetch({
      ...baseOptions,
      selectedIndex: 1,
      alreadyPrefetched: new Set([1]),
    })
    expect(result).toBe(2)
  })

  it('returns null when rate limit is below threshold', () => {
    const result = shouldPrefetch({
      ...baseOptions,
      rateLimitRemaining: 100,
      minRateLimit: 200,
    })
    expect(result).toBeNull()
  })

  it('returns null when rate limit equals threshold minus 1', () => {
    const result = shouldPrefetch({
      ...baseOptions,
      rateLimitRemaining: 199,
      minRateLimit: 200,
    })
    expect(result).toBeNull()
  })

  it('returns PR number when rate limit exactly meets threshold', () => {
    const result = shouldPrefetch({
      ...baseOptions,
      rateLimitRemaining: 200,
      minRateLimit: 200,
    })
    expect(result).toBe(1)
  })

  it('returns PR number when rate limit exceeds threshold', () => {
    const result = shouldPrefetch({
      ...baseOptions,
      rateLimitRemaining: 5000,
      minRateLimit: 200,
    })
    expect(result).toBe(1)
  })

  it('returns correct PR number for different selectedIndex', () => {
    const items = [
      makePR({ number: 10 }),
      makePR({ number: 20 }),
      makePR({ number: 30 }),
    ]
    const result = shouldPrefetch({
      ...baseOptions,
      items,
      selectedIndex: 2,
    })
    expect(result).toBe(30)
  })

  it('handles single-item list', () => {
    const result = shouldPrefetch({
      ...baseOptions,
      items: [makePR({ number: 42 })],
      selectedIndex: 0,
    })
    expect(result).toBe(42)
  })

  it('returns null when both owner and repo are empty', () => {
    const result = shouldPrefetch({
      ...baseOptions,
      owner: '',
      repo: '',
    })
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildPrefetchQueryKeys
// ---------------------------------------------------------------------------

describe('buildPrefetchQueryKeys', () => {
  it('returns 4 query keys for PR detail data', () => {
    const keys = buildPrefetchQueryKeys('myowner', 'myrepo', 42)
    expect(keys).toHaveLength(4)
  })

  it('includes PR detail query key', () => {
    const keys = buildPrefetchQueryKeys('owner', 'repo', 1)
    expect(keys).toContainEqual(['pr', 'owner', 'repo', 1])
  })

  it('includes PR files query key', () => {
    const keys = buildPrefetchQueryKeys('owner', 'repo', 1)
    expect(keys).toContainEqual(['pr-files', 'owner', 'repo', 1])
  })

  it('includes PR comments query key', () => {
    const keys = buildPrefetchQueryKeys('owner', 'repo', 1)
    expect(keys).toContainEqual(['pr-comments', 'owner', 'repo', 1])
  })

  it('includes PR reviews query key', () => {
    const keys = buildPrefetchQueryKeys('owner', 'repo', 1)
    expect(keys).toContainEqual(['pr-reviews', 'owner', 'repo', 1])
  })

  it('uses the correct owner, repo, and PR number', () => {
    const keys = buildPrefetchQueryKeys('acme', 'widgets', 99)
    expect(keys).toEqual([
      ['pr', 'acme', 'widgets', 99],
      ['pr-files', 'acme', 'widgets', 99],
      ['pr-comments', 'acme', 'widgets', 99],
      ['pr-reviews', 'acme', 'widgets', 99],
    ])
  })

  it('matches query keys used by useGitHub hooks', () => {
    // These query keys must match the ones in useGitHub.ts:
    // usePullRequest:  ['pr', owner, repo, number]
    // usePRFiles:      ['pr-files', owner, repo, number]
    // usePRComments:   ['pr-comments', owner, repo, number]
    // usePRReviews:    ['pr-reviews', owner, repo, number]
    const keys = buildPrefetchQueryKeys('o', 'r', 5)
    const prefixes = keys.map((k) => k[0])
    expect(prefixes).toEqual(['pr', 'pr-files', 'pr-comments', 'pr-reviews'])
  })
})
