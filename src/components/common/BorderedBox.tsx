import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'

interface BorderedBoxProps {
  readonly title: string
  readonly width?: number | string
  readonly height?: number | string
  readonly isActive?: boolean
  readonly children: React.ReactNode
}

export function BorderedBox({
  title,
  width,
  height,
  isActive = false,
  children,
}: BorderedBoxProps): React.ReactElement {
  const theme = useTheme()
  const borderColor = isActive ? theme.colors.accent : theme.colors.border

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
      borderColor={borderColor}
    >
      <Box paddingX={1}>
        <Text bold={isActive} color={borderColor} dimColor={!isActive}>
          {title}
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {children}
      </Box>
    </Box>
  )
}
