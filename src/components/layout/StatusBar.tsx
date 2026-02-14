import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import { useStatusMessage } from '../../hooks/useStatusMessage'
import type { StatusMessageType } from '../../hooks/useStatusMessage'
import { useLastUpdated } from '../../hooks/useLastUpdated'
import { useRateLimit } from '../../hooks/useRateLimit'
import { useKeybindings } from '../../hooks/useKeybindings'
import { mergeKeybindings, formatActionBindings } from '../../config/keybindings'
import type { KeybindingOverrides } from '../../config/keybindings'
import type { Panel } from '../../hooks/useActivePanel'

export type ScreenContext =
  | 'pr-list'
  | 'pr-detail-description'
  | 'pr-detail-files'
  | 'pr-detail-files-tree'
  | 'pr-detail-files-diff'
  | 'pr-detail-conversations'
  | 'pr-detail-commits'
  | 'pr-detail-checks'
  | 'settings'
  | 'browse-picker'
  | 'browse-list'

// ---------------------------------------------------------------------------
// Each hint entry maps a keybinding action to a display label.
// The `ctx` field selects which keybinding context to look up the key from.
// Entries with a fixed `key` bypass the keybinding system (e.g. "1-5:tabs").
// ---------------------------------------------------------------------------

interface HintEntry {
  readonly ctx: string
  readonly action: string
  readonly label: string
  readonly key?: string // override — use this literal key instead of looking up
}

const PANEL_HINT_ENTRIES: Readonly<Record<Panel, readonly HintEntry[]>> = {
  sidebar: [
    { ctx: 'global', action: 'moveDown', label: 'nav', key: 'j/k' },
    { ctx: 'global', action: 'select', label: 'select' },
    { ctx: 'filesTab', action: 'switchPanel', label: 'list' },
    { ctx: 'global', action: 'toggleSidebar', label: 'sidebar' },
    { ctx: 'global', action: 'toggleHelp', label: 'help' },
    { ctx: 'global', action: 'back', label: 'quit', key: 'q' },
  ],
  list: [
    { ctx: 'global', action: 'moveDown', label: 'nav', key: 'j/k' },
    { ctx: 'global', action: 'select', label: 'detail' },
    { ctx: 'prList', action: 'filterPRs', label: 'filter' },
    { ctx: 'prList', action: 'sortPRs', label: 'sort' },
    { ctx: 'prList', action: 'openInBrowser', label: 'open' },
    { ctx: 'global', action: 'refresh', label: 'refresh' },
    { ctx: 'global', action: 'back', label: 'back', key: 'q' },
  ],
  detail: [
    { ctx: 'global', action: 'moveDown', label: 'scroll', key: 'j/k' },
    { ctx: 'filesTab', action: 'switchPanel', label: 'tabs' },
    { ctx: 'global', action: 'back', label: 'list', key: 'Esc' },
    { ctx: 'global', action: 'toggleHelp', label: 'help' },
    { ctx: 'global', action: 'refresh', label: 'refresh' },
  ],
}

const SCREEN_HINT_ENTRIES: Readonly<Record<ScreenContext, readonly HintEntry[]>> = {
  'pr-list': [
    { ctx: 'prList', action: 'filterPRs', label: 'filter' },
    { ctx: 'prList', action: 'sortPRs', label: 'sort' },
    { ctx: 'prList', action: 'toggleState', label: 'state' },
    { ctx: 'prList', action: 'toggleUnread', label: 'unread' },
    { ctx: 'prList', action: 'openInBrowser', label: 'browser' },
    { ctx: 'prList', action: 'copyUrl', label: 'copy-url' },
    { ctx: 'prList', action: 'nextPage', label: 'page', key: 'n/p' },
    { ctx: 'global', action: 'refresh', label: 'refresh' },
  ],
  'pr-detail-description': [
    { ctx: 'global', action: 'select', label: 'tabs', key: '1-5' },
    { ctx: 'prDetail', action: 'submitReview', label: 'review' },
    { ctx: 'prDetail', action: 'mergePR', label: 'merge' },
    { ctx: 'prDetail', action: 'openInBrowser', label: 'open' },
    { ctx: 'global', action: 'toggleHelp', label: 'help' },
  ],
  'pr-detail-files': [
    { ctx: 'filesTab', action: 'inlineComment', label: 'comment' },
    { ctx: 'filesTab', action: 'visualSelect', label: 'visual' },
    { ctx: 'filesTab', action: 'toggleSideBySide', label: 'split' },
    { ctx: 'filesTab', action: 'filterFiles', label: 'search' },
    { ctx: 'filesTab', action: 'switchPanel', label: 'tree' },
  ],
  'pr-detail-files-tree': [
    { ctx: 'global', action: 'select', label: 'view' },
    { ctx: 'filesTab', action: 'filterFiles', label: 'filter' },
    { ctx: 'filesTab', action: 'visualSelect', label: 'viewed' },
    { ctx: 'filesTab', action: 'switchPanel', label: 'diff' },
  ],
  'pr-detail-files-diff': [
    { ctx: 'filesTab', action: 'inlineComment', label: 'comment' },
    { ctx: 'filesTab', action: 'visualSelect', label: 'visual' },
    { ctx: 'filesTab', action: 'toggleSideBySide', label: 'split' },
    { ctx: 'filesTab', action: 'filterFiles', label: 'search' },
    { ctx: 'filesTab', action: 'switchPanel', label: 'tree' },
  ],
  'pr-detail-conversations': [
    { ctx: 'conversations', action: 'newComment', label: 'comment' },
    { ctx: 'conversations', action: 'reply', label: 'reply' },
    { ctx: 'conversations', action: 'editComment', label: 'edit' },
    { ctx: 'conversations', action: 'resolveThread', label: 'resolve' },
    { ctx: 'conversations', action: 'toggleResolved', label: 'filter' },
  ],
  'pr-detail-commits': [
    { ctx: 'global', action: 'moveDown', label: 'nav', key: 'j/k' },
    { ctx: 'commitsTab', action: 'copyCommitSha', label: 'copy-sha' },
    { ctx: 'prDetail', action: 'submitReview', label: 'review' },
    { ctx: 'prDetail', action: 'mergePR', label: 'merge' },
    { ctx: 'prDetail', action: 'nextPR', label: 'pr', key: '[/]' },
  ],
  'pr-detail-checks': [
    { ctx: 'global', action: 'moveDown', label: 'nav', key: 'j/k' },
    { ctx: 'checksTab', action: 'openInBrowser', label: 'open' },
    { ctx: 'checksTab', action: 'copyUrl', label: 'copy' },
    { ctx: 'prDetail', action: 'nextPR', label: 'pr', key: '[/]' },
  ],
  'settings': [
    { ctx: 'global', action: 'moveDown', label: 'nav', key: 'j/k' },
    { ctx: 'global', action: 'select', label: 'edit/toggle' },
    { ctx: 'global', action: 'back', label: 'cancel', key: 'Esc' },
  ],
  'browse-picker': [
    { ctx: 'global', action: 'select', label: 'search' },
    { ctx: 'global', action: 'moveDown', label: 'recent', key: 'j/k' },
    { ctx: 'global', action: 'back', label: 'remove', key: 'x' },
    { ctx: 'global', action: 'back', label: 'back', key: 'Esc' },
  ],
  'browse-list': [
    { ctx: 'global', action: 'moveDown', label: 'nav', key: 'j/k' },
    { ctx: 'global', action: 'select', label: 'open' },
    { ctx: 'global', action: 'back', label: 'picker', key: 'Esc' },
    { ctx: 'prList', action: 'filterPRs', label: 'filter' },
    { ctx: 'prList', action: 'sortPRs', label: 'sort' },
    { ctx: 'global', action: 'refresh', label: 'refresh' },
  ],
}

/**
 * Format a single key binding for the compact status bar display.
 * Uses the first binding only (e.g. 'j' instead of 'j / Down Arrow').
 */
function formatCompactKey(binding: string | readonly string[]): string {
  const first = Array.isArray(binding) ? binding[0] : binding
  if (!first) return ''
  // Short display: ctrl+b -> ^b, return -> Enter, tab -> Tab
  if (first.startsWith('ctrl+')) return `^${first.slice(5)}`
  if (first === 'return') return 'Enter'
  if (first === 'escape') return 'Esc'
  if (first === 'tab') return 'Tab'
  return first
}

/**
 * Build a hint string from hint entries using actual keybindings.
 */
export function buildHints(
  entries: readonly HintEntry[],
  overrides?: KeybindingOverrides,
): string {
  return entries
    .map((entry) => {
      if (entry.key) {
        return `${entry.key}:${entry.label}`
      }
      const bindings = mergeKeybindings(entry.ctx, overrides)
      const bound = bindings[entry.action]
      if (!bound) return `?:${entry.label}`
      return `${formatCompactKey(bound)}:${entry.label}`
    })
    .join('  ')
}

export function getContextHints(
  activePanel: Panel,
  screenContext?: ScreenContext,
  overrides?: KeybindingOverrides,
): string {
  if (activePanel === 'sidebar') {
    return buildHints(PANEL_HINT_ENTRIES.sidebar, overrides)
  }
  if (screenContext && screenContext in SCREEN_HINT_ENTRIES) {
    return buildHints(SCREEN_HINT_ENTRIES[screenContext], overrides)
  }
  return buildHints(PANEL_HINT_ENTRIES[activePanel], overrides)
}

const RATE_LIMIT_WARNING_THRESHOLD = 100

interface StatusBarProps {
  readonly activePanel?: Panel
  readonly screenContext?: ScreenContext
}

export function StatusBar({
  activePanel = 'sidebar',
  screenContext,
}: StatusBarProps): React.ReactElement {
  const theme = useTheme()
  const { message: statusMessage, messageType } = useStatusMessage()
  const { label: lastUpdatedLabel } = useLastUpdated()
  const rateLimit = useRateLimit()
  const { overrides } = useKeybindings('global')

  const hints = useMemo(
    () => getContextHints(activePanel, screenContext, overrides),
    [activePanel, screenContext, overrides],
  )

  const showRateLimitWarning = rateLimit.remaining < RATE_LIMIT_WARNING_THRESHOLD

  const statusColor = (type: StatusMessageType): string => {
    switch (type) {
      case 'success':
        return theme.colors.success
      case 'error':
        return theme.colors.error
      case 'info':
        return theme.colors.info
    }
  }

  const renderStatus = (): React.ReactElement => {
    if (statusMessage) {
      return <Text color={statusColor(messageType)}>{statusMessage}</Text>
    }
    if (lastUpdatedLabel) {
      return <Text color={theme.colors.muted}>{lastUpdatedLabel}</Text>
    }
    return <Text color={theme.colors.success}>Ready</Text>
  }

  return (
    <Box
      height={1}
      width="100%"
      justifyContent="space-between"
      paddingX={1}
    >
      <Box gap={2}>
        {renderStatus()}
        {showRateLimitWarning && (
          <Text color={theme.colors.warning}>
            API: {rateLimit.remaining}/{rateLimit.limit}
          </Text>
        )}
      </Box>
      <Box gap={1}>
        <Text color={theme.colors.muted}>{hints}</Text>
      </Box>
    </Box>
  )
}
