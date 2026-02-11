import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import { useCheckRuns } from '../../hooks/useGitHub'
import { summarizeChecks, type CheckRun } from '../../models/check'

interface CheckStatusSummaryProps {
  readonly owner: string
  readonly repo: string
  readonly sha: string
}

function CheckRunItem({ run }: { readonly run: CheckRun }): React.ReactElement {
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
    <Box gap={1} paddingLeft={4}>
      <Text color={color}>{icon}</Text>
      <Text color={theme.colors.text}>{run.name}</Text>
      {run.status !== 'completed' && (
        <Text color={theme.colors.muted}>({run.status})</Text>
      )}
      {run.status === 'completed' && run.conclusion && run.conclusion !== 'success' && (
        <Text color={theme.colors.muted}>({run.conclusion})</Text>
      )}
    </Box>
  )
}

export function CheckStatusSummary({
  owner,
  repo,
  sha,
}: CheckStatusSummaryProps): React.ReactElement | null {
  const theme = useTheme()
  const { data, isLoading } = useCheckRuns(owner, repo, sha)

  if (isLoading) {
    return (
      <Box paddingLeft={2}>
        <Text color={theme.colors.muted}>Loading checks...</Text>
      </Box>
    )
  }

  if (!data || data.total_count === 0) {
    return null
  }

  const summary = summarizeChecks(data.check_runs)

  const summaryColor =
    summary.conclusion === 'success'
      ? theme.colors.success
      : summary.conclusion === 'failure'
        ? theme.colors.error
        : theme.colors.warning

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box gap={1}>
        <Text color={summaryColor} bold>
          {summary.passed}/{summary.total} checks passed
        </Text>
        {summary.failed > 0 && (
          <Text color={theme.colors.error}>({summary.failed} failed)</Text>
        )}
        {summary.pending > 0 && (
          <Text color={theme.colors.warning}>({summary.pending} pending)</Text>
        )}
      </Box>
      {data.check_runs.map((run) => (
        <CheckRunItem key={run.id} run={run} />
      ))}
    </Box>
  )
}
