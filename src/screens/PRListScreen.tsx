import React, { useEffect, useRef } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { ScrollList, type ScrollListRef } from 'ink-scroll-list'
import { useTheme } from '../theme/index'
import { useGitHub } from '../hooks/useGitHub'
import { useListNavigation } from '../hooks/useListNavigation'
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
  const { stdout } = useStdout()
  const { prs, loading, error, fetchPRs } = useGitHub()

  useEffect(() => {
    fetchPRs(owner, repo)
  }, [owner, repo, fetchPRs])

  const listRef = useRef<ScrollListRef>(null)
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 6)
  const { selectedIndex } = useListNavigation({
    itemCount: prs.length,
    viewportHeight,
    isActive: true,
  })

  useEffect(() => {
    const handleResize = (): void => listRef.current?.remeasure()
    stdout?.on('resize', handleResize)
    return () => {
      stdout?.off('resize', handleResize)
    }
  }, [stdout])

  useInput((input, key) => {
    if (key.return && prs[selectedIndex]) {
      onSelect(prs[selectedIndex])
    }
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
      <EmptyState message="No pull requests found" hint={`${owner}/${repo}`} />
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
      <Box flexDirection="column" overflow="hidden" height={viewportHeight}>
        <ScrollList ref={listRef} selectedIndex={selectedIndex} scrollAlignment="auto">
          {prs.map((pr, index) => (
            <PRListItem
              key={pr.id}
              item={pr}
              isFocus={index === selectedIndex}
            />
          ))}
        </ScrollList>
      </Box>
    </Box>
  )
}
