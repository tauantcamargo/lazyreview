import React from 'react'
import { Box, Text } from 'tuir'
import { useTheme } from '../../theme/index'

export const SIDEBAR_ITEMS = [
  'Pull Requests',
  'My PRs',
  'Review Requests',
  'Settings',
] as const

export type SidebarItem = (typeof SIDEBAR_ITEMS)[number]

const sidebarIcons: Record<SidebarItem, string> = {
  'Pull Requests': '◆',
  'My PRs': '●',
  'Review Requests': '◎',
  Settings: '⚙',
}

interface SidebarProps {
  readonly selectedIndex: number
  readonly visible: boolean
}

export function Sidebar({
  selectedIndex,
  visible,
}: SidebarProps): React.ReactElement | null {
  const theme = useTheme()

  if (!visible) return null

  return (
    <Box
      flexDirection="column"
      width={24}
      borderStyle="single"
      borderColor={theme.colors.border}
      borderRight
      borderLeft={false}
      borderTop={false}
      borderBottom={false}
    >
      <Box paddingX={1} paddingY={0}>
        <Text color={theme.colors.accent} bold>
          Navigation
        </Text>
      </Box>
      <Box flexDirection="column" paddingTop={1}>
        {SIDEBAR_ITEMS.map((label, index) => {
          const isFocus = index === selectedIndex
          const icon = sidebarIcons[label] ?? '>'
          return (
            <Box key={label} paddingX={1} height={1}>
              <Text
                color={isFocus ? theme.colors.accent : theme.colors.text}
                backgroundColor={isFocus ? theme.colors.selection : undefined}
                bold={isFocus}
              >
                {isFocus ? '▸ ' : '  '}
                {icon} {label}
              </Text>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
