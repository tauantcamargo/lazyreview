import React, { useCallback, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { useTheme } from '../../theme/index'
import { useListNavigation, deriveScrollOffset } from '../../hooks/useListNavigation'
import { useCommitDiff } from '../../hooks/useGitHub'
import { useCommitRange } from '../../hooks/useCommitRange'
import { copyToClipboard } from '../../utils/terminal'
import { useStatusMessage } from '../../hooks/useStatusMessage'
import type { Commit } from '../../models/commit'
import type { CommitRange } from '../../hooks/useCommitRange'
import { timeAgo } from '../../utils/date'
import { EmptyState } from '../common/EmptyState'
import { stripAnsi } from '../../utils/sanitize'
import { CommitDiffView } from './CommitDiffView'

interface CommitsTabProps {
  readonly commits: readonly Commit[]
  readonly isActive: boolean
  readonly owner: string
  readonly repo: string
  readonly onRangeChange?: (range: CommitRange | null) => void
}

function CommitItem({
  commit,
  isFocus,
  isInRange,
}: {
  readonly commit: Commit
  readonly isFocus: boolean
  readonly isInRange: boolean
}): React.ReactElement {
  const theme = useTheme()

  const shortSha = commit.sha.slice(0, 7)
  const message = stripAnsi(commit.commit.message.split('\n')[0] ?? '')
  const author = commit.author?.login ?? commit.commit.author.name
  const date = commit.commit.author.date

  const bgColor = isFocus
    ? theme.colors.selection
    : isInRange
      ? theme.colors.diffAddHighlight
      : undefined

  return (
    <Box
      paddingX={1}
      paddingY={0}
      gap={1}
      backgroundColor={bgColor}
    >
      <Box width={10}>
        <Text color={isInRange ? theme.colors.success : theme.colors.warning} bold={isFocus}>
          {isInRange && !isFocus ? '\u2502 ' : ''}{shortSha}
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

/**
 * Build a CommitRange from the current selection state and end index.
 */
function buildRange(
  commits: readonly Commit[],
  startIdx: number | null,
  endIdx: number,
): CommitRange | null {
  const resolvedStart = startIdx ?? endIdx
  const normalizedStart = Math.min(resolvedStart, endIdx)
  const normalizedEnd = Math.max(resolvedStart, endIdx)
  const startCommit = commits[normalizedStart]
  const endCommit = commits[normalizedEnd]
  if (!startCommit || !endCommit) return null

  return {
    startSha: startCommit.sha,
    endSha: endCommit.sha,
    label: `${startCommit.sha.slice(0, 7)}..${endCommit.sha.slice(0, 7)}`,
    startIndex: normalizedStart,
    endIndex: normalizedEnd,
  }
}

export function CommitsTab({
  commits,
  isActive,
  owner,
  repo,
  onRangeChange,
}: CommitsTabProps): React.ReactElement {
  const { stdout } = useStdout()
  const theme = useTheme()
  const { setStatusMessage } = useStatusMessage()
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 10)
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null)

  const commitRange = useCommitRange()

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

  const completeRangeSelection = useCallback(
    (endIdx: number) => {
      const commit = commits[endIdx]
      if (!commit) return

      commitRange.endSelection(endIdx, commit.sha)
      setStatusMessage('Commit range selected - switch to Files tab to view')

      if (onRangeChange) {
        const range = buildRange(commits, commitRange.startIndex, endIdx)
        onRangeChange(range)
      }
    },
    [commits, commitRange, onRangeChange, setStatusMessage],
  )

  useInput(
    (input, key) => {
      if (input === 'v' && commits[selectedIndex]) {
        if (commitRange.isSelecting) {
          completeRangeSelection(selectedIndex)
        } else {
          commitRange.startSelection(selectedIndex, commits[selectedIndex].sha)
          setStatusMessage('Range start set - move to end commit and press v or Enter')
        }
      } else if (key.return && commits[selectedIndex]) {
        if (commitRange.isSelecting) {
          completeRangeSelection(selectedIndex)
        } else {
          setSelectedCommitSha(commits[selectedIndex].sha)
        }
      } else if (key.escape) {
        if (commitRange.isSelecting || commitRange.range) {
          commitRange.clearRange()
          onRangeChange?.(null)
          setStatusMessage('Commit range cleared')
        }
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
        {commitRange.isSelecting && (
          <Text color={theme.colors.warning} bold>
            -- RANGE SELECT --
          </Text>
        )}
        {commitRange.range && (
          <Text color={theme.colors.info}>
            [{commitRange.range.label}]
          </Text>
        )}
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
        {visibleCommits.map((commit, i) => {
          const absoluteIndex = scrollOffset + i
          return (
            <CommitItem
              key={commit.sha}
              commit={commit}
              isFocus={absoluteIndex === selectedIndex}
              isInRange={commitRange.isInRange(absoluteIndex)}
            />
          )
        })}
      </Box>
    </Box>
  )
}
