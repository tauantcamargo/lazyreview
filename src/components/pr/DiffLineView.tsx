import React from 'react'
import { Box, Text } from 'ink'
import SyntaxHighlight from 'ink-syntax-highlight'
import { useTheme } from '../../theme/index'
import type { DiffLine } from '../../models/diff'
import type { BlameInfo } from '../../models/blame'
import { abbreviateAuthor, formatBlameDate } from '../../models/blame'
import { stripAnsi } from '../../utils/sanitize'
import type { WordDiffSegment } from '../../utils/word-diff'
import type { FoldableRow } from '../../utils/hunk-folding'
import { expandTabs, sliceWordDiffSegments } from './diff-view-utils'

/** Width of the blame gutter in characters (8 author + 1 space + 3 date + 1 separator) */
export const BLAME_GUTTER_WIDTH = 14

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
  readonly blameInfo?: BlameInfo
}

export function DiffLineView({
  line,
  lineNumber,
  isFocus,
  isInSelection,
  isSearchMatch = false,
  language,
  contentWidth = 80,
  scrollOffsetX = 0,
  wordDiffSegments,
  blameInfo,
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

  const lineNumStr =
    lineNumber != null ? String(lineNumber).padStart(4, ' ') : '    '

  const blameStr =
    blameInfo !== undefined
      ? `${abbreviateAuthor(blameInfo.author).padEnd(8)} ${formatBlameDate(blameInfo.date).padStart(3)} `
      : ''

  if (hasWordDiff) {
    const cleanSegments = wordDiffSegments.map((seg) => ({
      ...seg,
      text: expandTabs(stripAnsi(seg.text)),
    }))
    const highlightBg =
      line.type === 'add'
        ? theme.colors.diffAddHighlight
        : theme.colors.diffDelHighlight
    const visible = sliceWordDiffSegments(
      cleanSegments,
      scrollOffsetX,
      contentWidth,
    )

    return (
      <Box height={1} width="100%" backgroundColor={bgColor} overflow="hidden">
        <Text wrap="truncate-end">
          <Text color={theme.colors.muted} dimColor={blameInfo !== undefined}>
            {blameStr}
            {lineNumStr}{' '}
          </Text>
          <Text color={textColor} bold>
            {prefix}
          </Text>
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
        </Text>
      </Box>
    )
  }

  const canHighlight =
    !hasWordDiff &&
    (line.type === 'context' || line.type === 'add' || line.type === 'del') &&
    language !== undefined &&
    visibleContent.trim().length > 0

  return (
    <Box height={1} width="100%" backgroundColor={bgColor} overflow="hidden">
      <Text wrap="truncate-end" inverse={isFocus}>
        <Text color={theme.colors.muted} dimColor={blameInfo !== undefined}>
          {blameStr}
          {lineNumStr}{' '}
        </Text>
        <Text color={textColor} bold={isFocus || line.type === 'add'}>
          {prefix}
        </Text>
        {canHighlight ? (
          <SyntaxHighlight code={visibleContent} language={language} />
        ) : (
          <Text color={textColor} bold={isFocus || line.type === 'add'}>
            {visibleContent}
          </Text>
        )}
      </Text>
    </Box>
  )
}

interface FoldedHunkPlaceholderViewProps {
  readonly foldedLineCount: number
  readonly isFocus: boolean
}

export function FoldedHunkPlaceholderView({
  foldedLineCount,
  isFocus,
}: FoldedHunkPlaceholderViewProps): React.ReactElement {
  const theme = useTheme()
  return (
    <Box
      flexDirection="row"
      backgroundColor={isFocus ? theme.colors.selection : undefined}
    >
      <Box width={5} flexShrink={0}>
        <Text color={theme.colors.muted}>{'    '}</Text>
      </Box>
      <Text color={theme.colors.info} bold={isFocus} inverse={isFocus}>
        {`[+${foldedLineCount} lines folded]`}
      </Text>
    </Box>
  )
}

/**
 * Look up blame info for a diff row using its line numbers.
 * For add/context lines, uses newLineNumber; for del lines, uses oldLineNumber.
 * Returns undefined for header lines or when no blame data is available.
 */
export function getBlameForRow(
  row: FoldableRow,
  blameData: ReadonlyMap<number, BlameInfo>,
): BlameInfo | undefined {
  if (row.type !== 'line') return undefined
  const lineNum =
    row.line.type === 'del' ? row.oldLineNumber : row.newLineNumber
  if (lineNum == null) return undefined
  return blameData.get(lineNum)
}
