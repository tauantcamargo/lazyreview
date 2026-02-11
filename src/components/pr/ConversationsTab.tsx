import React, { useEffect, useRef } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { Match } from 'effect'
import { ScrollList, type ScrollListRef } from 'ink-scroll-list'
import { useTheme } from '../../theme/index'
import { Divider } from '../common/Divider'
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
  readonly onComment?: () => void
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

  const getStateIcon = (state?: string): { icon: string; color: string } =>
    Match.value(state).pipe(
      Match.when('APPROVED', () => ({
        icon: '✓',
        color: theme.colors.success,
      })),
      Match.when('CHANGES_REQUESTED', () => ({
        icon: '✗',
        color: theme.colors.error,
      })),
      Match.when('COMMENTED', () => ({ icon: '💬', color: theme.colors.info })),
      Match.when('DISMISSED', () => ({ icon: '—', color: theme.colors.muted })),
      Match.orElse(() => ({ icon: '•', color: theme.colors.muted })),
    )

  const { icon, color } =
    item.type === 'review'
      ? getStateIcon(item.state)
      : item.type === 'description'
        ? { icon: '📝', color: theme.colors.accent }
        : { icon: '💬', color: theme.colors.info }

  const stateLabel =
    item.type === 'review' && item.state
      ? item.state.toLowerCase().replace('_', ' ')
      : ''
  const location =
    item.type === 'comment' && item.path
      ? ` on ${item.path}${item.line != null ? `:${item.line}` : ''}`
      : ''

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      marginBottom={2}
      gap={1}
    >
      <Box flexDirection="row">
        {isFocus && <Text color={theme.colors.accent}>{'▸ '}</Text>}
        <Text color={color}>{icon}</Text>
        <Text> </Text>
        <Text color={theme.colors.secondary} bold>
          {item.user}
        </Text>
        {stateLabel ? (
          <>
            <Text> </Text>
            <Text color={color}>{stateLabel}</Text>
          </>
        ) : null}
        {location ? <Text color={theme.colors.muted}>{location}</Text> : null}
        <Text color={theme.colors.muted}> · {timeAgo(item.date)}</Text>
      </Box>
      {item.body ? (
        <Box paddingLeft={isFocus ? 3 : 2} marginTop={0} width="80%">
          <Text color={theme.colors.text} wrap="wrap">
            {item.body}
          </Text>
        </Box>
      ) : null}
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
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      borderStyle="single"
      borderColor={theme.colors.border}
    >
      <Box flexDirection="row">
        <Text color={theme.colors.muted}>Author: </Text>
        <Text color={theme.colors.secondary} bold>
          {pr.user.login}
        </Text>
      </Box>
      {pr.requested_reviewers.length > 0 ? (
        <Box flexDirection="row" marginTop={0}>
          <Text color={theme.colors.muted}>Reviewers: </Text>
          <Text color={theme.colors.text}>
            {pr.requested_reviewers.map((r) => r.login).join(', ')}
          </Text>
        </Box>
      ) : null}
      {pr.labels.length > 0 ? (
        <Box flexDirection="row" marginTop={0}>
          <Text color={theme.colors.muted}>Labels: </Text>
          {pr.labels.map((label) => (
            <Text key={label.id} color={`#${label.color}`}>
              [{label.name}]{' '}
            </Text>
          ))}
        </Box>
      ) : null}
      <Box paddingY={0}>
        <Divider />
      </Box>
      <Box flexDirection="row" marginTop={0}>
        <Text color={theme.colors.diffAdd}>+{pr.additions}</Text>
        <Text> </Text>
        <Text color={theme.colors.diffDel}>-{pr.deletions}</Text>
        <Text color={theme.colors.muted}>
          {' '}
          {pr.changed_files} files changed
        </Text>
      </Box>
    </Box>
  )
}

const CONVERSATIONS_RESERVED_LINES = 18

export function ConversationsTab({
  pr,
  comments,
  reviews,
  isActive,
  onComment,
}: ConversationsTabProps): React.ReactElement {
  const theme = useTheme()
  const { stdout } = useStdout()
  const listRef = useRef<ScrollListRef>(null)
  const timeline = buildTimeline(pr, comments, reviews)
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - CONVERSATIONS_RESERVED_LINES)

  const { selectedIndex } = useListNavigation({
    itemCount: timeline.length,
    viewportHeight,
    isActive,
  })

  useInput(
    (input) => {
      if (input === 'c' && onComment) {
        onComment()
      }
    },
    { isActive },
  )

  useEffect(() => {
    const handleResize = (): void => {
      listRef.current?.remeasure()
    }
    stdout?.on('resize', handleResize)
    return () => {
      stdout?.off('resize', handleResize)
    }
  }, [stdout])

  return (
    <Box flexDirection="column" flexGrow={1}>
      <PRInfoSection pr={pr} />

      <Box flexDirection="row" paddingX={1} paddingY={0} marginBottom={1}>
        <Text color={theme.colors.accent} bold>
          Timeline ({timeline.length} items)
        </Text>
      </Box>

      <Box flexDirection="column" flexGrow={1} overflow="hidden" height={viewportHeight}>
        {timeline.length === 0 ? (
          <Box paddingX={1}>
            <Text color={theme.colors.muted}>No conversations yet</Text>
          </Box>
        ) : (
          <ScrollList
            ref={listRef}
            selectedIndex={selectedIndex}
            scrollAlignment="auto"
          >
            {timeline.map((item, index) => (
              <TimelineItemView
                key={item.id}
                item={item}
                isFocus={index === selectedIndex}
              />
            ))}
          </ScrollList>
        )}
      </Box>
    </Box>
  )
}
