import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'

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

interface SidebarProps {
  readonly selectedIndex: number
  readonly visible: boolean
  readonly isActive: boolean
}

export function Sidebar({
  selectedIndex,
  visible,
  isActive,
}: SidebarProps): React.ReactElement | null {
  const theme = useTheme()

  if (!visible) return null

  return (
    <Box
      flexDirection="column"
      width={24}
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
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
