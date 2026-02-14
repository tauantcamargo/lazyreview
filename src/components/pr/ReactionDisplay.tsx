import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { ReactionSummary } from '../../models/reaction'
import { REACTION_LABELS, REACTION_TYPES, type ReactionType } from '../../models/reaction'

interface ReactionDisplayProps {
  readonly reactions: ReactionSummary
}

/**
 * Displays reaction badges inline below a comment.
 * Shows only reactions with count > 0 as compact badges.
 * Example: "+1 (3)  heart (1)  rocket (2)"
 */
export function ReactionDisplay({
  reactions,
}: ReactionDisplayProps): React.ReactElement | null {
  const theme = useTheme()

  const active = REACTION_TYPES.filter((type) => reactions[type] > 0)

  if (active.length === 0) {
    return null
  }

  return (
    <Box flexDirection="row" gap={1} flexWrap="wrap">
      {active.map((type: ReactionType) => (
        <Box key={type}>
          <Text color={theme.colors.muted}>
            {REACTION_LABELS[type]} ({reactions[type]})
          </Text>
        </Box>
      ))}
    </Box>
  )
}
