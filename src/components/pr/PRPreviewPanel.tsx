import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import { MarkdownText } from '../common/MarkdownText'
import type { PullRequest } from '../../models/pull-request'
import { timeAgo } from '../../utils/date'

interface PRPreviewPanelProps {
  readonly pr: PullRequest | undefined
  readonly width: number
}

export const PREVIEW_PANEL_MIN_TERMINAL_WIDTH = 140
export const PREVIEW_PANEL_WIDTH_FRACTION = 0.4

/**
 * Preview panel that shows the selected PR's description.
 * Only rendered when the terminal is wide enough (>140 columns).
 */
export function PRPreviewPanel({
  pr,
  width,
}: PRPreviewPanelProps): React.ReactElement {
  const theme = useTheme()

  if (!pr) {
    return (
      <Box
        flexDirection="column"
        width={width}
        borderStyle="single"
        borderColor={theme.colors.border}
        paddingX={1}
      >
        <Text color={theme.colors.muted} italic>
          Select a PR to preview
        </Text>
      </Box>
    )
  }

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="single"
      borderColor={theme.colors.border}
      paddingX={1}
      overflow="hidden"
    >
      <Box flexDirection="column" marginBottom={1}>
        <Text color={theme.colors.accent} bold wrap="truncate">
          #{pr.number} {pr.title}
        </Text>
        <Box gap={1}>
          <Text color={theme.colors.muted}>{pr.user.login}</Text>
          <Text color={theme.colors.muted}>|</Text>
          <Text color={theme.colors.muted}>{timeAgo(pr.created_at)}</Text>
          {pr.comments > 0 && (
            <>
              <Text color={theme.colors.muted}>|</Text>
              <Text color={theme.colors.muted}>{pr.comments} comments</Text>
            </>
          )}
        </Box>
        <Box gap={1}>
          <Text color={theme.colors.success}>+{pr.additions}</Text>
          <Text color={theme.colors.error}>-{pr.deletions}</Text>
          <Text color={theme.colors.muted}>{pr.changed_files} files</Text>
        </Box>
      </Box>
      <Box flexDirection="column" overflow="hidden">
        <MarkdownText content={pr.body} />
      </Box>
    </Box>
  )
}
