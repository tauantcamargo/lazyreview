import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from './Modal'
import type { FilterState, SortField } from '../../hooks/useFilter'

interface FilterModalProps {
  readonly filter: FilterState
  readonly availableRepos: readonly string[]
  readonly availableAuthors: readonly string[]
  readonly availableLabels: readonly string[]
  readonly onSearchChange: (search: string) => void
  readonly onRepoChange: (repo: string | null) => void
  readonly onAuthorChange: (author: string | null) => void
  readonly onLabelChange: (label: string | null) => void
  readonly onSortChange: (sortBy: SortField) => void
  readonly onSortDirectionToggle: () => void
  readonly onClear: () => void
  readonly onClose: () => void
}

export function FilterModal({
  filter,
  onSearchChange,
  onClear,
  onClose,
}: FilterModalProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const [searchValue, setSearchValue] = useState(filter.search)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    setInputActive(true)
    return () => setInputActive(false)
  }, [setInputActive])

  useInput((input, key) => {
    if (showClearConfirm) {
      if (input === 'y' || input === 'Y') {
        onClear()
        onClose()
      } else if (input === 'n' || input === 'N' || key.escape) {
        setShowClearConfirm(false)
      }
      return
    }

    if (key.escape) {
      onClose()
    } else if (key.return) {
      onSearchChange(searchValue)
      onClose()
    } else if (input === 'c' && filter.search) {
      setShowClearConfirm(true)
    }
  })

  if (showClearConfirm) {
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
            Clear all filters?
          </Text>
          <Text color={theme.colors.text}>y: Yes, n: No</Text>
        </Box>
      </Modal>
    )
  }

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
          Search PRs
        </Text>

        <Text color={theme.colors.muted}>
          Filter by title, number, or author
        </Text>

        <Box>
          <TextInput
            defaultValue={searchValue}
            onChange={setSearchValue}
            placeholder="Type to search..."
          />
        </Box>

        <Text color={theme.colors.muted} dimColor>
          Enter: apply | Esc: cancel{filter.search ? ' | c: clear' : ''}
        </Text>
      </Box>
    </Modal>
  )
}
