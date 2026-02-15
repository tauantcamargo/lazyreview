import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { ThemeProvider, defaultTheme } from '../theme/index'
import { TeamDashboardScreen } from './TeamDashboardScreen'
import type { TeamMember } from '../models/team'
import { PullRequest } from '../models/pull-request'
import { User } from '../models/user'

function themed(el: React.ReactElement) {
  return <ThemeProvider theme={defaultTheme}>{el}</ThemeProvider>
}

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
    id: Math.random() * 10000,
    number: Math.floor(Math.random() * 1000),
    title: 'Test PR',
    state: 'open',
    user: overrides.user ?? makeUser('author'),
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    html_url: 'https://github.com/owner/repo/pull/1',
    requested_reviewers: overrides.requested_reviewers ?? [],
  })
}

describe('TeamDashboardScreen', () => {
  it('renders empty state when no members configured', () => {
    const { lastFrame } = render(
      themed(
        <TeamDashboardScreen
          isActive={true}
          members={[]}
          prs={[]}
          onBack={vi.fn()}
          onSelectMember={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('No team configured')
    expect(frame).toContain('config.yaml')
  })

  it('renders team dashboard header with totals', () => {
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const prs = [
      makePR({ user: makeUser('alice') }),
      makePR({
        user: makeUser('bob'),
        requested_reviewers: [makeUser('alice')],
      }),
    ]
    const { lastFrame } = render(
      themed(
        <TeamDashboardScreen
          isActive={true}
          members={members}
          prs={prs}
          onBack={vi.fn()}
          onSelectMember={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Team Dashboard')
    expect(frame).toContain('2 open')
    expect(frame).toContain('1 pending reviews')
  })

  it('renders column headers', () => {
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const { lastFrame } = render(
      themed(
        <TeamDashboardScreen
          isActive={true}
          members={members}
          prs={[]}
          onBack={vi.fn()}
          onSelectMember={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Username')
    expect(frame).toContain('Authored')
    expect(frame).toContain('Reviews Pending')
  })

  it('renders member rows with stats', () => {
    const members: readonly TeamMember[] = [
      { username: 'alice' },
      { username: 'bob' },
    ]
    const prs = [
      makePR({ user: makeUser('alice'), requested_reviewers: [makeUser('bob')] }),
      makePR({ user: makeUser('alice') }),
    ]
    const { lastFrame } = render(
      themed(
        <TeamDashboardScreen
          isActive={true}
          members={members}
          prs={prs}
          onBack={vi.fn()}
          onSelectMember={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('alice')
    expect(frame).toContain('bob')
  })

  it('shows hint text at the bottom', () => {
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const { lastFrame } = render(
      themed(
        <TeamDashboardScreen
          isActive={true}
          members={members}
          prs={[]}
          onBack={vi.fn()}
          onSelectMember={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('j/k: navigate')
    expect(frame).toContain('Enter: view member PRs')
    expect(frame).toContain('Escape: back')
  })

  it('shows selection indicator for first member', () => {
    const members: readonly TeamMember[] = [
      { username: 'alice' },
      { username: 'bob' },
    ]
    const { lastFrame } = render(
      themed(
        <TeamDashboardScreen
          isActive={true}
          members={members}
          prs={[]}
          onBack={vi.fn()}
          onSelectMember={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    // First item should have ">" indicator
    expect(frame).toContain('> ')
  })

  it('calls onBack when Escape is pressed', () => {
    const onBack = vi.fn()
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const { stdin } = render(
      themed(
        <TeamDashboardScreen
          isActive={true}
          members={members}
          prs={[]}
          onBack={onBack}
          onSelectMember={vi.fn()}
        />,
      ),
    )
    stdin.write('\x1B')
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('calls onSelectMember when Enter is pressed on a member', () => {
    const onSelectMember = vi.fn()
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const { stdin } = render(
      themed(
        <TeamDashboardScreen
          isActive={true}
          members={members}
          prs={[]}
          onBack={vi.fn()}
          onSelectMember={onSelectMember}
        />,
      ),
    )
    stdin.write('\r')
    expect(onSelectMember).toHaveBeenCalledWith('alice')
  })

  it('renders multiple members in order', () => {
    const members: readonly TeamMember[] = [
      { username: 'charlie' },
      { username: 'alice' },
      { username: 'bob' },
    ]
    const { lastFrame } = render(
      themed(
        <TeamDashboardScreen
          isActive={true}
          members={members}
          prs={[]}
          onBack={vi.fn()}
          onSelectMember={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    const charliePos = frame.indexOf('charlie')
    const alicePos = frame.indexOf('alice')
    const bobPos = frame.indexOf('bob')
    expect(charliePos).toBeLessThan(alicePos)
    expect(alicePos).toBeLessThan(bobPos)
  })

  it('does not call onSelectMember when isActive is false', () => {
    const onSelectMember = vi.fn()
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const { stdin } = render(
      themed(
        <TeamDashboardScreen
          isActive={false}
          members={members}
          prs={[]}
          onBack={vi.fn()}
          onSelectMember={onSelectMember}
        />,
      ),
    )
    stdin.write('\r')
    expect(onSelectMember).not.toHaveBeenCalled()
  })

  it('renders with zero stats correctly', () => {
    const members: readonly TeamMember[] = [{ username: 'alice' }]
    const { lastFrame } = render(
      themed(
        <TeamDashboardScreen
          isActive={true}
          members={members}
          prs={[]}
          onBack={vi.fn()}
          onSelectMember={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('0 open')
    expect(frame).toContain('0 pending')
  })
})
