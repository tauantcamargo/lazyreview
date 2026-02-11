import React from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'

interface ErrorWithRetryProps {
  readonly message: string
  readonly onRetry: () => void
  readonly isActive?: boolean
}

export function ErrorWithRetry({
  message,
  onRetry,
  isActive = true,
}: ErrorWithRetryProps): React.ReactElement {
  const theme = useTheme()

  useInput(
    (input) => {
      if (input === 'r') {
        onRetry()
      }
    },
    { isActive },
  )

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Text color={theme.colors.error}>Error: {message}</Text>
      <Text color={theme.colors.muted}>
        Press <Text color={theme.colors.accent} bold>r</Text> to retry
      </Text>
    </Box>
  )
}
