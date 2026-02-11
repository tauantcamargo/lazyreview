import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { useTheme } from '../../theme/index'
import { useListNavigation } from '../../hooks/useListNavigation'
import type { PullRequest } from '../../models/pull-request'
import type { Comment } from '../../models/comment'
import type { Review } from '../../models/review'
import { timeAgo } from '../../utils/date'

interface ConversationsTabProps {
  readonly pr: PullRequest
  readonly comments: readonly Comment[]
  readonly reviews: readonly Review[]
  readonly isActive: boolean
}

interface TimelineItem {
  readonly id: string
  readonly type: 'description' | 'review' | 'comment'
  readonly user: string
  readonly body: string | null
  readonly date: string
  readonly state?: string
  readonly path?: string
  readonly line?: number | null
}

function buildTimeline(
  pr: PullRequest,
  comments: readonly Comment[],
  reviews: readonly Review[],
): TimelineItem[] {
  const items: TimelineItem[] = []

  // Add PR description first
  items.push({
    id: 'description',
    type: 'description',
    user: pr.user.login,
    body: pr.body,
    date: pr.created_at,
  })

  // Add reviews
  for (const review of reviews) {
    if (review.state !== 'PENDING') {
      items.push({
        id: `review-${review.id}`,
        type: 'review',
        user: review.user.login,
        body: review.body,
        date: review.submitted_at ?? pr.created_at,
        state: review.state,
      })
    }
  }

  // Add comments
  for (const comment of comments) {
    items.push({
      id: `comment-${comment.id}`,
      type: 'comment',
      user: comment.user.login,
      body: comment.body,
      date: comment.created_at,
      path: comment.path,
      line: comment.line,
    })
  }

  // Sort by date
  items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return items
}

function TimelineItemView({
  item,
  isFocus,
}: {
  readonly item: TimelineItem
  readonly isFocus: boolean
}): React.ReactElement {
  const theme = useTheme()

  const getStateIcon = (state?: string): { icon: string; color: string } => {
    switch (state) {
      case 'APPROVED':
        return { icon: '✓', color: theme.colors.success }
      case 'CHANGES_REQUESTED':
        return { icon: '✗', color: theme.colors.error }
      case 'COMMENTED':
        return { icon: '💬', color: theme.colors.info }
      case 'DISMISSED':
        return { icon: '—', color: theme.colors.muted }
      default:
        return { icon: '•', color: theme.colors.muted }
    }
  }

  const { icon, color } = item.type === 'review'
    ? getStateIcon(item.state)
    : item.type === 'description'
      ? { icon: '📝', color: theme.colors.accent }
      : { icon: '💬', color: theme.colors.info }

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      borderStyle={isFocus ? 'single' : undefined}
      borderColor={isFocus ? theme.colors.accent : undefined}
    >
      <Box gap={1}>
        <Text color={color}>{icon}</Text>
        <Text color={theme.colors.secondary} bold>
          {item.user}
        </Text>
        {item.type === 'review' && item.state && (
          <Text color={color}>{item.state.toLowerCase().replace('_', ' ')}</Text>
        )}
        {item.type === 'comment' && item.path && (
          <Text color={theme.colors.muted}>
            on {item.path}
            {item.line ? `:${item.line}` : ''}
          </Text>
        )}
        <Text color={theme.colors.muted}>{timeAgo(item.date)}</Text>
      </Box>
      {item.body && (
        <Box paddingLeft={2} marginTop={1}>
          <Text color={theme.colors.text} wrap="wrap">
            {item.body.slice(0, 500)}
            {item.body.length > 500 ? '...' : ''}
          </Text>
        </Box>
      )}
    </Box>
  )
}

function PRInfoSection({
  pr,
}: {
  readonly pr: PullRequest
}): React.ReactElement {
  const theme = useTheme()

  return (
    <Box flexDirection="column" paddingX={1} paddingBottom={1} borderStyle="single" borderColor={theme.colors.border}>
      <Box gap={2} marginBottom={1}>
        <Text color={theme.colors.muted}>Author:</Text>
        <Text color={theme.colors.secondary} bold>
          {pr.user.login}
        </Text>
      </Box>

      {pr.requested_reviewers.length > 0 && (
        <Box gap={2} marginBottom={1}>
          <Text color={theme.colors.muted}>Reviewers:</Text>
          <Text color={theme.colors.text}>
            {pr.requested_reviewers.map((r) => r.login).join(', ')}
          </Text>
        </Box>
      )}

      {pr.labels.length > 0 && (
        <Box gap={2} marginBottom={1}>
          <Text color={theme.colors.muted}>Labels:</Text>
          <Box gap={1}>
            {pr.labels.map((label) => (
              <Text key={label.id} color={`#${label.color}`}>
                [{label.name}]
              </Text>
            ))}
          </Box>
        </Box>
      )}

      <Box gap={2}>
        <Text color={theme.colors.diffAdd}>+{pr.additions}</Text>
        <Text color={theme.colors.diffDel}>-{pr.deletions}</Text>
        <Text color={theme.colors.muted}>
          {pr.changed_files} files changed
        </Text>
      </Box>
    </Box>
  )
}

export function ConversationsTab({
  pr,
  comments,
  reviews,
  isActive,
}: ConversationsTabProps): React.ReactElement {
  const { stdout } = useStdout()
  const theme = useTheme()
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 12)

  const timeline = buildTimeline(pr, comments, reviews)

  const { selectedIndex, scrollOffset } = useListNavigation({
    itemCount: timeline.length,
    viewportHeight: Math.max(1, viewportHeight - 6),
    isActive,
  })

  const visibleItems = timeline.slice(
    scrollOffset,
    scrollOffset + viewportHeight - 6,
  )

  return (
    <Box flexDirection="column" flexGrow={1}>
      <PRInfoSection pr={pr} />

      <Box paddingX={1} paddingY={1}>
        <Text color={theme.colors.accent} bold>
          Timeline ({timeline.length} items)
        </Text>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        {visibleItems.length === 0 ? (
          <Box paddingX={1}>
            <Text color={theme.colors.muted}>No conversations yet</Text>
          </Box>
        ) : (
          visibleItems.map((item, index) => (
            <TimelineItemView
              key={item.id}
              item={item}
              isFocus={scrollOffset + index === selectedIndex}
            />
          ))
        )}
      </Box>
    </Box>
  )
}
