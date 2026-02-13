import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
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

const shortcutGroups: readonly ShortcutGroup[] = [
  {
    title: 'Global',
    items: [
      { key: 'j / k', description: 'Move down / up' },
      { key: 'Enter', description: 'Select / Open' },
      { key: 'Ctrl+b', description: 'Toggle sidebar' },
      { key: '?', description: 'Toggle this help' },
      { key: 'q / Esc', description: 'Back / Quit' },
      { key: 'Ctrl+c', description: 'Force quit' },
    ],
  },
  {
    title: 'PR List',
    items: [
      { key: '/', description: 'Filter PRs' },
      { key: 's', description: 'Sort PRs' },
      { key: 'n / p', description: 'Next / Previous page' },
      { key: 'o', description: 'Open PR in browser' },
      { key: 'y', description: 'Copy PR URL' },
      { key: 'u', description: 'Toggle unread only' },
      { key: 't', description: 'Toggle state (Open/Closed/All)' },
      { key: 'R', description: 'Refresh' },
    ],
  },
  {
    title: 'PR Detail',
    items: [
      { key: '1-5', description: 'Switch tabs (Desc/Conv/Commits/Files/Checks)' },
      { key: 'o', description: 'Open PR in browser' },
      { key: 'y', description: 'Copy PR URL' },
      { key: 'R', description: 'Submit review' },
      { key: 'S', description: 'Start batch review' },
      { key: 'E', description: 'Request re-review' },
      { key: 'm', description: 'Merge PR' },
      { key: 'X', description: 'Close / Reopen PR' },
      { key: 'G', description: 'Checkout PR branch locally' },
      { key: '] / [', description: 'Next / Previous PR' },
    ],
  },
  {
    title: 'Conversations Tab',
    items: [
      { key: 'c', description: 'New comment' },
      { key: 'r', description: 'Reply to comment (review + issue)' },
      { key: 'e', description: 'Edit own comment' },
      { key: 'D', description: 'Edit PR description (author only)' },
      { key: 'x', description: 'Resolve / unresolve thread' },
      { key: 'f', description: 'Toggle resolved comments' },
      { key: 'g', description: 'Go to file in diff (inline comments)' },
    ],
  },
  {
    title: 'Files Tab',
    items: [
      { key: 'h / l', description: 'Focus tree / diff' },
      { key: 'Tab', description: 'Switch tree / diff panel' },
      { key: '/', description: 'Filter files (tree) / Search diff (diff)' },
      { key: 'n / N', description: 'Next / previous search match (diff)' },
      { key: 'd', description: 'Toggle side-by-side diff' },
      { key: 'v', description: 'Visual line select (diff)' },
      { key: 'c', description: 'Inline comment (diff)' },
      { key: 'r', description: 'Reply to diff comment' },
      { key: 'e', description: 'Edit own diff comment' },
      { key: 'x', description: 'Resolve / unresolve (diff)' },
    ],
  },
  {
    title: 'Checks Tab',
    items: [
      { key: 'o', description: 'Open check run in browser' },
      { key: 'y', description: 'Copy check run URL' },
    ],
  },
  {
    title: 'Commits Tab',
    items: [
      { key: 'y', description: 'Copy commit SHA' },
    ],
  },
  {
    title: 'Comment / Review Input',
    items: [
      { key: 'Enter', description: 'New line' },
      { key: 'Tab', description: 'Insert indent (2 spaces)' },
      { key: 'Ctrl+S', description: 'Submit' },
      { key: 'Esc', description: 'Cancel / Back' },
    ],
  },
]

export function HelpModal({ onClose }: HelpModalProps): React.ReactElement {
  const theme = useTheme()

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
                <Box key={`${group.title}-${s.key}`} gap={2}>
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
