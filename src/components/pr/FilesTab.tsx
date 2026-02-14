import React, { useMemo, useRef, useState } from 'react'
import { Box, Text, useStdout, measureElement } from 'ink'
import type { DOMElement } from 'ink'
import { TextInput, Spinner } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useListNavigation, deriveScrollOffset } from '../../hooks/useListNavigation'
import { setScreenContext } from '../../hooks/useScreenContext'
import { useInputFocus } from '../../hooks/useInputFocus'
import { useViewedFiles } from '../../hooks/useViewedFiles'
import { useDiffSearch } from '../../hooks/useDiffSearch'
import { useCrossFileSearch } from '../../hooks/useCrossFileSearch'
import { useVisualSelect } from '../../hooks/useVisualSelect'
import { useFilesTabKeyboard } from '../../hooks/useFilesTabKeyboard'
import { useFileDiff } from '../../hooks/useGitHub'
import type { FileChange } from '../../models/file-change'
import { parseDiffPatch } from '../../models/diff'
import type { Comment } from '../../models/comment'
import type { ReviewThread } from '../../services/GitHubApiTypes'
import { buildCommentsByLine } from './buildCommentsByLine'
import { EmptyState } from '../common/EmptyState'
import { DiffView, buildDiffRows } from './DiffView'
import { computeMaxDiffLineLength, computeMaxSbsLineLength } from './diffScrollHelpers'
import {
  SideBySideDiffView,
  buildSideBySideRows,
  SIDE_BY_SIDE_MIN_WIDTH,
} from './SideBySideDiffView'
import {
  buildFileTree,
  flattenTreeToFiles,
  buildDisplayRows,
  FileItem,
} from './FileTree'
import type { InlineCommentContext } from '../../models/inline-comment'
import { DiffStatsSummary } from './DiffStatsSummary'
import { findRowByLineNumber, findSbsRowByLineNumber } from './diffNavigationHelpers'

export function fuzzyMatch(filename: string, query: string): boolean {
  const lower = filename.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

interface EditCommentContext {
  readonly commentId: number
  readonly body: string
  readonly isReviewComment: boolean
}

interface FilesTabProps {
  readonly files: readonly FileChange[]
  readonly isActive: boolean
  readonly prUrl?: string
  readonly onInlineComment?: (context: InlineCommentContext) => void
  readonly comments?: readonly Comment[]
  readonly reviewThreads?: readonly ReviewThread[]
  readonly currentUser?: string
  readonly onReply?: (context: {
    readonly commentId: number
    readonly user: string
    readonly body: string | null
  }) => void
  readonly onToggleResolve?: (context: {
    readonly threadId: string
    readonly isResolved: boolean
  }) => void
  readonly onEditComment?: (context: EditCommentContext) => void
  readonly onAddReaction?: (context: {
    readonly commentId: number
    readonly commentType: 'issue_comment' | 'review_comment'
  }) => void
  readonly initialFile?: string
  readonly onInitialFileConsumed?: () => void
  // Lazy diff loading: if provided, diffs are fetched on-demand per file
  readonly owner?: string
  readonly repo?: string
  readonly prNumber?: number
  // Total file count from PR metadata (for pagination indicator)
  readonly totalFileCount?: number
  // Whether more pages of files are available
  readonly hasMoreFiles?: boolean
  // Callback to load the next page of files
  readonly onLoadMoreFiles?: () => void
}

type FocusPanel = 'tree' | 'diff'
type DiffMode = 'unified' | 'side-by-side'

export function FilesTab({
  files,
  isActive,
  prUrl,
  onInlineComment,
  comments,
  reviewThreads,
  currentUser,
  onReply,
  onToggleResolve,
  onEditComment,
  onAddReaction,
  initialFile,
  onInitialFileConsumed,
  owner,
  repo,
  prNumber,
  totalFileCount,
  hasMoreFiles,
  onLoadMoreFiles,
}: FilesTabProps): React.ReactElement {
  const { stdout } = useStdout()
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const { markViewed, toggleViewed, isViewed, getViewedCount } =
    useViewedFiles()
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 13)
  const FILES_TREE_HEADER_LINES = 5
  const treeViewportMaxHeight = Math.max(
    1,
    (stdout?.rows ?? 24) - 18 - FILES_TREE_HEADER_LINES,
  )

  const [focusPanel, setFocusPanel] = useState<FocusPanel>('tree')
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [diffMode, setDiffMode] = useState<DiffMode>('unified')
  const [treePanelPct, setTreePanelPct] = useState(30)
  const [collapsedDirs, setCollapsedDirs] = useState<ReadonlySet<string>>(new Set())
  const visual = useVisualSelect()

  // Measure actual container width
  const containerRef = useRef<DOMElement>(null)
  const [measuredWidth, setMeasuredWidth] = useState(0)
  React.useEffect(() => {
    if (containerRef.current) {
      const { width } = measureElement(containerRef.current)
      setMeasuredWidth((prev) => (prev === width ? prev : width))
    }
  })

  // Fall back to unified if terminal is too narrow
  const terminalWidth = stdout?.columns ?? 120
  const containerWidth = measuredWidth > 0 ? measuredWidth : terminalWidth
  const effectiveDiffMode =
    diffMode === 'side-by-side' && containerWidth < SIDE_BY_SIDE_MIN_WIDTH
      ? 'unified'
      : diffMode

  const crossFileSearch = useCrossFileSearch(files)

  const [isFiltering, setIsFiltering] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [diffScrollOffsetX, setDiffScrollOffsetX] = useState(0)
  const [isGoToLine, setIsGoToLine] = useState(false)
  const [goToLineQuery, setGoToLineQuery] = useState('')

  const treePanelWidth = Math.max(32, Math.floor(containerWidth * (treePanelPct / 100)))
  const diffContentWidth = Math.max(10, containerWidth - treePanelWidth - 8)

  const filteredFiles = useMemo(() => {
    if (!activeFilter && !isFiltering) return files
    const query = isFiltering ? filterQuery : activeFilter
    if (!query) return files
    return files.filter((f) => fuzzyMatch(f.filename, query))
  }, [files, activeFilter, filterQuery, isFiltering])

  const filteredTree = useMemo(
    () => buildFileTree(filteredFiles),
    [filteredFiles],
  )
  const fileOrder = useMemo(
    () => flattenTreeToFiles(filteredTree),
    [filteredTree],
  )
  const displayRows = useMemo(
    () => buildDisplayRows(filteredTree, 0, { current: 0 }, collapsedDirs),
    [filteredTree, collapsedDirs],
  )

  const treeViewportHeight = Math.min(
    viewportHeight - 2,
    treeViewportMaxHeight - (isFiltering ? 1 : 0),
  )

  const { selectedIndex: treeSelectedIndex } = useListNavigation({
    itemCount: fileOrder.length,
    viewportHeight: treeViewportHeight,
    isActive: isActive && focusPanel === 'tree' && !isFiltering && !crossFileSearch.isSearching,
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
    if (isActive) {
      setScreenContext(focusPanel === 'tree' ? 'pr-detail-files-tree' : 'pr-detail-files-diff')
    }
  }, [focusPanel, isActive])

  React.useEffect(() => {
    if (focusPanel === 'tree') {
      setSelectedFileIndex(treeSelectedIndex)
    }
  }, [treeSelectedIndex, focusPanel])

  const selectedFile = fileOrder[selectedFileIndex] ?? fileOrder[0] ?? null

  // Memoize hunks by filename to avoid re-parsing on every render
  const selectedFilename = selectedFile?.filename ?? null
  const inlinePatch = selectedFile?.patch ?? null

  // Lazy diff loading: fetch on-demand when file has no inline patch
  const needsLazyDiff = !!selectedFilename && inlinePatch == null && !!owner && !!repo && !!prNumber
  const { data: lazyDiffFile, isLoading: isDiffLoading } = useFileDiff(
    owner ?? '',
    repo ?? '',
    prNumber ?? 0,
    needsLazyDiff ? selectedFilename : null,
    { enabled: needsLazyDiff },
  )

  const selectedPatch = inlinePatch ?? lazyDiffFile?.patch ?? null
  const hunks = useMemo(
    () => (selectedPatch ? parseDiffPatch(selectedPatch) : []),
    [selectedPatch],
  )

  // Stable key for commentsByLine: use a stringified fingerprint of
  // comment IDs + resolution state for the selected file so we only
  // recompute when actual comment data changes, not on every React
  // Query cache reference update.
  const commentIdKey = useMemo(() => {
    if (!comments || comments.length === 0 || !selectedFilename) return ''
    const fileComments = comments.filter((c) => c.path === selectedFilename)
    const ids = fileComments.map((c) => `${c.id}:${c.body.length}`).join(',')
    const threadIds = reviewThreads
      ? reviewThreads
          .map((t) => `${t.id}:${t.isResolved ? 1 : 0}`)
          .join(',')
      : ''
    return `${ids}|${threadIds}`
  }, [comments, reviewThreads, selectedFilename])

  const commentsByLine = useMemo(
    () => buildCommentsByLine(comments, reviewThreads, selectedFilename ?? undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commentIdKey, selectedFilename],
  )

  const allRows = useMemo(
    () => buildDiffRows(hunks, commentsByLine),
    [hunks, commentsByLine],
  )
  const sideBySideRows = useMemo(
    () =>
      effectiveDiffMode === 'side-by-side'
        ? buildSideBySideRows(hunks, commentsByLine)
        : [],
    [hunks, effectiveDiffMode, commentsByLine],
  )
  const totalDiffLines =
    effectiveDiffMode === 'side-by-side'
      ? sideBySideRows.length
      : allRows.length

  const search = useDiffSearch(effectiveDiffMode, allRows, sideBySideRows)

  // Reset search when file changes
  React.useEffect(() => {
    setDiffScrollOffsetX(0)
    search.resetOnFileChange()
  }, [selectedFileIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-mark file as viewed when selected
  React.useEffect(() => {
    const file = fileOrder[selectedFileIndex]
    if (file && prUrl) {
      markViewed(prUrl, file.filename)
    }
  }, [selectedFileIndex, fileOrder, prUrl, markViewed])

  // Auto-select initial file
  React.useEffect(() => {
    if (!initialFile) return
    const targetIndex = fileOrder.findIndex((f) => f.filename === initialFile)
    if (targetIndex >= 0) {
      setSelectedFileIndex(targetIndex)
      setFocusPanel('diff')
    }
    onInitialFileConsumed?.()
  }, [initialFile, fileOrder, onInitialFileConsumed])

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
  const maxDiffScrollXSbs = Math.max(
    0,
    maxDiffLineLengthSbs - diffContentWidthSbs,
  )
  const maxDiffScrollX =
    effectiveDiffMode === 'side-by-side'
      ? maxDiffScrollXSbs
      : maxDiffScrollXUnified

  const { selectedIndex: diffSelectedLine, scrollOffset: diffScrollOffset, setSelectedIndex: setDiffSelectedLine } =
    useListNavigation({
      itemCount: totalDiffLines,
      viewportHeight,
      isActive: isActive && focusPanel === 'diff' && !search.isDiffSearching && !crossFileSearch.isSearching && !isGoToLine,
    })

  useFilesTabKeyboard({
    isActive,
    focusPanel,
    setFocusPanel,
    effectiveDiffMode,
    setDiffMode,
    isFiltering,
    setIsFiltering,
    filterQuery,
    setFilterQuery,
    activeFilter,
    setActiveFilter,
    setInputActive,
    search,
    crossFileSearch,
    setSelectedFileIndex,
    visual,
    diffSelectedLine,
    setDiffSelectedLine,
    maxDiffScrollX,
    setDiffScrollOffsetX,
    allRows,
    sideBySideRows,
    fileOrder,
    treeSelectedIndex,
    prUrl,
    toggleViewed,
    selectedFile,
    onReply,
    onToggleResolve,
    onEditComment,
    onInlineComment,
    onAddReaction,
    currentUser,
    treePanelPct,
    setTreePanelPct,
    displayRows,
    collapsedDirs,
    setCollapsedDirs,
    isGoToLine,
    setIsGoToLine,
    goToLineQuery,
    setGoToLineQuery,
  })

  if (files.length === 0) {
    return <EmptyState message="No files changed" />
  }

  const isPanelFocused = focusPanel === 'tree' && isActive

  return (
    <Box ref={containerRef} flexDirection="row" flexGrow={1}>
      <Box
        flexDirection="column"
        width={`${treePanelPct}%`}
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
          <Text color={theme.colors.muted}>
            {activeFilter || isFiltering
              ? `(${filteredFiles.length} of ${files.length})`
              : `(${files.length})`}
          </Text>
          {prUrl && (
            <Text color={theme.colors.success}>
              {getViewedCount(prUrl)}/{files.length} viewed
            </Text>
          )}
          {activeFilter && !isFiltering && (
            <Text color={theme.colors.warning}>[/{activeFilter}]</Text>
          )}
          {totalFileCount != null && totalFileCount > files.length && (
            <Text color={theme.colors.info}>
              [{files.length}/{totalFileCount}]
            </Text>
          )}
          {hasMoreFiles && (
            <Text color={theme.colors.muted}>[more...]</Text>
          )}
        </Box>
        <DiffStatsSummary files={files} />
        {isFiltering && (
          <Box paddingX={1}>
            <Text color={theme.colors.accent}>/</Text>
            <TextInput
              defaultValue={filterQuery}
              onChange={setFilterQuery}
              placeholder="filter files..."
            />
          </Box>
        )}
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
                  {row.isCollapsed ? '\u25B8' : '\u25BE'} {row.name}/
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
                  isFocus={
                    isPanelFocused && row.fileIndex === treeSelectedIndex
                  }
                  isSelected={row.fileIndex === selectedFileIndex}
                  isViewed={
                    prUrl ? isViewed(prUrl, row.file.filename) : undefined
                  }
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
              <Text color={theme.colors.diffAdd}>
                +{selectedFile.additions}
              </Text>
              <Text color={theme.colors.diffDel}>
                -{selectedFile.deletions}
              </Text>
            </Box>
          )}
          {totalDiffLines > 0 && focusPanel === 'diff' && (
            <Text color={theme.colors.muted}>
              {diffSelectedLine + 1}/{totalDiffLines}
            </Text>
          )}
          {effectiveDiffMode === 'side-by-side' && (
            <Text color={theme.colors.info}>[split]</Text>
          )}
          {maxDiffScrollX > 0 && (
            <Text color={theme.colors.muted}>[left/right h-scroll]</Text>
          )}
          {visual.visualStart != null && focusPanel === 'diff' && (
            <Text color={theme.colors.warning} bold>
              -- VISUAL LINE --
            </Text>
          )}
          {search.activeDiffSearch && !search.isDiffSearching && (
            <Text color={theme.colors.warning}>
              [/{search.activeDiffSearch}] {search.diffSearchMatches.length > 0
                ? `${search.currentSearchMatchIndex + 1}/${search.diffSearchMatches.length}`
                : 'no matches'}
            </Text>
          )}
          {crossFileSearch.activeQuery && !crossFileSearch.isSearching && !search.activeDiffSearch && (
            <Text color={theme.colors.info}>
              [F:{crossFileSearch.activeQuery}] {crossFileSearch.matches.length > 0
                ? `${crossFileSearch.currentIndex + 1}/${crossFileSearch.matches.length} (${crossFileSearch.matchedFileCount()} files)`
                : 'no matches'}
            </Text>
          )}
        </Box>
        {crossFileSearch.isSearching && (
          <Box paddingX={1}>
            <Text color={theme.colors.info}>F/</Text>
            <TextInput
              defaultValue={crossFileSearch.query}
              onChange={crossFileSearch.setQuery}
              placeholder="search all files..."
            />
          </Box>
        )}
        {search.isDiffSearching && (
          <Box paddingX={1}>
            <Text color={theme.colors.accent}>/</Text>
            <TextInput
              defaultValue={search.diffSearchQuery}
              onChange={search.setDiffSearchQuery}
              placeholder="search diff..."
            />
          </Box>
        )}
        {isGoToLine && (
          <Box paddingX={1}>
            <Text color={theme.colors.accent}>:</Text>
            <TextInput
              defaultValue={goToLineQuery}
              onChange={setGoToLineQuery}
              placeholder="line number..."
            />
          </Box>
        )}
        <Box flexDirection="column" flexGrow={1} minWidth={0} overflow="hidden">
          {isDiffLoading && needsLazyDiff ? (
            <Box justifyContent="center" alignItems="center" flexGrow={1}>
              <Box gap={1}>
                <Spinner />
                <Text color={theme.colors.accent}>Loading diff...</Text>
              </Box>
            </Box>
          ) : effectiveDiffMode === 'side-by-side' ? (
            <SideBySideDiffView
              rows={sideBySideRows}
              selectedLine={diffSelectedLine}
              scrollOffset={diffScrollOffset}
              viewportHeight={viewportHeight - 2 - (search.isDiffSearching || crossFileSearch.isSearching || isGoToLine ? 1 : 0)}
              isActive={isActive && focusPanel === 'diff'}
              filename={selectedFile?.filename}
              contentWidth={diffContentWidthSbs}
              scrollOffsetX={Math.min(diffScrollOffsetX, maxDiffScrollXSbs)}
              searchMatchIndices={search.diffSearchMatchSet.size > 0 ? search.diffSearchMatchSet : undefined}
            />
          ) : (
            <DiffView
              allRows={allRows}
              selectedLine={diffSelectedLine}
              scrollOffset={diffScrollOffset}
              viewportHeight={viewportHeight - 2 - (search.isDiffSearching || crossFileSearch.isSearching || isGoToLine ? 1 : 0)}
              isActive={isActive && focusPanel === 'diff'}
              filename={selectedFile?.filename}
              visualStart={focusPanel === 'diff' ? visual.visualStart : null}
              contentWidth={diffContentWidth}
              scrollOffsetX={Math.min(diffScrollOffsetX, maxDiffScrollXUnified)}
              searchMatchIndices={search.diffSearchMatchSet.size > 0 ? search.diffSearchMatchSet : undefined}
            />
          )}
        </Box>
      </Box>
    </Box>
  )
}
