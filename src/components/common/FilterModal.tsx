import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from './Modal'
import type { FilterState, SortField, FacetOption } from '../../hooks/useFilter'

type FilterField = 'search' | 'repo' | 'author' | 'label'

const FILTER_FIELDS: readonly FilterField[] = ['search', 'repo', 'author', 'label']

interface FilterModalProps {
  readonly filter: FilterState
  readonly availableRepos: readonly string[]
  readonly availableAuthors: readonly string[]
  readonly availableLabels: readonly string[]
  readonly repoFacets: readonly FacetOption[]
  readonly authorFacets: readonly FacetOption[]
  readonly labelFacets: readonly FacetOption[]
  readonly onSearchChange: (search: string) => void
  readonly onRepoChange: (repo: string | null) => void
  readonly onAuthorChange: (author: string | null) => void
  readonly onLabelChange: (label: string | null) => void
  readonly onSortChange: (sortBy: SortField) => void
  readonly onSortDirectionToggle: () => void
  readonly onClear: () => void
  readonly onClose: () => void
}

function FacetSection({
  title,
  options,
  selectedValue,
  isFocused,
  highlightIndex,
  accentColor,
  textColor,
  mutedColor,
  selectionColor,
  warningColor,
}: {
  readonly title: string
  readonly options: readonly FacetOption[]
  readonly selectedValue: string | null
  readonly isFocused: boolean
  readonly highlightIndex: number
  readonly accentColor: string
  readonly textColor: string
  readonly mutedColor: string
  readonly selectionColor: string
  readonly warningColor: string
}): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={isFocused ? accentColor : mutedColor} bold={isFocused}>
          {isFocused ? '▶ ' : '  '}{title}
        </Text>
        {selectedValue && (
          <Text color={warningColor}>[{selectedValue}]</Text>
        )}
      </Box>
      <Box flexDirection="column" paddingLeft={1}>
        {options.length === 0 ? (
          <Text color={mutedColor}>  (none)</Text>
        ) : (
          options.slice(0, 8).map((opt, idx) => {
            const isHighlighted = isFocused && idx === highlightIndex
            const isSelected = selectedValue === opt.value
            return (
              <Box key={opt.value} gap={1}>
                <Text
                  color={isSelected ? warningColor : isHighlighted ? accentColor : textColor}
                  backgroundColor={isHighlighted ? selectionColor : undefined}
                  bold={isSelected || isHighlighted}
                >
                  {isHighlighted ? '▶' : ' '} {isSelected ? '✓' : '○'} {opt.value}
                </Text>
                <Text color={mutedColor}>({opt.count})</Text>
              </Box>
            )
          })
        )}
        {options.length > 8 && (
          <Text color={mutedColor}>  +{options.length - 8} more</Text>
        )}
      </Box>
    </Box>
  )
}

export function FilterModal({
  filter,
  repoFacets,
  authorFacets,
  labelFacets,
  onSearchChange,
  onRepoChange,
  onAuthorChange,
  onLabelChange,
  onClear,
  onClose,
}: FilterModalProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const [activeField, setActiveField] = useState<FilterField>('search')
  const [searchValue, setSearchValue] = useState(filter.search)
  const [repoIndex, setRepoIndex] = useState(0)
  const [authorIndex, setAuthorIndex] = useState(0)
  const [labelIndex, setLabelIndex] = useState(0)

  const isSearchField = activeField === 'search'

  useEffect(() => {
    setInputActive(isSearchField)
    return () => setInputActive(false)
  }, [setInputActive, isSearchField])

  // Apply search immediately on change
  useEffect(() => {
    onSearchChange(searchValue)
  }, [searchValue, onSearchChange])

  const getMaxIndex = (field: FilterField): number => {
    switch (field) {
      case 'repo':
        return Math.max(0, Math.min(repoFacets.length, 8) - 1)
      case 'author':
        return Math.max(0, Math.min(authorFacets.length, 8) - 1)
      case 'label':
        return Math.max(0, Math.min(labelFacets.length, 8) - 1)
      default:
        return 0
    }
  }

  useInput((input, key) => {
    if (key.escape) {
      onClose()
      return
    }

    if (key.tab) {
      const currentIdx = FILTER_FIELDS.indexOf(activeField)
      const nextIdx = (currentIdx + 1) % FILTER_FIELDS.length
      setActiveField(FILTER_FIELDS[nextIdx]!)
      return
    }

    if (isSearchField) {
      if (input === 'c' && key.ctrl) {
        onClear()
      }
      return
    }

    // Facet navigation
    if (input === 'j' || key.downArrow) {
      const max = getMaxIndex(activeField)
      if (activeField === 'repo') setRepoIndex((prev) => Math.min(prev + 1, max))
      if (activeField === 'author') setAuthorIndex((prev) => Math.min(prev + 1, max))
      if (activeField === 'label') setLabelIndex((prev) => Math.min(prev + 1, max))
    } else if (input === 'k' || key.upArrow) {
      if (activeField === 'repo') setRepoIndex((prev) => Math.max(prev - 1, 0))
      if (activeField === 'author') setAuthorIndex((prev) => Math.max(prev - 1, 0))
      if (activeField === 'label') setLabelIndex((prev) => Math.max(prev - 1, 0))
    } else if (key.return) {
      // Toggle selection
      if (activeField === 'repo') {
        const opt = repoFacets[repoIndex]
        if (opt) onRepoChange(filter.repo === opt.value ? null : opt.value)
      } else if (activeField === 'author') {
        const opt = authorFacets[authorIndex]
        if (opt) onAuthorChange(filter.author === opt.value ? null : opt.value)
      } else if (activeField === 'label') {
        const opt = labelFacets[labelIndex]
        if (opt) onLabelChange(filter.label === opt.value ? null : opt.value)
      }
    } else if (input === 'd') {
      // Clear current field filter
      if (activeField === 'repo') onRepoChange(null)
      else if (activeField === 'author') onAuthorChange(null)
      else if (activeField === 'label') onLabelChange(null)
    } else if (input === 'C') {
      onClear()
    }
  })

  const hasAnyFilter =
    filter.search !== '' ||
    filter.repo !== null ||
    filter.author !== null ||
    filter.label !== null

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
          Filter PRs
        </Text>

        {hasAnyFilter && (
          <Box gap={1} flexWrap="wrap">
            <Text color={theme.colors.muted}>Active:</Text>
            {filter.search && (
              <Text color={theme.colors.warning}>search:&quot;{filter.search}&quot;</Text>
            )}
            {filter.repo && (
              <Text color={theme.colors.warning}>repo:{filter.repo}</Text>
            )}
            {filter.author && (
              <Text color={theme.colors.warning}>author:{filter.author}</Text>
            )}
            {filter.label && (
              <Text color={theme.colors.warning}>label:{filter.label}</Text>
            )}
          </Box>
        )}

        <Box flexDirection="column">
          <Box gap={1}>
            <Text
              color={isSearchField ? theme.colors.accent : theme.colors.muted}
              bold={isSearchField}
            >
              {isSearchField ? '▶ ' : '  '}Search
            </Text>
          </Box>
          <Box paddingLeft={1}>
            {isSearchField ? (
              <TextInput
                defaultValue={searchValue}
                onChange={setSearchValue}
                placeholder="Type to search..."
              />
            ) : (
              <Text color={searchValue ? theme.colors.text : theme.colors.muted}>
                {searchValue || '(none)'}
              </Text>
            )}
          </Box>
        </Box>

        <FacetSection
          title="Repository"
          options={repoFacets}
          selectedValue={filter.repo}
          isFocused={activeField === 'repo'}
          highlightIndex={repoIndex}
          accentColor={theme.colors.accent}
          textColor={theme.colors.text}
          mutedColor={theme.colors.muted}
          selectionColor={theme.colors.selection}
          warningColor={theme.colors.warning}
        />

        <FacetSection
          title="Author"
          options={authorFacets}
          selectedValue={filter.author}
          isFocused={activeField === 'author'}
          highlightIndex={authorIndex}
          accentColor={theme.colors.accent}
          textColor={theme.colors.text}
          mutedColor={theme.colors.muted}
          selectionColor={theme.colors.selection}
          warningColor={theme.colors.warning}
        />

        <FacetSection
          title="Label"
          options={labelFacets}
          selectedValue={filter.label}
          isFocused={activeField === 'label'}
          highlightIndex={labelIndex}
          accentColor={theme.colors.accent}
          textColor={theme.colors.text}
          mutedColor={theme.colors.muted}
          selectionColor={theme.colors.selection}
          warningColor={theme.colors.warning}
        />

        <Text color={theme.colors.muted} dimColor>
          Tab: switch field | j/k: navigate | Enter: toggle | d: clear field | C: clear all | Esc: close
        </Text>
      </Box>
    </Modal>
  )
}
