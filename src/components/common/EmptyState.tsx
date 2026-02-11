import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'

interface EmptyStateProps {
  readonly icon?: string
  readonly message: string
  readonly hint?: string
}

export function EmptyState({
  icon = '~',
  message,
  hint,
}: EmptyStateProps): React.ReactElement {
  const theme = useTheme()

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      paddingY={2}
    >
      <Text color={theme.colors.muted}>{icon}</Text>
      <Text color={theme.colors.muted}>{message}</Text>
      {hint && (
        <Text color={theme.colors.muted} dimColor>
          {hint}
        </Text>
      )}
    </Box>
  )
}
