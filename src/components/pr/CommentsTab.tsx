import React from 'react'
import { Box, Text, List, useList, useListItem } from 'tuir'
import { useTheme } from '../../theme/index'
import type { Comment } from '../../models/comment'
import { timeAgo } from '../../utils/date'
import { EmptyState } from '../common/EmptyState'

interface CommentsTabProps {
  readonly comments: readonly Comment[]
}

function CommentItem(): React.ReactElement {
  const theme = useTheme()
  const { item, isFocus } = useListItem<Comment[]>()

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
  const mutableComments = [...comments]
  const { listView } = useList(mutableComments, {
    navigation: 'vi-vertical',
    unitSize: 4,
  })

  if (comments.length === 0) {
    return <EmptyState message="No comments yet" />
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <List listView={listView}>
        <CommentItem />
      </List>
    </Box>
  )
}
