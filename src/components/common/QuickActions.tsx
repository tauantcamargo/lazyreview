import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { Modal } from './Modal'
import type { QuickAction } from '../../utils/quick-actions'

interface ActionRowProps {
  readonly action: QuickAction
  readonly isSelected: boolean
  readonly accentColor: string
  readonly textColor: string
  readonly mutedColor: string
  readonly selectionBg: string
  readonly selectionFg: string
}

/**
 * Renders a single action row with label on the left
 * and keybinding hint on the right (dimmed).
 */
function ActionRow({
  action,
  isSelected,
  accentColor,
  textColor,
  mutedColor,
  selectionBg,
  selectionFg,
}: ActionRowProps): React.ReactElement {
  const fgColor = isSelected ? selectionFg : textColor

  return (
    <Box
      gap={1}
      paddingX={1}
      backgroundColor={isSelected ? selectionBg : undefined}
    >
      <Text color={isSelected ? selectionFg : accentColor}>
        {isSelected ? '>' : ' '}
      </Text>
      <Box flexGrow={1}>
        <Text color={fgColor} bold={isSelected}>
          {action.label}
        </Text>
      </Box>
      <Box width={12} justifyContent="flex-end">
        <Text color={isSelected ? selectionFg : mutedColor} dimColor={!isSelected}>
          {action.keybinding}
        </Text>
      </Box>
    </Box>
  )
}

interface QuickActionsProps {
  readonly actions: readonly QuickAction[]
  readonly onSelect: (action: string) => void
  readonly onClose: () => void
}

/**
 * Quick-actions popup triggered by the `.` key.
 * Displays a small context-sensitive list of actions with
 * j/k navigation, Enter to select, and Escape to close.
 */
export function QuickActions({
  actions,
  onSelect,
  onClose,
}: QuickActionsProps): React.ReactElement {
  const theme = useTheme()
  const [selectedIndex, setSelectedIndex] = useState(0)

  useInput((input, key) => {
    if (key.escape) {
      onClose()
      return
    }

    if (key.return) {
      const selected = actions[selectedIndex]
      if (selected) {
        onSelect(selected.action)
      }
      return
    }

    // Navigate with j/k or arrow keys
    if (input === 'j' || key.downArrow) {
      setSelectedIndex((prev) =>
        Math.min(prev + 1, actions.length - 1),
      )
    } else if (input === 'k' || key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    }
  })

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.bg}
        paddingX={1}
        paddingY={1}
        width={48}
      >
        {/* Header */}
        <Box paddingX={1} marginBottom={1}>
          <Text color={theme.colors.accent} bold>
            Quick Actions
          </Text>
        </Box>

        {/* Action list */}
        <Box flexDirection="column">
          {actions.length === 0 ? (
            <Box paddingX={2} paddingY={1}>
              <Text color={theme.colors.muted}>No actions available</Text>
            </Box>
          ) : (
            actions.map((action, idx) => (
              <ActionRow
                key={action.action}
                action={action}
                isSelected={idx === selectedIndex}
                accentColor={theme.colors.accent}
                textColor={theme.colors.text}
                mutedColor={theme.colors.muted}
                selectionBg={theme.colors.listSelectedBg}
                selectionFg={theme.colors.listSelectedFg}
              />
            ))
          )}
        </Box>

        {/* Footer hints */}
        <Box paddingX={1} marginTop={1}>
          <Text color={theme.colors.muted} dimColor>
            j/k: navigate | Enter: select | Esc: close
          </Text>
        </Box>
      </Box>
    </Modal>
  )
}
