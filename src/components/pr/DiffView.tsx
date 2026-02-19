import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { BlameInfo } from '../../models/blame'
import { DiffCommentView } from './DiffComment'
import { getLanguageFromFilename } from '../../utils/languages'
import { computeVirtualWindow } from '../../utils/virtual-window'
import type { FoldableRow } from '../../utils/hunk-folding'
import {
  DiffLineView,
  FoldedHunkPlaceholderView,
  getBlameForRow,
  BLAME_GUTTER_WIDTH,
} from './DiffLineView'

export {
  expandTabs,
  getDiffLineNumber,
  computeDiffSearchMatches,
  sliceWordDiffSegments,
  buildDiffRows,
} from './diff-view-utils'

export type { DiffDisplayRow } from './diff-view-utils'

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
  readonly blameData?: ReadonlyMap<number, BlameInfo>
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
  blameData,
}: DiffViewProps): React.ReactElement {
  const language = filename ? getLanguageFromFilename(filename) : undefined
  const theme = useTheme()

  const virtualWindow = useMemo(
    () =>
      computeVirtualWindow({
        totalItems: allRows.length,
        viewportSize: viewportHeight,
        scrollOffset,
        overscan: 5,
      }),
    [allRows.length, viewportHeight, scrollOffset],
  )

  if (allRows.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>No diff available</Text>
      </Box>
    )
  }

  const visibleRows = allRows.slice(
    virtualWindow.startIndex,
    virtualWindow.endIndex,
  )

  const selMin = visualStart != null ? Math.min(visualStart, selectedLine) : -1
  const selMax = visualStart != null ? Math.max(visualStart, selectedLine) : -1

  return (
    <Box flexDirection="column" flexGrow={1} minWidth={0} overflow="hidden">
      {visibleRows.map((row, index) => {
        const absIndex = virtualWindow.startIndex + index
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
        const lineBlameInfo = blameData
          ? getBlameForRow(row, blameData)
          : undefined
        return (
          <DiffLineView
            key={`${row.hunkIndex}-${absIndex}`}
            line={row.line}
            lineNumber={row.lineNumber}
            isFocus={isActive && absIndex === selectedLine}
            isInSelection={isInSelection}
            isSearchMatch={searchMatchIndices?.has(absIndex) ?? false}
            language={language}
            contentWidth={
              blameData ? contentWidth - BLAME_GUTTER_WIDTH : contentWidth
            }
            scrollOffsetX={scrollOffsetX}
            wordDiffSegments={row.wordDiffSegments}
            blameInfo={lineBlameInfo}
          />
        )
      })}
    </Box>
  )
}
