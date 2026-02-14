import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import { MarkdownText } from '../common/MarkdownText'
import { timeAgo } from '../../utils/date'
import type { Comment } from '../../models/comment'
import { ReactionDisplay } from './ReactionDisplay'

export interface DiffCommentThread {
  readonly comments: readonly Comment[]
  readonly threadId?: string
  readonly isResolved?: boolean
}

interface DiffCommentViewProps {
  readonly thread: DiffCommentThread
  readonly isFocus: boolean
}

export function DiffCommentView({
  thread,
  isFocus,
}: DiffCommentViewProps): React.ReactElement {
  const theme = useTheme()

  return (
    <Box
      flexDirection="column"
      paddingLeft={6}
      paddingRight={1}
      marginBottom={0}
    >
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={isFocus ? theme.colors.accent : theme.colors.border}
        paddingX={1}
        paddingY={0}
      >
        {thread.isResolved && (
          <Text color={theme.colors.muted} dimColor>[Resolved]</Text>
        )}
        {thread.comments.map((comment, idx) => (
          <Box key={comment.id} flexDirection="column" paddingLeft={idx > 0 ? 2 : 0}>
            <Box flexDirection="row" gap={1}>
              <Text
                color={thread.isResolved ? theme.colors.muted : theme.colors.secondary}
                bold
                dimColor={thread.isResolved}
              >
                {comment.user.login}
              </Text>
              <Text color={theme.colors.muted}>{timeAgo(comment.created_at)}</Text>
            </Box>
            <Box width="90%">
              <MarkdownText
                content={thread.isResolved ? `~~${comment.body}~~` : comment.body}
              />
            </Box>
            {comment.reactions && comment.reactions.total_count > 0 ? (
              <ReactionDisplay reactions={comment.reactions} />
            ) : null}
          </Box>
        ))}
        {isFocus && (
          <Text color={theme.colors.muted} dimColor>
            r: reply | x: {thread.isResolved ? 'unresolve' : 'resolve'} | e: edit | +: react
          </Text>
        )}
      </Box>
    </Box>
  )
}
