/**
 * Builds the list of available actions for the command palette
 * based on the current screen context.
 */

import { mergeKeybindings, formatActionBindings } from '../config/keybindings'
import type { KeybindingOverrides } from '../config/keybindings'
import type { ScreenContext } from '../components/layout/StatusBar'

export interface CommandPaletteAction {
  /** The action identifier (e.g. 'filterPRs') */
  readonly action: string
  /** Human-readable description (e.g. 'Filter PRs') */
  readonly description: string
  /** Display string for the keybinding (e.g. '/' or 'Ctrl+B') */
  readonly keyDisplay: string
  /** Which context this action belongs to (e.g. 'Global', 'PR List') */
  readonly contextLabel: string
}

/**
 * Actions that should be excluded from the command palette because they
 * are navigation primitives or input-specific actions that don't make
 * sense as "commands".
 */
const EXCLUDED_ACTIONS: ReadonlySet<string> = new Set([
  'moveUp',
  'moveDown',
  'select',
  'back',
  'quit',
  'submit',
  'newLine',
  'indent',
  'toggleDirCollapse',
  'commandPalette',
])

/**
 * Description labels for each action, used in the command palette.
 */
const ACTION_DESCRIPTIONS: Readonly<Record<string, string>> = {
  // Global
  toggleSidebar: 'Toggle sidebar',
  toggleHelp: 'Show keyboard shortcuts',
  refresh: 'Refresh data',
  // PR List
  filterPRs: 'Filter PRs',
  sortPRs: 'Sort PRs',
  nextPage: 'Next page',
  prevPage: 'Previous page',
  openInBrowser: 'Open in browser',
  copyUrl: 'Copy URL to clipboard',
  toggleUnread: 'Toggle unread only',
  toggleState: 'Toggle state (Open/Closed/All)',
  createPR: 'Create new PR',
  jumpToUnread: 'Jump to next unread',
  toggleCompactList: 'Toggle compact list mode',
  togglePreview: 'Toggle PR preview panel',
  // PR Detail
  submitReview: 'Submit review',
  batchReview: 'Start batch review',
  reReview: 'Request re-review',
  mergePR: 'Merge pull request',
  closePR: 'Close or reopen PR',
  checkoutBranch: 'Checkout PR branch locally',
  nextPR: 'Next PR in list',
  prevPR: 'Previous PR in list',
  editTitle: 'Edit PR title',
  toggleDraft: 'Toggle draft / ready for review',
  labels: 'Manage labels',
  assignees: 'Manage assignees',
  botSummary: 'Show bot summary',
  // Conversations
  newComment: 'New comment',
  reply: 'Reply to comment',
  editComment: 'Edit own comment',
  editDescription: 'Edit PR description',
  resolveThread: 'Resolve / unresolve thread',
  toggleResolved: 'Toggle resolved comments',
  goToFile: 'Go to file in diff',
  addReaction: 'Add reaction',
  // Files Tab
  focusTree: 'Focus file tree panel',
  focusDiff: 'Focus diff panel',
  switchPanel: 'Switch tree / diff panel',
  filterFiles: 'Search in diff',
  toggleSideBySide: 'Toggle side-by-side diff',
  visualSelect: 'Visual line select',
  inlineComment: 'Add inline comment',
  shrinkTreePanel: 'Shrink tree panel',
  growTreePanel: 'Grow tree panel',
  nextHunk: 'Next diff hunk',
  prevHunk: 'Previous diff hunk',
  goToLine: 'Go to line number',
  toggleHunkFold: 'Toggle hunk fold/unfold',
  // Commits Tab
  copyCommitSha: 'Copy commit SHA',
  // Checks Tab (openInBrowser + copyUrl handled above)
}

/**
 * Mapping from ScreenContext to the keybinding contexts that are active.
 * Global context is always included.
 */
const SCREEN_TO_CONTEXTS: Readonly<
  Record<ScreenContext, readonly { readonly context: string; readonly label: string }[]>
> = {
  'pr-list': [
    { context: 'prList', label: 'PR List' },
  ],
  'pr-detail-description': [
    { context: 'prDetail', label: 'PR Detail' },
  ],
  'pr-detail-conversations': [
    { context: 'prDetail', label: 'PR Detail' },
    { context: 'conversations', label: 'Conversations' },
  ],
  'pr-detail-files': [
    { context: 'prDetail', label: 'PR Detail' },
    { context: 'filesTab', label: 'Files' },
  ],
  'pr-detail-files-tree': [
    { context: 'prDetail', label: 'PR Detail' },
    { context: 'filesTab', label: 'Files' },
  ],
  'pr-detail-files-diff': [
    { context: 'prDetail', label: 'PR Detail' },
    { context: 'filesTab', label: 'Files' },
  ],
  'pr-detail-commits': [
    { context: 'prDetail', label: 'PR Detail' },
    { context: 'commitsTab', label: 'Commits' },
  ],
  'pr-detail-checks': [
    { context: 'prDetail', label: 'PR Detail' },
    { context: 'checksTab', label: 'Checks' },
  ],
  'settings': [],
  'browse-picker': [],
  'browse-list': [
    { context: 'prList', label: 'PR List' },
  ],
}

/**
 * Build the flat list of available command palette actions
 * for the given screen context.
 *
 * @param screenContext - The current screen context
 * @param overrides - Optional keybinding overrides from user config
 * @returns Sorted list of actions with descriptions and keybinding displays
 */
export function buildCommandPaletteActions(
  screenContext: ScreenContext,
  overrides?: KeybindingOverrides,
): readonly CommandPaletteAction[] {
  const seen = new Set<string>()
  const actions: CommandPaletteAction[] = []

  // Always include global actions
  const globalBindings = mergeKeybindings('global', overrides)
  for (const [action, binding] of Object.entries(globalBindings)) {
    if (EXCLUDED_ACTIONS.has(action)) continue
    if (seen.has(action)) continue
    seen.add(action)

    const description = ACTION_DESCRIPTIONS[action] ?? action
    actions.push({
      action,
      description,
      keyDisplay: formatActionBindings(binding),
      contextLabel: 'Global',
    })
  }

  // Add context-specific actions
  const contextDefs = SCREEN_TO_CONTEXTS[screenContext] ?? []
  for (const { context, label } of contextDefs) {
    const bindings = mergeKeybindings(context, overrides)
    for (const [action, binding] of Object.entries(bindings)) {
      if (EXCLUDED_ACTIONS.has(action)) continue
      if (seen.has(action)) continue
      seen.add(action)

      const description = ACTION_DESCRIPTIONS[action] ?? action
      actions.push({
        action,
        description,
        keyDisplay: formatActionBindings(binding),
        contextLabel: label,
      })
    }
  }

  return actions
}
