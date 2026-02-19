import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { DiffLine } from '../../models/diff'
import { stripAnsi } from '../../utils/sanitize'
import type { WordDiffSegment } from '../../utils/word-diff'
import { expandTabs, sliceWordDiffSegments } from './diff-view-utils'

interface SideBySideLineProps {
  readonly line: DiffLine | null
  readonly isFocus: boolean
  readonly isSearchMatch?: boolean
  readonly language?: string
  readonly contentWidth?: number
  readonly scrollOffsetX?: number
  readonly wordDiffSegments?: readonly WordDiffSegment[]
}

export function SideBySideLine({
  line,
  isFocus,
  isSearchMatch = false,
  language,
  contentWidth = 40,
  scrollOffsetX = 0,
  wordDiffSegments,
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

  const prefix = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '

  const hasWordDiff =
    wordDiffSegments != null &&
    wordDiffSegments.length > 0 &&
    (line.type === 'add' || line.type === 'del')

  const cleanContent = expandTabs(stripAnsi(line.content))
  const visibleContent = cleanContent.slice(
    scrollOffsetX,
    scrollOffsetX + contentWidth,
  )

  const lineNumStr = lineNum != null ? String(lineNum).padStart(4, ' ') : '    '

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
          <Text color={theme.colors.muted}>{lineNumStr} </Text>
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

  return (
    <Box height={1} width="100%" backgroundColor={bgColor} overflow="hidden">
      <Text wrap="truncate-end">
        <Text color={theme.colors.muted}>{lineNumStr} </Text>
        <Text color={textColor} bold={line.type === 'add'}>
          {prefix}
        </Text>
        <Text color={textColor} bold={line.type === 'add'}>
          {visibleContent}
        </Text>
      </Text>
    </Box>
  )
}
