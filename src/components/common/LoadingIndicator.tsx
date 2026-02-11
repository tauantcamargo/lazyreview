import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { Spinner } from '@inkjs/ui'
import { useTheme } from '../../theme/index'

interface LoadingIndicatorProps {
  readonly message?: string
}

export function LoadingIndicator({
  message = 'Loading...',
}: LoadingIndicatorProps): React.ReactElement {
  const theme = useTheme()
  const { stdout } = useStdout()
  const height = stdout?.rows ?? 24

  return (
    <Box
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      height={height - 4}
      flexGrow={1}
    >
      <Box gap={1}>
        <Spinner />
        <Text color={theme.colors.accent}>{message}</Text>
      </Box>
    </Box>
  )
}
