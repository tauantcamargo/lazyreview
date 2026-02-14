import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { Modal } from '../common/Modal'
import { REACTION_TYPES, REACTION_LABELS, type ReactionType } from '../../models/reaction'

interface ReactionPickerProps {
  readonly onSelect: (reaction: ReactionType) => void
  readonly onClose: () => void
  readonly isSubmitting: boolean
  readonly error: string | null
}

/**
 * Modal picker for selecting a reaction to add to a comment.
 * Shows all 8 standard reaction types in a navigable list.
 * Uses j/k for navigation, Enter to select, Esc to cancel.
 */
export function ReactionPicker({
  onSelect,
  onClose,
  isSubmitting,
  error,
}: ReactionPickerProps): React.ReactElement {
  const theme = useTheme()
  const [selectedIndex, setSelectedIndex] = useState(0)

  useInput(
    (input, key) => {
      if (isSubmitting) return

      if (key.escape) {
        onClose()
      } else if (input === 'j' || key.downArrow) {
        setSelectedIndex((prev) => Math.min(prev + 1, REACTION_TYPES.length - 1))
      } else if (input === 'k' || key.upArrow) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (key.return) {
        const selected = REACTION_TYPES[selectedIndex]
        if (selected) {
          onSelect(selected)
        }
      }
    },
    { isActive: true },
  )

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.bg}
        paddingX={2}
        paddingY={1}
        gap={1}
        width={30}
      >
        <Text color={theme.colors.accent} bold>
          Add Reaction
        </Text>

        <Box flexDirection="column">
          {REACTION_TYPES.map((type, index) => (
            <Box key={type} gap={1}>
              <Text color={index === selectedIndex ? theme.colors.accent : theme.colors.muted}>
                {index === selectedIndex ? '>' : ' '}
              </Text>
              <Text
                color={index === selectedIndex ? theme.colors.text : theme.colors.muted}
                bold={index === selectedIndex}
              >
                {REACTION_LABELS[type]}
              </Text>
            </Box>
          ))}
        </Box>

        {isSubmitting && (
          <Text color={theme.colors.info}>Adding reaction...</Text>
        )}

        {error && (
          <Text color={theme.colors.error}>{error}</Text>
        )}

        <Text color={theme.colors.muted} dimColor>
          j/k: navigate | Enter: select | Esc: cancel
        </Text>
      </Box>
    </Modal>
  )
}
