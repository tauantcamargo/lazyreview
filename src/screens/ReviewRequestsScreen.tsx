import React, { useEffect } from 'react'
import { Box, Text, List, useList } from 'tuir'
import { useTheme } from '../theme/index'
import { useGitHub } from '../hooks/useGitHub'
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
  const { prs, loading, error, fetchReviewRequests } = useGitHub()

  useEffect(() => {
    fetchReviewRequests()
  }, [fetchReviewRequests])

  const mutablePRs = [...prs]
  const { listView } = useList(mutablePRs, {
    navigation: 'vi-vertical',
    unitSize: 2,
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

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Text color={theme.colors.accent} bold>
          Review Requests
        </Text>
        <Text color={theme.colors.muted}> ({prs.length})</Text>
      </Box>
      <List listView={listView}>
        <PRListItem />
      </List>
    </Box>
  )
}
