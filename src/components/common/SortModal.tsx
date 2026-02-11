import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { Modal } from './Modal'
import type { SortField, SortDirection } from '../../hooks/useFilter'

const SORT_OPTIONS: readonly { key: SortField; label: string }[] = [
  { key: 'updated', label: 'Last Updated' },
  { key: 'created', label: 'Created Date' },
  { key: 'repo', label: 'Repository' },
  { key: 'author', label: 'Author' },
  { key: 'title', label: 'Title' },
]

interface SortModalProps {
  readonly currentSort: SortField
  readonly sortDirection: SortDirection
  readonly onSortChange: (sortBy: SortField) => void
  readonly onSortDirectionToggle: () => void
  readonly onClose: () => void
}

export function SortModal({
  currentSort,
  sortDirection,
  onSortChange,
  onSortDirectionToggle,
  onClose,
}: SortModalProps): React.ReactElement {
  const theme = useTheme()
  const currentIndex = SORT_OPTIONS.findIndex((o) => o.key === currentSort)
  const [selectedIndex, setSelectedIndex] = useState(
    currentIndex >= 0 ? currentIndex : 0,
  )

  useInput((input, key) => {
    if (key.escape || input === 's') {
      onClose()
    } else if (input === 'j' || key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, SORT_OPTIONS.length - 1))
    } else if (input === 'k' || key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (key.return) {
      const selected = SORT_OPTIONS[selectedIndex]
      if (selected.key === currentSort) {
        onSortDirectionToggle()
      } else {
        onSortChange(selected.key)
      }
      onClose()
    }
  })

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        // @ts-ignore
        backgroundColor={theme.colors.bg}
        paddingX={2}
        paddingY={1}
        gap={1}
      >
        <Text color={theme.colors.accent} bold>
          Sort by
        </Text>

        <Box flexDirection="column">
          {SORT_OPTIONS.map((option, idx) => {
            const isSelected = idx === selectedIndex
            const isCurrent = option.key === currentSort
            const arrow = sortDirection === 'desc' ? '↓' : '↑'

            return (
              <Box key={option.key} gap={2}>
                <Box width={20}>
                  <Text
                    color={
                      isCurrent
                        ? theme.colors.success
                        : isSelected
                          ? theme.colors.accent
                          : theme.colors.text
                    }
                    bold={isSelected}
                  >
                    {isSelected ? '▸ ' : '  '}
                    {option.label}
                  </Text>
                </Box>
                {isCurrent && <Text color={theme.colors.warning}>{arrow}</Text>}
              </Box>
            )
          })}
        </Box>

        <Text color={theme.colors.muted} dimColor>
          j/k: move | Enter: select | Esc: close
        </Text>
      </Box>
    </Modal>
  )
}
