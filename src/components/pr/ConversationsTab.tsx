import React, { useEffect } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { useTheme } from '../../theme/index'
import { useListNavigation, deriveScrollOffset } from '../../hooks/useListNavigation'
import { setSelectionContext } from '../../hooks/useSelectionContext'
import type { PullRequest } from '../../models/pull-request'
import type { Comment } from '../../models/comment'
import type { IssueComment } from '../../models/issue-comment'
import type { Review } from '../../models/review'
import type { ReviewThread } from '../../services/GitHubApi'
import { TimelineItemView, type TimelineItem } from './TimelineItemView'
import type { ReactionContext } from '../../hooks/useReactionActions'

export interface ReplyContext {
  readonly commentId: number
  readonly user: string
  readonly body: string | null
  readonly isIssueComment?: boolean
}

export interface ResolveContext {
  readonly threadId: string
  readonly isResolved: boolean
}

export interface EditCommentContext {
  readonly commentId: number
  readonly body: string
  readonly isReviewComment: boolean
}

export interface EditDescriptionContext {
  readonly body: string
}

interface ConversationsTabProps {
  readonly pr: PullRequest
  readonly comments: readonly Comment[]
  readonly reviews: readonly Review[]
  readonly reviewThreads?: readonly ReviewThread[]
  readonly issueComments?: readonly IssueComment[]
  readonly isActive: boolean
  readonly showResolved?: boolean
  readonly currentUser?: string
  readonly supportsReactions?: boolean
  readonly onComment?: () => void
  readonly onReply?: (context: ReplyContext) => void
  readonly onToggleResolve?: (context: ResolveContext) => void
  readonly onToggleShowResolved?: () => void
  readonly onEditComment?: (context: EditCommentContext) => void
  readonly onEditDescription?: (context: EditDescriptionContext) => void
  readonly onGoToFile?: (path: string) => void
  readonly onAddReaction?: (context: ReactionContext) => void
}

export function buildTimeline(
  pr: PullRequest,
  comments: readonly Comment[],
  reviews: readonly Review[],
  reviewThreads?: readonly ReviewThread[],
  issueComments?: readonly IssueComment[],
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

  // Add review comments (inline/PR comments)
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
      reactions: comment.reactions,
    })
  }

  // Add issue comments (general PR conversation comments)
  if (issueComments) {
    for (const ic of issueComments) {
      items.push({
        id: `issue-comment-${ic.id}`,
        type: 'issue_comment',
        user: ic.user.login,
        body: ic.body,
        date: ic.created_at,
        commentId: ic.id,
        reactions: ic.reactions,
      })
    }
  }

  // Sort by date
  items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return items
}

const PR_DETAIL_CONTENT_HEIGHT_RESERVED = 18
const CONVERSATIONS_TIMELINE_HEADER_LINES = 3

export function ConversationsTab({
  pr,
  comments,
  reviews,
  reviewThreads,
  issueComments,
  isActive,
  showResolved = true,
  currentUser,
  supportsReactions = false,
  onComment,
  onReply,
  onToggleResolve,
  onToggleShowResolved,
  onEditComment,
  onEditDescription,
  onGoToFile,
  onAddReaction,
}: ConversationsTabProps): React.ReactElement {
  const theme = useTheme()
  const { stdout } = useStdout()
  const allTimeline = buildTimeline(pr, comments, reviews, reviewThreads, issueComments)
  const timeline = showResolved
    ? allTimeline
    : allTimeline.filter((item) => !item.isResolved)
  const contentHeight = Math.max(1, (stdout?.rows ?? 24) - PR_DETAIL_CONTENT_HEIGHT_RESERVED)
  const viewportHeight = Math.max(1, contentHeight - CONVERSATIONS_TIMELINE_HEADER_LINES)

  const { selectedIndex } = useListNavigation({
    itemCount: timeline.length,
    viewportHeight,
    isActive,
  })

  // Publish selection context for status bar hints
  useEffect(() => {
    const selected = timeline[selectedIndex]
    if (selected && isActive) {
      setSelectionContext({
        type: 'timeline-item',
        itemType: selected.type,
        hasThread: !!selected.threadId,
        isResolved: selected.isResolved ?? false,
        isOwnComment: !!currentUser && selected.user === currentUser,
        hasPath: !!selected.path,
      })
    }
  }, [selectedIndex, timeline, isActive, currentUser])

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
        } else if (selected?.type === 'issue_comment' && selected.commentId != null) {
          onReply({
            commentId: selected.commentId,
            user: selected.user,
            body: selected.body,
            isIssueComment: true,
          })
        }
      }
      if (input === 'g' && onGoToFile) {
        const selected = timeline[selectedIndex]
        if (selected?.type === 'comment' && selected.path) {
          onGoToFile(selected.path)
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
      if (input === 'e' && onEditComment && currentUser) {
        const selected = timeline[selectedIndex]
        if (
          (selected?.type === 'comment' || selected?.type === 'issue_comment') &&
          selected.commentId != null &&
          selected.user === currentUser
        ) {
          onEditComment({
            commentId: selected.commentId,
            body: selected.body ?? '',
            isReviewComment: selected.type === 'comment' && !!selected.path,
          })
        }
      }
      if (input === 'D' && onEditDescription && currentUser && pr.user.login === currentUser) {
        onEditDescription({ body: pr.body ?? '' })
      }
      if (input === 'f' && onToggleShowResolved) {
        onToggleShowResolved()
      }
      if (input === '+' && onAddReaction && supportsReactions) {
        const selected = timeline[selectedIndex]
        if (selected?.type === 'comment' && selected.commentId != null) {
          onAddReaction({
            commentId: selected.commentId,
            commentType: 'review_comment',
          })
        } else if (selected?.type === 'issue_comment' && selected.commentId != null) {
          onAddReaction({
            commentId: selected.commentId,
            commentType: 'issue_comment',
          })
        }
      }
    },
    { isActive },
  )

  const scrollOffset = deriveScrollOffset(selectedIndex, viewportHeight, timeline.length)
  const visibleItems = timeline.slice(scrollOffset, scrollOffset + viewportHeight)

  return (
    <Box flexDirection="column" flexGrow={1} minHeight={0} overflow="hidden">
      <Box
        flexDirection="row"
        flexShrink={0}
        paddingX={1}
        paddingY={0}
        marginBottom={1}
      >
        <Text color={theme.colors.accent} bold>
          Timeline ({timeline.length} items)
        </Text>
      </Box>

      <Box
        flexDirection="column"
        flexShrink={0}
        overflow="hidden"
        height={viewportHeight}
        minHeight={viewportHeight}
      >
        {timeline.length === 0 ? (
          <Box paddingX={1}>
            <Text color={theme.colors.muted}>No conversations yet</Text>
          </Box>
        ) : (
          visibleItems.map((item, i) => (
            <TimelineItemView
              key={item.id}
              item={item}
              isFocus={scrollOffset + i === selectedIndex}
            />
          ))
        )}
      </Box>
    </Box>
  )
}
