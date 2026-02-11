import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { useTheme } from '../../theme/index'
import { useListNavigation } from '../../hooks/useListNavigation'
import type { Comment } from '../../models/comment'
import { timeAgo } from '../../utils/date'
import { EmptyState } from '../common/EmptyState'

interface CommentsTabProps {
  readonly comments: readonly Comment[]
}

interface CommentItemProps {
  readonly item: Comment
  readonly isFocus: boolean
}

function CommentItem({ item, isFocus }: CommentItemProps): React.ReactElement {
  const theme = useTheme()

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={0}
      borderStyle={isFocus ? 'single' : undefined}
      borderColor={isFocus ? theme.colors.accent : undefined}
    >
      <Box gap={1}>
        <Text color={theme.colors.secondary} bold>
          {item.user.login}
        </Text>
        <Text color={theme.colors.muted}>{timeAgo(item.created_at)}</Text>
        {item.path && (
          <>
            <Text color={theme.colors.muted}>on</Text>
            <Text color={theme.colors.info}>{item.path}</Text>
            {item.line && (
              <Text color={theme.colors.muted}>:{item.line}</Text>
            )}
          </>
        )}
      </Box>
      <Box paddingLeft={2}>
        <Text color={theme.colors.text} wrap="wrap">
          {item.body}
        </Text>
      </Box>
    </Box>
  )
}

export function CommentsTab({
  comments,
}: CommentsTabProps): React.ReactElement {
  const { stdout } = useStdout()
  // Comments take more vertical space, adjust viewport accordingly
  const viewportHeight = Math.max(1, Math.floor((stdout?.rows ?? 24) - 8) / 4)

  const { selectedIndex, scrollOffset } = useListNavigation({
    itemCount: comments.length,
    viewportHeight,
    isActive: true,
  })

  if (comments.length === 0) {
    return <EmptyState message="No comments yet" />
  }

  const visibleComments = comments.slice(
    scrollOffset,
    scrollOffset + viewportHeight,
  )

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleComments.map((comment, index) => (
        <CommentItem
          key={comment.id}
          item={comment}
          isFocus={scrollOffset + index === selectedIndex}
        />
      ))}
    </Box>
  )
}
