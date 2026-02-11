import React from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '../common/Spinner'
import { useTheme } from '../../theme/index'
import { useLoading } from '../../hooks/useLoading'
import { useStatusMessage } from '../../hooks/useStatusMessage'
import { useLastUpdated } from '../../hooks/useLastUpdated'
import { useRateLimit } from '../../hooks/useRateLimit'
import type { Panel } from '../../hooks/useActivePanel'

const PANEL_HINTS: Record<Panel, string> = {
  sidebar: 'j/k:nav  gg/G:top/bottom  Enter:select  Tab:list  b:toggle  ?:help  R:refresh  q:quit',
  list: 'j/k:nav  gg/G:top/bottom  Enter:detail  Esc:sidebar  Tab:next  ?:help  R:refresh  q:quit',
  detail: 'j/k:scroll  Tab:tabs  Esc:list  ?:help  R:refresh  q:quit',
}

const RATE_LIMIT_WARNING_THRESHOLD = 100

interface StatusBarProps {
  readonly activePanel?: Panel
}

export function StatusBar({ activePanel = 'sidebar' }: StatusBarProps): React.ReactElement {
  const theme = useTheme()
  const loadingState = useLoading()
  const { message: statusMessage } = useStatusMessage()
  const { label: lastUpdatedLabel } = useLastUpdated()
  const rateLimit = useRateLimit()
  const hints = PANEL_HINTS[activePanel]

  const showRateLimitWarning = rateLimit.remaining < RATE_LIMIT_WARNING_THRESHOLD

  const renderStatus = (): React.ReactElement => {
    if (loadingState.isLoading) {
      return <Spinner label={loadingState.message ?? 'Loading...'} />
    }
    if (statusMessage) {
      return <Text color={theme.colors.info}>{statusMessage}</Text>
    }
    if (lastUpdatedLabel) {
      return <Text color={theme.colors.muted}>{lastUpdatedLabel}</Text>
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
      <Box gap={2}>
        {renderStatus()}
        {showRateLimitWarning && (
          <Text color={theme.colors.warning}>
            API: {rateLimit.remaining}/{rateLimit.limit}
          </Text>
        )}
      </Box>
      <Box gap={1}>
        <Text color={theme.colors.muted}>{hints}</Text>
      </Box>
    </Box>
  )
}
