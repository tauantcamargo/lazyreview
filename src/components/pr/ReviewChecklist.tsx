/**
 * Collapsible review checklist section.
 *
 * Renders a list of checklist items with checkboxes that the reviewer
 * can toggle. Space toggles the focused item. Navigate items with j/k
 * when expanded. Toggle expand/collapse with 'c'.
 *
 * Header shows completion count: "Review Checklist (3/5)"
 * Checked items render in success (green), unchecked in default text color.
 */
import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import type { ChecklistState } from '../../models/review-checklist'
import { completionSummary } from '../../models/review-checklist'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewChecklistProps {
  readonly state: ChecklistState
  readonly onToggle: (index: number) => void
  readonly isActive: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewChecklist({
  state,
  onToggle,
  isActive,
}: ReviewChecklistProps): React.ReactElement | null {
  const theme = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const summary = completionSummary(state)

  useInput(
    (input, key) => {
      if (input === 'c' && !key.ctrl && !key.meta) {
        setIsExpanded((prev) => !prev)
      }
      if (isExpanded) {
        if (input === 'j' || key.downArrow) {
          setSelectedIndex((prev) =>
            Math.min(prev + 1, state.items.length - 1),
          )
        }
        if (input === 'k' || key.upArrow) {
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
        }
        if (input === ' ') {
          onToggle(selectedIndex)
        }
      }
    },
    { isActive },
  )

  if (state.items.length === 0) {
    return null
  }

  const toggleHint = isExpanded ? '[c: collapse]' : '[c: expand]'
  const headerColor = summary.checked === summary.total
    ? theme.colors.success
    : theme.colors.info

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      borderStyle="single"
      borderColor={theme.colors.border}
      overflow="hidden"
    >
      {/* Header row */}
      <Box flexDirection="row" gap={1}>
        <Text color={headerColor} bold>
          Review Checklist ({summary.checked}/{summary.total})
        </Text>
        <Text color={theme.colors.muted} dimColor>
          {toggleHint}
        </Text>
      </Box>

      {/* Expanded content */}
      {isExpanded && (
        <Box flexDirection="column" paddingTop={1} paddingLeft={1}>
          {state.items.map((item, index) => {
            const isSelected = index === selectedIndex
            const checkbox = item.checked ? '[x]' : '[ ]'
            const checkColor = item.checked
              ? theme.colors.success
              : theme.colors.text

            return (
              <Box key={item.label} flexDirection="column">
                <Box flexDirection="row" gap={1}>
                  <Text
                    color={
                      isSelected ? theme.colors.accent : theme.colors.muted
                    }
                  >
                    {isSelected ? '>' : ' '}
                  </Text>
                  <Text color={checkColor}>{checkbox}</Text>
                  <Text
                    color={
                      item.checked ? theme.colors.success : theme.colors.text
                    }
                  >
                    {item.label}
                  </Text>
                </Box>
                {item.description && isExpanded && (
                  <Box paddingLeft={6}>
                    <Text color={theme.colors.muted} dimColor>
                      {item.description}
                    </Text>
                  </Box>
                )}
              </Box>
            )
          })}
          <Box paddingTop={1}>
            <Text color={theme.colors.muted} dimColor>
              <Text color={theme.colors.accent}>Space</Text> toggle item
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
