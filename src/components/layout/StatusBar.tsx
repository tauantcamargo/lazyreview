import React from 'react'
import { Box, Text } from 'tuir'
import { Spinner } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useLoading } from '../../hooks/useLoading'

interface StatusBarProps {
  readonly hints?: string
}

export function StatusBar({ hints }: StatusBarProps): React.ReactElement {
  const theme = useTheme()
  const loadingState = useLoading()

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
        <Text color={theme.colors.muted}>
          {hints ?? 'j/k:nav Tab:focus b:sidebar ?:help q:quit'}
        </Text>
      </Box>
    </Box>
  )
}
