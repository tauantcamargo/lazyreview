import React, { useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { useTheme } from '../../theme/index'
import { useListNavigation, deriveScrollOffset } from '../../hooks/useListNavigation'
import { useCommitDiff } from '../../hooks/useGitHub'
import { copyToClipboard } from '../../utils/terminal'
import { useStatusMessage } from '../../hooks/useStatusMessage'
import type { Commit } from '../../models/commit'
import { timeAgo } from '../../utils/date'
import { EmptyState } from '../common/EmptyState'
import { stripAnsi } from '../../utils/sanitize'
import { CommitDiffView } from './CommitDiffView'

interface CommitsTabProps {
  readonly commits: readonly Commit[]
  readonly isActive: boolean
  readonly owner: string
  readonly repo: string
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
  const message = stripAnsi(commit.commit.message.split('\n')[0] ?? '')
  const author = commit.author?.login ?? commit.commit.author.name
  const date = commit.commit.author.date

  return (
    <Box
      paddingX={1}
      paddingY={0}
      gap={1}
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
  owner,
  repo,
}: CommitsTabProps): React.ReactElement {
  const { stdout } = useStdout()
  const theme = useTheme()
  const { setStatusMessage } = useStatusMessage()
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 10)
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null)

  const { selectedIndex } = useListNavigation({
    itemCount: commits.length,
    viewportHeight,
    isActive: isActive && selectedCommitSha === null,
  })

  const { data: commitFiles = [], isLoading: commitDiffLoading } = useCommitDiff(
    owner,
    repo,
    selectedCommitSha ?? '',
    { enabled: selectedCommitSha !== null },
  )

  useInput(
    (input, key) => {
      if (key.return && commits[selectedIndex]) {
        setSelectedCommitSha(commits[selectedIndex].sha)
      } else if (input === 'y' && commits[selectedIndex]) {
        const sha = commits[selectedIndex].sha
        if (copyToClipboard(sha)) {
          setStatusMessage(`Copied SHA ${sha.slice(0, 7)} to clipboard`)
        } else {
          setStatusMessage('Failed to copy to clipboard')
        }
      }
    },
    { isActive: isActive && selectedCommitSha === null },
  )

  const scrollOffset = deriveScrollOffset(selectedIndex, viewportHeight, commits.length)
  const visibleCommits = commits.slice(scrollOffset, scrollOffset + viewportHeight)

  if (commits.length === 0) {
    return <EmptyState message="No commits found" />
  }

  // Show commit diff view when a commit is selected
  if (selectedCommitSha !== null) {
    const commit = commits.find((c) => c.sha === selectedCommitSha)
    return (
      <CommitDiffView
        files={commitFiles}
        commitSha={selectedCommitSha}
        commitMessage={commit?.commit.message ?? ''}
        isActive={isActive}
        isLoading={commitDiffLoading}
        onBack={() => setSelectedCommitSha(null)}
      />
    )
  }

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

      <Box flexDirection="column" overflow="hidden" height={viewportHeight}>
        {visibleCommits.map((commit, i) => (
          <CommitItem
            key={commit.sha}
            commit={commit}
            isFocus={scrollOffset + i === selectedIndex}
          />
        ))}
      </Box>
    </Box>
  )
}
