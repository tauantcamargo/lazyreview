import React from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '../common/Spinner'
import { useTheme } from '../../theme/index'
import { useLoading } from '../../hooks/useLoading'
import { useStatusMessage } from '../../hooks/useStatusMessage'
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
  const { message: statusMessage } = useStatusMessage()
  const hints = PANEL_HINTS[activePanel]

  const renderStatus = (): React.ReactElement => {
    if (loadingState.isLoading) {
      return <Spinner label={loadingState.message ?? 'Loading...'} />
    }
    if (statusMessage) {
      return <Text color={theme.colors.info}>{statusMessage}</Text>
    }
    return <Text color={theme.colors.success}>Ready</Text>
  }

  return (
    <Box
      height={1}
      width="100%"
      justifyContent="space-between"
      paddingX={1}
    >
      <Box>
        {renderStatus()}
      </Box>
      <Box gap={1}>
        <Text color={theme.colors.muted}>{hints}</Text>
      </Box>
    </Box>
  )
}
