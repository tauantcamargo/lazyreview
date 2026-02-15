import { describe, it, expect } from 'vitest'
import {
  computeTeamDashboard,
  type MemberStat,
  type TeamDashboardResult,
} from './useTeamDashboard'
import type { TeamMember } from '../models/team'
import { PullRequest } from '../models/pull-request'
import { User } from '../models/user'

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
  readonly state?: 'open' | 'closed'
}): PullRequest {
  return new PullRequest({
    id: Math.random() * 10000,
    number: Math.floor(Math.random() * 1000),
    title: 'Test PR',
    state: overrides.state ?? 'open',
    user: overrides.user ?? makeUser('author'),
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    html_url: 'https://github.com/owner/repo/pull/1',
    requested_reviewers: overrides.requested_reviewers ?? [],
  })
}

describe('computeTeamDashboard', () => {
  it('should return empty stats for empty members', () => {
    const result = computeTeamDashboard([], [])
    expect(result.memberStats).toEqual([])
    expect(result.totalOpen).toBe(0)
    expect(result.totalPending).toBe(0)
  })

  it('should return zero counts when no PRs match members', () => {
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const prs = [makePR({ user: makeUser('unrelated') })]
    const result = computeTeamDashboard(members, prs)
    expect(result.memberStats).toHaveLength(1)
    expect(result.memberStats[0]!.authoredCount).toBe(0)
    expect(result.memberStats[0]!.reviewCount).toBe(0)
  })

  it('should count authored PRs for a member', () => {
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const prs = [
      makePR({ user: makeUser('alice') }),
      makePR({ user: makeUser('alice') }),
      makePR({ user: makeUser('bob') }),
    ]
    const result = computeTeamDashboard(members, prs)
    expect(result.memberStats[0]!.authoredCount).toBe(2)
  })

  it('should count review requests for a member', () => {
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const prs = [
      makePR({ requested_reviewers: [makeUser('alice')] }),
      makePR({ requested_reviewers: [makeUser('alice'), makeUser('bob')] }),
      makePR({ requested_reviewers: [makeUser('bob')] }),
    ]
    const result = computeTeamDashboard(members, prs)
    expect(result.memberStats[0]!.reviewCount).toBe(2)
  })

  it('should compute stats for multiple members', () => {
    const members: readonly TeamMember[] = [
      { username: 'alice' },
      { username: 'bob' },
    ]
    const prs = [
      makePR({ user: makeUser('alice'), requested_reviewers: [makeUser('bob')] }),
      makePR({ user: makeUser('bob'), requested_reviewers: [makeUser('alice')] }),
    ]
    const result = computeTeamDashboard(members, prs)
    expect(result.memberStats).toHaveLength(2)

    const alice = result.memberStats.find((s) => s.member.username === 'alice')
    const bob = result.memberStats.find((s) => s.member.username === 'bob')

    expect(alice?.authoredCount).toBe(1)
    expect(alice?.reviewCount).toBe(1)
    expect(bob?.authoredCount).toBe(1)
    expect(bob?.reviewCount).toBe(1)
  })

  it('should compute totalOpen from all provided PRs', () => {
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const prs = [
      makePR({ user: makeUser('alice') }),
      makePR({ user: makeUser('bob') }),
      makePR({ user: makeUser('charlie') }),
    ]
    const result = computeTeamDashboard(members, prs)
    expect(result.totalOpen).toBe(3)
  })

  it('should compute totalPending as sum of all review counts', () => {
    const members: readonly TeamMember[] = [
      { username: 'alice' },
      { username: 'bob' },
    ]
    const prs = [
      makePR({ requested_reviewers: [makeUser('alice'), makeUser('bob')] }),
      makePR({ requested_reviewers: [makeUser('alice')] }),
    ]
    const result = computeTeamDashboard(members, prs)
    // alice=2, bob=1, total=3
    expect(result.totalPending).toBe(3)
  })

  it('should handle case-insensitive matching', () => {
    const members: readonly TeamMember[] = [{ username: 'Alice' }]
    const prs = [
      makePR({ user: makeUser('alice') }),
      makePR({ requested_reviewers: [makeUser('ALICE')] }),
    ]
    const result = computeTeamDashboard(members, prs)
    expect(result.memberStats[0]!.authoredCount).toBe(1)
    expect(result.memberStats[0]!.reviewCount).toBe(1)
  })

  it('should preserve member order in output', () => {
    const members: readonly TeamMember[] = [
      { username: 'charlie' },
      { username: 'alice' },
      { username: 'bob' },
    ]
    const result = computeTeamDashboard(members, [])
    expect(result.memberStats.map((s) => s.member.username)).toEqual([
      'charlie',
      'alice',
      'bob',
    ])
  })

  it('should not double-count when member authors and reviews same PR', () => {
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const prs = [
      makePR({
        user: makeUser('alice'),
        requested_reviewers: [makeUser('alice')],
      }),
    ]
    const result = computeTeamDashboard(members, prs)
    // authored: 1, reviewed: 1 (these are independent counts)
    expect(result.memberStats[0]!.authoredCount).toBe(1)
    expect(result.memberStats[0]!.reviewCount).toBe(1)
  })

  it('should return immutable result (does not share references with input)', () => {
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const prs = [makePR({ user: makeUser('alice') })]
    const result1 = computeTeamDashboard(members, prs)
    const result2 = computeTeamDashboard(members, prs)
    expect(result1).toEqual(result2)
    expect(result1).not.toBe(result2)
    expect(result1.memberStats).not.toBe(result2.memberStats)
  })
})
