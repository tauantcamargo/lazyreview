import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'

interface BorderedBoxProps {
  readonly title: string
  readonly subtitle?: string
  readonly statusColor?: string
  readonly width?: number | string
  readonly height?: number | string
  readonly isActive?: boolean
  readonly children: React.ReactNode
}

export function BorderedBox({
  title,
  subtitle,
  statusColor,
  width,
  height,
  isActive = false,
  children,
}: BorderedBoxProps): React.ReactElement {
  const theme = useTheme()
  const borderColor = statusColor ?? (isActive ? theme.colors.accent : theme.colors.border)

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
      borderColor={borderColor}
    >
      <Box paddingX={1} flexDirection="column">
        <Text bold={isActive} color={borderColor} dimColor={!isActive && !statusColor}>
          {title}
        </Text>
        {subtitle && (
          <Text color={theme.colors.muted} dimColor>
            {subtitle}
          </Text>
        )}
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {children}
      </Box>
    </Box>
  )
}
