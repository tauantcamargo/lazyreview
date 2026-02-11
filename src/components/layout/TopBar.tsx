import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'

interface TopBarProps {
  readonly username: string
  readonly provider: string
  readonly repoPath: string
}

export function TopBar({
  username,
  provider,
  repoPath,
}: TopBarProps): React.ReactElement {
  const theme = useTheme()

  return (
    <Box
      height={1}
      width="100%"
      justifyContent="space-between"
      paddingX={1}
      marginTop={0.6}
    >
      <Box gap={1}>
        <Text color={theme.colors.accent} bold>
          LazyReview
        </Text>
        <Text color={theme.colors.muted}>│</Text>
        <Text color={theme.colors.text}>{repoPath}</Text>
      </Box>
      <Box gap={1}>
        <Text color={theme.colors.muted}>{provider}</Text>
        <Text color={theme.colors.muted}>│</Text>
        <Text color={theme.colors.secondary}>{username}</Text>
      </Box>
    </Box>
  )
}
