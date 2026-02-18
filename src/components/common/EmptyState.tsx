import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'

export interface EmptyStateAction {
  readonly key: string
  readonly label: string
}

interface EmptyStateProps {
  readonly title?: string
  readonly icon?: string
  readonly message: string
  readonly hint?: string
  readonly actions?: readonly EmptyStateAction[]
}

export function EmptyState({
  title,
  icon = '~',
  message,
  hint,
  actions,
}: EmptyStateProps): React.ReactElement {
  const theme = useTheme()

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      paddingY={3}
      gap={1}
    >
      <Text color={theme.colors.muted}>{icon}</Text>
      {title && (
        <Text color={theme.colors.text} bold>
          {title}
        </Text>
      )}
      <Text color={theme.colors.muted}>{message}</Text>
      {hint && (
        <Text color={theme.colors.muted} dimColor>
          {hint}
        </Text>
      )}
      {actions && actions.length > 0 && (
        <Box gap={2} marginTop={1}>
          {actions.map((action) => (
            <Box key={action.key} gap={1}>
              <Text color={theme.colors.accent} bold>
                {action.key}
              </Text>
              <Text color={theme.colors.muted}>{action.label}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
