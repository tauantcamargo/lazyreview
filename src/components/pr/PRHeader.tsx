import React from 'react'
import { Box, Text } from 'tuir'
import { useTheme } from '../../theme/index'
import type { PullRequest } from '../../models/pull-request'
import { timeAgo } from '../../utils/date'

interface PRHeaderProps {
  readonly pr: PullRequest
}

export function PRHeader({ pr }: PRHeaderProps): React.ReactElement {
  const theme = useTheme()

  const stateColor = pr.draft
    ? theme.colors.muted
    : pr.state === 'open'
      ? theme.colors.success
      : theme.colors.error

  const stateLabel = pr.draft
    ? 'Draft'
    : pr.merged
      ? 'Merged'
      : pr.state === 'open'
        ? 'Open'
        : 'Closed'

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box gap={1}>
        <Text color={stateColor} bold>
          [{stateLabel}]
        </Text>
        <Text color={theme.colors.accent} bold>
          #{pr.number}
        </Text>
        <Text color={theme.colors.text} bold>
          {pr.title}
        </Text>
      </Box>
      <Box gap={1} paddingLeft={2}>
        <Text color={theme.colors.secondary}>{pr.user.login}</Text>
        <Text color={theme.colors.muted}>wants to merge</Text>
        <Text color={theme.colors.info}>{pr.head.ref}</Text>
        <Text color={theme.colors.muted}>into</Text>
        <Text color={theme.colors.info}>{pr.base.ref}</Text>
      </Box>
      <Box gap={2} paddingLeft={2}>
        <Text color={theme.colors.muted}>
          opened {timeAgo(pr.created_at)}
        </Text>
        <Text color={theme.colors.diffAdd}>+{pr.additions}</Text>
        <Text color={theme.colors.diffDel}>-{pr.deletions}</Text>
        <Text color={theme.colors.muted}>
          {pr.changed_files} files changed
        </Text>
      </Box>
      {pr.labels.length > 0 && (
        <Box gap={1} paddingLeft={2}>
          {pr.labels.map((label) => (
            <Text key={label.id} color={`#${label.color}`}>
              [{label.name}]
            </Text>
          ))}
        </Box>
      )}
    </Box>
  )
}
