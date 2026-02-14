import { useInput } from 'ink'
import { useRef } from 'react'
import type { DiffDisplayRow } from '../components/pr/DiffView'
import type { SideBySideRow } from '../components/pr/SideBySideDiffView'
import type { DiffCommentThread } from '../components/pr/DiffComment'
import type { DisplayRow } from '../components/pr/FileTree'
import type { DiffLine } from '../models/diff'
import type { FileChange } from '../models/file-change'
import type { InlineCommentContext } from '../models/inline-comment'
import type { ReactionContext } from './useReactionActions'
import type { DiffSearchActions } from './useDiffSearch'
import type { CrossFileSearchState, CrossFileSearchActions } from './useCrossFileSearch'
import type { VisualSelectActions, VisualSelectState } from './useVisualSelect'
import {
  findNextHunkStart,
  findPrevHunkStart,
  findRowByLineNumber,
  findNextSbsHunkStart,
  findPrevSbsHunkStart,
  findSbsRowByLineNumber,
} from '../components/pr/diffNavigationHelpers'
import {
  getHunkIndexForRow,
  toggleHunkFold,
  type FoldableRow,
} from '../utils/hunk-folding'

type FocusPanel = 'tree' | 'diff'
type DiffMode = 'unified' | 'side-by-side'

interface EditCommentContext {
  readonly commentId: number
  readonly body: string
  readonly isReviewComment: boolean
}

interface FocusedLineInfo {
  readonly line: DiffLine
  readonly oldLineNumber: number | undefined
  readonly newLineNumber: number | undefined
}

/**
 * Resolve the focused DiffCommentThread from either unified or side-by-side rows.
 */
export function getFocusedCommentThread(
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

/**
 * Resolve the focused diff line from either unified or side-by-side rows.
 * For side-by-side paired rows, prefers the right (new) side, falls back to left.
 */
export function getFocusedLine(
  effectiveDiffMode: DiffMode,
  index: number,
  allRows: readonly DiffDisplayRow[],
  sideBySideRows: readonly SideBySideRow[],
): FocusedLineInfo | undefined {
  if (effectiveDiffMode === 'side-by-side') {
    const row = sideBySideRows[index]
    if (!row || row.type === 'comment') return undefined
    if (row.type === 'header') {
      if (row.left)
        return {
          line: row.left,
          oldLineNumber: row.left.oldLineNumber,
          newLineNumber: row.left.newLineNumber,
        }
      return undefined
    }
    const activeLine = row.right ?? row.left
    if (!activeLine) return undefined
    return {
      line: activeLine,
      oldLineNumber: activeLine.oldLineNumber,
      newLineNumber: activeLine.newLineNumber,
    }
  }
  const row = allRows[index]
  if (!row || row.type !== 'line') return undefined
  return {
    line: row.line,
    oldLineNumber: row.oldLineNumber,
    newLineNumber: row.newLineNumber,
  }
}

export interface SuggestionLineContext {
  /** The original code to be replaced */
  readonly originalCode: string
  /** File path being edited */
  readonly path: string
  /** End line number for the suggestion */
  readonly line: number
  /** Side of the diff (LEFT for deletions, RIGHT for additions/context) */
  readonly side: 'LEFT' | 'RIGHT'
  /** Start line for multi-line suggestions */
  readonly startLine?: number
}

export interface AiReviewLineContext {
  readonly code: string
  readonly filename: string
  readonly lineTypes: ReadonlySet<string>
  readonly startLine?: number
  readonly endLine?: number
}

/**
 * Extract selected lines from the diff for AI review.
 * For a visual selection, extracts all lines in the range.
 * For a single focused line, extracts that line plus context lines above/below.
 */
export function extractAiReviewLines(
  effectiveDiffMode: DiffMode,
  diffSelectedLine: number,
  allRows: readonly DiffDisplayRow[],
  sideBySideRows: readonly SideBySideRow[],
  filename: string,
  visualStart: number | null,
  contextLines: number = 5,
): AiReviewLineContext | undefined {
  if (visualStart != null) {
    return extractVisualSelection(
      effectiveDiffMode,
      diffSelectedLine,
      allRows,
      sideBySideRows,
      filename,
      visualStart,
    )
  }
  return extractSingleLineWithContext(
    effectiveDiffMode,
    diffSelectedLine,
    allRows,
    sideBySideRows,
    filename,
    contextLines,
  )
}

function extractVisualSelection(
  effectiveDiffMode: DiffMode,
  diffSelectedLine: number,
  allRows: readonly DiffDisplayRow[],
  sideBySideRows: readonly SideBySideRow[],
  filename: string,
  visualStart: number,
): AiReviewLineContext | undefined {
  const selMin = Math.min(visualStart, diffSelectedLine)
  const selMax = Math.max(visualStart, diffSelectedLine)
  const lines: string[] = []
  const lineTypes = new Set<string>()
  let startLine: number | undefined
  let endLine: number | undefined

  for (let i = selMin; i <= selMax; i++) {
    const lineInfo = getFocusedLine(effectiveDiffMode, i, allRows, sideBySideRows)
    if (lineInfo && lineInfo.line.type !== 'header') {
      lines.push(lineInfo.line.content)
      lineTypes.add(lineInfo.line.type)
      const lineNum = lineInfo.newLineNumber ?? lineInfo.oldLineNumber
      if (lineNum != null) {
        if (startLine == null) startLine = lineNum
        endLine = lineNum
      }
    }
  }

  if (lines.length === 0) return undefined

  return {
    code: lines.join('\n'),
    filename,
    lineTypes,
    startLine,
    endLine,
  }
}

function extractSingleLineWithContext(
  effectiveDiffMode: DiffMode,
  diffSelectedLine: number,
  allRows: readonly DiffDisplayRow[],
  sideBySideRows: readonly SideBySideRow[],
  filename: string,
  contextLines: number,
): AiReviewLineContext | undefined {
  const focusedInfo = getFocusedLine(effectiveDiffMode, diffSelectedLine, allRows, sideBySideRows)
  if (!focusedInfo || focusedInfo.line.type === 'header') return undefined

  const rowCount = effectiveDiffMode === 'side-by-side' ? sideBySideRows.length : allRows.length
  const startIdx = Math.max(0, diffSelectedLine - contextLines)
  const endIdx = Math.min(rowCount - 1, diffSelectedLine + contextLines)

  const lines: string[] = []
  const lineTypes = new Set<string>()
  let startLine: number | undefined
  let endLine: number | undefined

  for (let i = startIdx; i <= endIdx; i++) {
    const lineInfo = getFocusedLine(effectiveDiffMode, i, allRows, sideBySideRows)
    if (lineInfo && lineInfo.line.type !== 'header') {
      lines.push(lineInfo.line.content)
      lineTypes.add(lineInfo.line.type)
      const lineNum = lineInfo.newLineNumber ?? lineInfo.oldLineNumber
      if (lineNum != null) {
        if (startLine == null) startLine = lineNum
        endLine = lineNum
      }
    }
  }

  if (lines.length === 0) return undefined

  return {
    code: lines.join('\n'),
    filename,
    lineTypes,
    startLine,
    endLine,
  }
}

/**
 * Extract suggestion context from a visual selection or single focused line.
 * Returns the original code lines and positioning info needed to open SuggestionModal.
 */
export function extractSuggestionContext(
  effectiveDiffMode: DiffMode,
  diffSelectedLine: number,
  allRows: readonly DiffDisplayRow[],
  sideBySideRows: readonly SideBySideRow[],
  filename: string,
  visualStart: number | null,
): SuggestionLineContext | undefined {
  if (visualStart != null) {
    return extractVisualSuggestion(
      effectiveDiffMode,
      diffSelectedLine,
      allRows,
      sideBySideRows,
      filename,
      visualStart,
    )
  }
  return extractSingleLineSuggestion(
    effectiveDiffMode,
    diffSelectedLine,
    allRows,
    sideBySideRows,
    filename,
  )
}

function extractVisualSuggestion(
  effectiveDiffMode: DiffMode,
  diffSelectedLine: number,
  allRows: readonly DiffDisplayRow[],
  sideBySideRows: readonly SideBySideRow[],
  filename: string,
  visualStart: number,
): SuggestionLineContext | undefined {
  const selMin = Math.min(visualStart, diffSelectedLine)
  const selMax = Math.max(visualStart, diffSelectedLine)
  const lines: string[] = []
  let startLine: number | undefined
  let endLine: number | undefined
  let endSide: 'LEFT' | 'RIGHT' = 'RIGHT'

  for (let i = selMin; i <= selMax; i++) {
    const lineInfo = getFocusedLine(effectiveDiffMode, i, allRows, sideBySideRows)
    if (lineInfo && lineInfo.line.type !== 'header') {
      lines.push(lineInfo.line.content)
      const lineNum = lineInfo.newLineNumber ?? lineInfo.oldLineNumber
      if (lineNum != null) {
        if (startLine == null) startLine = lineNum
        endLine = lineNum
        endSide = lineInfo.line.type === 'del' ? 'LEFT' : 'RIGHT'
      }
    }
  }

  if (lines.length === 0 || endLine == null) return undefined

  return {
    originalCode: lines.join('\n'),
    path: filename,
    line: endLine,
    side: endSide,
    startLine,
  }
}

function extractSingleLineSuggestion(
  effectiveDiffMode: DiffMode,
  diffSelectedLine: number,
  allRows: readonly DiffDisplayRow[],
  sideBySideRows: readonly SideBySideRow[],
  filename: string,
): SuggestionLineContext | undefined {
  const lineInfo = getFocusedLine(effectiveDiffMode, diffSelectedLine, allRows, sideBySideRows)
  if (!lineInfo || lineInfo.line.type === 'header') return undefined

  const side = lineInfo.line.type === 'del' ? ('LEFT' as const) : ('RIGHT' as const)
  const line = side === 'LEFT' ? lineInfo.oldLineNumber : lineInfo.newLineNumber
  if (line == null) return undefined

  return {
    originalCode: lineInfo.line.content,
    path: filename,
    line,
    side,
  }
}

interface UseFilesTabKeyboardOptions {
  readonly isActive: boolean
  readonly focusPanel: FocusPanel
  readonly setFocusPanel: (panel: FocusPanel | ((prev: FocusPanel) => FocusPanel)) => void
  readonly effectiveDiffMode: DiffMode
  readonly setDiffMode: (mode: DiffMode | ((prev: DiffMode) => DiffMode)) => void

  // Filter state
  readonly isFiltering: boolean
  readonly setIsFiltering: (v: boolean) => void
  readonly filterQuery: string
  readonly setFilterQuery: (v: string) => void
  readonly activeFilter: string
  readonly setActiveFilter: (v: string) => void
  readonly setInputActive: (v: boolean) => void

  // Diff search
  readonly search: DiffSearchActions & {
    readonly isDiffSearching: boolean
    readonly diffSearchQuery: string
    readonly activeDiffSearch: string
    readonly diffSearchMatches: readonly number[]
  }

  // Visual select
  readonly visual: VisualSelectState & VisualSelectActions

  // Diff navigation
  readonly diffSelectedLine: number
  readonly setDiffSelectedLine: (index: number) => void
  readonly maxDiffScrollX: number
  readonly setDiffScrollOffsetX: (fn: number | ((prev: number) => number)) => void

  // Row data
  readonly allRows: readonly DiffDisplayRow[]
  readonly sideBySideRows: readonly SideBySideRow[]

  // File tree
  readonly fileOrder: readonly FileChange[]
  readonly treeSelectedIndex: number
  readonly prUrl?: string
  readonly toggleViewed: (prUrl: string, filename: string) => void
  readonly selectedFile: FileChange | null

  // Cross-file search
  readonly crossFileSearch?: CrossFileSearchState & CrossFileSearchActions
  readonly setSelectedFileIndex?: (index: number) => void

  // Tree panel resizing
  readonly treePanelPct?: number
  readonly setTreePanelPct?: (fn: number | ((prev: number) => number)) => void

  // Directory collapse/expand
  readonly displayRows?: readonly DisplayRow[]
  readonly collapsedDirs?: ReadonlySet<string>
  readonly setCollapsedDirs?: (fn: ReadonlySet<string> | ((prev: ReadonlySet<string>) => ReadonlySet<string>)) => void

  // Go-to-line
  readonly isGoToLine?: boolean
  readonly setIsGoToLine?: (v: boolean) => void
  readonly goToLineQuery?: string
  readonly setGoToLineQuery?: (v: string) => void

  // Hunk folding
  readonly foldedHunks?: ReadonlySet<number>
  readonly setFoldedHunks?: (fn: ReadonlySet<number> | ((prev: ReadonlySet<number>) => ReadonlySet<number>)) => void
  readonly foldedRows?: readonly FoldableRow[]

  // File picker
  readonly onOpenFilePicker?: () => void

  // Suggestion
  readonly onSuggest?: (context: SuggestionLineContext) => void

  // AI review
  readonly onAiReview?: (context: AiReviewLineContext) => void

  // File review status
  readonly onApproveFile?: () => void
  readonly onRejectFile?: () => void
  readonly onSkipFile?: () => void
  readonly onNextUnreviewed?: () => void
  readonly onPrevUnreviewed?: () => void

  // Callbacks
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
  readonly onInlineComment?: (context: InlineCommentContext) => void
  readonly onAddReaction?: (context: ReactionContext) => void
  readonly currentUser?: string
}

export function useFilesTabKeyboard(opts: UseFilesTabKeyboardOptions): void {
  const pendingBracketRef = useRef<']' | '[' | null>(null)

  useInput(
    (input, key) => {
      // Two-key sequence: ]f / [f
      if (pendingBracketRef.current !== null) {
        const bracket = pendingBracketRef.current
        pendingBracketRef.current = null
        if (input === 'f' && opts.focusPanel === 'tree') {
          if (bracket === ']' && opts.onNextUnreviewed) {
            opts.onNextUnreviewed()
            return
          }
          if (bracket === '[' && opts.onPrevUnreviewed) {
            opts.onPrevUnreviewed()
            return
          }
        }
        // Not a valid sequence continuation; fall through to normal handling
        // but the bracket key was already consumed, so just return
        return
      }
      // File tree filter input mode
      if (opts.isFiltering) {
        if (key.escape) {
          opts.setIsFiltering(false)
          opts.setFilterQuery('')
          opts.setActiveFilter('')
          opts.setInputActive(false)
        } else if (key.return) {
          opts.setIsFiltering(false)
          opts.setActiveFilter(opts.filterQuery)
          opts.setInputActive(false)
        }
        return
      }

      // Diff search input mode
      if (opts.search.isDiffSearching) {
        if (key.escape) {
          opts.search.cancelSearch()
          opts.setInputActive(false)
        } else if (key.return) {
          opts.search.confirmSearch(
            opts.search.diffSearchQuery,
            opts.effectiveDiffMode,
            opts.sideBySideRows,
            opts.allRows,
            opts.setDiffSelectedLine,
          )
          opts.setInputActive(false)
        }
        return
      }

      // Go-to-line input mode
      if (opts.isGoToLine) {
        if (key.escape) {
          opts.setIsGoToLine?.(false)
          opts.setGoToLineQuery?.('')
          opts.setInputActive(false)
        } else if (key.return) {
          handleGoToLineSubmit(opts)
          opts.setIsGoToLine?.(false)
          opts.setGoToLineQuery?.('')
          opts.setInputActive(false)
        }
        return
      }

      // Cross-file search input mode
      if (opts.crossFileSearch?.isSearching) {
        if (key.escape) {
          opts.crossFileSearch.cancelSearch()
          opts.setInputActive(false)
        } else if (key.return) {
          const firstMatch = opts.crossFileSearch.confirmSearch()
          opts.setInputActive(false)
          if (firstMatch && opts.setSelectedFileIndex) {
            opts.setSelectedFileIndex(firstMatch.fileIndex)
            opts.setFocusPanel('diff')
          }
        }
        return
      }

      // n/N search navigation (single-file search takes priority)
      if (
        input === 'n' &&
        opts.focusPanel === 'diff' &&
        opts.search.activeDiffSearch &&
        opts.search.diffSearchMatches.length > 0
      ) {
        opts.search.navigateNext(opts.setDiffSelectedLine)
        return
      }
      if (
        input === 'N' &&
        opts.focusPanel === 'diff' &&
        opts.search.activeDiffSearch &&
        opts.search.diffSearchMatches.length > 0
      ) {
        opts.search.navigatePrev(opts.setDiffSelectedLine)
        return
      }

      // n/N cross-file search navigation (when no single-file search active)
      if (
        input === 'n' &&
        opts.crossFileSearch?.activeQuery &&
        opts.crossFileSearch.matches.length > 0 &&
        opts.setSelectedFileIndex
      ) {
        const match = opts.crossFileSearch.navigateNext()
        if (match) {
          opts.setSelectedFileIndex(match.fileIndex)
          opts.setFocusPanel('diff')
        }
        return
      }
      if (
        input === 'N' &&
        opts.crossFileSearch?.activeQuery &&
        opts.crossFileSearch.matches.length > 0 &&
        opts.setSelectedFileIndex
      ) {
        const match = opts.crossFileSearch.navigatePrev()
        if (match) {
          opts.setSelectedFileIndex(match.fileIndex)
          opts.setFocusPanel('diff')
        }
        return
      }

      // Escape: clear search, visual, or filter
      if (key.escape && opts.search.activeDiffSearch) {
        opts.search.clearSearch()
        return
      }
      if (key.escape && opts.crossFileSearch?.activeQuery) {
        opts.crossFileSearch.clearSearch()
        return
      }
      if (key.escape && opts.visual.visualStart != null) {
        opts.visual.clearVisual()
        return
      }
      if (key.escape && opts.activeFilter) {
        opts.setActiveFilter('')
        opts.setFilterQuery('')
        return
      }

      // / to start filtering or searching
      if (input === '/' && opts.focusPanel === 'tree') {
        opts.setIsFiltering(true)
        opts.setFilterQuery(opts.activeFilter)
        opts.setInputActive(true)
        return
      }
      if (input === '/' && opts.focusPanel === 'diff') {
        opts.search.startSearch(opts.search.activeDiffSearch)
        opts.setInputActive(true)
        return
      }

      // Ctrl+f: open fuzzy file picker
      if (input === 'f' && key.ctrl && opts.onOpenFilePicker) {
        opts.onOpenFilePicker()
        return
      }

      // S: Suggest change on selected line(s)
      if (
        input === 'S' &&
        opts.focusPanel === 'diff' &&
        opts.onSuggest &&
        opts.selectedFile
      ) {
        handleSuggest(opts)
        return
      }

      // I or Ctrl+a: AI review of selected line(s)
      if (
        ((input === 'I') || (input === 'a' && key.ctrl)) &&
        opts.focusPanel === 'diff' &&
        opts.onAiReview &&
        opts.selectedFile
      ) {
        handleAiReview(opts)
        return
      }

      // Tab: switch panels
      if (key.tab) {
        opts.visual.clearVisual()
        opts.setFocusPanel((prev) => (prev === 'tree' ? 'diff' : 'tree'))
      } else if (opts.focusPanel === 'diff' && (key.leftArrow || key.rightArrow)) {
        // Horizontal scroll in diff
        const step = key.shift ? 16 : 4
        opts.setDiffScrollOffsetX((prev: number) =>
          Math.max(
            0,
            Math.min(
              opts.maxDiffScrollX,
              prev + (key.leftArrow ? -step : step),
            ),
          ),
        )
        return
      }

      // Panel navigation
      if (input === 'h' || key.leftArrow) {
        opts.visual.clearVisual()
        opts.setFocusPanel('tree')
      } else if (input === 'l' || key.rightArrow) {
        opts.setFocusPanel('diff')
      } else if (input === 'd' && opts.focusPanel === 'diff') {
        opts.setDiffMode((prev) =>
          prev === 'unified' ? 'side-by-side' : 'unified',
        )
        opts.visual.clearVisual()
      } else if (input === 'F' && opts.crossFileSearch) {
        opts.crossFileSearch.startSearch()
        opts.setInputActive(true)
      } else if (input === 'v' && opts.focusPanel === 'tree' && opts.prUrl) {
        const file = opts.fileOrder[opts.treeSelectedIndex]
        if (file) {
          opts.toggleViewed(opts.prUrl, file.filename)
        }
      } else if (input === 'v' && opts.focusPanel === 'diff') {
        opts.visual.toggleVisual(opts.diffSelectedLine)
      } else if (input === 'r' && opts.focusPanel === 'diff' && opts.onReply) {
        handleReply(opts)
      } else if (input === 'x' && opts.focusPanel === 'diff' && opts.onToggleResolve) {
        handleToggleResolve(opts)
      } else if (input === 'e' && opts.focusPanel === 'diff' && opts.onEditComment && opts.currentUser) {
        handleEditComment(opts)
      } else if (input === 'c' && opts.focusPanel === 'diff' && opts.onInlineComment && opts.selectedFile) {
        handleInlineComment(opts)
      } else if (input === '+' && opts.focusPanel === 'diff' && opts.onAddReaction) {
        handleAddReaction(opts)
      } else if (input === '}' && opts.focusPanel === 'diff') {
        handleNextHunk(opts)
      } else if (input === '{' && opts.focusPanel === 'diff') {
        handlePrevHunk(opts)
      } else if (input === ':' && opts.focusPanel === 'diff' && opts.setIsGoToLine) {
        opts.setIsGoToLine(true)
        opts.setInputActive(true)
      } else if (input === 'z' && opts.focusPanel === 'diff' && opts.setFoldedHunks && opts.foldedRows) {
        handleToggleHunkFold(opts)
      } else if (input === '<' && opts.setTreePanelPct) {
        opts.setTreePanelPct((prev: number) => Math.max(15, prev - 5))
      } else if (input === '>' && opts.setTreePanelPct) {
        opts.setTreePanelPct((prev: number) => Math.min(50, prev + 5))
      } else if (input === 'a' && opts.focusPanel === 'tree' && opts.onApproveFile) {
        opts.onApproveFile()
      } else if (input === 'x' && opts.focusPanel === 'tree' && opts.onRejectFile) {
        opts.onRejectFile()
      } else if (input === 's' && opts.focusPanel === 'tree' && opts.onSkipFile) {
        opts.onSkipFile()
      } else if ((input === ']' || input === '[') && opts.focusPanel === 'tree') {
        pendingBracketRef.current = input as ']' | '['
      } else if (
        (key.return || input === ' ') &&
        opts.focusPanel === 'tree' &&
        opts.displayRows &&
        opts.setCollapsedDirs
      ) {
        handleToggleDirCollapse(opts)
      }
    },
    { isActive: opts.isActive },
  )
}

function handleReply(opts: UseFilesTabKeyboardOptions): void {
  const thread = getFocusedCommentThread(
    opts.effectiveDiffMode,
    opts.diffSelectedLine,
    opts.allRows,
    opts.sideBySideRows,
  )
  if (thread && opts.onReply) {
    const lastComment = thread.comments[thread.comments.length - 1]
    if (lastComment) {
      opts.onReply({
        commentId: lastComment.id,
        user: lastComment.user.login,
        body: lastComment.body,
      })
    }
  }
}

function handleToggleResolve(opts: UseFilesTabKeyboardOptions): void {
  const thread = getFocusedCommentThread(
    opts.effectiveDiffMode,
    opts.diffSelectedLine,
    opts.allRows,
    opts.sideBySideRows,
  )
  if (thread?.threadId && opts.onToggleResolve) {
    opts.onToggleResolve({
      threadId: thread.threadId,
      isResolved: thread.isResolved ?? false,
    })
  }
}

function handleEditComment(opts: UseFilesTabKeyboardOptions): void {
  const thread = getFocusedCommentThread(
    opts.effectiveDiffMode,
    opts.diffSelectedLine,
    opts.allRows,
    opts.sideBySideRows,
  )
  if (thread && opts.onEditComment && opts.currentUser) {
    const ownComment = thread.comments.find(
      (c) => c.user.login === opts.currentUser,
    )
    if (ownComment) {
      opts.onEditComment({
        commentId: ownComment.id,
        body: ownComment.body,
        isReviewComment: true,
      })
    }
  }
}

function handleInlineComment(opts: UseFilesTabKeyboardOptions): void {
  if (!opts.onInlineComment || !opts.selectedFile) return

  if (opts.visual.visualStart != null) {
    handleVisualInlineComment(opts)
  } else {
    handleSingleLineComment(opts)
  }
}

function handleVisualInlineComment(opts: UseFilesTabKeyboardOptions): void {
  if (opts.visual.visualStart == null || !opts.onInlineComment || !opts.selectedFile) return

  const selMin = Math.min(opts.visual.visualStart, opts.diffSelectedLine)
  const selMax = Math.max(opts.visual.visualStart, opts.diffSelectedLine)
  const startInfo = getFocusedLine(
    opts.effectiveDiffMode,
    selMin,
    opts.allRows,
    opts.sideBySideRows,
  )
  const endInfo = getFocusedLine(
    opts.effectiveDiffMode,
    selMax,
    opts.allRows,
    opts.sideBySideRows,
  )
  if (
    startInfo &&
    endInfo &&
    startInfo.line.type !== 'header' &&
    endInfo.line.type !== 'header'
  ) {
    const endSide =
      endInfo.line.type === 'del' ? ('LEFT' as const) : ('RIGHT' as const)
    const startSide =
      startInfo.line.type === 'del' ? ('LEFT' as const) : ('RIGHT' as const)
    const endLine =
      endSide === 'LEFT' ? endInfo.oldLineNumber : endInfo.newLineNumber
    const startLine =
      startSide === 'LEFT'
        ? startInfo.oldLineNumber
        : startInfo.newLineNumber
    if (endLine != null && startLine != null) {
      opts.onInlineComment({
        path: opts.selectedFile.filename,
        line: endLine,
        side: endSide,
        startLine,
        startSide,
      })
      opts.visual.clearVisual()
    }
  }
}

function handleSingleLineComment(opts: UseFilesTabKeyboardOptions): void {
  if (!opts.onInlineComment || !opts.selectedFile) return

  const lineInfo = getFocusedLine(
    opts.effectiveDiffMode,
    opts.diffSelectedLine,
    opts.allRows,
    opts.sideBySideRows,
  )
  if (lineInfo && lineInfo.line.type !== 'header') {
    const side =
      lineInfo.line.type === 'del' ? ('LEFT' as const) : ('RIGHT' as const)
    const line =
      side === 'LEFT' ? lineInfo.oldLineNumber : lineInfo.newLineNumber
    if (line != null) {
      opts.onInlineComment({
        path: opts.selectedFile.filename,
        line,
        side,
      })
    }
  }
}

function handleAddReaction(opts: UseFilesTabKeyboardOptions): void {
  const thread = getFocusedCommentThread(
    opts.effectiveDiffMode,
    opts.diffSelectedLine,
    opts.allRows,
    opts.sideBySideRows,
  )
  if (thread && opts.onAddReaction) {
    const lastComment = thread.comments[thread.comments.length - 1]
    if (lastComment) {
      opts.onAddReaction({
        commentId: lastComment.id,
        commentType: 'review_comment',
      })
    }
  }
}

function handleNextHunk(opts: UseFilesTabKeyboardOptions): void {
  const target =
    opts.effectiveDiffMode === 'side-by-side'
      ? findNextSbsHunkStart(opts.sideBySideRows, opts.diffSelectedLine)
      : findNextHunkStart(opts.allRows, opts.diffSelectedLine)
  if (target >= 0) {
    opts.setDiffSelectedLine(target)
  }
}

function handlePrevHunk(opts: UseFilesTabKeyboardOptions): void {
  const target =
    opts.effectiveDiffMode === 'side-by-side'
      ? findPrevSbsHunkStart(opts.sideBySideRows, opts.diffSelectedLine)
      : findPrevHunkStart(opts.allRows, opts.diffSelectedLine)
  if (target >= 0) {
    opts.setDiffSelectedLine(target)
  }
}

function handleGoToLineSubmit(opts: UseFilesTabKeyboardOptions): void {
  const lineNum = parseInt(opts.goToLineQuery ?? '', 10)
  if (isNaN(lineNum) || lineNum < 1) return

  const target =
    opts.effectiveDiffMode === 'side-by-side'
      ? findSbsRowByLineNumber(opts.sideBySideRows, lineNum)
      : findRowByLineNumber(opts.allRows, lineNum)

  if (target >= 0) {
    opts.setDiffSelectedLine(target)
  }
}

function handleToggleDirCollapse(opts: UseFilesTabKeyboardOptions): void {
  if (!opts.displayRows || !opts.setCollapsedDirs) return

  // Find the display row corresponding to the current tree selection
  const currentRow = opts.displayRows.find(
    (r) => r.type === 'file' && r.fileIndex === opts.treeSelectedIndex,
  )
  if (!currentRow) return

  // Look for the nearest dir row above the current file
  const currentRowIndex = opts.displayRows.indexOf(currentRow)
  for (let i = currentRowIndex; i >= 0; i--) {
    const row = opts.displayRows[i]
    if (row && row.type === 'dir') {
      const dirPath = row.dirPath
      opts.setCollapsedDirs((prev: ReadonlySet<string>) => {
        const next = new Set(prev)
        if (next.has(dirPath)) {
          next.delete(dirPath)
        } else {
          next.add(dirPath)
        }
        return next
      })
      return
    }
  }
}

function handleToggleHunkFold(opts: UseFilesTabKeyboardOptions): void {
  if (!opts.setFoldedHunks || !opts.foldedRows) return

  const hunkIndex = getHunkIndexForRow(opts.foldedRows, opts.diffSelectedLine)
  if (hunkIndex < 0) return

  opts.setFoldedHunks((prev: ReadonlySet<number>) =>
    toggleHunkFold(prev, hunkIndex),
  )
}

function handleSuggest(opts: UseFilesTabKeyboardOptions): void {
  if (!opts.onSuggest || !opts.selectedFile) return

  const context = extractSuggestionContext(
    opts.effectiveDiffMode,
    opts.diffSelectedLine,
    opts.allRows,
    opts.sideBySideRows,
    opts.selectedFile.filename,
    opts.visual.visualStart,
  )

  if (context) {
    opts.onSuggest(context)
    opts.visual.clearVisual()
  }
}

function handleAiReview(opts: UseFilesTabKeyboardOptions): void {
  if (!opts.onAiReview || !opts.selectedFile) return

  const context = extractAiReviewLines(
    opts.effectiveDiffMode,
    opts.diffSelectedLine,
    opts.allRows,
    opts.sideBySideRows,
    opts.selectedFile.filename,
    opts.visual.visualStart,
  )

  if (context) {
    opts.onAiReview(context)
    opts.visual.clearVisual()
  }
}
