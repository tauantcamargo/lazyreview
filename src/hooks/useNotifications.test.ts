import { describe, it, expect } from 'vitest'
import {
  detectNewPRs,
  detectUpdatedPRs,
  detectNewReviewRequests,
  buildSnapshotMap,
} from './useNotifications'
import type { PullRequest } from '../models/pull-request'

function makePR(overrides: Partial<PullRequest> & { number: number }): PullRequest {
  return {
    id: overrides.number,
    node_id: '',
    number: overrides.number,
    title: overrides.title ?? `PR #${overrides.number}`,
    body: null,
    state: 'open',
    draft: false,
    merged: false,
    user: {
      login: overrides.user?.login ?? 'author',
      id: 1,
      avatar_url: '',
      html_url: '',
      type: 'User',
    },
    labels: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: overrides.updated_at ?? '2026-01-01T00:00:00Z',
    merged_at: null,
    closed_at: null,
    html_url: `https://github.com/owner/repo/pull/${overrides.number}`,
    head: { ref: 'main', sha: 'abc', label: undefined },
    base: { ref: 'main', sha: 'def', label: undefined },
    additions: 0,
    deletions: 0,
    changed_files: 0,
    comments: 0,
    review_comments: 0,
    requested_reviewers: overrides.requested_reviewers ?? [],
    assignees: [],
    mergeable: null,
    mergeable_state: null,
    merge_commit_sha: null,
  } as unknown as PullRequest
}

describe('buildSnapshotMap', () => {
  it('builds a map from PR list', () => {
    const prs = [
      makePR({ number: 1, updated_at: '2026-01-01T00:00:00Z' }),
      makePR({ number: 2, updated_at: '2026-01-02T00:00:00Z' }),
    ]

    const map = buildSnapshotMap(prs)
    expect(map.size).toBe(2)
    expect(map.get(1)?.updated_at).toBe('2026-01-01T00:00:00Z')
    expect(map.get(2)?.updated_at).toBe('2026-01-02T00:00:00Z')
  })

  it('returns empty map for empty list', () => {
    const map = buildSnapshotMap([])
    expect(map.size).toBe(0)
  })

  it('extracts requested reviewer logins', () => {
    const prs = [
      makePR({
        number: 1,
        requested_reviewers: [
          { login: 'reviewer1', id: 2, avatar_url: '', html_url: '', type: 'User' },
        ] as PullRequest['requested_reviewers'],
      }),
    ]

    const map = buildSnapshotMap(prs)
    expect(map.get(1)?.requested_reviewers).toEqual(['reviewer1'])
  })
})

describe('detectNewPRs', () => {
  it('returns empty array when previousMap is empty (initial load)', () => {
    const prs = [makePR({ number: 1 })]
    const prevMap = new Map()

    const result = detectNewPRs(prs, prevMap)
    expect(result).toEqual([])
  })

  it('detects a new PR not in the previous snapshot', () => {
    const pr1 = makePR({ number: 1 })
    const pr2 = makePR({ number: 2 })
    const prevMap = buildSnapshotMap([pr1])

    const result = detectNewPRs([pr1, pr2], prevMap)
    expect(result).toHaveLength(1)
    expect(result[0]?.number).toBe(2)
  })

  it('returns empty array when no new PRs', () => {
    const pr1 = makePR({ number: 1 })
    const prevMap = buildSnapshotMap([pr1])

    const result = detectNewPRs([pr1], prevMap)
    expect(result).toEqual([])
  })

  it('detects multiple new PRs', () => {
    const pr1 = makePR({ number: 1 })
    const pr2 = makePR({ number: 2 })
    const pr3 = makePR({ number: 3 })
    const prevMap = buildSnapshotMap([pr1])

    const result = detectNewPRs([pr1, pr2, pr3], prevMap)
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.number)).toEqual([2, 3])
  })
})

describe('detectUpdatedPRs', () => {
  it('returns empty array when previousMap is empty (initial load)', () => {
    const prs = [makePR({ number: 1, updated_at: '2026-01-02T00:00:00Z' })]
    const prevMap = new Map()

    const result = detectUpdatedPRs(prs, prevMap)
    expect(result).toEqual([])
  })

  it('detects a PR that was updated', () => {
    const pr1Old = makePR({ number: 1, updated_at: '2026-01-01T00:00:00Z' })
    const pr1New = makePR({ number: 1, updated_at: '2026-01-02T00:00:00Z' })
    const prevMap = buildSnapshotMap([pr1Old])

    const result = detectUpdatedPRs([pr1New], prevMap)
    expect(result).toHaveLength(1)
    expect(result[0]?.number).toBe(1)
  })

  it('returns empty when PR has same updated_at', () => {
    const pr1 = makePR({ number: 1, updated_at: '2026-01-01T00:00:00Z' })
    const prevMap = buildSnapshotMap([pr1])

    const result = detectUpdatedPRs([pr1], prevMap)
    expect(result).toEqual([])
  })

  it('does not report new PRs as updated', () => {
    const pr1 = makePR({ number: 1 })
    const pr2 = makePR({ number: 2 })
    const prevMap = buildSnapshotMap([pr1])

    const result = detectUpdatedPRs([pr1, pr2], prevMap)
    expect(result).toEqual([])
  })

  it('detects multiple updated PRs', () => {
    const pr1Old = makePR({ number: 1, updated_at: '2026-01-01T00:00:00Z' })
    const pr2Old = makePR({ number: 2, updated_at: '2026-01-01T00:00:00Z' })
    const pr1New = makePR({ number: 1, updated_at: '2026-01-02T00:00:00Z' })
    const pr2New = makePR({ number: 2, updated_at: '2026-01-02T00:00:00Z' })
    const prevMap = buildSnapshotMap([pr1Old, pr2Old])

    const result = detectUpdatedPRs([pr1New, pr2New], prevMap)
    expect(result).toHaveLength(2)
  })
})

describe('detectNewReviewRequests', () => {
  it('returns empty array when previousMap is empty (initial load)', () => {
    const prs = [
      makePR({
        number: 1,
        requested_reviewers: [
          { login: 'me', id: 2, avatar_url: '', html_url: '', type: 'User' },
        ] as PullRequest['requested_reviewers'],
      }),
    ]
    const prevMap = new Map()

    const result = detectNewReviewRequests(prs, prevMap, 'me')
    expect(result).toEqual([])
  })

  it('returns empty array when currentUserLogin is undefined', () => {
    const pr1 = makePR({ number: 1 })
    const prevMap = buildSnapshotMap([pr1])

    const result = detectNewReviewRequests([pr1], prevMap, undefined)
    expect(result).toEqual([])
  })

  it('detects when user is newly added as reviewer', () => {
    const pr1Before = makePR({ number: 1, requested_reviewers: [] })
    const pr1After = makePR({
      number: 1,
      requested_reviewers: [
        { login: 'me', id: 2, avatar_url: '', html_url: '', type: 'User' },
      ] as PullRequest['requested_reviewers'],
    })
    const prevMap = buildSnapshotMap([pr1Before])

    const result = detectNewReviewRequests([pr1After], prevMap, 'me')
    expect(result).toHaveLength(1)
    expect(result[0]?.number).toBe(1)
  })

  it('does not notify when user was already a reviewer', () => {
    const pr1 = makePR({
      number: 1,
      requested_reviewers: [
        { login: 'me', id: 2, avatar_url: '', html_url: '', type: 'User' },
      ] as PullRequest['requested_reviewers'],
    })
    const prevMap = buildSnapshotMap([pr1])

    const result = detectNewReviewRequests([pr1], prevMap, 'me')
    expect(result).toEqual([])
  })

  it('does not flag other users being added as reviewers', () => {
    const pr1Before = makePR({ number: 1, requested_reviewers: [] })
    const pr1After = makePR({
      number: 1,
      requested_reviewers: [
        { login: 'other-user', id: 3, avatar_url: '', html_url: '', type: 'User' },
      ] as PullRequest['requested_reviewers'],
    })
    const prevMap = buildSnapshotMap([pr1Before])

    const result = detectNewReviewRequests([pr1After], prevMap, 'me')
    expect(result).toEqual([])
  })

  it('does not flag new PRs as review requests', () => {
    const pr1 = makePR({ number: 1 })
    const pr2 = makePR({
      number: 2,
      requested_reviewers: [
        { login: 'me', id: 2, avatar_url: '', html_url: '', type: 'User' },
      ] as PullRequest['requested_reviewers'],
    })
    const prevMap = buildSnapshotMap([pr1])

    const result = detectNewReviewRequests([pr1, pr2], prevMap, 'me')
    expect(result).toEqual([])
  })
})
