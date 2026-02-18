import React from 'react'
import { Box } from 'ink'
import { Tab, Tabs } from 'ink-tab'
import { useTheme } from '../../theme/index'
import { Divider } from '../common/Divider'

export const PR_TAB_NAMES = ['Description', 'Conversations', 'Commits', 'Files', 'Checks', 'Timeline'] as const
export type PRTabName = (typeof PR_TAB_NAMES)[number]

/**
 * Format a tab name with its 1-based index prefix, e.g. "1:Description"
 */
export function formatTabName(name: string, index: number): string {
  return `${index + 1}:${name}`
}

interface PRTabsProps {
  readonly activeIndex: number
  readonly onChange: (index: number) => void
}

export function PRTabs({ activeIndex, onChange }: PRTabsProps): React.ReactElement {
  const theme = useTheme()

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" paddingX={1}>
        <Tabs
          key={activeIndex}
          defaultValue={PR_TAB_NAMES[activeIndex]}
          onChange={(name) => {
            const index = PR_TAB_NAMES.indexOf(name as PRTabName)
            if (index >= 0) onChange(index)
          }}
          showIndex={false}
          isFocused={true}
          colors={{
            activeTab: {
              color: theme.colors.accent,
              backgroundColor: theme.colors.bg,
            },
          }}
          keyMap={{ useNumbers: true, useTab: true }}
        >
          {PR_TAB_NAMES.map((name, i) => (
            <Tab key={name} name={name}>
              {formatTabName(name, i)}
            </Tab>
          ))}
        </Tabs>
      </Box>
      <Divider style="single" />
    </Box>
  )
}
