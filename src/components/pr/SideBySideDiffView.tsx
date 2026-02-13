import React from 'react'
import { Box, Text } from 'ink'
import SyntaxHighlight from 'ink-syntax-highlight'
import { useTheme } from '../../theme/index'
import type { Hunk, DiffLine } from '../../models/diff'
import { DiffCommentView, type DiffCommentThread } from './DiffComment'
import { getLanguageFromFilename, expandTabs } from './DiffView'
import { stripAnsi } from '../../utils/sanitize'

export type SideBySideRow =
  | {
      readonly left: DiffLine | null
      readonly right: DiffLine | null
      readonly type: 'paired' | 'header'
    }
  | {
      readonly type: 'comment'
      readonly thread: DiffCommentThread
    }

/**
 * Get the comment lookup key for a diff line in side-by-side context.
 */
function getSbsCommentKey(line: DiffLine): string | undefined {
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
 * Insert a comment row if there is a matching comment for the given line.
 */
function maybeInsertComment(
  rows: SideBySideRow[],
  line: DiffLine,
  commentsByLine?: ReadonlyMap<string, DiffCommentThread>,
): void {
  if (!commentsByLine) return
  const key = getSbsCommentKey(line)
  if (key) {
    const thread = commentsByLine.get(key)
    if (thread) {
      rows.push({ type: 'comment', thread })
    }
  }
  // Also check LEFT for context lines
  if (line.type === 'context' && line.oldLineNumber != null) {
    const leftKey = `LEFT:${line.oldLineNumber}`
    const thread = commentsByLine.get(leftKey)
    if (thread) {
      rows.push({ type: 'comment', thread })
    }
  }
}

/**
 * Build side-by-side rows from hunks by pairing deletions with additions.
 * Context lines appear on both sides. Unmatched dels/adds get an empty opposite side.
 * When commentsByLine is provided, comment rows are inserted after matching lines.
 */
export function buildSideBySideRows(
  hunks: readonly Hunk[],
  commentsByLine?: ReadonlyMap<string, DiffCommentThread>,
): readonly SideBySideRow[] {
  const rows: SideBySideRow[] = []

  for (const hunk of hunks) {
    const pendingDels: DiffLine[] = []
    const pendingAdds: DiffLine[] = []

    const flushPending = (): void => {
      const maxLen = Math.max(pendingDels.length, pendingAdds.length)
      for (let i = 0; i < maxLen; i++) {
        const leftLine = pendingDels[i] ?? null
        const rightLine = pendingAdds[i] ?? null
        rows.push({
          left: leftLine,
          right: rightLine,
          type: 'paired',
        })
        // Insert comments for flushed lines
        if (leftLine) maybeInsertComment(rows, leftLine, commentsByLine)
        if (rightLine) maybeInsertComment(rows, rightLine, commentsByLine)
      }
      pendingDels.length = 0
      pendingAdds.length = 0
    }

    for (const line of hunk.lines) {
      if (line.type === 'header') {
        flushPending()
        rows.push({ left: line, right: null, type: 'header' })
      } else if (line.type === 'del') {
        pendingDels.push(line)
      } else if (line.type === 'add') {
        pendingAdds.push(line)
      } else {
        // context line
        flushPending()
        rows.push({ left: line, right: line, type: 'paired' })
        maybeInsertComment(rows, line, commentsByLine)
      }
    }

    flushPending()
  }

  return rows
}

/**
 * Compute indices of side-by-side rows whose content matches the given query.
 * Only paired/header code lines are matched; comment rows are skipped.
 */
export function computeSbsSearchMatches(
  rows: readonly SideBySideRow[],
  query: string,
): readonly number[] {
  if (!query) return []
  const lowerQuery = query.toLowerCase()
  const matches: number[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.type === 'comment') continue
    if (row.type === 'header') {
      // skip headers
      continue
    }
    // paired row: check left and right
    const leftMatch = row.left && row.left.type !== 'header' && row.left.content.toLowerCase().includes(lowerQuery)
    const rightMatch = row.right && row.right.type !== 'header' && row.right.content.toLowerCase().includes(lowerQuery)
    if (leftMatch || rightMatch) {
      matches.push(i)
    }
  }
  return matches
}

interface SideBySideLineProps {
  readonly line: DiffLine | null
  readonly isFocus: boolean
  readonly isSearchMatch?: boolean
  readonly language?: string
  readonly contentWidth?: number
  readonly scrollOffsetX?: number
}

function SideBySideLine({
  line,
  isFocus,
  isSearchMatch = false,
  language,
  contentWidth = 40,
  scrollOffsetX = 0,
}: SideBySideLineProps): React.ReactElement {
  const theme = useTheme()

  if (!line) {
    return <Text color={theme.colors.muted}> </Text>
  }

  const bgColor = isFocus
    ? theme.colors.selection
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

  const lineNum =
    line.type === 'del' || line.type === 'context'
      ? line.oldLineNumber
      : line.newLineNumber

  const prefix =
    line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '

  const cleanContent = expandTabs(stripAnsi(line.content))
  const visibleContent = cleanContent.slice(
    scrollOffsetX,
    scrollOffsetX + contentWidth,
  )
  const canHighlight =
    line.type !== 'header' &&
    language !== undefined &&
    visibleContent.trim().length > 0

  return (
    <Box backgroundColor={bgColor} overflow="hidden">
      <Box width={5} flexShrink={0}>
        <Text color={theme.colors.muted}>
          {lineNum != null ? String(lineNum).padStart(4, ' ') : '    '}
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
            <Text color={textColor} wrap="truncate-end">
              {visibleContent}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}

interface SideBySideDiffViewProps {
  readonly rows: readonly SideBySideRow[]
  readonly selectedLine: number
  readonly scrollOffset: number
  readonly viewportHeight: number
  readonly isActive: boolean
  readonly filename?: string
  readonly contentWidth?: number
  readonly scrollOffsetX?: number
  readonly searchMatchIndices?: ReadonlySet<number>
}

export function SideBySideDiffView({
  rows,
  selectedLine,
  scrollOffset,
  viewportHeight,
  isActive,
  filename,
  contentWidth = 40,
  scrollOffsetX = 0,
  searchMatchIndices,
}: SideBySideDiffViewProps): React.ReactElement {
  const theme = useTheme()
  const language = filename ? getLanguageFromFilename(filename) : undefined

  if (rows.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>No diff available</Text>
      </Box>
    )
  }

  const visibleRows = rows.slice(scrollOffset, scrollOffset + viewportHeight)

  return (
    <Box flexDirection="column" flexGrow={1} minWidth={0} overflow="hidden">
      {visibleRows.map((row, index) => {
        const absIndex = scrollOffset + index
        const isFocus = isActive && absIndex === selectedLine

        if (row.type === 'comment') {
          return (
            <DiffCommentView
              key={`sbs-comment-${absIndex}`}
              thread={row.thread}
              isFocus={isFocus}
            />
          )
        }

        if (row.type === 'header') {
          const raw = row.left?.content ?? ''
          const headerWidth = 2 * contentWidth + 1
          const visible = expandTabs(stripAnsi(raw)).slice(
            scrollOffsetX,
            scrollOffsetX + headerWidth,
          )
          return (
            <Box
              key={`sbs-${absIndex}`}
              flexDirection="row"
              backgroundColor={isFocus ? theme.colors.selection : undefined}
              overflow="hidden"
            >
              <Box width={5} flexShrink={0}>
                <Text color={theme.colors.muted}> </Text>
              </Box>
              <Box flexGrow={1} minWidth={0} overflow="hidden">
                <Text color={theme.colors.info} wrap="truncate-end">
                  {visible}
                </Text>
              </Box>
            </Box>
          )
        }

        const isMatch = searchMatchIndices?.has(absIndex) ?? false
        return (
          <Box key={`sbs-${absIndex}`} flexDirection="row" overflow="hidden">
            <Box flexGrow={1} flexBasis={0} minWidth={0} flexShrink={1} overflow="hidden">
              <SideBySideLine
                line={row.left}
                isFocus={isFocus}
                isSearchMatch={isMatch}
                language={language}
                contentWidth={contentWidth}
                scrollOffsetX={scrollOffsetX}
              />
            </Box>
            <Box width={1} flexShrink={0} flexGrow={0}>
              <Text color={theme.colors.border}>|</Text>
            </Box>
            <Box flexGrow={1} flexBasis={0} minWidth={0} flexShrink={1} overflow="hidden">
              <SideBySideLine
                line={row.right}
                isFocus={isFocus}
                isSearchMatch={isMatch}
                language={language}
                contentWidth={contentWidth}
                scrollOffsetX={scrollOffsetX}
              />
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

/**
 * Minimum terminal width to show side-by-side view.
 * Below this, we fall back to unified view.
 */
export const SIDE_BY_SIDE_MIN_WIDTH = 100
