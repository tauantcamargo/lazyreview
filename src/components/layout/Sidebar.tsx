import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { SidebarCounts } from '../../hooks/useSidebarCounts'

export const SIDEBAR_ITEMS = [
  'Involved',
  'My PRs',
  'For Review',
  'This Repo',
  'Settings',
] as const

export type SidebarItem = (typeof SIDEBAR_ITEMS)[number]

const sidebarIcons: Record<SidebarItem, string> = {
  Involved: '◆',
  'My PRs': '●',
  'For Review': '◎',
  'This Repo': '◈',
  Settings: '⚙',
}

function getCountForItem(
  label: SidebarItem,
  counts: SidebarCounts | undefined,
): number | null {
  if (!counts) return null
  switch (label) {
    case 'Involved':
      return counts.involved
    case 'My PRs':
      return counts.myPrs
    case 'For Review':
      return counts.forReview
    case 'This Repo':
      return counts.thisRepo
    case 'Settings':
      return null
  }
}

function getUnreadForItem(
  label: SidebarItem,
  counts: SidebarCounts | undefined,
): number | null {
  if (!counts) return null
  if (label === 'For Review') return counts.forReviewUnread
  return null
}

interface SidebarProps {
  readonly selectedIndex: number
  readonly visible: boolean
  readonly isActive: boolean
  readonly counts?: SidebarCounts
}

export function Sidebar({
  selectedIndex,
  visible,
  isActive,
  counts,
}: SidebarProps): React.ReactElement | null {
  const theme = useTheme()

  if (!visible) return null

  return (
    <Box
      flexDirection="column"
      width={28}
      borderStyle="single"
      borderColor={isActive ? theme.colors.accent : theme.colors.border}
    >
      <Box paddingX={1} paddingY={0}>
        <Text color={theme.colors.accent} bold={isActive} dimColor={!isActive}>
          Navigation
        </Text>
      </Box>
      <Box flexDirection="column" paddingTop={1}>
        {SIDEBAR_ITEMS.map((label, index) => {
          const isSelected = index === selectedIndex
          const icon = sidebarIcons[label]
          const count = getCountForItem(label, counts)
          const unread = getUnreadForItem(label, counts)
          return (
            <Box key={label} paddingX={1}>
              <Text
                color={isSelected ? theme.colors.accent : theme.colors.text}
                backgroundColor={isSelected ? theme.colors.selection : undefined}
                bold={isSelected}
                dimColor={!isActive && !isSelected}
              >
                {isSelected ? '▸ ' : '  '}
                {icon} {label}
              </Text>
              {count !== null && (
                <Text color={theme.colors.muted}>
                  {' '}({count})
                </Text>
              )}
              {unread !== null && (
                <Text color={theme.colors.accent}>
                  {' '}*{unread} new*
                </Text>
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
