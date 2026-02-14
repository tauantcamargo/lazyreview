import { describe, it, expect } from 'vitest'
import {
  GiteaUserSchema,
  GiteaLabelSchema,
  GiteaBranchRefSchema,
  GiteaPullRequestSchema,
} from './pull-request'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validUser = {
  id: 1,
  login: 'janedoe',
  full_name: 'Jane Doe',
  avatar_url: 'https://gitea.example.com/avatars/1',
}

const validBranchRef = {
  label: 'janedoe:feature',
  ref: 'feature',
  sha: 'abc123def456',
}

const minimalPR = {
  number: 42,
  title: 'Add dark mode',
  body: 'Implements dark mode toggle',
  state: 'open' as const,
  user: validUser,
  head: { ...validBranchRef, label: 'janedoe:feature', ref: 'feature' },
  base: { ...validBranchRef, label: 'main', ref: 'main', sha: 'def456abc' },
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-16T12:00:00Z',
}

// ---------------------------------------------------------------------------
// GiteaUserSchema
// ---------------------------------------------------------------------------

describe('GiteaUserSchema', () => {
  it('parses a fully-populated user', () => {
    const result = GiteaUserSchema.parse(validUser)
    expect(result.id).toBe(1)
    expect(result.login).toBe('janedoe')
    expect(result.full_name).toBe('Jane Doe')
    expect(result.avatar_url).toBe('https://gitea.example.com/avatars/1')
  })

  it('parses a minimal user (only required fields)', () => {
    const result = GiteaUserSchema.parse({ id: 2, login: 'john' })
    expect(result.id).toBe(2)
    expect(result.login).toBe('john')
    expect(result.full_name).toBe('')
    expect(result.avatar_url).toBe('')
  })

  it('rejects missing id', () => {
    expect(() => GiteaUserSchema.parse({ login: 'test' })).toThrow()
  })

  it('rejects missing login', () => {
    expect(() => GiteaUserSchema.parse({ id: 1 })).toThrow()
  })

  it('rejects non-number id', () => {
    expect(() =>
      GiteaUserSchema.parse({ id: 'abc', login: 'test' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GiteaLabelSchema
// ---------------------------------------------------------------------------

describe('GiteaLabelSchema', () => {
  it('parses a label', () => {
    const result = GiteaLabelSchema.parse({ name: 'bug', color: 'ff0000' })
    expect(result.name).toBe('bug')
    expect(result.color).toBe('ff0000')
  })

  it('rejects missing name', () => {
    expect(() => GiteaLabelSchema.parse({ color: 'ff0000' })).toThrow()
  })

  it('rejects missing color', () => {
    expect(() => GiteaLabelSchema.parse({ name: 'bug' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GiteaBranchRefSchema
// ---------------------------------------------------------------------------

describe('GiteaBranchRefSchema', () => {
  it('parses a full branch ref', () => {
    const result = GiteaBranchRefSchema.parse({
      ...validBranchRef,
      repo: { full_name: 'janedoe/repo' },
    })
    expect(result.label).toBe('janedoe:feature')
    expect(result.ref).toBe('feature')
    expect(result.sha).toBe('abc123def456')
    expect(result.repo?.full_name).toBe('janedoe/repo')
  })

  it('parses without optional repo', () => {
    const result = GiteaBranchRefSchema.parse(validBranchRef)
    expect(result.repo).toBeUndefined()
  })

  it('rejects missing ref', () => {
    expect(() =>
      GiteaBranchRefSchema.parse({ label: 'test', sha: 'abc' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GiteaPullRequestSchema
// ---------------------------------------------------------------------------

describe('GiteaPullRequestSchema', () => {
  it('parses a minimal pull request', () => {
    const result = GiteaPullRequestSchema.parse(minimalPR)
    expect(result.number).toBe(42)
    expect(result.title).toBe('Add dark mode')
    expect(result.body).toBe('Implements dark mode toggle')
    expect(result.state).toBe('open')
    expect(result.head.ref).toBe('feature')
    expect(result.base.ref).toBe('main')
  })

  it('defaults optional fields', () => {
    const result = GiteaPullRequestSchema.parse(minimalPR)
    expect(result.is_locked).toBe(false)
    expect(result.labels).toEqual([])
    expect(result.assignees).toEqual([])
    expect(result.requested_reviewers).toEqual([])
    expect(result.merged).toBe(false)
    expect(result.html_url).toBe('')
    expect(result.diff_url).toBe('')
    expect(result.comments).toBe(0)
  })

  it('parses a fully-populated pull request', () => {
    const fullPR = {
      ...minimalPR,
      state: 'closed' as const,
      is_locked: true,
      labels: [{ name: 'enhancement', color: '00ff00' }],
      assignees: [validUser],
      requested_reviewers: [validUser],
      merged: true,
      merged_by: validUser,
      merge_base: 'base123',
      mergeable: true,
      html_url: 'https://gitea.example.com/janedoe/repo/pulls/42',
      diff_url: 'https://gitea.example.com/janedoe/repo/pulls/42.diff',
      comments: 5,
    }

    const result = GiteaPullRequestSchema.parse(fullPR)
    expect(result.state).toBe('closed')
    expect(result.is_locked).toBe(true)
    expect(result.labels).toHaveLength(1)
    expect(result.labels[0]?.name).toBe('enhancement')
    expect(result.assignees).toHaveLength(1)
    expect(result.requested_reviewers).toHaveLength(1)
    expect(result.merged).toBe(true)
    expect(result.merged_by?.login).toBe('janedoe')
    expect(result.mergeable).toBe(true)
    expect(result.comments).toBe(5)
  })

  it('accepts null body', () => {
    const result = GiteaPullRequestSchema.parse({
      ...minimalPR,
      body: null,
    })
    // Zod nullable().default('') only defaults on undefined, null passes through
    expect(result.body).toBeNull()
  })

  it('parses both valid states', () => {
    for (const state of ['open', 'closed'] as const) {
      const result = GiteaPullRequestSchema.parse({ ...minimalPR, state })
      expect(result.state).toBe(state)
    }
  })

  it('rejects invalid state', () => {
    expect(() =>
      GiteaPullRequestSchema.parse({ ...minimalPR, state: 'merged' }),
    ).toThrow()
  })

  it('rejects missing title', () => {
    const { title: _, ...noTitle } = minimalPR
    expect(() => GiteaPullRequestSchema.parse(noTitle)).toThrow()
  })

  it('rejects missing user', () => {
    const { user: _, ...noUser } = minimalPR
    expect(() => GiteaPullRequestSchema.parse(noUser)).toThrow()
  })

  it('rejects missing head', () => {
    const { head: _, ...noHead } = minimalPR
    expect(() => GiteaPullRequestSchema.parse(noHead)).toThrow()
  })

  it('rejects missing base', () => {
    const { base: _, ...noBase } = minimalPR
    expect(() => GiteaPullRequestSchema.parse(noBase)).toThrow()
  })
})
