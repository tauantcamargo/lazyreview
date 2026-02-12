import { describe, it, expect } from 'vitest'
import type { PullRequest } from '../models/pull-request'

import {
  extractRepoFromUrl,
  matchesSearch,
  matchesRepo,
  matchesAuthor,
  matchesLabel,
  comparePRs,
} from './useFilter'

function makePR(overrides: Partial<Record<string, unknown>> = {}): PullRequest {
  return {
    id: 1,
    number: 42,
    title: 'Test PR',
    body: null,
    state: 'open',
    draft: false,
    merged: false,
    user: { login: 'alice', avatar_url: '' },
    labels: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    html_url: 'https://github.com/owner/repo/pull/42',
    head: { ref: 'feature', sha: 'abc' },
    base: { ref: 'main', sha: 'def' },
    additions: 0,
    deletions: 0,
    changed_files: 0,
    comments: 0,
    review_comments: 0,
    requested_reviewers: [],
    ...overrides,
  } as unknown as PullRequest
}

describe('extractRepoFromUrl', () => {
  it('extracts owner/repo from a valid GitHub PR URL', () => {
    expect(extractRepoFromUrl('https://github.com/owner/repo/pull/42')).toBe(
      'owner/repo',
    )
  })

  it('returns null for non-matching URLs', () => {
    expect(extractRepoFromUrl('https://example.com')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractRepoFromUrl('')).toBeNull()
  })

  it('extracts from URL with nested repo name', () => {
    expect(
      extractRepoFromUrl('https://github.com/my-org/my-repo/pull/123'),
    ).toBe('my-org/my-repo')
  })

  it('returns null for a GitHub URL without /pull/', () => {
    expect(extractRepoFromUrl('https://github.com/owner/repo/issues/5')).toBeNull()
  })

  it('handles URL with query parameters', () => {
    expect(
      extractRepoFromUrl('https://github.com/owner/repo/pull/42?diff=unified'),
    ).toBe('owner/repo')
  })
})

describe('matchesSearch', () => {
  it('returns true when search is empty', () => {
    expect(matchesSearch(makePR(), '')).toBe(true)
  })

  it('matches on title', () => {
    expect(matchesSearch(makePR({ title: 'Fix login bug' }), 'login')).toBe(true)
  })

  it('matches on user login', () => {
    expect(matchesSearch(makePR(), 'alice')).toBe(true)
  })

  it('matches on PR number', () => {
    expect(matchesSearch(makePR({ number: 123 }), '123')).toBe(true)
  })

  it('is case insensitive', () => {
    expect(matchesSearch(makePR({ title: 'FIX BUG' }), 'fix bug')).toBe(true)
  })

  it('returns false when nothing matches', () => {
    expect(matchesSearch(makePR(), 'nonexistent')).toBe(false)
  })

  it('matches partial title substring', () => {
    expect(matchesSearch(makePR({ title: 'refactor authentication' }), 'auth')).toBe(true)
  })

  it('matches partial user login substring', () => {
    expect(matchesSearch(makePR({ user: { login: 'alice-smith', avatar_url: '' } }), 'smith')).toBe(true)
  })

  it('matches partial PR number', () => {
    expect(matchesSearch(makePR({ number: 1234 }), '23')).toBe(true)
  })
})

describe('matchesRepo', () => {
  it('returns true when repo is null', () => {
    expect(matchesRepo(makePR(), null)).toBe(true)
  })

  it('matches when PR repo matches', () => {
    expect(matchesRepo(makePR(), 'owner/repo')).toBe(true)
  })

  it('matches partial repo name', () => {
    expect(matchesRepo(makePR(), 'owner')).toBe(true)
  })

  it('returns false when repo does not match', () => {
    expect(matchesRepo(makePR(), 'other/thing')).toBe(false)
  })

  it('is case insensitive', () => {
    expect(matchesRepo(makePR(), 'OWNER/REPO')).toBe(true)
  })

  it('returns false for non-github URL with repo filter', () => {
    const pr = makePR({ html_url: 'https://example.com/pull/1' })
    expect(matchesRepo(pr, 'owner/repo')).toBe(false)
  })
})

describe('matchesAuthor', () => {
  it('returns true when author is null', () => {
    expect(matchesAuthor(makePR(), null)).toBe(true)
  })

  it('matches author login', () => {
    expect(matchesAuthor(makePR(), 'alice')).toBe(true)
  })

  it('is case insensitive', () => {
    expect(matchesAuthor(makePR(), 'ALICE')).toBe(true)
  })

  it('returns false when author does not match', () => {
    expect(matchesAuthor(makePR(), 'bob')).toBe(false)
  })

  it('matches partial author name', () => {
    expect(matchesAuthor(makePR({ user: { login: 'alice-smith', avatar_url: '' } }), 'alice')).toBe(true)
  })
})

describe('matchesLabel', () => {
  it('returns true when label is null', () => {
    expect(matchesLabel(makePR(), null)).toBe(true)
  })

  it('matches label name', () => {
    const pr = makePR({
      labels: [{ id: 1, name: 'bug', color: 'ff0000', description: null }],
    })
    expect(matchesLabel(pr, 'bug')).toBe(true)
  })

  it('is case insensitive', () => {
    const pr = makePR({
      labels: [{ id: 1, name: 'Bug', color: 'ff0000', description: null }],
    })
    expect(matchesLabel(pr, 'bug')).toBe(true)
  })

  it('returns false when no matching label', () => {
    expect(matchesLabel(makePR(), 'bug')).toBe(false)
  })

  it('matches partial label name', () => {
    const pr = makePR({
      labels: [{ id: 1, name: 'enhancement', color: '00ff00', description: null }],
    })
    expect(matchesLabel(pr, 'enhance')).toBe(true)
  })

  it('matches among multiple labels', () => {
    const pr = makePR({
      labels: [
        { id: 1, name: 'feature', color: '00ff00', description: null },
        { id: 2, name: 'bug', color: 'ff0000', description: null },
      ],
    })
    expect(matchesLabel(pr, 'bug')).toBe(true)
  })

  it('returns false when labels exist but none match', () => {
    const pr = makePR({
      labels: [{ id: 1, name: 'feature', color: '00ff00', description: null }],
    })
    expect(matchesLabel(pr, 'bug')).toBe(false)
  })
})

describe('comparePRs', () => {
  it('sorts by updated date descending by default', () => {
    const a = makePR({ updated_at: '2025-01-01T00:00:00Z' })
    const b = makePR({ updated_at: '2025-01-02T00:00:00Z' })
    expect(comparePRs(a, b, 'updated', 'desc')).toBeGreaterThan(0)
  })

  it('sorts by updated date ascending when specified', () => {
    const a = makePR({ updated_at: '2025-01-01T00:00:00Z' })
    const b = makePR({ updated_at: '2025-01-02T00:00:00Z' })
    expect(comparePRs(a, b, 'updated', 'asc')).toBeLessThan(0)
  })

  it('sorts by created date descending', () => {
    const a = makePR({ created_at: '2025-01-01T00:00:00Z' })
    const b = makePR({ created_at: '2025-01-02T00:00:00Z' })
    expect(comparePRs(a, b, 'created', 'desc')).toBeGreaterThan(0)
  })

  it('sorts by created date ascending', () => {
    const a = makePR({ created_at: '2025-01-01T00:00:00Z' })
    const b = makePR({ created_at: '2025-01-02T00:00:00Z' })
    expect(comparePRs(a, b, 'created', 'asc')).toBeLessThan(0)
  })

  it('sorts by author login descending', () => {
    const a = makePR({ user: { login: 'alice', avatar_url: '' } })
    const b = makePR({ user: { login: 'bob', avatar_url: '' } })
    expect(comparePRs(a, b, 'author', 'desc')).toBeLessThan(0)
  })

  it('sorts by author login ascending', () => {
    const a = makePR({ user: { login: 'alice', avatar_url: '' } })
    const b = makePR({ user: { login: 'bob', avatar_url: '' } })
    expect(comparePRs(a, b, 'author', 'asc')).toBeGreaterThan(0)
  })

  it('sorts by title descending', () => {
    const a = makePR({ title: 'Alpha' })
    const b = makePR({ title: 'Beta' })
    expect(comparePRs(a, b, 'title', 'desc')).toBeLessThan(0)
  })

  it('sorts by title ascending', () => {
    const a = makePR({ title: 'Alpha' })
    const b = makePR({ title: 'Beta' })
    expect(comparePRs(a, b, 'title', 'asc')).toBeGreaterThan(0)
  })

  it('sorts by repo descending', () => {
    const a = makePR({ html_url: 'https://github.com/aaa/repo/pull/1' })
    const b = makePR({ html_url: 'https://github.com/bbb/repo/pull/1' })
    expect(comparePRs(a, b, 'repo', 'desc')).toBeLessThan(0)
  })

  it('sorts by repo ascending', () => {
    const a = makePR({ html_url: 'https://github.com/aaa/repo/pull/1' })
    const b = makePR({ html_url: 'https://github.com/bbb/repo/pull/1' })
    expect(comparePRs(a, b, 'repo', 'asc')).toBeGreaterThan(0)
  })

  it('returns 0 for equal values', () => {
    const a = makePR({ title: 'Same' })
    const b = makePR({ title: 'Same' })
    expect(comparePRs(a, b, 'title', 'desc')).toBe(0)
  })

  it('handles repo sort when URLs are not GitHub URLs', () => {
    const a = makePR({ html_url: 'https://example.com/pull/1' })
    const b = makePR({ html_url: 'https://example.com/pull/2' })
    // Both resolve to empty string, so comparison is 0
    expect(comparePRs(a, b, 'repo', 'desc')).toBe(0)
  })
})
