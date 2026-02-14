import { describe, it, expect } from 'vitest'
import {
  BitbucketUserSchema,
  BitbucketParticipantSchema,
  BitbucketPullRequestSchema,
} from './pull-request'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validUser = {
  display_name: 'Jane Doe',
  uuid: '{abc-123-def}',
  nickname: 'janedoe',
  account_id: '12345',
  links: {
    avatar: { href: 'https://bitbucket.org/account/janedoe/avatar' },
  },
}

const validParticipant = {
  user: validUser,
  role: 'REVIEWER' as const,
  approved: true,
  state: 'approved' as const,
}

const minimalPR = {
  id: 42,
  title: 'Add dark mode',
  description: 'Implements dark mode toggle',
  state: 'OPEN' as const,
  author: validUser,
  source: {
    branch: { name: 'feature/dark-mode' },
    commit: { hash: 'abc123' },
  },
  destination: {
    branch: { name: 'main' },
    commit: { hash: 'def456' },
  },
  created_on: '2026-01-15T10:00:00Z',
  updated_on: '2026-01-16T12:00:00Z',
  links: {
    html: { href: 'https://bitbucket.org/team/repo/pull-requests/42' },
  },
}

// ---------------------------------------------------------------------------
// BitbucketUserSchema
// ---------------------------------------------------------------------------

describe('BitbucketUserSchema', () => {
  it('parses a fully-populated user', () => {
    const result = BitbucketUserSchema.parse(validUser)
    expect(result.display_name).toBe('Jane Doe')
    expect(result.uuid).toBe('{abc-123-def}')
    expect(result.nickname).toBe('janedoe')
    expect(result.account_id).toBe('12345')
    expect(result.links?.avatar?.href).toBe(
      'https://bitbucket.org/account/janedoe/avatar',
    )
  })

  it('parses a minimal user (only required fields)', () => {
    const result = BitbucketUserSchema.parse({
      display_name: 'John',
      uuid: '{uuid-1}',
    })
    expect(result.display_name).toBe('John')
    expect(result.uuid).toBe('{uuid-1}')
    expect(result.nickname).toBeUndefined()
    expect(result.account_id).toBeUndefined()
    expect(result.links).toBeUndefined()
  })

  it('parses a user with links but no avatar', () => {
    const result = BitbucketUserSchema.parse({
      ...validUser,
      links: {},
    })
    expect(result.links?.avatar).toBeUndefined()
  })

  it('rejects missing display_name', () => {
    const { display_name: _, ...noName } = validUser
    expect(() => BitbucketUserSchema.parse(noName)).toThrow()
  })

  it('rejects missing uuid', () => {
    const { uuid: _, ...noUuid } = validUser
    expect(() => BitbucketUserSchema.parse(noUuid)).toThrow()
  })

  it('rejects non-string display_name', () => {
    expect(() =>
      BitbucketUserSchema.parse({ ...validUser, display_name: 123 }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// BitbucketParticipantSchema
// ---------------------------------------------------------------------------

describe('BitbucketParticipantSchema', () => {
  it('parses an approved reviewer', () => {
    const result = BitbucketParticipantSchema.parse(validParticipant)
    expect(result.role).toBe('REVIEWER')
    expect(result.approved).toBe(true)
    expect(result.state).toBe('approved')
  })

  it('parses a participant with changes_requested state', () => {
    const result = BitbucketParticipantSchema.parse({
      ...validParticipant,
      approved: false,
      state: 'changes_requested',
    })
    expect(result.approved).toBe(false)
    expect(result.state).toBe('changes_requested')
  })

  it('parses a participant with null state', () => {
    const result = BitbucketParticipantSchema.parse({
      ...validParticipant,
      approved: false,
      state: null,
    })
    expect(result.state).toBeNull()
  })

  it('parses a participant without state field', () => {
    const { state: _, ...noState } = validParticipant
    const result = BitbucketParticipantSchema.parse(noState)
    expect(result.state).toBeUndefined()
  })

  it('parses all valid roles', () => {
    const roles = ['PARTICIPANT', 'REVIEWER', 'AUTHOR'] as const
    for (const role of roles) {
      const result = BitbucketParticipantSchema.parse({
        ...validParticipant,
        role,
      })
      expect(result.role).toBe(role)
    }
  })

  it('rejects invalid role', () => {
    expect(() =>
      BitbucketParticipantSchema.parse({
        ...validParticipant,
        role: 'ADMIN',
      }),
    ).toThrow()
  })

  it('rejects missing approved field', () => {
    const { approved: _, ...noApproved } = validParticipant
    expect(() => BitbucketParticipantSchema.parse(noApproved)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// BitbucketPullRequestSchema
// ---------------------------------------------------------------------------

describe('BitbucketPullRequestSchema', () => {
  it('parses a minimal pull request', () => {
    const result = BitbucketPullRequestSchema.parse(minimalPR)
    expect(result.id).toBe(42)
    expect(result.title).toBe('Add dark mode')
    expect(result.description).toBe('Implements dark mode toggle')
    expect(result.state).toBe('OPEN')
    expect(result.source.branch.name).toBe('feature/dark-mode')
    expect(result.source.commit.hash).toBe('abc123')
    expect(result.destination.branch.name).toBe('main')
    expect(result.destination.commit.hash).toBe('def456')
  })

  it('defaults optional fields', () => {
    const result = BitbucketPullRequestSchema.parse(minimalPR)
    expect(result.reviewers).toEqual([])
    expect(result.participants).toEqual([])
    expect(result.comment_count).toBe(0)
    expect(result.task_count).toBe(0)
  })

  it('parses a fully-populated pull request', () => {
    const fullPR = {
      ...minimalPR,
      state: 'MERGED' as const,
      reviewers: [validUser],
      participants: [validParticipant],
      close_source_branch: true,
      merge_commit: { hash: 'merged123' },
      comment_count: 5,
      task_count: 2,
      links: {
        html: { href: 'https://bitbucket.org/team/repo/pull-requests/42' },
        diff: {
          href: 'https://bitbucket.org/team/repo/pull-requests/42/diff',
        },
      },
      source: {
        ...minimalPR.source,
        repository: { full_name: 'team/repo' },
      },
    }

    const result = BitbucketPullRequestSchema.parse(fullPR)
    expect(result.state).toBe('MERGED')
    expect(result.reviewers).toHaveLength(1)
    expect(result.participants).toHaveLength(1)
    expect(result.close_source_branch).toBe(true)
    expect(result.merge_commit?.hash).toBe('merged123')
    expect(result.comment_count).toBe(5)
    expect(result.task_count).toBe(2)
    expect(result.links.diff?.href).toContain('/diff')
    expect(result.source.repository?.full_name).toBe('team/repo')
  })

  it('defaults null description to empty string', () => {
    const result = BitbucketPullRequestSchema.parse({
      ...minimalPR,
      description: null,
    })
    expect(result.description).toBe('')
  })

  it('accepts null merge_commit', () => {
    const result = BitbucketPullRequestSchema.parse({
      ...minimalPR,
      merge_commit: null,
    })
    expect(result.merge_commit).toBeNull()
  })

  it('parses all valid states', () => {
    const states = ['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED'] as const
    for (const state of states) {
      const result = BitbucketPullRequestSchema.parse({
        ...minimalPR,
        state,
      })
      expect(result.state).toBe(state)
    }
  })

  it('rejects invalid state', () => {
    expect(() =>
      BitbucketPullRequestSchema.parse({ ...minimalPR, state: 'open' }),
    ).toThrow()
  })

  it('rejects missing title', () => {
    const { title: _, ...noTitle } = minimalPR
    expect(() => BitbucketPullRequestSchema.parse(noTitle)).toThrow()
  })

  it('rejects missing author', () => {
    const { author: _, ...noAuthor } = minimalPR
    expect(() => BitbucketPullRequestSchema.parse(noAuthor)).toThrow()
  })

  it('rejects missing source', () => {
    const { source: _, ...noSource } = minimalPR
    expect(() => BitbucketPullRequestSchema.parse(noSource)).toThrow()
  })

  it('rejects missing links.html', () => {
    expect(() =>
      BitbucketPullRequestSchema.parse({ ...minimalPR, links: {} }),
    ).toThrow()
  })
})
