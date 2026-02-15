import { describe, it, expect } from 'vitest'
import {
  TeamMemberSchema,
  TeamConfigSchema,
  buildTeamMemberKey,
  isAuthoredBy,
  isReviewRequestedFrom,
  type TeamMember,
} from './team'
import { Schema as S } from 'effect'
import { PullRequest, BranchRef } from './pull-request'
import { User } from './user'

function makeUser(login: string): User {
  return new User({
    login,
    id: 1,
    avatar_url: 'https://example.com/avatar.png',
    html_url: `https://github.com/${login}`,
  })
}

function makePR(overrides: {
  readonly user?: User
  readonly requested_reviewers?: readonly User[]
}): PullRequest {
  return new PullRequest({
    id: 1,
    number: 42,
    title: 'Test PR',
    state: 'open',
    user: overrides.user ?? makeUser('author'),
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    html_url: 'https://github.com/owner/repo/pull/42',
    requested_reviewers: overrides.requested_reviewers ?? [],
  })
}

describe('Team model', () => {
  describe('TeamMemberSchema', () => {
    it('should validate a member with username only', () => {
      const result = TeamMemberSchema.safeParse({ username: 'alice' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.username).toBe('alice')
        expect(result.data.provider).toBeUndefined()
      }
    })

    it('should validate a member with username and provider', () => {
      const result = TeamMemberSchema.safeParse({
        username: 'bob',
        provider: 'github',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.username).toBe('bob')
        expect(result.data.provider).toBe('github')
      }
    })

    it('should accept all valid provider values', () => {
      const providers = ['github', 'gitlab', 'bitbucket', 'azure', 'gitea'] as const
      for (const provider of providers) {
        const result = TeamMemberSchema.safeParse({ username: 'user', provider })
        expect(result.success).toBe(true)
      }
    })

    it('should reject an invalid provider', () => {
      const result = TeamMemberSchema.safeParse({
        username: 'alice',
        provider: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing username', () => {
      const result = TeamMemberSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject empty username', () => {
      const result = TeamMemberSchema.safeParse({ username: '' })
      expect(result.success).toBe(false)
    })

    it('should reject non-string username', () => {
      const result = TeamMemberSchema.safeParse({ username: 123 })
      expect(result.success).toBe(false)
    })
  })

  describe('TeamConfigSchema', () => {
    it('should validate a config with empty members', () => {
      const result = TeamConfigSchema.safeParse({ members: [] })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.members).toEqual([])
      }
    })

    it('should validate a config with multiple members', () => {
      const result = TeamConfigSchema.safeParse({
        members: [
          { username: 'alice', provider: 'github' },
          { username: 'bob' },
        ],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.members).toHaveLength(2)
      }
    })

    it('should reject config without members field', () => {
      const result = TeamConfigSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('buildTeamMemberKey', () => {
    it('should build key from username only', () => {
      const member: TeamMember = { username: 'alice' }
      expect(buildTeamMemberKey(member)).toBe('alice')
    })

    it('should build key from username and provider', () => {
      const member: TeamMember = { username: 'alice', provider: 'gitlab' }
      expect(buildTeamMemberKey(member)).toBe('gitlab:alice')
    })

    it('should produce unique keys for same user on different providers', () => {
      const ghMember: TeamMember = { username: 'alice', provider: 'github' }
      const glMember: TeamMember = { username: 'alice', provider: 'gitlab' }
      expect(buildTeamMemberKey(ghMember)).not.toBe(buildTeamMemberKey(glMember))
    })
  })

  describe('isAuthoredBy', () => {
    it('should return true when PR author matches member username', () => {
      const pr = makePR({ user: makeUser('alice') })
      const member: TeamMember = { username: 'alice' }
      expect(isAuthoredBy(pr, member)).toBe(true)
    })

    it('should return false when PR author does not match', () => {
      const pr = makePR({ user: makeUser('bob') })
      const member: TeamMember = { username: 'alice' }
      expect(isAuthoredBy(pr, member)).toBe(false)
    })

    it('should be case-insensitive', () => {
      const pr = makePR({ user: makeUser('Alice') })
      const member: TeamMember = { username: 'alice' }
      expect(isAuthoredBy(pr, member)).toBe(true)
    })
  })

  describe('isReviewRequestedFrom', () => {
    it('should return true when member is in requested reviewers', () => {
      const pr = makePR({
        requested_reviewers: [makeUser('alice'), makeUser('charlie')],
      })
      const member: TeamMember = { username: 'alice' }
      expect(isReviewRequestedFrom(pr, member)).toBe(true)
    })

    it('should return false when member is not in requested reviewers', () => {
      const pr = makePR({
        requested_reviewers: [makeUser('bob')],
      })
      const member: TeamMember = { username: 'alice' }
      expect(isReviewRequestedFrom(pr, member)).toBe(false)
    })

    it('should return false when there are no requested reviewers', () => {
      const pr = makePR({ requested_reviewers: [] })
      const member: TeamMember = { username: 'alice' }
      expect(isReviewRequestedFrom(pr, member)).toBe(false)
    })

    it('should be case-insensitive', () => {
      const pr = makePR({
        requested_reviewers: [makeUser('Alice')],
      })
      const member: TeamMember = { username: 'alice' }
      expect(isReviewRequestedFrom(pr, member)).toBe(true)
    })
  })
})
