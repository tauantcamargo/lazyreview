import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import { useKeybindings } from '../../hooks/useKeybindings'
import { mergeKeybindings, formatActionBindings } from '../../config/keybindings'
import type { KeybindingOverrides } from '../../config/keybindings'
import { Divider } from '../common/Divider'
import { Modal } from '../common/Modal'

interface HelpModalProps {
  readonly onClose: () => void
}

interface ShortcutEntry {
  readonly key: string
  readonly description: string
}

interface ShortcutGroup {
  readonly title: string
  readonly items: readonly ShortcutEntry[]
}

/**
 * Description labels for each action, used in the help modal.
 */
const ACTION_DESCRIPTIONS: Readonly<Record<string, string>> = {
  // Global
  moveDown: 'Move down',
  moveUp: 'Move up',
  select: 'Select / Open',
  toggleSidebar: 'Toggle sidebar',
  toggleHelp: 'Toggle this help',
  commandPalette: 'Command palette',
  back: 'Back / Quit',
  quit: 'Force quit',
  refresh: 'Refresh',
  // PR List
  filterPRs: 'Filter PRs',
  sortPRs: 'Sort PRs',
  nextPage: 'Next page',
  prevPage: 'Previous page',
  openInBrowser: 'Open in browser',
  copyUrl: 'Copy URL',
  toggleUnread: 'Toggle unread only',
  toggleState: 'Toggle state (Open/Closed/All)',
  // PR Detail
  submitReview: 'Submit review',
  batchReview: 'Start batch review',
  reReview: 'Request re-review',
  mergePR: 'Merge PR',
  editTitle: 'Edit PR title',
  toggleDraft: 'Toggle draft / ready for review',
  closePR: 'Close / Reopen PR',
  checkoutBranch: 'Checkout PR branch locally',
  nextPR: 'Next PR',
  prevPR: 'Previous PR',
  // Conversations
  newComment: 'New comment',
  reply: 'Reply to comment',
  editComment: 'Edit own comment',
  editDescription: 'Edit PR description (author only)',
  resolveThread: 'Resolve / unresolve thread',
  toggleResolved: 'Toggle resolved comments',
  goToFile: 'Go to file in diff',
  // Files Tab
  focusTree: 'Focus tree',
  focusDiff: 'Focus diff',
  switchPanel: 'Switch tree / diff panel',
  filterFiles: 'Filter files / Search diff',
  toggleSideBySide: 'Toggle side-by-side diff',
  visualSelect: 'Visual line select',
  inlineComment: 'Inline comment',
  // Commits Tab
  copyCommitSha: 'Copy commit SHA',
  // Input
  submit: 'Submit',
  newLine: 'New line',
  indent: 'Insert indent (2 spaces)',
}

/**
 * Defines which actions appear in each help section and in what order.
 * Some entries are static (not backed by the keybinding system).
 */
interface HelpSectionDef {
  readonly title: string
  readonly context: string
  readonly actions: readonly string[]
  readonly staticEntries?: readonly ShortcutEntry[]
}

const HELP_SECTIONS: readonly HelpSectionDef[] = [
  {
    title: 'Global',
    context: 'global',
    actions: ['moveDown', 'moveUp', 'select', 'toggleSidebar', 'toggleHelp', 'commandPalette', 'back', 'quit'],
  },
  {
    title: 'PR List',
    context: 'prList',
    actions: ['filterPRs', 'sortPRs', 'nextPage', 'prevPage', 'openInBrowser', 'copyUrl', 'toggleUnread', 'toggleState'],
    staticEntries: [
      { key: 'R', description: 'Refresh' },
    ],
  },
  {
    title: 'PR Detail',
    context: 'prDetail',
    actions: ['openInBrowser', 'copyUrl', 'submitReview', 'batchReview', 'reReview', 'mergePR', 'editTitle', 'toggleDraft', 'closePR', 'checkoutBranch', 'nextPR', 'prevPR'],
    staticEntries: [
      { key: '1-6', description: 'Switch tabs (Desc/Conv/Commits/Files/Checks/Timeline)' },
    ],
  },
  {
    title: 'Conversations Tab',
    context: 'conversations',
    actions: ['newComment', 'reply', 'editComment', 'editDescription', 'resolveThread', 'toggleResolved', 'goToFile'],
  },
  {
    title: 'Files Tab',
    context: 'filesTab',
    actions: ['focusTree', 'focusDiff', 'switchPanel', 'filterFiles', 'toggleSideBySide', 'visualSelect', 'inlineComment', 'reply', 'editComment', 'resolveThread'],
    staticEntries: [
      { key: 'F', description: 'Search across all files' },
      { key: 'n / N', description: 'Next / previous search match' },
    ],
  },
  {
    title: 'Checks Tab',
    context: 'checksTab',
    actions: ['openInBrowser', 'copyUrl'],
  },
  {
    title: 'Timeline Tab',
    context: 'timelineTab',
    actions: ['openInBrowser', 'copyUrl'],
  },
  {
    title: 'Commits Tab',
    context: 'commitsTab',
    actions: ['select', 'copyCommitSha', 'back'],
  },
  {
    title: 'Comment / Review Input',
    context: 'input',
    actions: ['newLine', 'indent', 'submit', 'back'],
  },
]

/**
 * Build shortcut groups by merging keybinding defaults with user overrides.
 */
export function buildShortcutGroups(
  overrides: KeybindingOverrides | undefined,
): readonly ShortcutGroup[] {
  return HELP_SECTIONS.map((section) => {
    const bindings = mergeKeybindings(section.context, overrides)

    const actionItems: readonly ShortcutEntry[] = section.actions
      .filter((action) => bindings[action] != null)
      .map((action) => ({
        key: formatActionBindings(bindings[action]!),
        description: ACTION_DESCRIPTIONS[action] ?? action,
      }))

    const staticItems = section.staticEntries ?? []

    // Place static entries at the front (like tab switching or search nav)
    const items = [...staticItems, ...actionItems]

    return { title: section.title, items }
  })
}

export function HelpModal({ onClose }: HelpModalProps): React.ReactElement {
  const theme = useTheme()
  const { overrides } = useKeybindings('global')

  const shortcutGroups = useMemo(
    () => buildShortcutGroups(overrides),
    [overrides],
  )

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.bg}
        paddingX={2}
        paddingY={1}
        gap={1}
      >
        <Text color={theme.colors.accent} bold>
          Keyboard Shortcuts
        </Text>
        <Divider />
        <Box flexDirection="column" gap={1}>
          {shortcutGroups.map((group) => (
            <Box key={group.title} flexDirection="column">
              <Text color={theme.colors.secondary} bold>
                {group.title}
              </Text>
              {group.items.map((s) => (
                <Box key={`${group.title}-${s.key}-${s.description}`} gap={2}>
                  <Box width={16}>
                    <Text color={theme.colors.warning}>{s.key}</Text>
                  </Box>
                  <Text color={theme.colors.text}>{s.description}</Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
        <Divider />
        <Text color={theme.colors.muted} dimColor>
          Press ? to close  |  Case matters: R/r, S/s, E/e, X/x
        </Text>
      </Box>
    </Modal>
  )
}
