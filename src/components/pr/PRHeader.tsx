import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { PullRequest } from '../../models/pull-request'
import { timeAgo } from '../../utils/date'
import { contrastForeground, normalizeHexColor } from '../../utils/color'
import { detectConflictState } from '../../utils/conflict-detection'

interface PRHeaderProps {
  readonly pr: PullRequest
  readonly prIndex?: number
  readonly prTotal?: number
  readonly hasNotes?: boolean
}

export function PRHeader({ pr, prIndex, prTotal, hasNotes }: PRHeaderProps): React.ReactElement {
  const theme = useTheme()
  const totalComments = pr.comments + pr.review_comments
  const conflictState = detectConflictState(pr)

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
      {/* Line 1: [STATE] #number  title  [Notes] [CONFLICTS] (idx/total) */}
      <Box gap={1}>
        <Text color={stateColor} bold inverse>
          {stateLabel}
        </Text>
        <Text color={theme.colors.accent} bold>
          #{pr.number}
        </Text>
        <Text color={theme.colors.text} bold>
          {pr.title}
        </Text>
        {hasNotes && (
          <Text color={theme.colors.warning} bold>
            [Notes]
          </Text>
        )}
        {conflictState.hasConflicts && (
          <Text color={theme.colors.error} bold>
            [CONFLICTS]
          </Text>
        )}
        {pr.mergeable === null && (
          <Text color={theme.colors.muted}>
            [?merge]
          </Text>
        )}
        {prTotal !== undefined && prIndex !== undefined && prTotal > 1 && (
          <Text color={theme.colors.muted}>
            ({prIndex + 1}/{prTotal})
          </Text>
        )}
      </Box>
      {/* Line 2: user → head → base · opened N ago · +adds -dels · N files · N comments */}
      <Box gap={1} paddingLeft={2}>
        <Text color={theme.colors.secondary}>{pr.user.login}</Text>
        <Text color={theme.colors.muted}>→</Text>
        <Text color={theme.colors.info}>{pr.head.ref}</Text>
        <Text color={theme.colors.muted}>→</Text>
        <Text color={theme.colors.info}>{pr.base.ref}</Text>
        <Text color={theme.colors.muted}>·</Text>
        <Text color={theme.colors.muted}>opened {timeAgo(pr.created_at)}</Text>
        <Text color={theme.colors.muted}>·</Text>
        <Text color={theme.colors.diffAdd}>+{pr.additions}</Text>
        <Text color={theme.colors.diffDel}>-{pr.deletions}</Text>
        <Text color={theme.colors.muted}>·</Text>
        <Text color={theme.colors.muted}>{pr.changed_files} files</Text>
        {totalComments > 0 && (
          <>
            <Text color={theme.colors.muted}>·</Text>
            <Text color={theme.colors.info}>
              {totalComments} 💬
            </Text>
          </>
        )}
      </Box>
      {/* Line 3: labels (only when present) */}
      {pr.labels.length > 0 && (
        <Box gap={1} paddingLeft={2}>
          {pr.labels.map((label) => {
            const bgColor = label.color ? normalizeHexColor(label.color) : undefined
            const fgColor = label.color ? contrastForeground(label.color) : theme.colors.muted
            return (
              <Text
                key={label.id}
                color={fgColor}
                backgroundColor={bgColor}
              >
                {` ${label.name} `}
              </Text>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
