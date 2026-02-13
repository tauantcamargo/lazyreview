import React from 'react'
import { Box, Text } from 'ink'
import SyntaxHighlight from 'ink-syntax-highlight'
import { useTheme } from '../../theme/index'
import type { Hunk, DiffLine } from '../../models/diff'
import { DiffCommentView, type DiffCommentThread } from './DiffComment'
import { stripAnsi } from '../../utils/sanitize'

/**
 * Expand tab characters to spaces using tab stops.
 * Ensures character count matches terminal column count for correct slicing.
 */
export function expandTabs(text: string, tabWidth: number = 4): string {
  if (!text.includes('\t')) return text
  let result = ''
  let col = 0
  for (const char of text) {
    if (char === '\t') {
      const spaces = tabWidth - (col % tabWidth)
      result += ' '.repeat(spaces)
      col += spaces
    } else {
      result += char
      col++
    }
  }
  return result
}

export function getLanguageFromFilename(
  filename: string,
): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    py: 'python',
    go: 'go',
    rs: 'rust',
    css: 'css',
    scss: 'scss',
    html: 'html',
    yaml: 'yaml',
    yml: 'yaml',
  }
  return ext ? map[ext] : undefined
}

/**
 * Returns the display line number for a diff line.
 * - add/context lines: newLineNumber (RIGHT side)
 * - del lines: oldLineNumber (LEFT side)
 * - header lines: undefined (no line number)
 */
export function getDiffLineNumber(line: DiffLine): number | undefined {
  switch (line.type) {
    case 'add':
    case 'context':
      return line.newLineNumber
    case 'del':
      return line.oldLineNumber
    case 'header':
      return undefined
  }
}

/**
 * Returns the comment lookup key for a diff line.
 * Format: "SIDE:lineNumber" where SIDE is LEFT for deletions, RIGHT for additions/context.
 */
function getCommentKey(line: DiffLine): string | undefined {
  switch (line.type) {
    case 'del':
      return line.oldLineNumber != null ? `LEFT:${line.oldLineNumber}` : undefined
    case 'add':
      return line.newLineNumber != null ? `RIGHT:${line.newLineNumber}` : undefined
    case 'context':
      return line.newLineNumber != null ? `RIGHT:${line.newLineNumber}` : undefined
    case 'header':
      return undefined
  }
}

interface DiffLineViewProps {
  readonly line: DiffLine
  readonly lineNumber?: number
  readonly isFocus: boolean
  readonly isInSelection: boolean
  readonly language?: string
  readonly contentWidth?: number
  readonly scrollOffsetX?: number
}

function DiffLineView({
  line,
  lineNumber,
  isFocus,
  isInSelection,
  language,
  contentWidth = 80,
  scrollOffsetX = 0,
}: DiffLineViewProps): React.ReactElement {
  const theme = useTheme()

  const bgColor = isFocus
    ? theme.colors.selection
    : isInSelection
      ? theme.colors.listSelectedBg
      : undefined

  const textColor =
    line.type === 'add'
      ? theme.colors.diffAdd
      : line.type === 'del'
        ? theme.colors.diffDel
        : line.type === 'header'
          ? theme.colors.info
          : theme.colors.text

  const prefix =
    line.type === 'add'
      ? '+'
      : line.type === 'del'
        ? '-'
        : line.type === 'header'
          ? ''
          : ' '

  const cleanContent = expandTabs(stripAnsi(line.content))
  const visibleContent = cleanContent.slice(
    scrollOffsetX,
    scrollOffsetX + contentWidth,
  )

  const canHighlight =
    (line.type === 'context' || line.type === 'add' || line.type === 'del') &&
    language !== undefined &&
    visibleContent.trim().length > 0

  return (
    <Box flexDirection="row" backgroundColor={bgColor} overflow="hidden">
      <Box width={5} flexShrink={0}>
        <Text color={theme.colors.muted}>
          {lineNumber != null ? String(lineNumber).padStart(4, ' ') : ''}
        </Text>
      </Box>
      {canHighlight ? (
        <Box flexDirection="row" flexShrink={0} overflow="hidden">
          <Text color={textColor}>{prefix}</Text>
          <Box width={contentWidth} overflow="hidden" flexShrink={0}>
            <SyntaxHighlight code={visibleContent} language={language} />
          </Box>
        </Box>
      ) : (
        <Box flexDirection="row" flexShrink={0} overflow="hidden">
          <Text color={textColor}>{prefix}</Text>
          <Box width={contentWidth} overflow="hidden" flexShrink={0}>
            <Text
              wrap="truncate-end"
              color={textColor}
              bold={isFocus}
              inverse={isFocus}
            >
              {visibleContent}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}

export type DiffDisplayRow =
  | {
      readonly type: 'line'
      readonly line: DiffLine
      readonly lineNumber: number | undefined
      readonly oldLineNumber: number | undefined
      readonly newLineNumber: number | undefined
      readonly hunkIndex: number
    }
  | { readonly type: 'comment'; readonly thread: DiffCommentThread }

export function buildDiffRows(
  hunks: readonly Hunk[],
  commentsByLine?: ReadonlyMap<string, DiffCommentThread>,
): DiffDisplayRow[] {
  const rows: DiffDisplayRow[] = []

  for (let hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
    const hunk = hunks[hunkIndex]
    for (const line of hunk.lines) {
      const lineNumber = getDiffLineNumber(line)
      rows.push({
        type: 'line',
        line,
        lineNumber,
        oldLineNumber: line.oldLineNumber,
        newLineNumber: line.newLineNumber,
        hunkIndex,
      })

      // After each non-header line, check for comments
      if (commentsByLine && line.type !== 'header') {
        const key = getCommentKey(line)
        if (key) {
          const thread = commentsByLine.get(key)
          if (thread) {
            rows.push({ type: 'comment', thread })
          }
        }
        // Also check the other side for context lines (they have both old and new numbers)
        if (line.type === 'context' && line.oldLineNumber != null) {
          const leftKey = `LEFT:${line.oldLineNumber}`
          // Only check LEFT if it's different from what we already checked
          const thread = commentsByLine.get(leftKey)
          if (thread) {
            rows.push({ type: 'comment', thread })
          }
        }
      }
    }
  }

  return rows
}

interface DiffViewProps {
  readonly allRows: readonly DiffDisplayRow[]
  readonly selectedLine: number
  readonly scrollOffset: number
  readonly viewportHeight: number
  readonly isActive: boolean
  readonly filename?: string
  readonly visualStart?: number | null
  readonly contentWidth?: number
  readonly scrollOffsetX?: number
}

export function DiffView({
  allRows,
  selectedLine,
  scrollOffset,
  viewportHeight,
  isActive,
  filename,
  visualStart,
  contentWidth = 80,
  scrollOffsetX = 0,
}: DiffViewProps): React.ReactElement {
  const language = filename ? getLanguageFromFilename(filename) : undefined
  const theme = useTheme()

  if (allRows.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>No diff available</Text>
      </Box>
    )
  }

  const visibleRows = allRows.slice(
    scrollOffset,
    scrollOffset + viewportHeight,
  )

  const selMin = visualStart != null ? Math.min(visualStart, selectedLine) : -1
  const selMax = visualStart != null ? Math.max(visualStart, selectedLine) : -1

  return (
    <Box flexDirection="column" flexGrow={1} minWidth={0} overflow="hidden">
      {visibleRows.map((row, index) => {
        const absIndex = scrollOffset + index
        if (row.type === 'comment') {
          return (
            <DiffCommentView
              key={`comment-${absIndex}`}
              thread={row.thread}
              isFocus={isActive && absIndex === selectedLine}
            />
          )
        }
        const isInSelection =
          visualStart != null && absIndex >= selMin && absIndex <= selMax
        return (
          <DiffLineView
            key={`${row.hunkIndex}-${absIndex}`}
            line={row.line}
            lineNumber={row.lineNumber}
            isFocus={isActive && absIndex === selectedLine}
            isInSelection={isInSelection}
            language={language}
            contentWidth={contentWidth}
            scrollOffsetX={scrollOffsetX}
          />
        )
      })}
    </Box>
  )
}
