import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import { MarkdownText } from '../common/MarkdownText'
import type { BotDetectableComment } from '../../utils/bot-detection'

interface BotSummarySectionProps {
  readonly comment: BotDetectableComment
  readonly isExpanded: boolean
}

/**
 * Collapsible section that displays the most recent bot comment
 * (e.g., AI review summaries from GitHub Actions bots).
 *
 * Collapsed by default. Toggle with the B keybinding.
 * Hidden entirely when no bot comment is found (handled by parent).
 */
export function BotSummarySection({
  comment,
  isExpanded,
}: BotSummarySectionProps): React.ReactElement {
  const theme = useTheme()

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      borderStyle="single"
      borderColor={theme.colors.border}
      overflow="hidden"
    >
      <Box flexDirection="row" gap={1}>
        <Text color={theme.colors.info} bold>
          Bot Summary
        </Text>
        <Text color={theme.colors.muted}>
          by {comment.user.login}
        </Text>
        <Text color={theme.colors.muted} dimColor>
          {isExpanded ? '[B: collapse]' : '[B: expand]'}
        </Text>
      </Box>
      {isExpanded ? (
        <Box paddingLeft={1} paddingTop={1} width="85%">
          <MarkdownText content={comment.body} />
        </Box>
      ) : null}
    </Box>
  )
}
