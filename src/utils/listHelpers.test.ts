import { describe, it, expect } from 'vitest'
import { findNextUnread } from './listHelpers'
import type { PullRequest } from '../models/pull-request'

function makePR(overrides: {
  readonly number: number
  readonly html_url: string
  readonly updated_at: string
}): PullRequest {
  return {
    id: overrides.number,
    node_id: '',
    number: overrides.number,
    title: `PR #${overrides.number}`,
    body: null,
    state: 'open',
    draft: false,
    merged: false,
    user: { login: 'user', avatar_url: '', id: 1, node_id: '' },
    labels: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: overrides.updated_at,
    merged_at: null,
    closed_at: null,
    html_url: overrides.html_url,
    head: { ref: 'main', sha: 'abc', label: undefined },
    base: { ref: 'main', sha: 'def', label: undefined },
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

describe('findNextUnread', () => {
  const prs = [
    makePR({ number: 1, html_url: 'https://github.com/o/r/pull/1', updated_at: '2024-01-01T00:00:00Z' }),
    makePR({ number: 2, html_url: 'https://github.com/o/r/pull/2', updated_at: '2024-01-02T00:00:00Z' }),
    makePR({ number: 3, html_url: 'https://github.com/o/r/pull/3', updated_at: '2024-01-03T00:00:00Z' }),
    makePR({ number: 4, html_url: 'https://github.com/o/r/pull/4', updated_at: '2024-01-04T00:00:00Z' }),
    makePR({ number: 5, html_url: 'https://github.com/o/r/pull/5', updated_at: '2024-01-05T00:00:00Z' }),
  ]

  it('returns -1 for empty list', () => {
    const result = findNextUnread([], 0, () => true)
    expect(result).toBe(-1)
  })

  it('returns -1 when no PRs are unread', () => {
    const result = findNextUnread(prs, 0, () => false)
    expect(result).toBe(-1)
  })

  it('finds the next unread PR after current index', () => {
    // PRs 2 and 4 are unread
    const isUnread = (url: string) =>
      url.includes('/pull/2') || url.includes('/pull/4')

    const result = findNextUnread(prs, 0, isUnread)
    expect(result).toBe(1) // PR #2 at index 1
  })

  it('skips already-passed unread PRs and finds next forward', () => {
    // PRs 2 and 4 are unread
    const isUnread = (url: string) =>
      url.includes('/pull/2') || url.includes('/pull/4')

    const result = findNextUnread(prs, 1, isUnread)
    expect(result).toBe(3) // PR #4 at index 3
  })

  it('wraps around to the beginning when no unread PRs after current', () => {
    // Only PR 1 is unread
    const isUnread = (url: string) => url.includes('/pull/1')

    const result = findNextUnread(prs, 2, isUnread)
    expect(result).toBe(0) // PR #1 at index 0
  })

  it('wraps to current index when current item is the only unread', () => {
    // Only PR 3 is unread (index 2)
    const isUnread = (url: string) => url.includes('/pull/3')

    const result = findNextUnread(prs, 2, isUnread)
    expect(result).toBe(2) // Wraps back to itself
  })

  it('finds first unread when all are unread', () => {
    const result = findNextUnread(prs, 2, () => true)
    expect(result).toBe(3) // Next after current index 2
  })

  it('handles single item list that is unread', () => {
    const singlePR = [prs[0]!]
    const result = findNextUnread(singlePR, 0, () => true)
    expect(result).toBe(0)
  })

  it('handles single item list that is read', () => {
    const singlePR = [prs[0]!]
    const result = findNextUnread(singlePR, 0, () => false)
    expect(result).toBe(-1)
  })

  it('finds unread at end of list when current is near start', () => {
    // Only PR 5 (index 4) is unread
    const isUnread = (url: string) => url.includes('/pull/5')

    const result = findNextUnread(prs, 0, isUnread)
    expect(result).toBe(4)
  })

  it('finds unread at start when current is at end', () => {
    // Only PR 1 (index 0) is unread
    const isUnread = (url: string) => url.includes('/pull/1')

    const result = findNextUnread(prs, 4, isUnread)
    expect(result).toBe(0) // Wraps to beginning
  })

  it('uses both html_url and updated_at for isUnread check', () => {
    let calledWith: Array<{ url: string; updatedAt: string }> = []
    const isUnread = (url: string, updatedAt: string) => {
      calledWith = [...calledWith, { url, updatedAt }]
      return url.includes('/pull/2')
    }

    findNextUnread(prs, 0, isUnread)

    // Should be called with the html_url and updated_at from each PR
    expect(calledWith[0]!.url).toBe('https://github.com/o/r/pull/2')
    expect(calledWith[0]!.updatedAt).toBe('2024-01-02T00:00:00Z')
  })
})
