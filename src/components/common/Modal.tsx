import React from 'react'
import { Box, useStdout } from 'ink'

interface ModalProps {
  readonly children: React.ReactNode
}

export function Modal({ children }: ModalProps): React.ReactElement {
  const { stdout } = useStdout()
  const width = stdout?.columns ?? 80
  const height = stdout?.rows ?? 24

  return (
    <Box
      position="absolute"
      width={width}
      height={height}
      justifyContent="center"
      alignItems="center"
    >
      {children}
    </Box>
  )
}
