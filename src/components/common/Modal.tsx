import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { useTheme } from '../../theme/index'

interface ModalProps {
  readonly children: React.ReactNode
}

export function Modal({ children }: ModalProps): React.ReactElement {
  const theme = useTheme()
  const { stdout } = useStdout()
  const width = stdout?.columns ?? 80
  const height = stdout?.rows ?? 24

  // Create a full-screen background
  return (
    <Box
      position="absolute"
      width={width}
      height={height}
      flexDirection="column"
    >
      {/* Background layer - fill entire screen */}
      {Array.from({ length: height }).map((_, i) => (
        <Text key={i} backgroundColor={theme.colors.bg}>
          {' '.repeat(width)}
        </Text>
      ))}
      {/* Content layer - centered on top */}
      <Box
        position="absolute"
        width="100%"
        height="100%"
        justifyContent="center"
        alignItems="center"
      >
        {children}
      </Box>
    </Box>
  )
}
