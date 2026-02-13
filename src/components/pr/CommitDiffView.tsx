import React, { useMemo, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { useTheme } from '../../theme/index'
import { useListNavigation, deriveScrollOffset } from '../../hooks/useListNavigation'
import type { FileChange } from '../../models/file-change'
import { parseDiffPatch } from '../../models/diff'
import { DiffView, buildDiffRows } from './DiffView'
import {
  SideBySideDiffView,
  buildSideBySideRows,
  SIDE_BY_SIDE_MIN_WIDTH,
} from './SideBySideDiffView'
import { computeMaxDiffLineLength, computeMaxSbsLineLength } from './diffScrollHelpers'
import { buildFileTree, flattenTreeToFiles, buildDisplayRows, FileItem } from './FileTree'
import { LoadingIndicator } from '../common/LoadingIndicator'
import { EmptyState } from '../common/EmptyState'

type FocusPanel = 'tree' | 'diff'
type DiffMode = 'unified' | 'side-by-side'

interface CommitDiffViewProps {
  readonly files: readonly FileChange[]
  readonly commitSha: string
  readonly commitMessage: string
  readonly isActive: boolean
  readonly isLoading: boolean
  readonly onBack: () => void
}

export function CommitDiffView({
  files,
  commitSha,
  commitMessage,
  isActive,
  isLoading,
  onBack,
}: CommitDiffViewProps): React.ReactElement {
  const { stdout } = useStdout()
  const theme = useTheme()
  const terminalWidth = stdout?.columns ?? 120
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 13)
  const treeViewportMaxHeight = Math.max(1, (stdout?.rows ?? 24) - 18)

  const [focusPanel, setFocusPanel] = useState<FocusPanel>('tree')
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [diffMode, setDiffMode] = useState<DiffMode>('unified')
  const [diffScrollOffsetX, setDiffScrollOffsetX] = useState(0)

  const effectiveDiffMode =
    diffMode === 'side-by-side' && terminalWidth < SIDE_BY_SIDE_MIN_WIDTH
      ? 'unified'
      : diffMode

  const treePanelWidth = Math.max(32, Math.floor(terminalWidth * 0.3))
  const diffContentWidth = Math.max(10, terminalWidth - treePanelWidth - 8)

  const fileTree = useMemo(() => buildFileTree(files), [files])
  const fileOrder = useMemo(() => flattenTreeToFiles(fileTree), [fileTree])
  const displayRows = useMemo(
    () => buildDisplayRows(fileTree, 0, { current: 0 }),
    [fileTree],
  )

  const treeViewportHeight = Math.min(viewportHeight - 2, treeViewportMaxHeight)

  const { selectedIndex: treeSelectedIndex } = useListNavigation({
    itemCount: fileOrder.length,
    viewportHeight: treeViewportHeight,
    isActive: isActive && focusPanel === 'tree',
  })

  const selectedRowIndex = displayRows.findIndex(
    (r) => r.type === 'file' && r.fileIndex === treeSelectedIndex,
  )
  const effectiveRowIndex = selectedRowIndex >= 0 ? selectedRowIndex : 0
  const treeScrollOffset = deriveScrollOffset(
    effectiveRowIndex,
    treeViewportHeight,
    displayRows.length,
  )
  const visibleRows = displayRows.slice(
    treeScrollOffset,
    treeScrollOffset + treeViewportHeight,
  )

  React.useEffect(() => {
    if (focusPanel === 'tree') {
      setSelectedFileIndex(treeSelectedIndex)
    }
  }, [treeSelectedIndex, focusPanel])

  // Reset scroll when file changes
  React.useEffect(() => {
    setDiffScrollOffsetX(0)
  }, [selectedFileIndex])

  const selectedFile = fileOrder[selectedFileIndex] ?? fileOrder[0] ?? null
  const selectedPatch = selectedFile?.patch ?? null
  const hunks = useMemo(
    () => (selectedPatch ? parseDiffPatch(selectedPatch) : []),
    [selectedPatch],
  )

  const allRows = useMemo(
    () => buildDiffRows(hunks, undefined),
    [hunks],
  )
  const sideBySideRows = useMemo(
    () =>
      effectiveDiffMode === 'side-by-side'
        ? buildSideBySideRows(hunks, undefined)
        : [],
    [hunks, effectiveDiffMode],
  )
  const totalDiffLines =
    effectiveDiffMode === 'side-by-side'
      ? sideBySideRows.length
      : allRows.length

  const maxDiffLineLength = useMemo(
    () => computeMaxDiffLineLength(allRows),
    [allRows],
  )
  const diffContentWidthSbs = Math.max(
    10,
    Math.floor((diffContentWidth - 1) / 2),
  )
  const maxDiffLineLengthSbs = useMemo(
    () => computeMaxSbsLineLength(sideBySideRows),
    [sideBySideRows],
  )
  const maxDiffScrollXUnified = Math.max(0, maxDiffLineLength - diffContentWidth)
  const maxDiffScrollXSbs = Math.max(0, maxDiffLineLengthSbs - diffContentWidthSbs)
  const maxDiffScrollX =
    effectiveDiffMode === 'side-by-side' ? maxDiffScrollXSbs : maxDiffScrollXUnified

  const {
    selectedIndex: diffSelectedLine,
    scrollOffset: diffScrollOffset,
  } = useListNavigation({
    itemCount: totalDiffLines,
    viewportHeight,
    isActive: isActive && focusPanel === 'diff',
  })

  useInput(
    (input, key) => {
      if (input === 'q' || key.escape) {
        onBack()
      } else if (input === 'h') {
        setFocusPanel('tree')
      } else if (input === 'l' || (key.return && focusPanel === 'tree')) {
        setFocusPanel('diff')
      } else if (input === 'd') {
        setDiffMode((prev) =>
          prev === 'unified' ? 'side-by-side' : 'unified',
        )
      } else if (key.tab) {
        setFocusPanel((prev) => (prev === 'tree' ? 'diff' : 'tree'))
      } else if (input === 'H' && focusPanel === 'diff') {
        setDiffScrollOffsetX((prev) => Math.max(0, prev - 8))
      } else if (input === 'L' && focusPanel === 'diff') {
        setDiffScrollOffsetX((prev) => Math.min(maxDiffScrollX, prev + 8))
      }
    },
    { isActive },
  )

  if (isLoading) {
    return <LoadingIndicator message="Loading commit diff..." />
  }

  if (files.length === 0) {
    return <EmptyState message="No files changed in this commit" />
  }

  const shortSha = commitSha.slice(0, 7)
  const shortMessage = commitMessage.split('\n')[0] ?? ''
  const isPanelFocused = focusPanel === 'tree' && isActive

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} paddingY={0} gap={1} marginBottom={0}>
        <Text color={theme.colors.warning} bold>
          {shortSha}
        </Text>
        <Text color={theme.colors.text} bold wrap="truncate">
          {shortMessage}
        </Text>
        <Text color={theme.colors.muted}>
          ({files.length} file{files.length !== 1 ? 's' : ''})
        </Text>
      </Box>
      <Box flexDirection="row" flexGrow={1}>
        <Box
          flexDirection="column"
          width="30%"
          minWidth={32}
          minHeight={0}
          overflow="hidden"
          borderStyle="single"
          borderColor={
            focusPanel === 'tree' && isActive
              ? theme.colors.accent
              : theme.colors.border
          }
        >
          <Box paddingX={1} paddingY={0} gap={1}>
            <Text color={theme.colors.accent} bold>
              Files
            </Text>
            <Text color={theme.colors.muted}>({files.length})</Text>
          </Box>
          <Box
            flexDirection="column"
            width="100%"
            minWidth={0}
            paddingX={1}
            overflow="hidden"
            height={treeViewportHeight}
            minHeight={0}
            flexShrink={1}
          >
            {visibleRows.map((row, i) => {
              const rowIndex = treeScrollOffset + i
              return row.type === 'dir' ? (
                <Box
                  key={`row-${rowIndex}`}
                  width="100%"
                  minWidth={0}
                  overflow="hidden"
                  paddingLeft={row.indent * 2}
                >
                  <Text wrap="truncate-end" color={theme.colors.muted}>
                    {row.name}/
                  </Text>
                </Box>
              ) : (
                <Box
                  key={`row-${rowIndex}`}
                  width="100%"
                  minWidth={0}
                  overflow="hidden"
                  paddingLeft={row.indent * 2}
                >
                  <FileItem
                    item={row.file}
                    isFocus={isPanelFocused && row.fileIndex === treeSelectedIndex}
                    isSelected={row.fileIndex === selectedFileIndex}
                  />
                </Box>
              )
            })}
          </Box>
        </Box>
        <Box
          flexDirection="column"
          flexGrow={1}
          minWidth={0}
          overflow="hidden"
          borderStyle="single"
          borderColor={
            focusPanel === 'diff' && isActive
              ? theme.colors.accent
              : theme.colors.border
          }
        >
          <Box paddingX={1} paddingY={0} gap={2} overflow="hidden">
            <Text wrap="truncate-end" color={theme.colors.accent} bold>
              {selectedFile?.filename ?? 'No file selected'}
            </Text>
            {selectedFile && (
              <Box gap={1}>
                <Text color={theme.colors.diffAdd}>+{selectedFile.additions}</Text>
                <Text color={theme.colors.diffDel}>-{selectedFile.deletions}</Text>
              </Box>
            )}
            {effectiveDiffMode === 'side-by-side' && (
              <Text color={theme.colors.info}>[split]</Text>
            )}
          </Box>
          <Box flexDirection="column" flexGrow={1} minWidth={0} overflow="hidden">
            {effectiveDiffMode === 'side-by-side' ? (
              <SideBySideDiffView
                rows={sideBySideRows}
                selectedLine={diffSelectedLine}
                scrollOffset={diffScrollOffset}
                viewportHeight={viewportHeight - 2}
                isActive={isActive && focusPanel === 'diff'}
                filename={selectedFile?.filename}
                contentWidth={diffContentWidthSbs}
                scrollOffsetX={Math.min(diffScrollOffsetX, maxDiffScrollXSbs)}
              />
            ) : (
              <DiffView
                allRows={allRows}
                selectedLine={diffSelectedLine}
                scrollOffset={diffScrollOffset}
                viewportHeight={viewportHeight - 2}
                isActive={isActive && focusPanel === 'diff'}
                filename={selectedFile?.filename}
                visualStart={null}
                contentWidth={diffContentWidth}
                scrollOffsetX={Math.min(diffScrollOffsetX, maxDiffScrollXUnified)}
              />
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
