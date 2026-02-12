import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../theme/index'
import { EmptyState } from '../components/common/EmptyState'
import type { PullRequest } from '../models/pull-request'

interface BrowseRepoScreenProps {
  readonly onSelect: (pr: PullRequest, list?: readonly PullRequest[], index?: number) => void
}

export function BrowseRepoScreen({ onSelect: _onSelect }: BrowseRepoScreenProps): React.ReactElement {
  const theme = useTheme()

  return (
    <Box flexDirection="column" flexGrow={1} padding={1}>
      <Text color={theme.colors.accent} bold>
        Browse Repository
      </Text>
      <EmptyState message="Enter an owner/repo to browse PRs from any GitHub repository" />
    </Box>
  )
}
