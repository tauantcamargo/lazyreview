import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { useTheme } from '../../theme/index'
import { useListNavigation } from '../../hooks/useListNavigation'
import type { Commit } from '../../models/commit'
import { timeAgo } from '../../utils/date'
import { EmptyState } from '../common/EmptyState'

interface CommitsTabProps {
  readonly commits: readonly Commit[]
  readonly isActive: boolean
}

function CommitItem({
  commit,
  isFocus,
}: {
  readonly commit: Commit
  readonly isFocus: boolean
}): React.ReactElement {
  const theme = useTheme()

  const shortSha = commit.sha.slice(0, 7)
  const message = commit.commit.message.split('\n')[0] ?? ''
  const author = commit.author?.login ?? commit.commit.author.name
  const date = commit.commit.author.date

  return (
    <Box
      paddingX={1}
      paddingY={0}
      gap={1}
      // @ts-ignore
      backgroundColor={isFocus ? theme.colors.selection : undefined}
    >
      <Box width={10}>
        <Text color={theme.colors.warning} bold={isFocus}>
          {shortSha}
        </Text>
      </Box>
      <Box flexGrow={1} flexShrink={1}>
        <Text
          color={isFocus ? theme.colors.listSelectedFg : theme.colors.text}
          bold={isFocus}
          wrap="truncate"
        >
          {message}
        </Text>
      </Box>
      <Box width={16}>
        <Text color={theme.colors.secondary}>{author}</Text>
      </Box>
      <Box width={14}>
        <Text color={theme.colors.muted}>{timeAgo(date)}</Text>
      </Box>
    </Box>
  )
}

export function CommitsTab({
  commits,
  isActive,
}: CommitsTabProps): React.ReactElement {
  const { stdout } = useStdout()
  const theme = useTheme()
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 10)

  const { selectedIndex, scrollOffset } = useListNavigation({
    itemCount: commits.length,
    viewportHeight,
    isActive,
  })

  if (commits.length === 0) {
    return <EmptyState message="No commits found" />
  }

  const visibleCommits = commits.slice(scrollOffset, scrollOffset + viewportHeight)

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} paddingY={1} gap={1}>
        <Text color={theme.colors.accent} bold>
          Commits
        </Text>
        <Text color={theme.colors.muted}>({commits.length})</Text>
      </Box>

      <Box
        paddingX={1}
        paddingBottom={1}
        gap={1}
        borderStyle="single"
        borderColor={theme.colors.border}
        borderTop={false}
        borderLeft={false}
        borderRight={false}
      >
        <Box width={10}>
          <Text color={theme.colors.muted} bold>
            SHA
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text color={theme.colors.muted} bold>
            Message
          </Text>
        </Box>
        <Box width={16}>
          <Text color={theme.colors.muted} bold>
            Author
          </Text>
        </Box>
        <Box width={14}>
          <Text color={theme.colors.muted} bold>
            Date
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column">
        {visibleCommits.map((commit, index) => (
          <CommitItem
            key={commit.sha}
            commit={commit}
            isFocus={scrollOffset + index === selectedIndex}
          />
        ))}
      </Box>
    </Box>
  )
}
