import React from 'react'
import { Box } from 'ink'
import { Tab, Tabs } from 'ink-tab'
import { useTheme } from '../../theme/index'

export const PR_TAB_NAMES = ['Description', 'Conversations', 'Commits', 'Files'] as const
export type PRTabName = (typeof PR_TAB_NAMES)[number]

interface PRTabsProps {
  readonly activeIndex: number
  readonly onChange: (index: number) => void
}

export function PRTabs({ activeIndex, onChange }: PRTabsProps): React.ReactElement {
  const theme = useTheme()

  return (
    <Box
      flexDirection="row"
      paddingX={1}
      paddingY={1}
      borderStyle="single"
      borderColor={theme.colors.border}
    >
      <Tabs
        key={activeIndex}
        defaultValue={PR_TAB_NAMES[activeIndex]}
        onChange={(name) => {
          const index = PR_TAB_NAMES.indexOf(name as PRTabName)
          if (index >= 0) onChange(index)
        }}
        showIndex={true}
        isFocused={true}
        colors={{
          activeTab: {
            color: theme.colors.accent,
            backgroundColor: theme.colors.bg,
          },
        }}
        keyMap={{ useNumbers: true, useTab: true }}
      >
        {PR_TAB_NAMES.map((name) => (
          <Tab key={name} name={name}>
            {name}
          </Tab>
        ))}
      </Tabs>
    </Box>
  )
}
