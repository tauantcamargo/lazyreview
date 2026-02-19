import React from 'react'
import { Text } from 'ink'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { ThemeProvider, defaultTheme } from '../../theme/index'
import { TopBar } from '../layout/TopBar'
import { Sidebar } from '../layout/Sidebar'
import { getStateBadge, getStateColor, formatDiffStats } from '../pr/PRListItem'
import { PRHeader } from '../pr/PRHeader'
import { buildHints } from '../layout/StatusBar'
import { buildShortcutGroups } from '../layout/HelpModal'
import { EmptyState } from '../common/EmptyState'
import { LoadingIndicator } from '../common/LoadingIndicator'
import { ErrorWithRetry } from '../common/ErrorWithRetry'
import { Divider } from '../common/Divider'
import { BorderedBox } from '../common/BorderedBox'
import { PaginationBar } from '../common/PaginationBar'
import { MarkdownText } from '../common/MarkdownText'
import { formatStepProgress } from '../layout/OnboardingScreen'
import { formatTabName } from '../pr/PRTabs'
import { MainPanel } from '../layout/MainPanel'
import { SettingRow } from '../settings/SettingRow'
import { providerBadge } from '../../utils/provider-helpers'
import { formatSortLabel } from '../common/SortModal'

function themed(el: React.ReactElement) {
  return <ThemeProvider theme={defaultTheme}>{el}</ThemeProvider>
}

const mockPR = {
  id: 1,
  node_id: '',
  number: 42,
  title: 'Fix the bug',
  body: null,
  state: 'open' as const,
  draft: false,
  merged: false,
  user: { login: 'alice', id: 1, avatar_url: '', html_url: '' },
  labels: [],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  merged_at: null,
  closed_at: null,
  html_url: 'https://github.com/owner/repo/pull/42',
  head: { ref: 'feature-branch', sha: 'abc123', label: undefined },
  base: { ref: 'main', sha: 'def456', label: undefined },
  additions: 12,
  deletions: 5,
  changed_files: 3,
  comments: 2,
  review_comments: 1,
  requested_reviewers: [],
  assignees: [],
  mergeable: true,
  mergeable_state: 'clean',
  merge_commit_sha: null,
}

describe('HelpModal buildShortcutGroups', () => {
  it('returns groups for all help sections', () => {
    const groups = buildShortcutGroups(undefined)
    expect(groups.length).toBeGreaterThan(0)
    expect(groups[0]?.title).toBe('Global')
  })

  it('includes PR List section', () => {
    const groups = buildShortcutGroups(undefined)
    const prList = groups.find((g) => g.title === 'PR List')
    expect(prList).toBeDefined()
  })
})

describe('StatusBar buildHints', () => {
  it('separates hints with │ instead of double spaces', () => {
    const hints = buildHints([
      { ctx: 'global', action: 'moveDown', label: 'nav', key: 'j/k' },
      { ctx: 'global', action: 'back', label: 'quit', key: 'q' },
    ])
    expect(hints).toContain('│')
    expect(hints).not.toContain('  ') // no double-space separator
  })

  it('formats hint entries as key:label', () => {
    const hints = buildHints([
      { ctx: 'global', action: 'moveDown', label: 'nav', key: 'j/k' },
    ])
    expect(hints).toContain('j/k:nav')
  })
})

describe('PRHeader', () => {
  it('renders PR number and title', () => {
    const { lastFrame } = render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      themed(<PRHeader pr={mockPR as any} />),
    )
    expect(lastFrame()).toContain('42')
    expect(lastFrame()).toContain('Fix the bug')
  })

  it('renders branch flow with → instead of "wants to merge"', () => {
    const { lastFrame } = render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      themed(<PRHeader pr={mockPR as any} />),
    )
    expect(lastFrame()).toContain('→')
    expect(lastFrame()).not.toContain('wants to merge')
  })

  it('shows diff stats', () => {
    const { lastFrame } = render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      themed(<PRHeader pr={mockPR as any} />),
    )
    expect(lastFrame()).toContain('+12')
    expect(lastFrame()).toContain('-5')
  })
})

describe('PRListItem helpers', () => {
  it('getStateBadge returns OPEN for open non-draft PR', () => {
    expect(getStateBadge({ state: 'open', draft: false, merged: false })).toBe('OPEN')
  })

  it('getStateBadge returns DRFT for draft PR', () => {
    expect(getStateBadge({ state: 'open', draft: true, merged: false })).toBe('DRFT')
  })

  it('getStateBadge returns MRGD for merged PR', () => {
    expect(getStateBadge({ state: 'closed', draft: false, merged: true })).toBe('MRGD')
  })

  it('getStateBadge returns CLSD for closed PR', () => {
    expect(getStateBadge({ state: 'closed', draft: false, merged: false })).toBe('CLSD')
  })

  it('formatDiffStats formats additions and deletions', () => {
    expect(formatDiffStats(42, 8)).toBe('+42 -8')
  })

  it('formatDiffStats returns empty string when both are 0', () => {
    expect(formatDiffStats(0, 0)).toBe('')
  })
})

describe('Sidebar', () => {
  it('renders sidebar items in full mode', () => {
    const { lastFrame } = render(
      themed(
        <Sidebar selectedIndex={0} visible isActive={false} />,
      ),
    )
    expect(lastFrame()).toContain('Involved')
    expect(lastFrame()).toContain('Settings')
  })

  it('uses ▶ arrow for selected item', () => {
    const { lastFrame } = render(
      themed(
        <Sidebar selectedIndex={0} visible isActive={true} />,
      ),
    )
    expect(lastFrame()).toContain('▶')
  })

  it('shows counts in badge style with ··', () => {
    const { lastFrame } = render(
      themed(
        <Sidebar
          selectedIndex={0}
          visible
          isActive={true}
          counts={{
            involved: 5,
            myPrs: 0,
            forReview: 3,
            thisRepo: 0,
            browse: null,
            team: 0,
            forReviewUnread: 0,
          }}
        />,
      ),
    )
    expect(lastFrame()).toContain('··')
  })
})

describe('TopBar', () => {
  it('renders › separator in breadcrumbs', () => {
    const { lastFrame } = render(
      themed(
        <TopBar
          username="alice"
          provider="github"
          screenName="Involved"
        />,
      ),
    )
    expect(lastFrame()).toContain('›')
  })

  it('shows only dot when connected (no label)', () => {
    const { lastFrame } = render(
      themed(
        <TopBar
          username="alice"
          provider="github"
          connectionStatus="connected"
        />,
      ),
    )
    expect(lastFrame()).not.toContain('connected')
  })

  it('truncates PR title at 30 characters', () => {
    const longTitle = 'This is a very long PR title that should be truncated properly'
    const { lastFrame } = render(
      themed(
        <TopBar
          username="alice"
          provider="github"
          prNumber={123}
          prTitle={longTitle}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    // After truncation at 30 chars, the full original title should not appear
    expect(frame).not.toContain(longTitle)
    // But PR number should appear
    expect(frame).toContain('123')
  })

  it('shows provider badge in breadcrumbs', () => {
    const { lastFrame } = render(
      themed(
        <TopBar
          username="alice"
          provider="github"
        />,
      ),
    )
    expect(lastFrame()).toContain('[GH]')
  })
})

describe('EmptyState', () => {
  it('renders message', () => {
    const { lastFrame } = render(themed(<EmptyState message="Nothing here" />))
    expect(lastFrame()).toContain('Nothing here')
  })

  it('renders hint when provided', () => {
    const { lastFrame } = render(
      themed(<EmptyState message="Empty" hint="Try something" />),
    )
    expect(lastFrame()).toContain('Try something')
  })

  it('renders custom icon', () => {
    const { lastFrame } = render(
      themed(<EmptyState icon="!" message="Alert" />),
    )
    expect(lastFrame()).toContain('!')
  })

  it('renders title when provided', () => {
    const { lastFrame } = render(
      themed(<EmptyState title="No Results" message="No PRs match your filter" />),
    )
    expect(lastFrame()).toContain('No Results')
    expect(lastFrame()).toContain('No PRs match your filter')
  })

  it('renders actions when provided', () => {
    const { lastFrame } = render(
      themed(<EmptyState message="Empty" actions={[{ key: 'r', label: 'refresh' }]} />),
    )
    expect(lastFrame()).toContain('r')
    expect(lastFrame()).toContain('refresh')
  })
})

describe('LoadingIndicator', () => {
  it('renders loading message', () => {
    const { lastFrame } = render(themed(<LoadingIndicator message="Loading..." />))
    expect(lastFrame()).toContain('Loading...')
  })

  it('renders subtitle when provided', () => {
    const { lastFrame } = render(
      themed(<LoadingIndicator message="Loading" subtitle="Fetching 42 items..." />),
    )
    expect(lastFrame()).toContain('Loading')
    expect(lastFrame()).toContain('Fetching 42 items...')
  })

  it('renders inline mode without growing', () => {
    const { lastFrame } = render(
      themed(<LoadingIndicator message="Inline loading" inline />),
    )
    expect(lastFrame()).toContain('Inline loading')
  })
})

describe('ErrorWithRetry', () => {
  it('renders error message with icon', () => {
    const { lastFrame } = render(
      themed(<ErrorWithRetry message="Something went wrong" onRetry={() => {}} />),
    )
    expect(lastFrame()).toContain('Something went wrong')
    expect(lastFrame()).toContain('✗')
  })

  it('renders retry hint', () => {
    const { lastFrame } = render(
      themed(<ErrorWithRetry message="Error" onRetry={() => {}} />),
    )
    expect(lastFrame()).toContain('r')
  })
})

describe('Divider', () => {
  it('renders a line', () => {
    const { lastFrame } = render(themed(<Divider />))
    const frame = lastFrame() ?? ''
    expect(frame.length).toBeGreaterThan(0)
  })

  it('renders with title', () => {
    const { lastFrame } = render(themed(<Divider title="Section" />))
    expect(lastFrame()).toContain('Section')
  })

  it('renders double style with ═ characters', () => {
    const { lastFrame } = render(themed(<Divider style="double" />))
    expect(lastFrame()).toContain('═')
  })

  it('renders thick style with ━ characters', () => {
    const { lastFrame } = render(themed(<Divider style="thick" />))
    expect(lastFrame()).toContain('━')
  })

  it('renders dotted style with · characters', () => {
    const { lastFrame } = render(themed(<Divider style="dotted" />))
    expect(lastFrame()).toContain('·')
  })

  it('renders title with left alignment', () => {
    const { lastFrame } = render(themed(<Divider title="Left" titleAlign="left" />))
    expect(lastFrame()).toContain('Left')
  })

  it('renders title with right alignment', () => {
    const { lastFrame } = render(themed(<Divider title="Right" titleAlign="right" />))
    expect(lastFrame()).toContain('Right')
  })
})

describe('BorderedBox', () => {
  it('renders title and children', () => {
    const { lastFrame } = render(
      themed(<BorderedBox title="My Box"><Text>Hello</Text></BorderedBox>),
    )
    expect(lastFrame()).toContain('My Box')
    expect(lastFrame()).toContain('Hello')
  })

  it('renders subtitle when provided', () => {
    const { lastFrame } = render(
      themed(
        <BorderedBox title="Panel" subtitle="secondary info">
          <Text>Content</Text>
        </BorderedBox>,
      ),
    )
    expect(lastFrame()).toContain('Panel')
    expect(lastFrame()).toContain('secondary info')
  })

  it('renders with statusColor without errors', () => {
    const { lastFrame } = render(
      themed(
        <BorderedBox title="Status" statusColor="red">
          <Text>Content</Text>
        </BorderedBox>,
      ),
    )
    expect(lastFrame()).toContain('Status')
    expect(lastFrame()).toContain('Content')
  })
})

describe('PaginationBar', () => {
  it('renders item count for single page', () => {
    const { lastFrame } = render(
      themed(
        <PaginationBar
          currentPage={1}
          totalPages={1}
          totalItems={5}
          startIndex={0}
          endIndex={5}
          hasNextPage={false}
          hasPrevPage={false}
        />,
      ),
    )
    expect(lastFrame()).toContain('5 items')
  })

  it('renders pagination controls for multiple pages', () => {
    const { lastFrame } = render(
      themed(
        <PaginationBar
          currentPage={2}
          totalPages={10}
          totalItems={50}
          startIndex={18}
          endIndex={28}
          hasNextPage={true}
          hasPrevPage={true}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('19-28 of 50')
    expect(frame).toContain('2/10')
  })

  it('uses ‹ and › arrows', () => {
    const { lastFrame } = render(
      themed(
        <PaginationBar
          currentPage={2}
          totalPages={3}
          totalItems={30}
          startIndex={10}
          endIndex={20}
          hasNextPage={true}
          hasPrevPage={true}
        />,
      ),
    )
    expect(lastFrame()).toContain('‹')
    expect(lastFrame()).toContain('›')
  })

  it('shows dot indicators for ≤5 pages', () => {
    const { lastFrame } = render(
      themed(
        <PaginationBar
          currentPage={2}
          totalPages={4}
          totalItems={40}
          startIndex={10}
          endIndex={20}
          hasNextPage={true}
          hasPrevPage={true}
        />,
      ),
    )
    expect(lastFrame()).toContain('●')
    expect(lastFrame()).toContain('○')
  })
})

describe('formatSortLabel', () => {
  it('shows ↓ arrow for active sort with desc direction', () => {
    const label = formatSortLabel('updated', 'Last Updated', 'updated', 'desc')
    expect(label).toContain('↓')
  })

  it('shows ↑ arrow for active sort with asc direction', () => {
    const label = formatSortLabel('updated', 'Last Updated', 'updated', 'asc')
    expect(label).toContain('↑')
  })

  it('returns plain label for non-active sort field', () => {
    const label = formatSortLabel('created', 'Created Date', 'updated', 'desc')
    expect(label).toBe('Created Date')
  })
})

describe('providerBadge', () => {
  it('returns [GH] for github', () => {
    expect(providerBadge('github')).toBe('[GH]')
  })

  it('returns [GL] for gitlab', () => {
    expect(providerBadge('gitlab')).toBe('[GL]')
  })

  it('returns empty string for undefined', () => {
    expect(providerBadge(undefined)).toBe('')
  })

  it('returns empty string for unknown provider', () => {
    expect(providerBadge('unknown')).toBe('')
  })
})

describe('SettingRow', () => {
  it('renders label and value', () => {
    const { lastFrame } = render(
      themed(<SettingRow label="Theme" value="tokyo-night" />),
    )
    expect(lastFrame()).toContain('Theme')
    expect(lastFrame()).toContain('tokyo-night')
  })

  it('uses ▶ selector when selected', () => {
    const { lastFrame } = render(
      themed(<SettingRow label="Theme" value="tokyo-night" isSelected />),
    )
    expect(lastFrame()).toContain('▶')
  })

  it('renders description when provided and selected', () => {
    const { lastFrame } = render(
      themed(<SettingRow label="Theme" value="tokyo-night" isSelected description="Color scheme for the UI" />),
    )
    expect(lastFrame()).toContain('Color scheme for the UI')
  })
})

describe('formatTabName', () => {
  it('prefixes name with 1-based index', () => {
    expect(formatTabName('Description', 0)).toBe('1:Description')
    expect(formatTabName('Files', 3)).toBe('4:Files')
  })

  it('formats all PR tab names correctly', () => {
    const names = ['Description', 'Conversations', 'Commits', 'Files', 'Checks', 'Timeline']
    names.forEach((name, i) => {
      expect(formatTabName(name, i)).toBe(`${i + 1}:${name}`)
    })
  })
})

describe('MainPanel', () => {
  it('renders children', () => {
    const { lastFrame } = render(
      themed(<MainPanel><Text>Content</Text></MainPanel>),
    )
    expect(lastFrame()).toContain('Content')
  })

  it('uses double border when active', () => {
    const { lastFrame } = render(
      themed(<MainPanel isActive><Text>Content</Text></MainPanel>),
    )
    // Double border uses ═ character
    expect(lastFrame()).toContain('═')
  })

  it('uses single border when inactive', () => {
    const { lastFrame } = render(
      themed(<MainPanel isActive={false}><Text>Content</Text></MainPanel>),
    )
    // Single border uses ─ character
    expect(lastFrame()).toContain('─')
  })
})

describe('formatStepProgress', () => {
  it('includes step label with current and total', () => {
    const result = formatStepProgress(1, 4)
    expect(result).toContain('Step 1 of 4')
  })

  it('includes filled ━ and empty ○ characters', () => {
    const result = formatStepProgress(1, 4)
    expect(result).toContain('━')
    expect(result).toContain('○')
  })

  it('shows all filled for last step', () => {
    const result = formatStepProgress(4, 4)
    expect(result).not.toContain('○')
    expect(result).toContain('━')
  })

  it('shows no filled chars for step 0', () => {
    const result = formatStepProgress(0, 4)
    expect(result).not.toContain('━')
    expect(result).toContain('○')
  })
})

describe('MarkdownText', () => {
  it('renders paragraph text', () => {
    const { lastFrame } = render(themed(<MarkdownText content="Hello world" />))
    expect(lastFrame()).toContain('Hello world')
  })

  it('renders empty state for null content', () => {
    const { lastFrame } = render(themed(<MarkdownText content={null} />))
    expect(lastFrame()).toContain('No description provided')
  })

  it('renders headings', () => {
    const { lastFrame } = render(themed(<MarkdownText content="# Title" />))
    expect(lastFrame()).toContain('Title')
  })
})
