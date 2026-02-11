import React from 'react'
import { Box, Text } from 'ink'
import { Match } from 'effect'
import { useTheme } from '../../theme/index'
import { MarkdownText } from '../common/MarkdownText'
import { timeAgo } from '../../utils/date'

export interface TimelineItem {
  readonly id: string
  readonly type: 'review' | 'comment'
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

export function TimelineItemView({
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
        icon: '+',
        color: theme.colors.success,
      })),
      Match.when('CHANGES_REQUESTED', () => ({
        icon: 'x',
        color: theme.colors.error,
      })),
      Match.when('COMMENTED', () => ({ icon: '~', color: theme.colors.info })),
      Match.when('DISMISSED', () => ({ icon: '-', color: theme.colors.muted })),
      Match.orElse(() => ({ icon: '*', color: theme.colors.muted })),
    )

  const { icon, color } =
    item.type === 'review'
      ? getStateIcon(item.state)
      : { icon: '~', color: theme.colors.info }

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
        {isFocus && <Text color={theme.colors.accent}>{'> '}</Text>}
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
        <Text color={theme.colors.muted}> - {timeAgo(item.date)}</Text>
      </Box>
      {item.body ? (
        <Box paddingLeft={isFocus ? 3 : 2} marginTop={0} width="80%">
          <MarkdownText content={item.isResolved ? `~~${item.body}~~` : item.body} />
        </Box>
      ) : null}
    </Box>
  )
}
