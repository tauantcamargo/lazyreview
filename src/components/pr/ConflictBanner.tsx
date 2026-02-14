import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { ConflictState } from '../../utils/conflict-detection'

interface ConflictBannerProps {
  readonly state: ConflictState
}

/**
 * A warning banner that displays merge conflict status at the top of a tab.
 * Shows nothing when there are no issues (clean state with empty message).
 */
export function ConflictBanner({ state }: ConflictBannerProps): React.ReactElement | null {
  const theme = useTheme()

  // Nothing to display
  if (!state.hasConflicts && state.conflictMessage === '') {
    return null
  }

  if (state.hasConflicts) {
    return (
      <Box
        paddingX={1}
        borderStyle="single"
        borderColor={theme.colors.error}
        flexDirection="column"
      >
        <Box gap={1}>
          <Text color={theme.colors.error} bold>
            CONFLICTS
          </Text>
          <Text color={theme.colors.error}>{state.conflictMessage}</Text>
        </Box>
        <Box gap={2}>
          <Text color={theme.colors.muted} dimColor>
            Tip: Pull the base branch and resolve conflicts locally, then push
          </Text>
          <Text color={theme.colors.info} dimColor>
            View Conflicts (C)
          </Text>
        </Box>
      </Box>
    )
  }

  // Non-conflict warning (unstable, blocked, behind, computing)
  const color = state.mergeableState === null
    ? theme.colors.muted
    : theme.colors.warning

  return (
    <Box paddingX={1}>
      <Text color={color}>{state.conflictMessage}</Text>
    </Box>
  )
}
