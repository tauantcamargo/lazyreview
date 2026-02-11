import React, { useEffect, useRef } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { Match } from 'effect'
import { ScrollList, type ScrollListRef } from 'ink-scroll-list'
import { useTheme } from '../../theme/index'
import { Divider } from '../common/Divider'
import { MarkdownText } from '../common/MarkdownText'
import { useListNavigation } from '../../hooks/useListNavigation'
import type { PullRequest } from '../../models/pull-request'
import type { Comment } from '../../models/comment'
import type { Review } from '../../models/review'
import type { ReviewThread } from '../../services/GitHubApi'
import { timeAgo } from '../../utils/date'

export interface ReplyContext {
  readonly commentId: number
  readonly user: string
  readonly body: string | null
}

export interface ResolveContext {
  readonly threadId: string
  readonly isResolved: boolean
}

interface ConversationsTabProps {
  readonly pr: PullRequest
  readonly comments: readonly Comment[]
  readonly reviews: readonly Review[]
  readonly reviewThreads?: readonly ReviewThread[]
  readonly isActive: boolean
  readonly showResolved?: boolean
  readonly onComment?: () => void
  readonly onReply?: (context: ReplyContext) => void
  readonly onToggleResolve?: (context: ResolveContext) => void
  readonly onToggleShowResolved?: () => void
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
  readonly commentId?: number
  readonly threadId?: string
  readonly isResolved?: boolean
}

function buildTimeline(
  pr: PullRequest,
  comments: readonly Comment[],
  reviews: readonly Review[],
  reviewThreads?: readonly ReviewThread[],
): TimelineItem[] {
  const items: TimelineItem[] = []

  // Build a map from comment database ID to thread info
  const threadByCommentId = new Map<number, ReviewThread>()
  if (reviewThreads) {
    for (const thread of reviewThreads) {
      for (const comment of thread.comments) {
        threadByCommentId.set(comment.databaseId, thread)
      }
    }
  }

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
    const thread = threadByCommentId.get(comment.id)
    items.push({
      id: `comment-${comment.id}`,
      type: 'comment',
      user: comment.user.login,
      body: comment.body,
      date: comment.created_at,
      path: comment.path,
      line: comment.line,
      commentId: comment.id,
      threadId: thread?.id,
      isResolved: thread?.isResolved,
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
        <Text color={item.isResolved ? theme.colors.muted : theme.colors.secondary} bold dimColor={item.isResolved}>
          {item.user}
        </Text>
        {stateLabel ? (
          <>
            <Text> </Text>
            <Text color={color}>{stateLabel}</Text>
          </>
        ) : null}
        {item.isResolved && (
          <>
            <Text> </Text>
            <Text color={theme.colors.muted} dimColor>[Resolved]</Text>
          </>
        )}
        {location ? <Text color={theme.colors.muted}>{location}</Text> : null}
        <Text color={theme.colors.muted}> · {timeAgo(item.date)}</Text>
      </Box>
      {item.body ? (
        <Box paddingLeft={isFocus ? 3 : 2} marginTop={0} width="80%">
          <MarkdownText content={item.isResolved ? `~~${item.body}~~` : item.body} />
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

function getLatestReviewByUser(
  reviews: readonly Review[],
): Map<string, Review> {
  const latest = new Map<string, Review>()
  for (const review of reviews) {
    if (review.state === 'PENDING') continue
    const existing = latest.get(review.user.login)
    if (
      !existing ||
      new Date(review.submitted_at ?? '').getTime() >
        new Date(existing.submitted_at ?? '').getTime()
    ) {
      latest.set(review.user.login, review)
    }
  }
  return latest
}

function ReviewSummary({
  reviews,
}: {
  readonly reviews: readonly Review[]
}): React.ReactElement | null {
  const theme = useTheme()
  const latestByUser = getLatestReviewByUser(reviews)

  if (latestByUser.size === 0) return null

  const approved = [...latestByUser.values()].filter(
    (r) => r.state === 'APPROVED',
  )
  const changesRequested = [...latestByUser.values()].filter(
    (r) => r.state === 'CHANGES_REQUESTED',
  )
  const total = latestByUser.size

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={0}
      marginBottom={1}
    >
      <Box flexDirection="row" gap={1}>
        <Text color={theme.colors.muted} bold>
          Reviews:
        </Text>
        <Text>
          {approved.length > 0 && (
            <Text color={theme.colors.success}>
              {approved.length} of {total} approvals
            </Text>
          )}
          {approved.length > 0 && changesRequested.length > 0 && (
            <Text color={theme.colors.muted}> · </Text>
          )}
          {changesRequested.length > 0 && (
            <Text color={theme.colors.error}>
              {changesRequested.length} changes requested
            </Text>
          )}
        </Text>
      </Box>
      <Box flexDirection="row" gap={1} paddingLeft={2}>
        {[...latestByUser.entries()].map(([login, review]) => {
          const color =
            review.state === 'APPROVED'
              ? theme.colors.success
              : review.state === 'CHANGES_REQUESTED'
                ? theme.colors.error
                : theme.colors.warning
          const icon =
            review.state === 'APPROVED'
              ? '+'
              : review.state === 'CHANGES_REQUESTED'
                ? 'x'
                : '~'
          return (
            <Text key={login} color={color}>
              [{icon} {login}]
            </Text>
          )
        })}
      </Box>
    </Box>
  )
}

const CONVERSATIONS_RESERVED_LINES = 18

export function ConversationsTab({
  pr,
  comments,
  reviews,
  reviewThreads,
  isActive,
  showResolved = true,
  onComment,
  onReply,
  onToggleResolve,
  onToggleShowResolved,
}: ConversationsTabProps): React.ReactElement {
  const theme = useTheme()
  const { stdout } = useStdout()
  const listRef = useRef<ScrollListRef>(null)
  const allTimeline = buildTimeline(pr, comments, reviews, reviewThreads)
  const timeline = showResolved
    ? allTimeline
    : allTimeline.filter((item) => !item.isResolved)
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
      if (input === 'r' && onReply) {
        const selected = timeline[selectedIndex]
        if (selected?.type === 'comment' && selected.commentId != null) {
          onReply({
            commentId: selected.commentId,
            user: selected.user,
            body: selected.body,
          })
        }
      }
      if (input === 'x' && onToggleResolve) {
        const selected = timeline[selectedIndex]
        if (selected?.type === 'comment' && selected.threadId) {
          onToggleResolve({
            threadId: selected.threadId,
            isResolved: selected.isResolved ?? false,
          })
        }
      }
      if (input === 'f' && onToggleShowResolved) {
        onToggleShowResolved()
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

      <ReviewSummary reviews={reviews} />

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
