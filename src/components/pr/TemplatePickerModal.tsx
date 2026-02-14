import React, { useState, useMemo, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'
import { fuzzyFilter } from '../../utils/fuzzy-search'
import type { CommentTemplate } from '../../models/comment-template'

const MAX_VISIBLE_ITEMS = 10

interface TemplatePickerModalProps {
  readonly templates: readonly CommentTemplate[]
  readonly onSelect: (template: CommentTemplate) => void
  readonly onClose: () => void
}

/**
 * Renders a single template row in the picker.
 */
function TemplateRow({
  template,
  isSelected,
  matchIndices,
  accentColor,
  textColor,
  mutedColor,
  warningColor,
  selectionBg,
  selectionFg,
}: {
  readonly template: CommentTemplate
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
        {isSelected ? '>' : ' '}
      </Text>
      <Box width={16}>
        <Text color={fgColor} bold={isSelected}>
          {renderHighlightedText(template.name, matchIndices, fgColor, warningColor)}
        </Text>
      </Box>
      {template.prefix !== undefined && template.prefix !== '' && (
        <Box width={14}>
          <Text color={isSelected ? selectionFg : mutedColor} dimColor={!isSelected}>
            {template.prefix}
          </Text>
        </Box>
      )}
      {(template.prefix === undefined || template.prefix === '') && (
        <Box width={14}>
          <Text color={mutedColor}> </Text>
        </Box>
      )}
      <Box flexGrow={1}>
        <Text color={isSelected ? selectionFg : mutedColor}>
          {template.description ?? ''}
        </Text>
      </Box>
    </Box>
  )
}

/**
 * Renders text with fuzzy match indices highlighted.
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

/**
 * Build the searchable text for a template.
 */
function getSearchText(template: CommentTemplate): string {
  return `${template.name} ${template.prefix ?? ''} ${template.description ?? ''}`
}

export function TemplatePickerModal({
  templates,
  onSelect,
  onClose,
}: TemplatePickerModalProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Mark input as active so global shortcuts are disabled
  useEffect(() => {
    setInputActive(true)
    return () => setInputActive(false)
  }, [setInputActive])

  // Filter templates based on the query
  const filteredTemplates = useMemo(() => {
    return fuzzyFilter(templates, query, getSearchText)
  }, [templates, query])

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Compute visible window for scrolling
  const visibleCount = Math.min(MAX_VISIBLE_ITEMS, filteredTemplates.length)
  const scrollOffset = Math.max(
    0,
    Math.min(selectedIndex - visibleCount + 1, filteredTemplates.length - visibleCount),
  )
  const visibleItems = filteredTemplates.slice(scrollOffset, scrollOffset + visibleCount)

  useInput((input, key) => {
    if (key.escape) {
      onClose()
      return
    }

    if (key.return) {
      const selected = filteredTemplates[selectedIndex]
      if (selected) {
        onSelect(selected.item)
      }
      return
    }

    // Navigate with arrow keys (j/k would conflict with text input)
    if (key.downArrow) {
      setSelectedIndex((prev) =>
        Math.min(prev + 1, filteredTemplates.length - 1),
      )
    } else if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    }
  })

  const itemCountLabel = query
    ? `${filteredTemplates.length}/${templates.length}`
    : `${templates.length}`

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.bg}
        paddingX={1}
        paddingY={1}
        width={68}
      >
        {/* Header */}
        <Box justifyContent="space-between" paddingX={1}>
          <Text color={theme.colors.accent} bold>
            Insert Template
          </Text>
          <Text color={theme.colors.muted}>
            {itemCountLabel} templates
          </Text>
        </Box>

        {/* Search input */}
        <Box paddingX={1} marginY={1}>
          <Text color={theme.colors.accent}>&gt; </Text>
          <TextInput
            defaultValue={query}
            onChange={setQuery}
            placeholder="Type to search templates..."
          />
        </Box>

        {/* Template list */}
        <Box flexDirection="column">
          {filteredTemplates.length === 0 ? (
            <Box paddingX={2} paddingY={1}>
              <Text color={theme.colors.muted}>No matching templates</Text>
            </Box>
          ) : (
            visibleItems.map((result, visIdx) => {
              const absoluteIdx = scrollOffset + visIdx
              return (
                <TemplateRow
                  key={result.item.name}
                  template={result.item}
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
        {filteredTemplates.length > MAX_VISIBLE_ITEMS && (
          <Box paddingX={2}>
            <Text color={theme.colors.muted}>
              {scrollOffset > 0 ? '...' : '   '} {selectedIndex + 1}/{filteredTemplates.length} {scrollOffset + visibleCount < filteredTemplates.length ? '...' : '   '}
            </Text>
          </Box>
        )}

        {/* Footer hints */}
        <Box paddingX={1} marginTop={1}>
          <Text color={theme.colors.muted} dimColor>
            Up/Down: navigate | Enter: insert | Esc: cancel
          </Text>
        </Box>
      </Box>
    </Modal>
  )
}
