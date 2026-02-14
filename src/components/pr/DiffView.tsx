import React from 'react'
import { Box, Text } from 'ink'
import SyntaxHighlight from 'ink-syntax-highlight'
import { useTheme } from '../../theme/index'
import type { Hunk, DiffLine } from '../../models/diff'
import { DiffCommentView, type DiffCommentThread } from './DiffComment'
import { stripAnsi } from '../../utils/sanitize'
import { getLanguageFromFilename } from '../../utils/languages'
import { computeWordDiff, type WordDiffSegment } from '../../utils/word-diff'
import type { FoldableRow } from '../../utils/hunk-folding'

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

/**
 * Compute indices of diff rows whose content matches the given query.
 * Only code lines (add, del, context) are matched; header and comment rows are skipped.
 */
export function computeDiffSearchMatches(
  rows: readonly DiffDisplayRow[],
  query: string,
): readonly number[] {
  if (!query) return []
  const lowerQuery = query.toLowerCase()
  const matches: number[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.type === 'line' && row.line.type !== 'header') {
      if (row.line.content.toLowerCase().includes(lowerQuery)) {
        matches.push(i)
      }
    }
  }
  return matches
}

/**
 * Slice word-diff segments to fit within a visible window defined by
 * scrollOffsetX and contentWidth. Preserves segment types while trimming text.
 */
export function sliceWordDiffSegments(
  segments: readonly WordDiffSegment[],
  scrollOffsetX: number,
  contentWidth: number,
): readonly WordDiffSegment[] {
  const result: WordDiffSegment[] = []
  let pos = 0
  const end = scrollOffsetX + contentWidth

  for (const seg of segments) {
    const segEnd = pos + seg.text.length
    if (segEnd <= scrollOffsetX) {
      pos = segEnd
      continue
    }
    if (pos >= end) break

    const sliceStart = Math.max(0, scrollOffsetX - pos)
    const sliceEnd = Math.min(seg.text.length, end - pos)
    const text = seg.text.slice(sliceStart, sliceEnd)
    if (text.length > 0) {
      result.push({ text, type: seg.type })
    }
    pos = segEnd
  }

  return result
}

interface WordDiffContentProps {
  readonly segments: readonly WordDiffSegment[]
  readonly lineType: 'add' | 'del'
  readonly scrollOffsetX: number
  readonly contentWidth: number
}

function WordDiffContent({
  segments,
  lineType,
  scrollOffsetX,
  contentWidth,
}: WordDiffContentProps): React.ReactElement {
  const theme = useTheme()
  const textColor = lineType === 'add' ? theme.colors.diffAdd : theme.colors.diffDel
  const highlightBg =
    lineType === 'add' ? theme.colors.diffAddHighlight : theme.colors.diffDelHighlight

  const cleanSegments = segments.map((seg) => ({
    ...seg,
    text: expandTabs(stripAnsi(seg.text)),
  }))
  const visible = sliceWordDiffSegments(cleanSegments, scrollOffsetX, contentWidth)

  return (
    <Box flexDirection="row" width={contentWidth} overflow="hidden" flexShrink={0}>
      {visible.map((seg, i) => (
        <Text
          key={i}
          color={textColor}
          bold={seg.type === 'changed'}
          backgroundColor={seg.type === 'changed' ? highlightBg : undefined}
        >
          {seg.text}
        </Text>
      ))}
    </Box>
  )
}

interface DiffLineViewProps {
  readonly line: DiffLine
  readonly lineNumber?: number
  readonly isFocus: boolean
  readonly isInSelection: boolean
  readonly isSearchMatch?: boolean
  readonly language?: string
  readonly contentWidth?: number
  readonly scrollOffsetX?: number
  readonly wordDiffSegments?: readonly WordDiffSegment[]
}

function DiffLineView({
  line,
  lineNumber,
  isFocus,
  isInSelection,
  isSearchMatch = false,
  language,
  contentWidth = 80,
  scrollOffsetX = 0,
  wordDiffSegments,
}: DiffLineViewProps): React.ReactElement {
  const theme = useTheme()

  const bgColor = isFocus
    ? theme.colors.selection
    : isInSelection
      ? theme.colors.listSelectedBg
      : isSearchMatch
        ? theme.colors.warning
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

  const hasWordDiff =
    wordDiffSegments != null &&
    wordDiffSegments.length > 0 &&
    (line.type === 'add' || line.type === 'del')

  const cleanContent = expandTabs(stripAnsi(line.content))
  const visibleContent = cleanContent.slice(
    scrollOffsetX,
    scrollOffsetX + contentWidth,
  )

  const canHighlight =
    !hasWordDiff &&
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
      {hasWordDiff ? (
        <Box flexDirection="row" flexShrink={0} overflow="hidden">
          <Text color={textColor} bold={line.type === 'add'}>{prefix}</Text>
          <WordDiffContent
            segments={wordDiffSegments}
            lineType={line.type as 'add' | 'del'}
            scrollOffsetX={scrollOffsetX}
            contentWidth={contentWidth}
          />
        </Box>
      ) : canHighlight ? (
        <Box flexDirection="row" flexShrink={0} overflow="hidden">
          <Text color={textColor} bold={line.type === 'add'}>{prefix}</Text>
          <Box width={contentWidth} overflow="hidden" flexShrink={0}>
            <SyntaxHighlight code={visibleContent} language={language} />
          </Box>
        </Box>
      ) : (
        <Box flexDirection="row" flexShrink={0} overflow="hidden">
          <Text color={textColor} bold={line.type === 'add'}>{prefix}</Text>
          <Box width={contentWidth} overflow="hidden" flexShrink={0}>
            <Text
              wrap="truncate-end"
              color={textColor}
              bold={isFocus || line.type === 'add'}
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
      readonly wordDiffSegments?: readonly WordDiffSegment[]
    }
  | { readonly type: 'comment'; readonly thread: DiffCommentThread }

/**
 * Annotate consecutive del/add line pairs with word-level diff segments.
 * Scans through rows, finds del lines immediately followed by add lines (ignoring comments),
 * pairs them up, and computes word diffs.
 */
function annotateWordDiffs(rows: DiffDisplayRow[]): DiffDisplayRow[] {
  const result: DiffDisplayRow[] = [...rows]

  let i = 0
  while (i < result.length) {
    // Find a run of del lines
    const delStart = i
    while (
      i < result.length &&
      result[i].type === 'line' &&
      (result[i] as { type: 'line'; line: DiffLine }).line.type === 'del'
    ) {
      i++
    }
    const delEnd = i

    // Skip any comment rows between dels and adds
    while (i < result.length && result[i].type === 'comment') {
      i++
    }

    // Find a run of add lines
    const addStart = i
    while (
      i < result.length &&
      result[i].type === 'line' &&
      (result[i] as { type: 'line'; line: DiffLine }).line.type === 'add'
    ) {
      i++
    }
    const addEnd = i

    const delCount = delEnd - delStart
    const addCount = addEnd - addStart

    // Only annotate when we have paired del/add lines
    if (delCount > 0 && addCount > 0) {
      const pairCount = Math.min(delCount, addCount)
      for (let p = 0; p < pairCount; p++) {
        const delRow = result[delStart + p]
        const addRow = result[addStart + p]
        if (delRow.type !== 'line' || addRow.type !== 'line') continue

        const diff = computeWordDiff(delRow.line.content, addRow.line.content)

        // Only annotate if there are actual differences (not all-equal or all-changed)
        const hasEqual = diff.oldSegments.some((s) => s.type === 'equal')
        const hasChanged = diff.oldSegments.some((s) => s.type === 'changed')
        if (hasEqual && hasChanged) {
          result[delStart + p] = { ...delRow, wordDiffSegments: diff.oldSegments }
          result[addStart + p] = { ...addRow, wordDiffSegments: diff.newSegments }
        }
      }
    }

    // If we didn't find any del or add lines, advance past whatever we're on
    if (delStart === delEnd && addStart === addEnd) {
      i++
    }
  }

  return result
}

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

  return annotateWordDiffs(rows)
}

interface FoldedHunkPlaceholderViewProps {
  readonly foldedLineCount: number
  readonly isFocus: boolean
}

function FoldedHunkPlaceholderView({
  foldedLineCount,
  isFocus,
}: FoldedHunkPlaceholderViewProps): React.ReactElement {
  const theme = useTheme()
  return (
    <Box flexDirection="row" backgroundColor={isFocus ? theme.colors.selection : undefined}>
      <Box width={5} flexShrink={0}>
        <Text color={theme.colors.muted}>{'    '}</Text>
      </Box>
      <Text
        color={theme.colors.info}
        bold={isFocus}
        inverse={isFocus}
      >
        {`[+${foldedLineCount} lines folded]`}
      </Text>
    </Box>
  )
}

interface DiffViewProps {
  readonly allRows: readonly FoldableRow[]
  readonly selectedLine: number
  readonly scrollOffset: number
  readonly viewportHeight: number
  readonly isActive: boolean
  readonly filename?: string
  readonly visualStart?: number | null
  readonly contentWidth?: number
  readonly scrollOffsetX?: number
  readonly searchMatchIndices?: ReadonlySet<number>
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
  searchMatchIndices,
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
        if (row.type === 'folded') {
          return (
            <FoldedHunkPlaceholderView
              key={`folded-${row.hunkIndex}`}
              foldedLineCount={row.foldedLineCount}
              isFocus={isActive && absIndex === selectedLine}
            />
          )
        }
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
            isSearchMatch={searchMatchIndices?.has(absIndex) ?? false}
            language={language}
            contentWidth={contentWidth}
            scrollOffsetX={scrollOffsetX}
            wordDiffSegments={row.wordDiffSegments}
          />
        )
      })}
    </Box>
  )
}
