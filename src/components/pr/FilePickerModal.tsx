import React, { useState, useMemo, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'
import { fuzzyFilter } from '../../utils/fuzzy-search'
import type { FuzzyFilterResult } from '../../utils/fuzzy-search'
import type { FileChange } from '../../models/file-change'

const MAX_VISIBLE_ITEMS = 15

interface FilePickerModalProps {
  readonly files: readonly FileChange[]
  readonly recentlyViewed: readonly string[]
  readonly onSelect: (fileIndex: number) => void
  readonly onClose: () => void
}

/**
 * Get the status icon character for a file change status.
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'added': return 'A'
    case 'removed': return 'D'
    case 'renamed': return 'R'
    default: return 'M'
  }
}

/**
 * Get the theme color for a file change status.
 */
function getStatusColor(
  status: string,
  colors: { readonly diffAdd: string; readonly diffDel: string; readonly warning: string },
): string {
  switch (status) {
    case 'added': return colors.diffAdd
    case 'removed': return colors.diffDel
    default: return colors.warning
  }
}

/**
 * Sort files with recently viewed first (preserving viewed order),
 * then remaining files in original order.
 */
export function sortWithRecentFirst(
  files: readonly FileChange[],
  recentlyViewed: readonly string[],
): readonly FileChange[] {
  if (recentlyViewed.length === 0) return files
  const recentSet = new Set(recentlyViewed)
  const recentOrdered: FileChange[] = []
  for (const viewedName of recentlyViewed) {
    const file = files.find((f) => f.filename === viewedName)
    if (file) recentOrdered.push(file)
  }
  const rest = files.filter((f) => !recentSet.has(f.filename))
  return [...recentOrdered, ...rest]
}

/**
 * Renders text with fuzzy match indices highlighted in bold.
 */
function HighlightedPath({
  text,
  indices,
  normalColor,
  highlightColor,
}: {
  readonly text: string
  readonly indices: readonly number[]
  readonly normalColor: string
  readonly highlightColor: string
}): React.ReactElement {
  if (indices.length === 0) {
    return <Text color={normalColor}>{text}</Text>
  }

  const indexSet = new Set(indices)
  const parts: React.ReactElement[] = []
  let currentRun = ''
  let currentIsHighlighted = false

  for (let i = 0; i < text.length; i++) {
    const isHighlighted = indexSet.has(i)
    if (isHighlighted !== currentIsHighlighted && currentRun.length > 0) {
      parts.push(
        <Text
          key={`${i}-${currentRun}`}
          color={currentIsHighlighted ? highlightColor : normalColor}
          bold={currentIsHighlighted}
        >
          {currentRun}
        </Text>,
      )
      currentRun = ''
    }
    currentRun += text[i]
    currentIsHighlighted = isHighlighted
  }

  if (currentRun.length > 0) {
    parts.push(
      <Text
        key={`end-${currentRun}`}
        color={currentIsHighlighted ? highlightColor : normalColor}
        bold={currentIsHighlighted}
      >
        {currentRun}
      </Text>,
    )
  }

  return <>{parts}</>
}

/**
 * Renders a single file row in the file picker.
 */
function FileRow({
  file,
  isSelected,
  matchIndices,
  accentColor,
  textColor,
  mutedColor,
  warningColor,
  selectionBg,
  selectionFg,
  diffAddColor,
  diffDelColor,
}: {
  readonly file: FileChange
  readonly isSelected: boolean
  readonly matchIndices: readonly number[]
  readonly accentColor: string
  readonly textColor: string
  readonly mutedColor: string
  readonly warningColor: string
  readonly selectionBg: string
  readonly selectionFg: string
  readonly diffAddColor: string
  readonly diffDelColor: string
}): React.ReactElement {
  const fgColor = isSelected ? selectionFg : textColor
  const statusColor = isSelected
    ? selectionFg
    : getStatusColor(file.status, {
        diffAdd: diffAddColor,
        diffDel: diffDelColor,
        warning: warningColor,
      })

  return (
    <Box
      gap={1}
      paddingX={1}
      backgroundColor={isSelected ? selectionBg : undefined}
    >
      <Text color={isSelected ? selectionFg : accentColor}>
        {isSelected ? '>' : ' '}
      </Text>
      <Text color={statusColor} bold>
        {getStatusIcon(file.status)}
      </Text>
      <Box flexGrow={1} minWidth={0} overflow="hidden">
        <Text wrap="truncate-end">
          <HighlightedPath
            text={file.filename}
            indices={matchIndices}
            normalColor={fgColor}
            highlightColor={isSelected ? selectionFg : warningColor}
          />
        </Text>
      </Box>
      <Box width={14} justifyContent="flex-end">
        <Text color={isSelected ? selectionFg : diffAddColor}>
          +{file.additions}
        </Text>
        <Text color={isSelected ? selectionFg : mutedColor}> </Text>
        <Text color={isSelected ? selectionFg : diffDelColor}>
          -{file.deletions}
        </Text>
      </Box>
    </Box>
  )
}

export function FilePickerModal({
  files,
  recentlyViewed,
  onSelect,
  onClose,
}: FilePickerModalProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Mark input as active so global shortcuts are disabled
  useEffect(() => {
    setInputActive(true)
    return () => setInputActive(false)
  }, [setInputActive])

  // Filter and sort files
  const filteredFiles: readonly FuzzyFilterResult<FileChange>[] = useMemo(() => {
    if (query.length === 0) {
      const sorted = sortWithRecentFirst(files, recentlyViewed)
      return sorted.map((item) => ({ item, score: 0, indices: [] as number[] }))
    }
    return fuzzyFilter(files, query, (f) => f.filename)
  }, [files, query, recentlyViewed])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll window
  const visibleCount = Math.min(MAX_VISIBLE_ITEMS, filteredFiles.length)
  const scrollOffset = Math.max(
    0,
    Math.min(
      selectedIndex - visibleCount + 1,
      filteredFiles.length - visibleCount,
    ),
  )
  const visibleItems = filteredFiles.slice(
    scrollOffset,
    scrollOffset + visibleCount,
  )

  useInput((input, key) => {
    if (key.escape) {
      onClose()
      return
    }

    if (key.return) {
      const selected = filteredFiles[selectedIndex]
      if (selected) {
        const originalIndex = files.indexOf(selected.item)
        if (originalIndex >= 0) {
          onSelect(originalIndex)
        }
      }
      return
    }

    // Navigate with arrow keys (j/k conflict with text input)
    if (key.downArrow) {
      setSelectedIndex((prev) =>
        Math.min(prev + 1, filteredFiles.length - 1),
      )
    } else if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    }
  })

  const itemCountLabel = query
    ? `${filteredFiles.length}/${files.length}`
    : `${files.length}`

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.bg}
        paddingX={1}
        paddingY={1}
        width={80}
      >
        {/* Header */}
        <Box justifyContent="space-between" paddingX={1}>
          <Text color={theme.colors.accent} bold>
            Go to File
          </Text>
          <Text color={theme.colors.muted}>
            {itemCountLabel} files
          </Text>
        </Box>

        {/* Search input */}
        <Box paddingX={1} marginY={1}>
          <Text color={theme.colors.accent}>&gt; </Text>
          <TextInput
            defaultValue={query}
            onChange={setQuery}
            placeholder="Type to search files..."
          />
        </Box>

        {/* File list */}
        <Box flexDirection="column">
          {filteredFiles.length === 0 ? (
            <Box paddingX={2} paddingY={1}>
              <Text color={theme.colors.muted}>No matching files</Text>
            </Box>
          ) : (
            visibleItems.map((result, visIdx) => {
              const absoluteIdx = scrollOffset + visIdx
              return (
                <FileRow
                  key={result.item.filename}
                  file={result.item}
                  isSelected={absoluteIdx === selectedIndex}
                  matchIndices={result.indices}
                  accentColor={theme.colors.accent}
                  textColor={theme.colors.text}
                  mutedColor={theme.colors.muted}
                  warningColor={theme.colors.warning}
                  selectionBg={theme.colors.listSelectedBg}
                  selectionFg={theme.colors.listSelectedFg}
                  diffAddColor={theme.colors.diffAdd}
                  diffDelColor={theme.colors.diffDel}
                />
              )
            })
          )}
        </Box>

        {/* Scroll indicator */}
        {filteredFiles.length > MAX_VISIBLE_ITEMS && (
          <Box paddingX={2}>
            <Text color={theme.colors.muted}>
              {scrollOffset > 0 ? '...' : '   '}{' '}
              {selectedIndex + 1}/{filteredFiles.length}{' '}
              {scrollOffset + visibleCount < filteredFiles.length ? '...' : '   '}
            </Text>
          </Box>
        )}

        {/* Footer hints */}
        <Box paddingX={1} marginTop={1}>
          <Text color={theme.colors.muted} dimColor>
            Up/Down: navigate | Enter: go to file | Esc: close
          </Text>
        </Box>
      </Box>
    </Modal>
  )
}
