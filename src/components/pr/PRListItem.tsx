import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { PullRequest } from '../../models/pull-request'
import { timeAgo } from '../../utils/date'

interface PRListItemProps {
  readonly item: PullRequest
  readonly isFocus: boolean
}

export function PRListItem({
  item,
  isFocus,
}: PRListItemProps): React.ReactElement {
  const theme = useTheme()

  const stateColor = item.draft
    ? theme.colors.muted
    : item.state === 'open'
      ? theme.colors.success
      : theme.colors.error

  const stateIcon = item.draft ? 'D' : item.state === 'open' ? 'O' : 'C'

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box gap={1}>
        <Text color={stateColor} bold>
          {stateIcon}
        </Text>
        <Text
          color={isFocus ? theme.colors.listSelectedFg : theme.colors.text}
          bold={isFocus}
          inverse={isFocus}
        >
          #{item.number}
        </Text>
        <Text
          color={isFocus ? theme.colors.listSelectedFg : theme.colors.text}
          bold={isFocus}
          inverse={isFocus}
        >
          {item.title}
        </Text>
      </Box>
      <Box gap={1} paddingLeft={3}>
        <Text color={theme.colors.muted}>{item.user.login}</Text>
        <Text color={theme.colors.muted}>|</Text>
        <Text color={theme.colors.muted}>{timeAgo(item.created_at)}</Text>
        {item.comments > 0 && (
          <>
            <Text color={theme.colors.muted}>|</Text>
            <Text color={theme.colors.muted}>{item.comments} comments</Text>
          </>
        )}
        {item.labels.length > 0 && (
          <>
            <Text color={theme.colors.muted}>|</Text>
            {item.labels.map(
              (label: { id: number; name: string; color: string }) => (
                <Text key={label.id} color={`#${label.color}`}>
                  [{label.name}]
                </Text>
              ),
            )}
          </>
        )}
      </Box>
    </Box>
  )
}
