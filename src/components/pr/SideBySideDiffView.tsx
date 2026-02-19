import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import { DiffCommentView } from './DiffComment'
import { getLanguageFromFilename } from '../../utils/languages'
import { stripAnsi } from '../../utils/sanitize'
import { computeVirtualWindow } from '../../utils/virtual-window'
import { expandTabs } from './diff-view-utils'
import { SideBySideLine } from './SideBySideLine'

export type { SideBySideRow } from './side-by-side-utils'
export {
  buildSideBySideRows,
  computeSbsSearchMatches,
} from './side-by-side-utils'

import type { SideBySideRow } from './side-by-side-utils'

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

  const virtualWindow = useMemo(
    () =>
      computeVirtualWindow({
        totalItems: rows.length,
        viewportSize: viewportHeight,
        scrollOffset,
        overscan: 5,
      }),
    [rows.length, viewportHeight, scrollOffset],
  )

  if (rows.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>No diff available</Text>
      </Box>
    )
  }

  const visibleRows = rows.slice(
    virtualWindow.startIndex,
    virtualWindow.endIndex,
  )

  return (
    <Box flexDirection="column" flexGrow={1} minWidth={0} overflow="hidden">
      {visibleRows.map((row, index) => {
        const absIndex = virtualWindow.startIndex + index
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
            <Box
              flexGrow={1}
              flexBasis={0}
              minWidth={0}
              flexShrink={1}
              overflow="hidden"
            >
              <SideBySideLine
                line={row.left}
                isFocus={isFocus}
                isSearchMatch={isMatch}
                language={language}
                contentWidth={contentWidth}
                scrollOffsetX={scrollOffsetX}
                wordDiffSegments={row.leftWordDiff}
              />
            </Box>
            <Box width={1} flexShrink={0} flexGrow={0}>
              <Text color={theme.colors.border}>|</Text>
            </Box>
            <Box
              flexGrow={1}
              flexBasis={0}
              minWidth={0}
              flexShrink={1}
              overflow="hidden"
            >
              <SideBySideLine
                line={row.right}
                isFocus={isFocus}
                isSearchMatch={isMatch}
                language={language}
                contentWidth={contentWidth}
                scrollOffsetX={scrollOffsetX}
                wordDiffSegments={row.rightWordDiff}
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
