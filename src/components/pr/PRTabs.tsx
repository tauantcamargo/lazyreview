import React from 'react'
import { Box, Text } from 'tuir'
import { useTheme } from '../../theme/index'

export const PR_TAB_NAMES = ['Files', 'Comments', 'Timeline'] as const
export type PRTabName = (typeof PR_TAB_NAMES)[number]

interface PRTabsProps {
  readonly activeIndex: number
}

export function PRTabs({ activeIndex }: PRTabsProps): React.ReactElement {
  const theme = useTheme()

  return (
    <Box paddingX={1} gap={2}>
      {PR_TAB_NAMES.map((name, index) => {
        const isActive = index === activeIndex
        return (
          <Box key={name} gap={1}>
            <Text color={theme.colors.muted}>{index + 1}:</Text>
            <Text
              color={isActive ? theme.colors.accent : theme.colors.muted}
              bold={isActive}
              underline={isActive}
            >
              {name}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
