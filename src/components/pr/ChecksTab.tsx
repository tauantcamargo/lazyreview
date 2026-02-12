import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { useTheme } from '../../theme/index'
import { useCheckRuns } from '../../hooks/useGitHub'
import { summarizeChecks, type CheckRun } from '../../models/check'
import { useListNavigation, deriveScrollOffset } from '../../hooks/useListNavigation'
import { LoadingIndicator } from '../common/LoadingIndicator'
import { EmptyState } from '../common/EmptyState'

interface ChecksTabProps {
  readonly owner: string
  readonly repo: string
  readonly sha: string
  readonly isActive: boolean
}

function CheckRunRow({
  run,
  isFocus,
}: {
  readonly run: CheckRun
  readonly isFocus: boolean
}): React.ReactElement {
  const theme = useTheme()

  const icon =
    run.status !== 'completed'
      ? '●'
      : run.conclusion === 'success' || run.conclusion === 'neutral' || run.conclusion === 'skipped'
        ? '✓'
        : '✗'

  const color =
    run.status !== 'completed'
      ? theme.colors.warning
      : run.conclusion === 'success' || run.conclusion === 'neutral' || run.conclusion === 'skipped'
        ? theme.colors.success
        : theme.colors.error

  return (
    <Box
      paddingX={1}
      gap={1}
      backgroundColor={isFocus ? theme.colors.selection : undefined}
    >
      <Text color={color}>{icon}</Text>
      <Text
        color={isFocus ? theme.colors.listSelectedFg : theme.colors.text}
        bold={isFocus}
      >
        {run.name}
      </Text>
      {run.status !== 'completed' && (
        <Text color={theme.colors.muted}>({run.status})</Text>
      )}
      {run.status === 'completed' && run.conclusion && run.conclusion !== 'success' && (
        <Text color={theme.colors.muted}>({run.conclusion})</Text>
      )}
    </Box>
  )
}

export function ChecksTab({
  owner,
  repo,
  sha,
  isActive,
}: ChecksTabProps): React.ReactElement {
  const theme = useTheme()
  const { stdout } = useStdout()
  const { data, isLoading } = useCheckRuns(owner, repo, sha)
  const viewportHeight = Math.max(1, (stdout?.rows ?? 24) - 16)

  const checkRuns = data?.check_runs ?? []

  const { selectedIndex } = useListNavigation({
    itemCount: checkRuns.length,
    viewportHeight,
    isActive,
  })

  const scrollOffset = deriveScrollOffset(selectedIndex, viewportHeight, checkRuns.length)
  const visibleRuns = checkRuns.slice(scrollOffset, scrollOffset + viewportHeight)

  if (isLoading) {
    return <LoadingIndicator message="Loading checks..." />
  }

  if (!data || data.total_count === 0) {
    return <EmptyState message="No CI/CD checks found" />
  }

  const summary = summarizeChecks(checkRuns)

  const summaryColor =
    summary.conclusion === 'success'
      ? theme.colors.success
      : summary.conclusion === 'failure'
        ? theme.colors.error
        : theme.colors.warning

  return (
    <Box flexDirection="column" flexGrow={1} minHeight={0} overflow="hidden">
      <Box paddingX={1} paddingY={0} marginBottom={1} gap={2}>
        <Text color={theme.colors.accent} bold>
          CI/CD Checks
        </Text>
        <Text color={summaryColor} bold>
          {summary.passed}/{summary.total} passed
        </Text>
        {summary.failed > 0 && (
          <Text color={theme.colors.error}>({summary.failed} failed)</Text>
        )}
        {summary.pending > 0 && (
          <Text color={theme.colors.warning}>({summary.pending} pending)</Text>
        )}
      </Box>
      <Box flexDirection="column" overflow="hidden" height={viewportHeight}>
        {visibleRuns.map((run, i) => (
          <CheckRunRow
            key={run.id}
            run={run}
            isFocus={scrollOffset + i === selectedIndex}
          />
        ))}
      </Box>
    </Box>
  )
}
