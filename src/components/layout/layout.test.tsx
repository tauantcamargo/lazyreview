import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { ThemeProvider, defaultTheme } from '../../theme/index'
import { TopBar } from './TopBar'
import { Sidebar, SIDEBAR_ITEMS } from './Sidebar'
import { MainPanel } from './MainPanel'
import { StatusBar } from './StatusBar'

function themed(el: React.ReactElement) {
  return <ThemeProvider theme={defaultTheme}>{el}</ThemeProvider>
}

describe('TopBar', () => {
  it('renders app name and username', () => {
    const { lastFrame } = render(
      themed(<TopBar username="alice" provider="github" />),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('LazyReview')
    expect(frame).toContain('alice')
    expect(frame).toContain('github')
  })

  it('renders repo path when provided', () => {
    const { lastFrame } = render(
      themed(<TopBar username="bob" provider="github" repoPath="owner/repo" />),
    )
    expect(lastFrame()).toContain('owner/repo')
  })

  it('renders breadcrumb with screen name', () => {
    const { lastFrame } = render(
      themed(<TopBar username="alice" provider="github" screenName="For Review" />),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('LazyReview')
    expect(frame).toContain('>')
    expect(frame).toContain('For Review')
  })

  it('renders breadcrumb with PR detail', () => {
    const { lastFrame } = render(
      themed(
        <TopBar
          username="alice"
          provider="github"
          screenName="For Review"
          prNumber={42}
          prTitle="Fix auth bug"
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('LazyReview')
    expect(frame).toContain('For Review')
    expect(frame).toContain('PR #42: Fix auth bug')
  })

  it('truncates long PR titles', () => {
    const longTitle = 'A'.repeat(50)
    const { lastFrame } = render(
      themed(
        <TopBar
          username="alice"
          provider="github"
          screenName="My PRs"
          prNumber={1}
          prTitle={longTitle}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('~')
    expect(frame).not.toContain(longTitle)
  })

  it('shows connection status indicator green by default', () => {
    const { lastFrame } = render(
      themed(<TopBar username="alice" provider="github" />),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('connected')
  })

  it('shows rate-limited connection status', () => {
    const { lastFrame } = render(
      themed(<TopBar username="alice" provider="github" connectionStatus="rate-limited" />),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('rate limited')
  })

  it('shows error connection status', () => {
    const { lastFrame } = render(
      themed(<TopBar username="alice" provider="github" connectionStatus="error" />),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('disconnected')
  })
})

describe('Sidebar', () => {
  it('renders sidebar items', () => {
    const { lastFrame } = render(
      themed(<Sidebar selectedIndex={0} visible={true} isActive={true} />),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Navigation')
    expect(frame).toContain('Involved')
    expect(frame).toContain('My PRs')
    expect(frame).toContain('For Review')
    expect(frame).toContain('Settings')
  })

  it('returns null when not visible', () => {
    const { lastFrame } = render(
      themed(<Sidebar selectedIndex={0} visible={false} isActive={false} />),
    )
    expect(lastFrame()).toBe('')
  })

  it('highlights selected item', () => {
    const { lastFrame } = render(
      themed(<Sidebar selectedIndex={1} visible={true} isActive={true} />),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('My PRs')
  })

  it('renders PR counts when provided', () => {
    const counts = {
      involved: 5,
      myPrs: 3,
      forReview: 2,
      forReviewUnread: null,
      thisRepo: 10,
    }
    const { lastFrame } = render(
      themed(<Sidebar selectedIndex={0} visible={true} isActive={true} counts={counts} />),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('(5)')
    expect(frame).toContain('(3)')
    expect(frame).toContain('(2)')
    expect(frame).toContain('(10)')
  })

  it('renders unread badge for For Review', () => {
    const counts = {
      involved: 5,
      myPrs: 3,
      forReview: 4,
      forReviewUnread: 2,
      thisRepo: null,
    }
    const { lastFrame } = render(
      themed(<Sidebar selectedIndex={0} visible={true} isActive={true} counts={counts} />),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('*2 new*')
  })

  it('does not show counts when null (loading)', () => {
    const counts = {
      involved: null,
      myPrs: null,
      forReview: null,
      forReviewUnread: null,
      thisRepo: null,
    }
    const { lastFrame } = render(
      themed(<Sidebar selectedIndex={0} visible={true} isActive={true} counts={counts} />),
    )
    const frame = lastFrame() ?? ''
    expect(frame).not.toContain('(0)')
    expect(frame).not.toContain('new')
  })

  it('does not show count for Settings item', () => {
    const counts = {
      involved: 5,
      myPrs: 3,
      forReview: 2,
      forReviewUnread: null,
      thisRepo: 10,
    }
    const { lastFrame } = render(
      themed(<Sidebar selectedIndex={4} visible={true} isActive={true} counts={counts} />),
    )
    const frame = lastFrame() ?? ''
    // Settings line should not have a count number next to it
    const lines = frame.split('\n')
    const settingsLine = lines.find((l: string) => l.includes('Settings'))
    expect(settingsLine).toBeDefined()
    expect(settingsLine).not.toMatch(/Settings.*\(\d+\)/)
  })

  it('works without counts prop (backwards compatible)', () => {
    const { lastFrame } = render(
      themed(<Sidebar selectedIndex={0} visible={true} isActive={true} />),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Involved')
    expect(frame).not.toContain('(')
  })
})

describe('MainPanel', () => {
  it('renders children', () => {
    const { lastFrame } = render(
      themed(
        <MainPanel isActive={true}>
          <>{`Panel content`}</>
        </MainPanel>,
      ),
    )
    expect(lastFrame()).toContain('Panel content')
  })
})

describe('StatusBar', () => {
  it('renders with default panel hints', () => {
    const { lastFrame } = render(themed(<StatusBar />))
    const frame = lastFrame() ?? ''
    // Default panel is sidebar
    expect(frame).toContain('j/k:nav')
  })

  it('renders list panel hints', () => {
    const { lastFrame } = render(themed(<StatusBar activePanel="list" />))
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Enter:detail')
  })
})
