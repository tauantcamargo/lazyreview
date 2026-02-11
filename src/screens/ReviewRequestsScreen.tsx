import React, { useEffect } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { useTheme } from '../theme/index'
import { useGitHub } from '../hooks/useGitHub'
import { useListNavigation } from '../hooks/useListNavigation'
import { PRListItem } from '../components/pr/PRListItem'
import { EmptyState } from '../components/common/EmptyState'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import type { PullRequest } from '../models/pull-request'

interface ReviewRequestsScreenProps {
  readonly onSelect: (pr: PullRequest) => void
}

export function ReviewRequestsScreen({
  onSelect,
}: ReviewRequestsScreenProps): React.ReactElement {
  const theme = useTheme()
  const { stdout } = useStdout()
  const { prs, loading, error, fetchReviewRequests } = useGitHub()

  useEffect(() => {
    fetchReviewRequests()
  }, [fetchReviewRequests])

  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 6)
  const { selectedIndex, scrollOffset } = useListNavigation({
    itemCount: prs.length,
    viewportHeight,
    isActive: true,
  })

  useInput((input, key) => {
    if (key.return && prs[selectedIndex]) {
      onSelect(prs[selectedIndex])
    }
  })

  if (loading && prs.length === 0) {
    return <LoadingIndicator message="Loading review requests..." />
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.colors.error}>Error: {error}</Text>
      </Box>
    )
  }

  if (prs.length === 0) {
    return <EmptyState message="No review requests" />
  }

  const visiblePRs = prs.slice(scrollOffset, scrollOffset + viewportHeight)

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Text color={theme.colors.accent} bold>
          Review Requests
        </Text>
        <Text color={theme.colors.muted}> ({prs.length})</Text>
      </Box>
      <Box flexDirection="column">
        {visiblePRs.map((pr, index) => (
          <PRListItem
            key={pr.id}
            item={pr}
            isFocus={scrollOffset + index === selectedIndex}
          />
        ))}
      </Box>
    </Box>
  )
}
