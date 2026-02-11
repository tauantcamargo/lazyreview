import React from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '../common/Spinner'
import { useTheme } from '../../theme/index'
import { useLoading } from '../../hooks/useLoading'
import { useStatusMessage } from '../../hooks/useStatusMessage'
import { useLastUpdated } from '../../hooks/useLastUpdated'
import { useRateLimit } from '../../hooks/useRateLimit'
import type { Panel } from '../../hooks/useActivePanel'

export type ScreenContext =
  | 'pr-list'
  | 'pr-detail-files'
  | 'pr-detail-conversations'
  | 'pr-detail-commits'
  | 'settings'

const PANEL_HINTS: Record<Panel, string> = {
  sidebar: 'j/k:nav  Enter:select  Tab:list  b:sidebar  ?:help  q:quit',
  list: 'j/k:nav  Enter:detail  /:filter  s:sort  o:open  R:refresh  q:back',
  detail: 'j/k:scroll  Tab:tabs  Esc:list  ?:help  R:refresh',
}

const SCREEN_CONTEXT_HINTS: Record<ScreenContext, string> = {
  'pr-list': 'j/k:nav  Enter:open  /:filter  s:sort  t:state  o:browser  y:copy-url  n/p:page  R:refresh',
  'pr-detail-files': 'j/k:nav  h/l:tree/diff  /:filter  v:select  c:comment  r:reply  x:resolve  R:review  S:batch',
  'pr-detail-conversations': 'j/k:nav  c:comment  r:reply  e:edit  x:resolve  f:resolved  R:review  S:batch  E:re-review',
  'pr-detail-commits': 'j/k:nav  y:copy-sha  R:review  S:batch  E:re-review  m:merge',
  'settings': 'j/k:nav  Enter:edit/toggle  Esc:cancel',
}

export function getContextHints(
  activePanel: Panel,
  screenContext?: ScreenContext,
): string {
  if (activePanel === 'sidebar') {
    return PANEL_HINTS.sidebar
  }
  if (screenContext && screenContext in SCREEN_CONTEXT_HINTS) {
    return SCREEN_CONTEXT_HINTS[screenContext]
  }
  return PANEL_HINTS[activePanel]
}

const RATE_LIMIT_WARNING_THRESHOLD = 100

interface StatusBarProps {
  readonly activePanel?: Panel
  readonly screenContext?: ScreenContext
}

export function StatusBar({
  activePanel = 'sidebar',
  screenContext,
}: StatusBarProps): React.ReactElement {
  const theme = useTheme()
  const loadingState = useLoading()
  const { message: statusMessage } = useStatusMessage()
  const { label: lastUpdatedLabel } = useLastUpdated()
  const rateLimit = useRateLimit()
  const hints = getContextHints(activePanel, screenContext)

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
