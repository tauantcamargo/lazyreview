import React from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import { useTheme } from '../../theme/index'

interface LoadingIndicatorProps {
  readonly message?: string
  readonly subtitle?: string
  readonly inline?: boolean
}

export function LoadingIndicator({
  message = 'Loading...',
  subtitle,
  inline = false,
}: LoadingIndicatorProps): React.ReactElement {
  const theme = useTheme()

  const content = (
    <Box flexDirection="column" alignItems="center" gap={0}>
      <Box gap={1}>
        <Spinner />
        <Text color={theme.colors.accent}>{message}</Text>
      </Box>
      {subtitle && (
        <Text color={theme.colors.muted} dimColor>
          {subtitle}
        </Text>
      )}
    </Box>
  )

  if (inline) {
    return content
  }

  return (
    <Box
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      flexGrow={1}
    >
      {content}
    </Box>
  )
}
