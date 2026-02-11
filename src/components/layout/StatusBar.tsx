import React from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '../common/Spinner'
import { useTheme } from '../../theme/index'
import { useLoading } from '../../hooks/useLoading'
import type { Panel } from '../../hooks/useActivePanel'

const PANEL_HINTS: Record<Panel, string> = {
  sidebar: 'j/k:nav  gg/G:top/bottom  Enter:select  Tab:list  b:toggle  ?:help  q:quit',
  list: 'j/k:nav  gg/G:top/bottom  Enter:detail  Esc:sidebar  Tab:next  ?:help  q:quit',
  detail: 'j/k:scroll  Tab:tabs  Esc:list  ?:help  q:quit',
}

interface StatusBarProps {
  readonly activePanel?: Panel
}

export function StatusBar({ activePanel = 'sidebar' }: StatusBarProps): React.ReactElement {
  const theme = useTheme()
  const loadingState = useLoading()
  const hints = PANEL_HINTS[activePanel]

  return (
    <Box
      height={1}
      width="100%"
      justifyContent="space-between"
      paddingX={1}
    >
      <Box>
        {loadingState.isLoading ? (
          <Spinner label={loadingState.message ?? 'Loading...'} />
        ) : (
          <Text color={theme.colors.success}>Ready</Text>
        )}
      </Box>
      <Box gap={1}>
        <Text color={theme.colors.muted}>{hints}</Text>
      </Box>
    </Box>
  )
}
