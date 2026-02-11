import React from 'react'
import { Box, Text, List, useListItem } from 'tuir'
import { useTheme } from '../../theme/index'

export const SIDEBAR_ITEMS = [
  'Pull Requests',
  'My PRs',
  'Review Requests',
  'Settings',
] as const

export type SidebarItem = (typeof SIDEBAR_ITEMS)[number]

const sidebarIcons: Record<SidebarItem, string> = {
  'Pull Requests': '>',
  'My PRs': '*',
  'Review Requests': '!',
  Settings: '#',
}

interface SidebarProps {
  readonly listView: Parameters<typeof List>[0]['listView']
  readonly visible: boolean
}

function SidebarItem(): React.ReactElement {
  const theme = useTheme()
  const { item, isFocus } = useListItem<string[]>()
  const label = item as unknown as SidebarItem
  const icon = sidebarIcons[label] ?? '>'

  return (
    <Box paddingX={1}>
      <Text
        color={isFocus ? theme.colors.listSelectedFg : theme.colors.text}
        backgroundColor={isFocus ? theme.colors.listSelectedBg : undefined}
        bold={isFocus}
      >
        {isFocus ? '> ' : '  '}
        {icon} {label}
      </Text>
    </Box>
  )
}

export function Sidebar({
  listView,
  visible,
}: SidebarProps): React.ReactElement | null {
  const theme = useTheme()

  if (!visible) return null

  return (
    <Box
      flexDirection="column"
      width={22}
      borderStyle="single"
      borderColor={theme.colors.border}
      borderRight
      borderLeft={false}
      borderTop={false}
      borderBottom={false}
    >
      <Box paddingX={1} marginBottom={1}>
        <Text color={theme.colors.accent} bold>
          Navigation
        </Text>
      </Box>
      <List listView={listView}>
        <SidebarItem />
      </List>
    </Box>
  )
}
