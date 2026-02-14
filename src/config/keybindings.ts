import { z } from 'zod'

/**
 * All bindable actions in LazyReview.
 * Each action maps to a specific behavior in the TUI.
 */
export type Action =
  | 'moveUp'
  | 'moveDown'
  | 'select'
  | 'back'
  | 'quit'
  | 'toggleSidebar'
  | 'toggleHelp'
  | 'refresh'
  | 'filterPRs'
  | 'sortPRs'
  | 'nextPage'
  | 'prevPage'
  | 'openInBrowser'
  | 'copyUrl'
  | 'toggleUnread'
  | 'toggleState'
  | 'submitReview'
  | 'batchReview'
  | 'reReview'
  | 'mergePR'
  | 'closePR'
  | 'checkoutBranch'
  | 'nextPR'
  | 'prevPR'
  | 'newComment'
  | 'reply'
  | 'editComment'
  | 'editDescription'
  | 'resolveThread'
  | 'toggleResolved'
  | 'goToFile'
  | 'focusTree'
  | 'focusDiff'
  | 'switchPanel'
  | 'filterFiles'
  | 'toggleSideBySide'
  | 'visualSelect'
  | 'inlineComment'
  | 'copyCommitSha'
  | 'submit'
  | 'newLine'
  | 'indent'
  | 'editTitle'
  | 'toggleDraft'
  | 'labels'
  | 'assignees'
  | 'createPR'
  | 'botSummary'
  | 'addReaction'
  | 'jumpToUnread'
  | 'toggleCompactList'
  | 'togglePreview'
  | 'shrinkTreePanel'
  | 'growTreePanel'
  | 'toggleDirCollapse'
  | 'nextHunk'
  | 'prevHunk'
  | 'goToLine'
  | 'toggleHunkFold'
  | 'fuzzyFilePicker'
  | 'commandPalette'
  | 'insertTemplate'
  | 'aiReview'
  | 'approveFile'
  | 'rejectFile'
  | 'skipFile'
  | 'nextUnreviewed'
  | 'prevUnreviewed'
  | 'aiSummary'
  | 'aiRegenerate'
  | 'suggest'
  | 'recordMacro'
  | 'replayMacro'

/**
 * Keybinding context names. Each context groups related actions
 * that are active in a specific part of the UI.
 */
export type KeybindingContext =
  | 'global'
  | 'prList'
  | 'prDetail'
  | 'conversations'
  | 'filesTab'
  | 'checksTab'
  | 'commitsTab'
  | 'timelineTab'
  | 'input'

/**
 * Zod schema for user-provided keybinding overrides.
 * The structure is Record<context, Record<action, key | key[]>>
 */
export const KeybindingOverrideSchema = z.record(
  z.string(),
  z.record(z.string(), z.union([z.string(), z.array(z.string())])),
)

export type KeybindingOverrides = z.infer<typeof KeybindingOverrideSchema>

/**
 * Represents Ink's Key object shape for matching.
 */
export interface InkKey {
  readonly upArrow: boolean
  readonly downArrow: boolean
  readonly leftArrow: boolean
  readonly rightArrow: boolean
  readonly return: boolean
  readonly escape: boolean
  readonly ctrl: boolean
  readonly shift: boolean
  readonly tab: boolean
  readonly backspace: boolean
  readonly delete: boolean
  readonly meta: boolean
}

/**
 * Default keybindings organized by context.
 * These match the currently hardcoded values throughout the codebase.
 */
export const DEFAULT_KEYBINDINGS: Readonly<
  Record<string, Readonly<Record<string, string | readonly string[]>>>
> = {
  global: {
    moveDown: ['j', 'down'],
    moveUp: ['k', 'up'],
    select: 'return',
    back: ['q', 'escape'],
    quit: 'ctrl+c',
    toggleSidebar: 'ctrl+b',
    toggleHelp: '?',
    refresh: 'R',
    commandPalette: 'ctrl+p',
    recordMacro: 'q',
    replayMacro: '@',
  },
  prList: {
    filterPRs: '/',
    sortPRs: 's',
    nextPage: 'n',
    prevPage: 'p',
    openInBrowser: 'o',
    copyUrl: 'y',
    toggleUnread: 'u',
    toggleState: 't',
    createPR: 'N',
    jumpToUnread: 'U',
    toggleCompactList: 'ctrl+l',
    togglePreview: 'P',
  },
  prDetail: {
    submitReview: 'R',
    batchReview: 'S',
    reReview: 'E',
    mergePR: 'm',
    closePR: 'X',
    checkoutBranch: 'G',
    nextPR: ']',
    prevPR: '[',
    openInBrowser: 'o',
    copyUrl: 'y',
    editTitle: 'T',
    toggleDraft: 'W',
    labels: 'L',
    assignees: 'A',
    botSummary: 'B',
    aiSummary: 'ctrl+a',
    aiRegenerate: 'ctrl+r',
  },
  conversations: {
    newComment: 'c',
    reply: 'r',
    editComment: 'e',
    editDescription: 'D',
    resolveThread: 'x',
    toggleResolved: 'f',
    goToFile: 'g',
    addReaction: '+',
  },
  filesTab: {
    focusTree: 'h',
    focusDiff: 'l',
    switchPanel: 'tab',
    filterFiles: '/',
    toggleSideBySide: 'd',
    visualSelect: 'v',
    inlineComment: 'c',
    reply: 'r',
    editComment: 'e',
    resolveThread: 'x',
    addReaction: '+',
    shrinkTreePanel: '<',
    growTreePanel: '>',
    toggleDirCollapse: ['return', ' '],
    nextHunk: '}',
    prevHunk: '{',
    goToLine: ':',
    toggleHunkFold: 'z',
    fuzzyFilePicker: 'ctrl+f',
    aiReview: ['I', 'ctrl+a'],
    suggest: 'S',
    approveFile: 'a',
    rejectFile: 'x',
    skipFile: 's',
    nextUnreviewed: ']f',
    prevUnreviewed: '[f',
  },
  checksTab: {
    openInBrowser: 'o',
    copyUrl: 'y',
  },
  commitsTab: {
    select: 'return',
    copyCommitSha: 'y',
    back: ['q', 'escape'],
  },
  timelineTab: {
    openInBrowser: 'o',
    copyUrl: 'y',
  },
  input: {
    submit: 'ctrl+s',
    newLine: 'return',
    indent: 'tab',
    back: 'escape',
    insertTemplate: 'ctrl+t',
  },
} as const

/**
 * Merge default keybindings with user overrides for a specific context.
 * User overrides take precedence over defaults.
 */
export function mergeKeybindings(
  context: string,
  overrides?: KeybindingOverrides,
): Readonly<Record<string, string | readonly string[]>> {
  const defaults = DEFAULT_KEYBINDINGS[context] ?? {}
  const contextOverrides = overrides?.[context] ?? {}
  return { ...defaults, ...contextOverrides }
}

/**
 * Parse a binding string into its components.
 * Supports formats like: 'j', 'ctrl+b', 'shift+r', 'return', 'escape',
 * 'up', 'down', 'left', 'right', 'tab', 'backspace', 'delete'
 */
export function parseBinding(binding: string): {
  readonly ctrl: boolean
  readonly shift: boolean
  readonly meta: boolean
  readonly key: string
} {
  const parts = binding.toLowerCase().split('+')
  const ctrl = parts.includes('ctrl')
  const shift = parts.includes('shift')
  const meta = parts.includes('meta')
  const key = parts.filter((p) => p !== 'ctrl' && p !== 'shift' && p !== 'meta').join('+') || ''
  return { ctrl, shift, meta, key }
}

/**
 * Special key names that map to Ink's Key object properties.
 */
const SPECIAL_KEYS: Readonly<Record<string, keyof InkKey>> = {
  up: 'upArrow',
  down: 'downArrow',
  left: 'leftArrow',
  right: 'rightArrow',
  return: 'return',
  enter: 'return',
  escape: 'escape',
  esc: 'escape',
  tab: 'tab',
  backspace: 'backspace',
  delete: 'delete',
}

/**
 * Check if a specific input+key combination matches a binding string.
 *
 * @param input - The character input from Ink's useInput
 * @param key - The Key object from Ink's useInput
 * @param binding - The binding string (e.g. 'j', 'ctrl+b', 'return')
 * @returns true if the input matches the binding
 */
export function matchesKey(
  input: string,
  key: Readonly<InkKey>,
  binding: string,
): boolean {
  const parsed = parseBinding(binding)

  // Check modifier keys
  if (parsed.ctrl !== key.ctrl) return false
  if (parsed.meta !== key.meta) return false

  // For shift, we only check the key flag when explicitly in the binding
  // Single uppercase chars (like 'R') use shift implicitly
  if (parsed.shift && !key.shift) return false

  // Check if it's a special key
  const specialKeyProp = SPECIAL_KEYS[parsed.key]
  if (specialKeyProp) {
    return key[specialKeyProp] === true
  }

  // For regular character keys, compare the input
  // Handle case sensitivity: 'R' should match shift+r or just 'R'
  if (parsed.key.length === 1) {
    return input === parsed.key || input === parsed.key.toUpperCase()
  }

  return input === parsed.key
}

/**
 * Check if an input matches any of the bindings for a given action.
 *
 * @param input - The character input from Ink's useInput
 * @param key - The Key object from Ink's useInput
 * @param action - The action name to check
 * @param bindings - The merged keybindings for the current context
 * @returns true if the input matches the action's binding(s)
 */
export function matchesAction(
  input: string,
  key: Readonly<InkKey>,
  action: string,
  bindings: Readonly<Record<string, string | readonly string[]>>,
): boolean {
  const bound = bindings[action]
  if (!bound) return false
  const keys = Array.isArray(bound) ? bound : [bound]
  return keys.some((k) => matchesKey(input, key, k))
}

/**
 * Format a binding string for display in the help modal.
 * Converts internal format to human-readable format.
 *
 * @param binding - The binding string (e.g. 'ctrl+b', 'return')
 * @returns Human-readable display string (e.g. 'Ctrl+B', 'Enter')
 */
export function formatBinding(binding: string): string {
  const DISPLAY_NAMES: Readonly<Record<string, string>> = {
    return: 'Enter',
    enter: 'Enter',
    escape: 'Esc',
    esc: 'Esc',
    tab: 'Tab',
    up: '\u2191',
    down: '\u2193',
    left: '\u2190',
    right: '\u2192',
    backspace: 'Backspace',
    delete: 'Delete',
    ctrl: 'Ctrl',
    shift: 'Shift',
    meta: 'Meta',
  }

  return binding
    .split('+')
    .map((part) => {
      const lower = part.toLowerCase()
      if (DISPLAY_NAMES[lower]) return DISPLAY_NAMES[lower]
      // Capitalize single letters
      if (part.length === 1) return part
      return part
    })
    .join('+')
}

/**
 * Format all bindings for an action into a display string.
 *
 * @param actionBindings - The binding(s) for an action (string or string[])
 * @returns Human-readable display string (e.g. 'j / \u2193')
 */
export function formatActionBindings(
  actionBindings: string | readonly string[],
): string {
  const bindings = Array.isArray(actionBindings)
    ? actionBindings
    : [actionBindings]
  return bindings.map(formatBinding).join(' / ')
}

/**
 * Get all actions and their display bindings for a context.
 * Useful for rendering the help modal with actual keybindings.
 */
export function getContextBindingsForDisplay(
  context: string,
  overrides?: KeybindingOverrides,
): ReadonlyArray<{ readonly action: string; readonly display: string }> {
  const bindings = mergeKeybindings(context, overrides)
  return Object.entries(bindings).map(([action, binding]) => ({
    action,
    display: formatActionBindings(binding),
  }))
}
