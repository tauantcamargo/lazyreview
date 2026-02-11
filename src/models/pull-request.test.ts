import { describe, it, expect } from 'vitest'
import { Schema as S } from 'effect'
import { PullRequest, Label, BranchRef } from './pull-request'

const validUser = {
  login: 'octocat',
  id: 1,
  avatar_url: 'https://avatars.githubusercontent.com/u/1',
  html_url: 'https://github.com/octocat',
}

const validPR = {
  id: 1,
  number: 42,
  title: 'Fix bug',
  state: 'open' as const,
  user: validUser,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  html_url: 'https://github.com/owner/repo/pull/42',
}

describe('PullRequest schema', () => {
  const decode = S.decodeUnknownSync(PullRequest)

  it('decodes a valid minimal pull request', () => {
    const result = decode(validPR)
    expect(result.id).toBe(1)
    expect(result.number).toBe(42)
    expect(result.title).toBe('Fix bug')
    expect(result.state).toBe('open')
    expect(result.draft).toBe(false)
    expect(result.merged).toBe(false)
    expect(result.labels).toEqual([])
  })

  it('decodes a pull request with all optional fields', () => {
    const full = {
      ...validPR,
      body: 'This fixes the bug',
      draft: true,
      merged: false,
      labels: [{ id: 1, name: 'bug', color: 'ff0000' }],
      merged_at: null,
      closed_at: null,
      head: { ref: 'feature', sha: 'abc123' },
      base: { ref: 'main', sha: 'def456' },
      additions: 10,
      deletions: 5,
      changed_files: 3,
      comments: 2,
      review_comments: 1,
      requested_reviewers: [validUser],
      mergeable: true,
      mergeable_state: 'clean',
      merge_commit_sha: 'sha123',
    }

    const result = decode(full)
    expect(result.draft).toBe(true)
    expect(result.body).toBe('This fixes the bug')
    expect(result.labels).toHaveLength(1)
    expect(result.head.ref).toBe('feature')
    expect(result.mergeable).toBe(true)
    expect(result.mergeable_state).toBe('clean')
  })

  it('rejects invalid state', () => {
    expect(() => decode({ ...validPR, state: 'merged' })).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => decode({ id: 1 })).toThrow()
  })

  it('rejects non-number id', () => {
    expect(() => decode({ ...validPR, id: 'not-a-number' })).toThrow()
  })

  it('defaults assignees to empty array', () => {
    const result = decode(validPR)
    expect(result.assignees).toEqual([])
  })

  it('decodes assignees when provided', () => {
    const result = decode({
      ...validPR,
      assignees: [validUser, { ...validUser, login: 'reviewer1', id: 2 }],
    })
    expect(result.assignees).toHaveLength(2)
    expect(result.assignees[0].login).toBe('octocat')
    expect(result.assignees[1].login).toBe('reviewer1')
  })
})

describe('Label schema', () => {
  const decode = S.decodeUnknownSync(Label)

  it('decodes a valid label', () => {
    const result = decode({ id: 1, name: 'bug', color: 'ff0000' })
    expect(result.name).toBe('bug')
    expect(result.description).toBeNull()
  })

  it('decodes a label with description', () => {
    const result = decode({ id: 1, name: 'bug', color: 'ff0000', description: 'A bug' })
    expect(result.description).toBe('A bug')
  })
})

describe('BranchRef schema', () => {
  const decode = S.decodeUnknownSync(BranchRef)

  it('decodes a valid branch ref', () => {
    const result = decode({ ref: 'main', sha: 'abc123' })
    expect(result.ref).toBe('main')
    expect(result.sha).toBe('abc123')
  })

  it('defaults to empty strings', () => {
    const result = decode({})
    expect(result.ref).toBe('')
    expect(result.sha).toBe('')
  })
})
