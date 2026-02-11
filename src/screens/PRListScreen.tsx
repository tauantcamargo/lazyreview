import React, { useEffect } from 'react'
import { Box, Text, List, useList } from 'tuir'
import { useTheme } from '../theme/index'
import { useGitHub } from '../hooks/useGitHub'
import { PRListItem } from '../components/pr/PRListItem'
import { EmptyState } from '../components/common/EmptyState'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import type { PullRequest } from '../models/pull-request'

interface PRListScreenProps {
  readonly owner: string
  readonly repo: string
  readonly onSelect: (pr: PullRequest) => void
}

export function PRListScreen({
  owner,
  repo,
  onSelect,
}: PRListScreenProps): React.ReactElement {
  const theme = useTheme()
  const { prs, loading, error, fetchPRs } = useGitHub()

  useEffect(() => {
    fetchPRs(owner, repo)
  }, [owner, repo, fetchPRs])

  const mutablePRs = [...prs]
  const { listView, control } = useList(mutablePRs, {
    navigation: 'vi-vertical',
    unitSize: 2,
  })

  if (loading && prs.length === 0) {
    return <LoadingIndicator message="Loading pull requests..." />
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.colors.error}>Error: {error}</Text>
      </Box>
    )
  }

  if (prs.length === 0) {
    return (
      <EmptyState
        message="No pull requests found"
        hint={`${owner}/${repo}`}
      />
    )
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1}>
        <Text color={theme.colors.accent} bold>
          Pull Requests
        </Text>
        <Text color={theme.colors.muted}> ({prs.length})</Text>
        <Text color={theme.colors.muted}>
          {' '}
          - {owner}/{repo}
        </Text>
      </Box>
      <List listView={listView}>
        <PRListItem />
      </List>
    </Box>
  )
}
