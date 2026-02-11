import React from 'react'
import { Box, Text } from 'ink'
import SyntaxHighlight from 'ink-syntax-highlight'
import { useTheme } from '../../theme/index'
import type { Hunk, DiffLine } from '../../models/diff'
import { DiffCommentView, type DiffCommentThread } from './DiffComment'

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

interface DiffLineViewProps {
  readonly line: DiffLine
  readonly lineNumber: number
  readonly isFocus: boolean
  readonly isInSelection: boolean
  readonly language?: string
}

function DiffLineView({
  line,
  lineNumber,
  isFocus,
  isInSelection,
  language,
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

  const useSyntaxHighlight =
    line.type === 'context' && language && line.content.trim().length > 0

  return (
    <Box backgroundColor={bgColor}>
      <Box width={5}>
        <Text color={theme.colors.muted}>
          {line.type === 'header' ? '' : String(lineNumber).padStart(4, ' ')}
        </Text>
      </Box>
      {useSyntaxHighlight ? (
        <Box flexDirection="row">
          <Text color={theme.colors.text}>{prefix}</Text>
          <SyntaxHighlight code={line.content} language={language} />
        </Box>
      ) : (
        <Text color={textColor} bold={isFocus} inverse={isFocus}>
          {prefix}
          {line.content}
        </Text>
      )}
    </Box>
  )
}

export type DiffDisplayRow =
  | { readonly type: 'line'; readonly line: DiffLine; readonly lineNumber: number; readonly hunkIndex: number }
  | { readonly type: 'comment'; readonly thread: DiffCommentThread }

export function buildDiffRows(
  hunks: readonly Hunk[],
  commentsByLine?: ReadonlyMap<number, DiffCommentThread>,
): DiffDisplayRow[] {
  const rows: DiffDisplayRow[] = []
  let lineNumber = 1

  for (let hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
    const hunk = hunks[hunkIndex]
    for (const line of hunk.lines) {
      rows.push({ type: 'line', line, lineNumber, hunkIndex })
      const currentLineNumber = lineNumber
      if (line.type !== 'header') {
        lineNumber++
      }
      // After each line, check for comments on that line
      if (commentsByLine && line.type !== 'header') {
        const thread = commentsByLine.get(currentLineNumber)
        if (thread) {
          rows.push({ type: 'comment', thread })
        }
      }
    }
  }

  return rows
}

interface DiffViewProps {
  readonly hunks: readonly Hunk[]
  readonly selectedLine: number
  readonly scrollOffset: number
  readonly viewportHeight: number
  readonly isActive: boolean
  readonly filename?: string
  readonly visualStart?: number | null
  readonly commentsByLine?: ReadonlyMap<number, DiffCommentThread>
}

export function DiffView({
  hunks,
  selectedLine,
  scrollOffset,
  viewportHeight,
  isActive,
  filename,
  visualStart,
  commentsByLine,
}: DiffViewProps): React.ReactElement {
  const language = filename ? getLanguageFromFilename(filename) : undefined
  const theme = useTheme()

  if (hunks.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>No diff available</Text>
      </Box>
    )
  }

  const allRows = buildDiffRows(hunks, commentsByLine)

  const visibleRows = allRows.slice(
    scrollOffset,
    scrollOffset + viewportHeight,
  )

  const selMin = visualStart != null ? Math.min(visualStart, selectedLine) : -1
  const selMax = visualStart != null ? Math.max(visualStart, selectedLine) : -1

  return (
    <Box flexDirection="column" flexGrow={1}>
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
          />
        )
      })}
    </Box>
  )
}
