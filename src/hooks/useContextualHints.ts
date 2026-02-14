import type { ScreenContext, HintEntry } from '../components/layout/StatusBar'
import {
  SCREEN_HINT_ENTRIES,
  PANEL_HINT_ENTRIES,
  buildHints,
  getContextHints,
} from '../components/layout/StatusBar'
import type { Panel } from './useActivePanel'
import type { KeybindingOverrides } from '../config/keybindings'

// ---------------------------------------------------------------------------
// Selection context types -- describes what is currently selected in the UI.
// Each variant carries the minimal data needed to filter status bar hints.
// ---------------------------------------------------------------------------

interface PRListItemContext {
  readonly type: 'pr-list-item'
  readonly prState: 'open' | 'closed'
  readonly prMerged: boolean
  readonly prDraft: boolean
}

interface PRDetailContext {
  readonly type: 'pr-detail'
  readonly prState: 'open' | 'closed'
  readonly prMerged: boolean
  readonly prDraft: boolean
}

interface TimelineItemContext {
  readonly type: 'timeline-item'
  readonly itemType: 'review' | 'comment' | 'issue_comment'
  readonly hasThread: boolean
  readonly isResolved: boolean
  readonly isOwnComment: boolean
  readonly hasPath: boolean
}

interface DiffRowContext {
  readonly type: 'diff-row'
  readonly isCommentRow: boolean
  readonly hasThread: boolean
  readonly isOwnComment: boolean
}

export type SelectionContext =
  | PRListItemContext
  | PRDetailContext
  | TimelineItemContext
  | DiffRowContext

// ---------------------------------------------------------------------------
// Actions that depend on PR being open
// ---------------------------------------------------------------------------

const PR_OPEN_ONLY_ACTIONS: ReadonlySet<string> = new Set([
  'mergePR',
  'closePR',
  'submitReview',
  'batchReview',
  'reReview',
  'checkoutBranch',
  'toggleDraft',
])

// ---------------------------------------------------------------------------
// Actions that only apply to certain timeline item types
// ---------------------------------------------------------------------------

const COMMENT_INTERACTIVE_ACTIONS: ReadonlySet<string> = new Set([
  'reply',
  'editComment',
  'resolveThread',
  'goToFile',
  'addReaction',
])

// ---------------------------------------------------------------------------
// Actions that only apply to diff comment rows (not code lines)
// ---------------------------------------------------------------------------

const DIFF_COMMENT_ACTIONS: ReadonlySet<string> = new Set([
  'reply',
  'editComment',
  'resolveThread',
  'addReaction',
])

// ---------------------------------------------------------------------------
// Pure filter functions
// ---------------------------------------------------------------------------

/**
 * Filter hint entries based on PR state (open/closed/merged).
 * Removes actions that are not applicable to the current PR state.
 */
export function filterHintsByPRState(
  entries: readonly HintEntry[],
  pr: {
    readonly state: 'open' | 'closed'
    readonly merged: boolean
    readonly draft: boolean
  },
): readonly HintEntry[] {
  if (pr.state === 'open') {
    return entries
  }
  return entries.filter((entry) => !PR_OPEN_ONLY_ACTIONS.has(entry.action))
}

/**
 * Filter hint entries based on the currently selected timeline item.
 * Shows/hides reply, edit, resolve, goToFile based on item type and ownership.
 */
export function filterHintsByTimelineItem(
  entries: readonly HintEntry[],
  item: {
    readonly type: 'review' | 'comment' | 'issue_comment'
    readonly hasThread: boolean
    readonly isResolved: boolean
    readonly isOwnComment: boolean
    readonly hasPath: boolean
  },
): readonly HintEntry[] {
  return entries.filter((entry) => {
    if (!COMMENT_INTERACTIVE_ACTIONS.has(entry.action)) {
      return true
    }

    if (item.type === 'review') {
      return false
    }

    if (entry.action === 'reply') {
      return item.type === 'comment' || item.type === 'issue_comment'
    }

    if (entry.action === 'editComment') {
      return item.isOwnComment
    }

    if (entry.action === 'resolveThread') {
      return item.type === 'comment' && item.hasThread
    }

    if (entry.action === 'goToFile') {
      return item.type === 'comment' && item.hasPath
    }

    if (entry.action === 'addReaction') {
      return item.type === 'comment' || item.type === 'issue_comment'
    }

    return true
  })
}

/**
 * Filter hint entries based on the currently selected diff row.
 * When on a comment row: show reply/edit/resolve actions.
 * When on a code line: hide them.
 */
export function filterHintsByDiffRow(
  entries: readonly HintEntry[],
  row: {
    readonly isCommentRow: boolean
    readonly hasThread: boolean
    readonly isOwnComment: boolean
  },
): readonly HintEntry[] {
  return entries.filter((entry) => {
    if (!DIFF_COMMENT_ACTIONS.has(entry.action)) {
      return true
    }

    if (!row.isCommentRow) {
      return false
    }

    if (entry.action === 'editComment') {
      return row.isOwnComment
    }

    if (entry.action === 'resolveThread') {
      return row.hasThread
    }

    return true
  })
}

// ---------------------------------------------------------------------------
// Extended hint entries for contexts that need extra actions
// ---------------------------------------------------------------------------

const EXTENDED_ENTRIES: Partial<Record<ScreenContext, readonly HintEntry[]>> = {
  'pr-detail-files-diff': [
    { ctx: 'filesTab', action: 'inlineComment', label: 'comment' },
    { ctx: 'filesTab', action: 'visualSelect', label: 'visual' },
    { ctx: 'filesTab', action: 'toggleSideBySide', label: 'split' },
    { ctx: 'filesTab', action: 'filterFiles', label: 'search' },
    { ctx: 'filesTab', action: 'switchPanel', label: 'tree' },
    { ctx: 'filesTab', action: 'reply', label: 'reply' },
    { ctx: 'filesTab', action: 'editComment', label: 'edit' },
    { ctx: 'filesTab', action: 'resolveThread', label: 'resolve' },
    { ctx: 'filesTab', action: 'addReaction', label: 'react' },
  ],
  'pr-detail-files': [
    { ctx: 'filesTab', action: 'inlineComment', label: 'comment' },
    { ctx: 'filesTab', action: 'visualSelect', label: 'visual' },
    { ctx: 'filesTab', action: 'toggleSideBySide', label: 'split' },
    { ctx: 'filesTab', action: 'filterFiles', label: 'search' },
    { ctx: 'filesTab', action: 'switchPanel', label: 'tree' },
    { ctx: 'filesTab', action: 'reply', label: 'reply' },
    { ctx: 'filesTab', action: 'editComment', label: 'edit' },
    { ctx: 'filesTab', action: 'resolveThread', label: 'resolve' },
    { ctx: 'filesTab', action: 'addReaction', label: 'react' },
  ],
  'pr-detail-conversations': [
    { ctx: 'conversations', action: 'newComment', label: 'comment' },
    { ctx: 'conversations', action: 'reply', label: 'reply' },
    { ctx: 'conversations', action: 'editComment', label: 'edit' },
    { ctx: 'conversations', action: 'resolveThread', label: 'resolve' },
    { ctx: 'conversations', action: 'toggleResolved', label: 'filter' },
    { ctx: 'conversations', action: 'goToFile', label: 'file' },
    { ctx: 'conversations', action: 'addReaction', label: 'react' },
  ],
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Get context-aware hints based on the active panel, screen context, and
 * current selection. When no selection context is provided, falls back to
 * the static hints from StatusBar.
 */
export function getContextualHints(
  activePanel: Panel,
  screenContext?: ScreenContext,
  selectionContext?: SelectionContext,
  overrides?: KeybindingOverrides,
): string {
  if (!selectionContext) {
    return getContextHints(activePanel, screenContext, overrides)
  }

  // For contexts with extended entries (diff, conversations), use those
  if (screenContext && EXTENDED_ENTRIES[screenContext]) {
    const extended = EXTENDED_ENTRIES[screenContext]!
    const filtered = applySelectionFilter(extended, selectionContext)
    return buildHints(filtered, overrides)
  }

  // For other screen contexts, apply PR state filter to the static entries
  if (screenContext && screenContext in SCREEN_HINT_ENTRIES) {
    const entries = SCREEN_HINT_ENTRIES[screenContext]
    const filtered = applySelectionFilter(entries, selectionContext)
    return buildHints(filtered, overrides)
  }

  // Sidebar/panel fallbacks
  if (activePanel === 'sidebar') {
    return buildHints(PANEL_HINT_ENTRIES.sidebar, overrides)
  }
  return buildHints(PANEL_HINT_ENTRIES[activePanel], overrides)
}

/**
 * Apply the appropriate selection filter based on the selection context type.
 */
function applySelectionFilter(
  entries: readonly HintEntry[],
  selectionContext: SelectionContext,
): readonly HintEntry[] {
  switch (selectionContext.type) {
    case 'timeline-item':
      return filterHintsByTimelineItem(entries, {
        type: selectionContext.itemType,
        hasThread: selectionContext.hasThread,
        isResolved: selectionContext.isResolved,
        isOwnComment: selectionContext.isOwnComment,
        hasPath: selectionContext.hasPath,
      })

    case 'diff-row':
      return filterHintsByDiffRow(entries, {
        isCommentRow: selectionContext.isCommentRow,
        hasThread: selectionContext.hasThread,
        isOwnComment: selectionContext.isOwnComment,
      })

    case 'pr-list-item':
    case 'pr-detail':
      return filterHintsByPRState(entries, {
        state: selectionContext.prState,
        merged: selectionContext.prMerged,
        draft: selectionContext.prDraft,
      })

    default:
      return entries
  }
}
