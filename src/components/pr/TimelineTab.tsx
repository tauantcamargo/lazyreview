import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { useTheme } from '../../theme/index'
import { useListNavigation, deriveScrollOffset } from '../../hooks/useListNavigation'
import { useTimeline } from '../../hooks/useTimeline'
import { LoadingIndicator } from '../common/LoadingIndicator'
import { EmptyState } from '../common/EmptyState'
import { timeAgo } from '../../utils/date'
import type { TimelineEvent } from '../../models/timeline-event'
import type { ThemeColors } from '../../theme/index'

// ---------------------------------------------------------------------------
// Pure helper functions (exported for testing)
// ---------------------------------------------------------------------------

type ThemeColorKey = keyof ThemeColors

/**
 * Get the display icon for a timeline event.
 */
export function getEventIcon(event: TimelineEvent): string {
  switch (event.type) {
    case 'commit':
      return '*'
    case 'review':
      switch (event.state) {
        case 'APPROVED':
          return '+'
        case 'CHANGES_REQUESTED':
          return 'x'
        case 'COMMENTED':
          return '~'
        case 'DISMISSED':
          return '-'
        case 'PENDING':
          return '...'
      }
      break
    case 'comment':
      return '#'
    case 'label-change':
      return '@'
    case 'assignee-change':
      return '>'
    case 'status-check':
      switch (event.status) {
        case 'success':
          return '[ok]'
        case 'failure':
        case 'error':
          return '[!!]'
        case 'pending':
          return '[..]'
        case 'cancelled':
          return '[--]'
      }
      break
    case 'force-push':
      return '!'
  }
  return '?'
}

/**
 * Get a human-readable description for a timeline event.
 */
export function getEventDescription(event: TimelineEvent): string {
  switch (event.type) {
    case 'commit': {
      const shortSha = event.sha.slice(0, 7)
      const firstLine = event.message.split('\n')[0] ?? ''
      return `${event.author.login} committed ${shortSha}: ${firstLine}`
    }
    case 'review': {
      const action = getReviewAction(event.state)
      return `${event.author.login} ${action}`
    }
    case 'comment': {
      const location = event.path
        ? ` on ${event.path}${event.line != null ? `:${event.line}` : ''}`
        : ''
      return `${event.author.login} commented${location}`
    }
    case 'label-change':
      return `${event.actor.login} ${event.action} label "${event.label.name}"`
    case 'assignee-change':
      return `${event.actor.login} ${event.action} ${event.assignee.login}`
    case 'status-check': {
      const statusWord = getStatusCheckWord(event.status)
      return `${event.name} ${statusWord}`
    }
    case 'force-push': {
      const before = event.beforeSha.slice(0, 7)
      const after = event.afterSha.slice(0, 7)
      return `${event.actor.login} force-pushed ${before}..${after}`
    }
  }
}

/**
 * Get the theme color key for a timeline event.
 */
export function getEventColorKey(event: TimelineEvent): ThemeColorKey {
  switch (event.type) {
    case 'commit':
      return 'warning'
    case 'review':
      switch (event.state) {
        case 'APPROVED':
          return 'success'
        case 'CHANGES_REQUESTED':
          return 'error'
        case 'COMMENTED':
          return 'info'
        case 'DISMISSED':
          return 'muted'
        case 'PENDING':
          return 'muted'
      }
      break
    case 'comment':
      return 'info'
    case 'label-change':
      return 'secondary'
    case 'assignee-change':
      return 'secondary'
    case 'status-check':
      switch (event.status) {
        case 'success':
          return 'success'
        case 'failure':
        case 'error':
          return 'error'
        case 'pending':
          return 'warning'
        case 'cancelled':
          return 'muted'
      }
      break
    case 'force-push':
      return 'error'
  }
  return 'muted'
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getReviewAction(state: string): string {
  switch (state) {
    case 'APPROVED':
      return 'approved'
    case 'CHANGES_REQUESTED':
      return 'requested changes'
    case 'COMMENTED':
      return 'reviewed'
    case 'DISMISSED':
      return 'dismissed review'
    default:
      return 'reviewed'
  }
}

function getStatusCheckWord(status: string): string {
  switch (status) {
    case 'success':
      return 'passed'
    case 'failure':
      return 'failed'
    case 'error':
      return 'errored'
    case 'cancelled':
      return 'cancelled'
    case 'pending':
      return 'pending'
    default:
      return status
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TimelineEventRowProps {
  readonly event: TimelineEvent
  readonly isFocus: boolean
}

function TimelineEventRow({ event, isFocus }: TimelineEventRowProps): React.ReactElement {
  const theme = useTheme()
  const icon = getEventIcon(event)
  const description = getEventDescription(event)
  const colorKey = getEventColorKey(event)
  const color = theme.colors[colorKey]

  return (
    <Box
      paddingX={1}
      gap={1}
      backgroundColor={isFocus ? theme.colors.selection : undefined}
    >
      <Box width={5} flexShrink={0}>
        <Text color={color} bold={isFocus}>
          {icon}
        </Text>
      </Box>
      <Box flexGrow={1} flexShrink={1}>
        <Text
          color={isFocus ? theme.colors.listSelectedFg : theme.colors.text}
          bold={isFocus}
          wrap="truncate"
        >
          {description}
        </Text>
      </Box>
      <Box width={14} flexShrink={0}>
        <Text color={theme.colors.muted}>{timeAgo(event.timestamp)}</Text>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const TIMELINE_TAB_RESERVED_LINES = 14

interface TimelineTabProps {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly isActive: boolean
}

export function TimelineTab({
  owner,
  repo,
  prNumber,
  isActive,
}: TimelineTabProps): React.ReactElement {
  const theme = useTheme()
  const { stdout } = useStdout()
  const { data: events = [], isLoading } = useTimeline(owner, repo, prNumber, {
    enabled: isActive || prNumber > 0,
  })
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - TIMELINE_TAB_RESERVED_LINES)

  const { selectedIndex } = useListNavigation({
    itemCount: events.length,
    viewportHeight,
    isActive,
  })

  const scrollOffset = deriveScrollOffset(selectedIndex, viewportHeight, events.length)
  const visibleEvents = events.slice(scrollOffset, scrollOffset + viewportHeight)

  if (isLoading) {
    return <LoadingIndicator message="Loading timeline..." />
  }

  if (events.length === 0) {
    return <EmptyState message="No timeline events found" />
  }

  return (
    <Box flexDirection="column" flexGrow={1} minHeight={0} overflow="hidden">
      <Box paddingX={1} paddingY={0} marginBottom={1} gap={2}>
        <Text color={theme.colors.accent} bold>
          Timeline
        </Text>
        <Text color={theme.colors.muted}>({events.length} events)</Text>
      </Box>
      <Box flexDirection="column" overflow="hidden" height={viewportHeight}>
        {visibleEvents.map((event, i) => (
          <TimelineEventRow
            key={event.id}
            event={event}
            isFocus={scrollOffset + i === selectedIndex}
          />
        ))}
      </Box>
    </Box>
  )
}
