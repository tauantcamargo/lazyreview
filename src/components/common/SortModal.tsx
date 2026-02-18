import React, { useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import SelectInput from 'ink-select-input'
import { useTheme } from '../../theme/index'
import { Modal } from './Modal'
import type { SortField, SortDirection } from '../../hooks/useFilter'

/**
 * Format a sort option label with direction arrow when it's the active sort.
 */
export function formatSortLabel(
  key: SortField,
  label: string,
  currentSort: SortField,
  direction: SortDirection,
): string {
  if (key !== currentSort) return label
  return `${label} ${direction === 'desc' ? '↓' : '↑'}`
}

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

  useInput((input, key) => {
    if (key.escape || input === 's') {
      onClose()
    }
  })

  const items = useMemo(
    () =>
      SORT_OPTIONS.map((option) => ({
        label: formatSortLabel(option.key, option.label, currentSort, sortDirection),
        value: option.key,
      })),
    [currentSort, sortDirection],
  )

  const initialIndex = Math.max(
    0,
    SORT_OPTIONS.findIndex((o) => o.key === currentSort),
  )

  const handleSelect = (item: { label: string; value: SortField }) => {
    if (item.value === currentSort) {
      onSortDirectionToggle()
    } else {
      onSortChange(item.value)
    }
    onClose()
  }

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
      >
        <Text color={theme.colors.accent} bold>
          Sort by
        </Text>

        <SelectInput
          items={items}
          initialIndex={initialIndex}
          onSelect={handleSelect}
          isFocused={true}
        />

        <Text color={theme.colors.muted} dimColor>
          j/k: move | Enter: select | Esc: close
        </Text>
      </Box>
    </Modal>
  )
}
