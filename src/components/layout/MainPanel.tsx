import React from 'react'
import { Box } from 'tuir'

interface MainPanelProps {
  readonly children: React.ReactNode
}

export function MainPanel({
  children,
}: MainPanelProps): React.ReactElement {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {children}
    </Box>
  )
}
