import React, { useState, useMemo, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from './Modal'
import { Divider } from './Divider'
import { fuzzyFilter } from '../../utils/fuzzy-search'
import type { CommandPaletteAction } from '../../utils/command-palette-actions'

const MAX_VISIBLE_ITEMS = 12

interface CommandPaletteProps {
  readonly actions: readonly CommandPaletteAction[]
  readonly onSelect: (action: string) => void
  readonly onClose: () => void
}

/**
 * Renders a single action row in the command palette.
 */
function ActionRow({
  action,
  isSelected,
  matchIndices,
  accentColor,
  textColor,
  mutedColor,
  warningColor,
  selectionBg,
  selectionFg,
}: {
  readonly action: CommandPaletteAction
  readonly isSelected: boolean
  readonly matchIndices: readonly number[]
  readonly accentColor: string
  readonly textColor: string
  readonly mutedColor: string
  readonly warningColor: string
  readonly selectionBg: string
  readonly selectionFg: string
}): React.ReactElement {
  const fgColor = isSelected ? selectionFg : textColor

  return (
    <Box
      gap={1}
      paddingX={1}
      backgroundColor={isSelected ? selectionBg : undefined}
    >
      <Text color={isSelected ? selectionFg : accentColor}>
        {isSelected ? '▶' : ' '}
      </Text>
      <Box flexGrow={1}>
        <Text color={fgColor} bold={isSelected}>
          {renderHighlightedText(action.description, matchIndices, fgColor, accentColor)}
        </Text>
      </Box>
      <Box width={12} justifyContent="flex-end">
        <Text color={isSelected ? selectionFg : mutedColor}>
          {action.contextLabel}
        </Text>
      </Box>
      <Box width={10} justifyContent="flex-end">
        <Text color={isSelected ? selectionFg : warningColor}>
          {action.keyDisplay}
        </Text>
      </Box>
    </Box>
  )
}

/**
 * Renders text with fuzzy match indices highlighted.
 * When there are no match indices, returns plain text.
 */
function renderHighlightedText(
  text: string,
  indices: readonly number[],
  normalColor: string,
  highlightColor: string,
): React.ReactElement {
  if (indices.length === 0) {
    return React.createElement(Text, { color: normalColor }, text)
  }

  const indexSet = new Set(indices)
  const parts: React.ReactElement[] = []
  let currentRun = ''
  let currentIsHighlighted = false

  for (let i = 0; i < text.length; i++) {
    const isHighlighted = indexSet.has(i)
    if (isHighlighted !== currentIsHighlighted && currentRun.length > 0) {
      parts.push(
        React.createElement(
          Text,
          {
            key: `${i}-${currentRun}`,
            color: currentIsHighlighted ? highlightColor : normalColor,
            bold: currentIsHighlighted,
          },
          currentRun,
        ),
      )
      currentRun = ''
    }
    currentRun += text[i]
    currentIsHighlighted = isHighlighted
  }

  if (currentRun.length > 0) {
    parts.push(
      React.createElement(
        Text,
        {
          key: `end-${currentRun}`,
          color: currentIsHighlighted ? highlightColor : normalColor,
          bold: currentIsHighlighted,
        },
        currentRun,
      ),
    )
  }

  return React.createElement(React.Fragment, null, ...parts)
}

export function CommandPalette({
  actions,
  onSelect,
  onClose,
}: CommandPaletteProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Mark input as active so global shortcuts are disabled
  useEffect(() => {
    setInputActive(true)
    return () => setInputActive(false)
  }, [setInputActive])

  // Filter actions based on the query
  const filteredActions = useMemo(() => {
    const results = fuzzyFilter(
      actions,
      query,
      (a) => `${a.description} ${a.contextLabel}`,
    )
    return results
  }, [actions, query])

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Compute visible window for scrolling
  const visibleCount = Math.min(MAX_VISIBLE_ITEMS, filteredActions.length)
  const scrollOffset = Math.max(
    0,
    Math.min(selectedIndex - visibleCount + 1, filteredActions.length - visibleCount),
  )
  const visibleItems = filteredActions.slice(scrollOffset, scrollOffset + visibleCount)

  useInput((input, key) => {
    if (key.escape) {
      onClose()
      return
    }

    if (key.return) {
      const selected = filteredActions[selectedIndex]
      if (selected) {
        onSelect(selected.item.action)
      }
      return
    }

    // Navigate with arrow keys (j/k would conflict with text input)
    if (key.downArrow) {
      setSelectedIndex((prev) =>
        Math.min(prev + 1, filteredActions.length - 1),
      )
    } else if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    }
  })

  const itemCountLabel = query
    ? `${filteredActions.length}/${actions.length}`
    : `${actions.length}`

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.bg}
        paddingX={1}
        paddingY={1}
        width={64}
      >
        {/* Header */}
        <Box justifyContent="space-between" paddingX={1}>
          <Text color={theme.colors.accent} bold>
            Command Palette
          </Text>
          <Text color={theme.colors.muted}>
            {itemCountLabel} actions
          </Text>
        </Box>

        {/* Search input */}
        <Box paddingX={1} marginY={1}>
          <Text color={theme.colors.accent}>&gt; </Text>
          <TextInput
            defaultValue={query}
            onChange={setQuery}
            placeholder="Type to search actions..."
          />
        </Box>

        <Divider style="single" />

        {/* Action list */}
        <Box flexDirection="column">
          {filteredActions.length === 0 ? (
            <Box paddingX={2} paddingY={1}>
              <Text color={theme.colors.muted}>No matching actions</Text>
            </Box>
          ) : (
            visibleItems.map((result, visIdx) => {
              const absoluteIdx = scrollOffset + visIdx
              return (
                <ActionRow
                  key={result.item.action}
                  action={result.item}
                  isSelected={absoluteIdx === selectedIndex}
                  matchIndices={result.indices}
                  accentColor={theme.colors.accent}
                  textColor={theme.colors.text}
                  mutedColor={theme.colors.muted}
                  warningColor={theme.colors.warning}
                  selectionBg={theme.colors.listSelectedBg}
                  selectionFg={theme.colors.listSelectedFg}
                />
              )
            })
          )}
        </Box>

        {/* Scroll indicator */}
        {filteredActions.length > MAX_VISIBLE_ITEMS && (
          <Box paddingX={2}>
            <Text color={theme.colors.muted}>
              {scrollOffset > 0 ? '...' : '   '} {selectedIndex + 1}/{filteredActions.length} {scrollOffset + visibleCount < filteredActions.length ? '...' : '   '}
            </Text>
          </Box>
        )}

        {/* Footer hints */}
        <Box paddingX={1} marginTop={1}>
          <Text color={theme.colors.muted} dimColor>
            Up/Down: navigate | Enter: execute | Esc: close
          </Text>
        </Box>
      </Box>
    </Modal>
  )
}
