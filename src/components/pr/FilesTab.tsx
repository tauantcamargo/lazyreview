import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { ScrollList, type ScrollListRef } from 'ink-scroll-list'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useListNavigation } from '../../hooks/useListNavigation'
import { useInputFocus } from '../../hooks/useInputFocus'
import { useViewedFiles } from '../../hooks/useViewedFiles'
import type { FileChange } from '../../models/file-change'
import { parseDiffPatch } from '../../models/diff'
import type { Comment } from '../../models/comment'
import type { ReviewThread } from '../../services/GitHubApiTypes'
import { EmptyState } from '../common/EmptyState'
import { DiffView, buildDiffRows } from './DiffView'
import {
  SideBySideDiffView,
  buildSideBySideRows,
  SIDE_BY_SIDE_MIN_WIDTH,
  type SideBySideRow,
} from './SideBySideDiffView'
import type { DiffCommentThread } from './DiffComment'
import type { DiffDisplayRow } from './DiffView'
import {
  buildFileTree,
  flattenTreeToFiles,
  buildDisplayRows,
  FileItem,
} from './FileTree'
import type { DiffLine } from '../../models/diff'
import type { InlineCommentContext } from '../../models/inline-comment'

/**
 * Resolve the focused DiffCommentThread from either unified or side-by-side rows.
 */
function getFocusedCommentThread(
  effectiveDiffMode: DiffMode,
  diffSelectedLine: number,
  allRows: readonly DiffDisplayRow[],
  sideBySideRows: readonly SideBySideRow[],
): DiffCommentThread | undefined {
  if (effectiveDiffMode === 'side-by-side') {
    const row = sideBySideRows[diffSelectedLine]
    return row?.type === 'comment' ? row.thread : undefined
  }
  const row = allRows[diffSelectedLine]
  return row?.type === 'comment' ? row.thread : undefined
}

interface FocusedLineInfo {
  readonly line: DiffLine
  readonly oldLineNumber: number | undefined
  readonly newLineNumber: number | undefined
}

/**
 * Resolve the focused diff line from either unified or side-by-side rows.
 * For side-by-side paired rows, prefers the right (new) side, falls back to left.
 */
function getFocusedLine(
  effectiveDiffMode: DiffMode,
  index: number,
  allRows: readonly DiffDisplayRow[],
  sideBySideRows: readonly SideBySideRow[],
): FocusedLineInfo | undefined {
  if (effectiveDiffMode === 'side-by-side') {
    const row = sideBySideRows[index]
    if (!row || row.type === 'comment') return undefined
    if (row.type === 'header') {
      if (row.left) return { line: row.left, oldLineNumber: row.left.oldLineNumber, newLineNumber: row.left.newLineNumber }
      return undefined
    }
    // For paired rows: prefer right (add/context), fall back to left (del)
    const activeLine = row.right ?? row.left
    if (!activeLine) return undefined
    return { line: activeLine, oldLineNumber: activeLine.oldLineNumber, newLineNumber: activeLine.newLineNumber }
  }
  const row = allRows[index]
  if (!row || row.type !== 'line') return undefined
  return { line: row.line, oldLineNumber: row.oldLineNumber, newLineNumber: row.newLineNumber }
}

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
  readonly onReply?: (context: { readonly commentId: number; readonly user: string; readonly body: string | null }) => void
  readonly onToggleResolve?: (context: { readonly threadId: string; readonly isResolved: boolean }) => void
  readonly onEditComment?: (context: EditCommentContext) => void
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
}: FilesTabProps): React.ReactElement {
  const { stdout } = useStdout()
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const { markViewed, toggleViewed, isViewed, getViewedCount } = useViewedFiles()
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 13)

  const [focusPanel, setFocusPanel] = useState<FocusPanel>('tree')
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [visualStart, setVisualStart] = useState<number | null>(null)
  const [diffMode, setDiffMode] = useState<DiffMode>('unified')

  // Fall back to unified if terminal is too narrow
  const terminalWidth = stdout?.columns ?? 120
  const effectiveDiffMode =
    diffMode === 'side-by-side' && terminalWidth < SIDE_BY_SIDE_MIN_WIDTH
      ? 'unified'
      : diffMode
  const [isFiltering, setIsFiltering] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('')

  const filteredFiles = useMemo(() => {
    if (!activeFilter && !isFiltering) return files
    const query = isFiltering ? filterQuery : activeFilter
    if (!query) return files
    return files.filter((f) => fuzzyMatch(f.filename, query))
  }, [files, activeFilter, filterQuery, isFiltering])

  const filteredTree = useMemo(() => buildFileTree(filteredFiles), [filteredFiles])
  const fileOrder = useMemo(() => flattenTreeToFiles(filteredTree), [filteredTree])
  const displayRows = useMemo(
    () => buildDisplayRows(filteredTree, 0, { current: 0 }),
    [filteredTree],
  )

  const treeViewportHeight = viewportHeight - 2
  const fileTreeListRef = useRef<ScrollListRef>(null)

  const { selectedIndex: treeSelectedIndex } = useListNavigation({
    itemCount: fileOrder.length,
    viewportHeight: treeViewportHeight,
    isActive: isActive && focusPanel === 'tree' && !isFiltering,
  })
  const selectedRowIndex = displayRows.findIndex(
    (r) => r.type === 'file' && r.fileIndex === treeSelectedIndex,
  )
  const effectiveRowIndex = selectedRowIndex >= 0 ? selectedRowIndex : 0

  useEffect(() => {
    const handleResize = (): void => fileTreeListRef.current?.remeasure()
    stdout?.on('resize', handleResize)
    return () => {
      stdout?.off('resize', handleResize)
    }
  }, [stdout])

  React.useEffect(() => {
    if (focusPanel === 'tree') {
      setSelectedFileIndex(treeSelectedIndex)
    }
  }, [treeSelectedIndex, focusPanel])

  // Auto-mark file as viewed when selected
  React.useEffect(() => {
    const file = fileOrder[selectedFileIndex]
    if (file && prUrl) {
      markViewed(prUrl, file.filename)
    }
  }, [selectedFileIndex, fileOrder, prUrl, markViewed])

  const selectedFile = fileOrder[selectedFileIndex] ?? fileOrder[0] ?? null
  const hunks = selectedFile?.patch ? parseDiffPatch(selectedFile.patch) : []

  const commentsByLine = useMemo((): ReadonlyMap<string, DiffCommentThread> | undefined => {
    if (!comments || comments.length === 0 || !selectedFile) return undefined
    const fileComments = comments.filter(
      (c) => c.path === selectedFile.filename && c.line != null && c.in_reply_to_id == null,
    )
    if (fileComments.length === 0) return undefined
    const threadMap = new Map<number, { id: string; isResolved: boolean } | undefined>()
    if (reviewThreads) {
      for (const thread of reviewThreads) {
        for (const tc of thread.comments) threadMap.set(tc.databaseId, { id: thread.id, isResolved: thread.isResolved })
      }
    }
    const replyMap = new Map<number, Comment[]>()
    for (const c of comments) {
      if (c.path === selectedFile.filename && c.in_reply_to_id != null) {
        replyMap.set(c.in_reply_to_id, [...(replyMap.get(c.in_reply_to_id) ?? []), c])
      }
    }
    const result = new Map<string, DiffCommentThread>()
    for (const rc of fileComments) {
      const threadInfo = threadMap.get(rc.id)
      const side = rc.side === 'LEFT' ? 'LEFT' : 'RIGHT'
      const key = `${side}:${rc.line!}`
      result.set(key, {
        comments: [rc, ...(replyMap.get(rc.id) ?? [])],
        threadId: threadInfo?.id, isResolved: threadInfo?.isResolved,
      })
    }
    return result
  }, [comments, reviewThreads, selectedFile])

  const allRows = useMemo(
    () => buildDiffRows(hunks, commentsByLine),
    [hunks, commentsByLine],
  )
  const sideBySideRows = useMemo(
    () => (effectiveDiffMode === 'side-by-side' ? buildSideBySideRows(hunks, commentsByLine) : []),
    [hunks, effectiveDiffMode, commentsByLine],
  )
  const totalDiffLines =
    effectiveDiffMode === 'side-by-side' ? sideBySideRows.length : allRows.length

  const { selectedIndex: diffSelectedLine, scrollOffset: diffScrollOffset } =
    useListNavigation({
      itemCount: totalDiffLines,
      viewportHeight,
      isActive: isActive && focusPanel === 'diff',
    })

  useInput(
    (input, key) => {
      if (isFiltering) {
        if (key.escape) {
          setIsFiltering(false)
          setFilterQuery('')
          setActiveFilter('')
          setInputActive(false)
        } else if (key.return) {
          setIsFiltering(false)
          setActiveFilter(filterQuery)
          setInputActive(false)
        }
        return
      }

      if (key.escape && visualStart != null) {
        setVisualStart(null)
        return
      }

      if (key.escape && activeFilter) {
        setActiveFilter('')
        setFilterQuery('')
        return
      }

      if (input === '/' && focusPanel === 'tree') {
        setIsFiltering(true)
        setFilterQuery(activeFilter)
        setInputActive(true)
        return
      }

      if (key.tab) {
        setVisualStart(null)
        setFocusPanel((prev) => (prev === 'tree' ? 'diff' : 'tree'))
      } else if (input === 'h' || key.leftArrow) {
        setVisualStart(null)
        setFocusPanel('tree')
      } else if (input === 'l' || key.rightArrow) {
        setFocusPanel('diff')
      } else if (input === 'd' && focusPanel === 'diff') {
        setDiffMode((prev) => (prev === 'unified' ? 'side-by-side' : 'unified'))
        setVisualStart(null)
      } else if (input === 'v' && focusPanel === 'tree' && prUrl) {
        const file = fileOrder[treeSelectedIndex]
        if (file) {
          toggleViewed(prUrl, file.filename)
        }
      } else if (input === 'v' && focusPanel === 'diff') {
        if (visualStart != null) {
          setVisualStart(null)
        } else {
          setVisualStart(diffSelectedLine)
        }
      } else if (input === 'r' && focusPanel === 'diff' && onReply) {
        const thread = getFocusedCommentThread(effectiveDiffMode, diffSelectedLine, allRows, sideBySideRows)
        if (thread) {
          const lastComment = thread.comments[thread.comments.length - 1]
          if (lastComment) {
            onReply({
              commentId: lastComment.id,
              user: lastComment.user.login,
              body: lastComment.body,
            })
          }
        }
      } else if (input === 'x' && focusPanel === 'diff' && onToggleResolve) {
        const thread = getFocusedCommentThread(effectiveDiffMode, diffSelectedLine, allRows, sideBySideRows)
        if (thread?.threadId) {
          onToggleResolve({
            threadId: thread.threadId,
            isResolved: thread.isResolved ?? false,
          })
        }
      } else if (input === 'e' && focusPanel === 'diff' && onEditComment && currentUser) {
        const thread = getFocusedCommentThread(effectiveDiffMode, diffSelectedLine, allRows, sideBySideRows)
        if (thread) {
          const ownComment = thread.comments.find((c) => c.user.login === currentUser)
          if (ownComment) {
            onEditComment({
              commentId: ownComment.id,
              body: ownComment.body,
              isReviewComment: true,
            })
          }
        }
      } else if (input === 'c' && focusPanel === 'diff' && onInlineComment && selectedFile) {
        if (visualStart != null) {
          const selMin = Math.min(visualStart, diffSelectedLine)
          const selMax = Math.max(visualStart, diffSelectedLine)
          const startInfo = getFocusedLine(effectiveDiffMode, selMin, allRows, sideBySideRows)
          const endInfo = getFocusedLine(effectiveDiffMode, selMax, allRows, sideBySideRows)
          if (
            startInfo && endInfo &&
            startInfo.line.type !== 'header' && endInfo.line.type !== 'header'
          ) {
            const endSide = endInfo.line.type === 'del' ? 'LEFT' as const : 'RIGHT' as const
            const startSide = startInfo.line.type === 'del' ? 'LEFT' as const : 'RIGHT' as const
            const endLine = endSide === 'LEFT' ? endInfo.oldLineNumber : endInfo.newLineNumber
            const startLine = startSide === 'LEFT' ? startInfo.oldLineNumber : startInfo.newLineNumber
            if (endLine != null && startLine != null) {
              onInlineComment({
                path: selectedFile.filename,
                line: endLine,
                side: endSide,
                startLine,
                startSide,
              })
              setVisualStart(null)
            }
          }
        } else {
          const lineInfo = getFocusedLine(effectiveDiffMode, diffSelectedLine, allRows, sideBySideRows)
          if (lineInfo && lineInfo.line.type !== 'header') {
            const side = lineInfo.line.type === 'del' ? 'LEFT' as const : 'RIGHT' as const
            const line = side === 'LEFT' ? lineInfo.oldLineNumber : lineInfo.newLineNumber
            if (line != null) {
              onInlineComment({
                path: selectedFile.filename,
                line,
                side,
              })
            }
          }
        }
      }
    },
    { isActive },
  )

  if (files.length === 0) {
    return <EmptyState message="No files changed" />
  }

  const isPanelFocused = focusPanel === 'tree' && isActive

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box
        flexDirection="column"
        width="30%"
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
        </Box>
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
          paddingX={1}
          overflow="hidden"
          height={isFiltering ? treeViewportHeight - 1 : treeViewportHeight}
          minHeight={isFiltering ? treeViewportHeight - 1 : treeViewportHeight}
          flexShrink={0}
        >
          <ScrollList
            ref={fileTreeListRef}
            selectedIndex={effectiveRowIndex}
            scrollAlignment="auto"
          >
            {displayRows.map((row, rowIndex) =>
              row.type === 'dir' ? (
                <Box key={`row-${rowIndex}`} paddingLeft={row.indent * 2}>
                  <Text color={theme.colors.muted}>{row.name}/</Text>
                </Box>
              ) : (
                <Box key={`row-${rowIndex}`} paddingLeft={row.indent * 2}>
                  <FileItem
                    item={row.file}
                    isFocus={
                      isPanelFocused && row.fileIndex === treeSelectedIndex
                    }
                    isSelected={row.fileIndex === selectedFileIndex}
                    isViewed={prUrl ? isViewed(prUrl, row.file.filename) : undefined}
                  />
                </Box>
              ),
            )}
          </ScrollList>
        </Box>
      </Box>
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderColor={
          focusPanel === 'diff' && isActive
            ? theme.colors.accent
            : theme.colors.border
        }
      >
        <Box paddingX={1} paddingY={0} gap={2}>
          <Text color={theme.colors.accent} bold>
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
          {effectiveDiffMode === 'side-by-side' && (
            <Text color={theme.colors.info}>[split]</Text>
          )}
          {visualStart != null && focusPanel === 'diff' && (
            <Text color={theme.colors.warning} bold>
              -- VISUAL LINE --
            </Text>
          )}
        </Box>
        <Box flexDirection="column" flexGrow={1} overflowY="hidden">
          {effectiveDiffMode === 'side-by-side' ? (
            <SideBySideDiffView
              rows={sideBySideRows}
              selectedLine={diffSelectedLine}
              scrollOffset={diffScrollOffset}
              viewportHeight={viewportHeight - 2}
              isActive={isActive && focusPanel === 'diff'}
              filename={selectedFile?.filename}
            />
          ) : (
            <DiffView
              allRows={allRows}
              selectedLine={diffSelectedLine}
              scrollOffset={diffScrollOffset}
              viewportHeight={viewportHeight - 2}
              isActive={isActive && focusPanel === 'diff'}
              filename={selectedFile?.filename}
              visualStart={focusPanel === 'diff' ? visualStart : null}
            />
          )}
        </Box>
      </Box>
    </Box>
  )
}
