/**
 * Context-sensitive quick actions for the `.` key popup.
 * Returns a set of 5-8 relevant actions based on the current
 * screen, item type, and item state.
 */

import { formatActionBindings } from '../config/keybindings'

/**
 * The screen where the quick-actions popup is triggered.
 */
export type QuickActionScreen = 'pr-list' | 'pr-detail' | 'files-tab'

/**
 * The type of item currently focused.
 */
export type QuickActionItemType = 'pull-request' | 'file' | 'comment'

/**
 * The state of the focused item (relevant for PRs).
 */
export type QuickActionItemState = 'open' | 'closed' | 'merged' | 'draft'

/**
 * Full context passed to getQuickActions to determine which actions to show.
 */
export interface QuickActionContext {
  readonly screen: QuickActionScreen
  readonly itemType: QuickActionItemType
  readonly itemState: QuickActionItemState
}

/**
 * A single action displayed in the quick-actions popup.
 */
export interface QuickAction {
  /** Human-readable label displayed in the popup */
  readonly label: string
  /** The keybinding hint shown on the right side (dimmed) */
  readonly keybinding: string
  /** The action identifier matching the keybindings system */
  readonly action: string
}

/**
 * Helper to create a QuickAction from an action name, label, and raw binding.
 */
function makeAction(
  action: string,
  label: string,
  binding: string | readonly string[],
): QuickAction {
  return {
    action,
    label,
    keybinding: formatActionBindings(binding),
  }
}

/**
 * Actions available on the PR list screen.
 */
function getPRListActions(_context: QuickActionContext): readonly QuickAction[] {
  return [
    makeAction('openInBrowser', 'Open in browser', 'o'),
    makeAction('copyUrl', 'Copy URL', 'y'),
    makeAction('filterPRs', 'Filter PRs', '/'),
    makeAction('sortPRs', 'Sort PRs', 's'),
    makeAction('toggleState', 'Toggle state', 't'),
    makeAction('toggleUnread', 'Toggle unread', 'u'),
    makeAction('refresh', 'Refresh', 'R'),
  ]
}

/**
 * Actions available on the PR detail screen.
 * Varies based on whether the PR is open, closed, merged, or draft.
 */
function getPRDetailActions(context: QuickActionContext): readonly QuickAction[] {
  const { itemState } = context
  const actions: QuickAction[] = []

  // Always available regardless of state
  actions.push(makeAction('openInBrowser', 'Open in browser', 'o'))
  actions.push(makeAction('copyUrl', 'Copy URL', 'y'))

  // Only for open (non-draft) PRs
  if (itemState === 'open') {
    actions.push(makeAction('submitReview', 'Submit review', 'R'))
    actions.push(makeAction('mergePR', 'Merge PR', 'm'))
    actions.push(makeAction('editTitle', 'Edit title', 'T'))
    actions.push(makeAction('checkoutBranch', 'Checkout branch', 'G'))
    actions.push(makeAction('closePR', 'Close PR', 'X'))
    actions.push(makeAction('labels', 'Manage labels', 'L'))
  }

  // Draft PRs get a "mark ready" action instead of merge/review
  if (itemState === 'draft') {
    actions.push(makeAction('toggleDraft', 'Mark ready for review', 'W'))
    actions.push(makeAction('editTitle', 'Edit title', 'T'))
    actions.push(makeAction('checkoutBranch', 'Checkout branch', 'G'))
    actions.push(makeAction('labels', 'Manage labels', 'L'))
    actions.push(makeAction('closePR', 'Close PR', 'X'))
  }

  // Closed PRs: limited actions
  if (itemState === 'closed') {
    actions.push(makeAction('closePR', 'Reopen PR', 'X'))
    actions.push(makeAction('checkoutBranch', 'Checkout branch', 'G'))
    actions.push(makeAction('labels', 'Manage labels', 'L'))
  }

  // Merged PRs: read-only + navigation actions
  if (itemState === 'merged') {
    actions.push(makeAction('checkoutBranch', 'Checkout branch', 'G'))
    actions.push(makeAction('nextPR', 'Next PR', ']'))
    actions.push(makeAction('prevPR', 'Previous PR', '['))
  }

  // Trim to max 8
  return actions.slice(0, 8)
}

/**
 * Actions available on the files tab.
 */
function getFilesTabActions(_context: QuickActionContext): readonly QuickAction[] {
  return [
    makeAction('inlineComment', 'Add inline comment', 'c'),
    makeAction('toggleSideBySide', 'Toggle side-by-side', 'd'),
    makeAction('filterFiles', 'Search in diff', '/'),
    makeAction('fuzzyFilePicker', 'Go to file', 'ctrl+f'),
    makeAction('visualSelect', 'Visual select', 'v'),
    makeAction('nextHunk', 'Next hunk', '}'),
    makeAction('prevHunk', 'Previous hunk', '{'),
    makeAction('toggleHunkFold', 'Toggle hunk fold', 'z'),
  ]
}

/**
 * Returns a list of 5-8 context-sensitive quick actions based on the
 * current screen, focused item type, and item state.
 *
 * This is a pure function with no side effects.
 *
 * @param context - The current UI context
 * @returns An array of QuickAction objects
 */
export function getQuickActions(context: QuickActionContext): readonly QuickAction[] {
  switch (context.screen) {
    case 'pr-list':
      return getPRListActions(context)
    case 'pr-detail':
      return getPRDetailActions(context)
    case 'files-tab':
      return getFilesTabActions(context)
    default:
      return getPRListActions(context)
  }
}
