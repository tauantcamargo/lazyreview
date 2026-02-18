import React from 'react'
import { Box } from 'ink'
import { useTheme } from '../../theme/index'

interface MainPanelProps {
  readonly children: React.ReactNode
  readonly isActive?: boolean
}

export function MainPanel({
  children,
  isActive = false,
}: MainPanelProps): React.ReactElement {
  const theme = useTheme()

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle={isActive ? 'double' : 'single'}
      borderColor={isActive ? theme.colors.accent : theme.colors.border}
    >
      {children}
    </Box>
  )
}
