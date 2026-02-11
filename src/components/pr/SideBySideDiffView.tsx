import React from 'react'
import { Box, Text, useStdout } from 'ink'
import SyntaxHighlight from 'ink-syntax-highlight'
import { useTheme } from '../../theme/index'
import type { Hunk, DiffLine } from '../../models/diff'
import { getLanguageFromFilename } from './DiffView'

export interface SideBySideRow {
  readonly left: DiffLine | null
  readonly right: DiffLine | null
  readonly type: 'paired' | 'header'
}

/**
 * Build side-by-side rows from hunks by pairing deletions with additions.
 * Context lines appear on both sides. Unmatched dels/adds get an empty opposite side.
 */
export function buildSideBySideRows(
  hunks: readonly Hunk[],
): readonly SideBySideRow[] {
  const rows: SideBySideRow[] = []

  for (const hunk of hunks) {
    const pendingDels: DiffLine[] = []
    const pendingAdds: DiffLine[] = []

    const flushPending = (): void => {
      const maxLen = Math.max(pendingDels.length, pendingAdds.length)
      for (let i = 0; i < maxLen; i++) {
        rows.push({
          left: pendingDels[i] ?? null,
          right: pendingAdds[i] ?? null,
          type: 'paired',
        })
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
      }
    }

    flushPending()
  }

  return rows
}

interface SideBySideLineProps {
  readonly line: DiffLine | null
  readonly width: number
  readonly isFocus: boolean
  readonly language?: string
}

function SideBySideLine({
  line,
  width,
  isFocus,
  language,
}: SideBySideLineProps): React.ReactElement {
  const theme = useTheme()

  if (!line) {
    return (
      <Box width={width}>
        <Text color={theme.colors.muted}>{' '.repeat(Math.max(0, width))}</Text>
      </Box>
    )
  }

  const bgColor = isFocus ? theme.colors.selection : undefined

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

  const canHighlight =
    line.type !== 'header' &&
    language !== undefined &&
    line.content.trim().length > 0

  const contentWidth = Math.max(0, width - 6) // 5 for line number + 1 for prefix

  return (
    <Box width={width} backgroundColor={bgColor}>
      <Box width={5}>
        <Text color={theme.colors.muted}>
          {lineNum != null ? String(lineNum).padStart(4, ' ') : '    '}
        </Text>
      </Box>
      <Box width={contentWidth}>
        {canHighlight ? (
          <Box flexDirection="row">
            <Text color={textColor}>{prefix}</Text>
            <SyntaxHighlight code={line.content.slice(0, contentWidth - 1)} language={language} />
          </Box>
        ) : (
          <Text color={textColor} wrap="truncate">
            {prefix}
            {line.content}
          </Text>
        )}
      </Box>
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
}

export function SideBySideDiffView({
  rows,
  selectedLine,
  scrollOffset,
  viewportHeight,
  isActive,
  filename,
}: SideBySideDiffViewProps): React.ReactElement {
  const { stdout } = useStdout()
  const theme = useTheme()
  const language = filename ? getLanguageFromFilename(filename) : undefined

  if (rows.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>No diff available</Text>
      </Box>
    )
  }

  const terminalWidth = stdout?.columns ?? 120
  const halfWidth = Math.floor((terminalWidth - 3) / 2) // 3 for gutter

  const visibleRows = rows.slice(scrollOffset, scrollOffset + viewportHeight)

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleRows.map((row, index) => {
        const absIndex = scrollOffset + index
        const isFocus = isActive && absIndex === selectedLine

        if (row.type === 'header') {
          return (
            <Box key={`sbs-${absIndex}`} backgroundColor={isFocus ? theme.colors.selection : undefined}>
              <Text color={theme.colors.info}>{row.left?.content ?? ''}</Text>
            </Box>
          )
        }

        return (
          <Box key={`sbs-${absIndex}`} flexDirection="row">
            <SideBySideLine
              line={row.left}
              width={halfWidth}
              isFocus={isFocus}
              language={language}
            />
            <Box width={1}>
              <Text color={theme.colors.border}>|</Text>
            </Box>
            <SideBySideLine
              line={row.right}
              width={halfWidth}
              isFocus={isFocus}
              language={language}
            />
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
