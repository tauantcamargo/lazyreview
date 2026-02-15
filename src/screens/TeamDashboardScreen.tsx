import React from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../theme/index'
import { useListNavigation } from '../hooks/useListNavigation'
import { useTeamDashboard } from '../hooks/useTeamDashboard'
import { EmptyState } from '../components/common/EmptyState'
import type { TeamMember } from '../models/team'
import type { PullRequest } from '../models/pull-request'

export interface TeamDashboardScreenProps {
  readonly isActive: boolean
  readonly members: readonly TeamMember[]
  readonly prs: readonly PullRequest[]
  readonly onBack: () => void
  readonly onSelectMember: (username: string) => void
}

/**
 * Pad or truncate a string to a fixed width.
 */
function padTo(value: string, width: number): string {
  if (value.length >= width) {
    return value.slice(0, width)
  }
  return value + ' '.repeat(width - value.length)
}

/**
 * Right-align a number string within a fixed width.
 */
function rightAlign(value: string, width: number): string {
  if (value.length >= width) {
    return value
  }
  return ' '.repeat(width - value.length) + value
}

export function TeamDashboardScreen({
  isActive,
  members,
  prs,
  onBack,
  onSelectMember,
}: TeamDashboardScreenProps): React.ReactElement {
  const theme = useTheme()
  const { memberStats, totalOpen, totalPending } = useTeamDashboard(
    members,
    prs,
  )

  const { selectedIndex } = useListNavigation({
    itemCount: memberStats.length,
    viewportHeight: memberStats.length,
    isActive,
  })

  useInput(
    (input, key) => {
      if (key.escape) {
        onBack()
        return
      }
      if (key.return && memberStats.length > 0) {
        const selected = memberStats[selectedIndex]
        if (selected) {
          onSelectMember(selected.member.username)
        }
      }
    },
    { isActive },
  )

  if (members.length === 0) {
    return (
      <EmptyState
        message="No team configured"
        hint="Add team members in config.yaml under team.members"
      />
    )
  }

  const COL_USERNAME = 24
  const COL_AUTHORED = 10
  const COL_REVIEWS = 16

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color={theme.colors.accent} bold>
          Team Dashboard
        </Text>
        <Text color={theme.colors.muted}>
          {' '}
          ({totalOpen} open, {totalPending} pending reviews)
        </Text>
      </Box>

      <Box>
        <Text color={theme.colors.secondary} bold>
          {padTo('Username', COL_USERNAME)}
          {rightAlign('Authored', COL_AUTHORED)}
          {rightAlign('Reviews Pending', COL_REVIEWS)}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color={theme.colors.border}>
          {'-'.repeat(COL_USERNAME + COL_AUTHORED + COL_REVIEWS)}
        </Text>
      </Box>

      {memberStats.map((stat, index) => {
        const isSelected = index === selectedIndex
        return (
          <Box key={stat.member.username}>
            <Text
              color={isSelected ? theme.colors.accent : theme.colors.text}
              backgroundColor={
                isSelected ? theme.colors.selection : undefined
              }
              bold={isSelected}
            >
              {isSelected ? '> ' : '  '}
              {padTo(stat.member.username, COL_USERNAME)}
              {rightAlign(String(stat.authoredCount), COL_AUTHORED)}
              {rightAlign(String(stat.reviewCount), COL_REVIEWS)}
            </Text>
          </Box>
        )
      })}

      <Box marginTop={1}>
        <Text color={theme.colors.muted} dimColor>
          j/k: navigate | Enter: view member PRs | Escape: back
        </Text>
      </Box>
    </Box>
  )
}
